import { cacheGet, cacheSet, isFresh, logRun } from "@/lib/cache";
import {
  formatCardValue,
  deltaPct,
  regActive,
  defaultFilters,
  COUNTRIES,
  type DailyPoint,
  type CardFilters,
  type CardUnit,
} from "@/lib/queries/cards";
import {
  queryOverview,
  queryRegistrations,
  queryDaily,
  queryDailyRegs,
  queryByOrderChannel,
  queryByCountry,
  queryReactivation,
  dayOf,
  type Agg,
  type OrderFilter,
  type UserFilter,
} from "@/lib/demo/warehouse";

// СЛОЙ МЕТРИК. Единая точка, через которую экраны, дашборды, алерты и ИИ-агент
// получают цифры: расчёт + кеш по ключу фильтров + журнал запусков.
// В продакшене compute* ходят в ClickHouse; в демо их обслуживает синтетическое
// хранилище (src/lib/demo/warehouse.ts) с тем же набором агрегатов.

export type CardResult = {
  code: string;
  title: string;
  value: string;
  deltaPct: number | null;
};

export type OverviewRaw = {
  registrations: number;
  cohortBuyers: number;     // купили в периоде из зарегистрированных в периоде (для воронки)
  cohortPaidBuyers: number; // из них оплатили
  buyers: number;
  paidBuyers: number;
  orders: number;
  revenue: number;
  weight: number;
};

export type CardsResponse = {
  configured: boolean;
  cards: CardResult[];
  raw?: OverviewRaw;
  error?: string;
};

export type DailyResponse = {
  configured: boolean;
  points: DailyPoint[];
  error?: string;
};

type Opts = { force?: boolean; source?: "request" | "schedule" };

const DAY_MS = 86_400_000;

function toDate(s: string): Date {
  return new Date(s + "T00:00:00Z");
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function shiftDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}
function ddmm(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}
function startOfWeek(d: Date): Date {
  const back = (d.getUTCDay() + 6) % 7; // к понедельнику
  return shiftDays(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), -back);
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit", timeZone: "UTC" });
}
// Список бакетов [from, toExcl) по гранулярности: ключ = дата начала, подпись для оси.
function bucketList(from: Date, toExcl: Date, grain: "day" | "week" | "month"): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (grain === "month") {
    let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    while (d < toExcl) {
      out.push({ key: fmt(d), label: monthLabel(d) });
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    }
  } else if (grain === "week") {
    let d = startOfWeek(from);
    while (d < toExcl) { out.push({ key: fmt(d), label: ddmm(d) }); d = shiftDays(d, 7); }
  } else {
    let d = new Date(from);
    while (d < toExcl) { out.push({ key: fmt(d), label: ddmm(d) }); d = shiftDays(d, 1); }
  }
  return out;
}

// Нижняя граница для «не задан»: фактически без фильтра по времени заказа (все данные).
const UNBOUNDED_FROM = "2000-01-01";

function windows(f: CardFilters) {
  // Период заказа «не задан» (пусто) -> без фильтра по времени (весь период).
  const now = new Date();
  const hasFrom = Boolean(f.from);
  const hasTo = Boolean(f.to);
  const fromStr = f.from || UNBOUNDED_FROM;
  const toStr = f.to || fmt(now);
  const from = toDate(fromStr);
  const toExcl = shiftDays(toDate(toStr), 1);
  const lenDays = Math.max(1, Math.round((toExcl.getTime() - from.getTime()) / DAY_MS));
  const prevFrom = shiftDays(from, -lenDays);
  // Сравнение с прошлым периодом имеет смысл только при заданной нижней границе.
  return { from, toExcl, prevFrom, lenDays, hasFrom, hasTo };
}
function regWindow(f: CardFilters, orderFrom: string, orderToExcl: string) {
  if (regActive(f)) return { regFrom: f.regFrom, regTo: fmt(shiftDays(toDate(f.regTo), 1)) };
  return { regFrom: orderFrom, regTo: orderToExcl };
}

// Короткая подпись среза для лога/истории.
export function describeFilters(f: CardFilters): string {
  const country = COUNTRIES.find((c) => c.code === f.country)?.label ?? f.country;
  const parts = [country];
  parts.push(f.userCreator === "all" ? "клиент: все" : `клиент: ${f.userCreator}`);
  if (f.orderCreator !== "all") parts.push(`заказ: ${f.orderCreator}`);
  parts.push(`${f.from || "…"}..${f.to || "…"}`);
  if (regActive(f)) parts.push(`рег ${f.regFrom}..${f.regTo}`);
  if (f.basis === "paid") parts.push("оплачено");
  if (f.excludeB2b) parts.push("без B2B");
  return parts.join(" · ");
}

// Фильтр пользователя (страна, канал регистрации, опционально когорта).
function userFilter(f: CardFilters, withCohort: boolean): UserFilter {
  const uf: UserFilter = { country: f.country, userChannel: f.userCreator };
  if (withCohort && regActive(f)) {
    uf.regFrom = dayOf(f.regFrom);
    uf.regToExcl = dayOf(f.regTo) + 1;
  }
  return uf;
}
function orderFilter(f: CardFilters, from: Date, toExcl: Date): OrderFilter {
  return { from: dayOf(fmt(from)), toExcl: dayOf(fmt(toExcl)), orderChannel: f.orderCreator, excludeB2b: f.excludeB2b };
}
function registrations(f: CardFilters, regFrom: string, regToExcl: string): number {
  return queryRegistrations({ ...userFilter(f, false), regFrom: dayOf(regFrom), regToExcl: dayOf(regToExcl) });
}

const EMPTY: Agg = { orders: 0, buyers: 0, paidBuyers: 0, revenue: 0, revenuePaid: 0, weight: 0 };

// --- Сырой расчёт карточек (со сравнением с прошлым периодом) ---
async function computeCards(f: CardFilters): Promise<CardsResponse> {
  const { from, toExcl, prevFrom, hasFrom } = windows(f);
  const cohort = regActive(f);
  // Стрелка сравнения – только когда есть нижняя граница периода (иначе прошлого нет).
  const noPrev = cohort || !hasFrom;

  try {
    const curRegWin = regWindow(f, fmt(from), fmt(toExcl));
    const prevRegWin = regWindow(f, fmt(prevFrom), fmt(from));
    const uf = userFilter(f, true);

    const cur = queryOverview(orderFilter(f, from, toExcl), uf);
    const prev = noPrev ? EMPTY : queryOverview(orderFilter(f, prevFrom, from), uf);
    const regCur = registrations(f, curRegWin.regFrom, curRegWin.regTo);
    const regPrev = noPrev ? 0 : registrations(f, prevRegWin.regFrom, prevRegWin.regTo);

    const revenueOf = (r: Agg) => (f.basis === "paid" ? r.revenuePaid : r.revenue);
    const avg = (r: Agg) => (r.orders ? revenueOf(r) / r.orders : 0);

    const mk = (code: string, title: string, unit: CardUnit, value: number, prevValue: number): CardResult => ({
      code,
      title,
      value: formatCardValue(unit, value),
      deltaPct: noPrev ? null : deltaPct(value, prevValue),
    });

    const conv = (buyers: number, reg: number) => (reg ? (buyers / reg) * 100 : 0);
    // Конверсия имеет смысл только с когортой: тогда покупатели входят в когорту и доля
    // не больше 100%. Без когорты знаменатель и числитель несопоставимы.
    const convCard = cohort
      ? [mk("conversion", "Конверсия", "percent", conv(cur.buyers, regCur), conv(prev.buyers, regPrev))]
      : [];

    const cards: CardResult[] = [
      mk("registrations", "Регистрации", "count", regCur, regPrev),
      mk("buyers", "Покупатели", "count", cur.buyers, prev.buyers),
      ...convCard,
      mk("orders", "Заказы", "count", cur.orders, prev.orders),
      mk("avg_check", "Средний чек", "currency2", avg(cur), avg(prev)),
      mk("weight_kg", "Вес, кг", "weight", cur.weight, prev.weight),
      mk("revenue", f.basis === "paid" ? "Выручка (оплачено)" : "Выручка", "currency", revenueOf(cur), revenueOf(prev)),
    ];

    // Воронка считается по когорте: покупатели среди зарегистрированных в окне регистрации.
    // В когортном режиме это те же покупатели, что в карточке.
    const cohortAgg = cohort ? cur : queryOverview(orderFilter(f, from, toExcl), {
      ...uf, regFrom: dayOf(curRegWin.regFrom), regToExcl: dayOf(curRegWin.regTo),
    });

    const raw: OverviewRaw = {
      registrations: regCur,
      cohortBuyers: cohortAgg.buyers,
      cohortPaidBuyers: cohortAgg.paidBuyers,
      buyers: cur.buyers,
      paidBuyers: cur.paidBuyers,
      orders: cur.orders,
      revenue: revenueOf(cur),
      weight: cur.weight,
    };

    return { configured: true, cards, raw };
  } catch (err) {
    return { configured: true, cards: [], error: String(err) };
  }
}

// --- Сырой расчёт ряда по периодам ---
async function computeDaily(f: CardFilters): Promise<DailyResponse> {
  const { from, toExcl, hasFrom } = windows(f);

  try {
    const orderRows = queryDaily(orderFilter(f, from, toExcl), userFilter(f, true), f.grain);
    const regs = queryDailyRegs(userFilter(f, false), dayOf(fmt(from)), dayOf(fmt(toExcl)), f.grain);

    const orders = new Map<string, { revenue: number; orders: number; buyers: number; weight: number }>();
    for (const [day, r] of orderRows) {
      orders.set(day, {
        revenue: f.basis === "paid" ? r.revenuePaid : r.revenue,
        orders: r.orders,
        buyers: r.buyers,
        weight: r.weight,
      });
    }

    // При «не задан» (нет нижней границы) не рисуем пустые бакеты от 2000 года:
    // начинаем ось от самой ранней даты, где реально есть данные.
    let startBuckets = from;
    if (!hasFrom) {
      const keys = [...orders.keys(), ...regs.keys()].sort();
      if (keys.length === 0) return { configured: true, points: [] };
      startBuckets = toDate(keys[0]);
    }

    const points: DailyPoint[] = bucketList(startBuckets, toExcl, f.grain).map((b) => {
      const o = orders.get(b.key);
      return {
        date: b.label,
        revenue: o?.revenue ?? 0,
        orders: o?.orders ?? 0,
        buyers: o?.buyers ?? 0,
        weight: o?.weight ?? 0,
        registrations: regs.get(b.key) ?? 0,
      };
    });

    return { configured: true, points };
  } catch (err) {
    return { configured: true, points: [], error: String(err) };
  }
}

// --- Кешируемые обёртки ---
function keyOf(kind: string, f: CardFilters): string {
  return kind + ":" + JSON.stringify(f);
}

export async function getCards(f: CardFilters = defaultFilters(), opts: Opts = {}): Promise<CardsResponse> {
  // grain влияет только на ряд, не на карточки: исключаем из ключа,
  // чтобы переключение гранулярности не пересчитывало карточки заново.
  const key = keyOf("cards", { ...f, grain: "day" });
  const hit = cacheGet<CardsResponse>(key);
  if (!opts.force && hit && isFresh(hit.at)) return hit.data;

  const t = Date.now();
  const data = await computeCards(f);
  if (data.configured) cacheSet(key, data);
  logRun({ at: Date.now(), label: describeFilters(f), kind: "cards", ms: Date.now() - t, ok: !data.error, source: opts.source ?? "request" });
  return data;
}

export async function getDaily(f: CardFilters = defaultFilters(), opts: Opts = {}): Promise<DailyResponse> {
  const key = keyOf("daily", f);
  const hit = cacheGet<DailyResponse>(key);
  if (!opts.force && hit && isFresh(hit.at)) return hit.data;

  const t = Date.now();
  const data = await computeDaily(f);
  if (data.configured) cacheSet(key, data);
  logRun({ at: Date.now(), label: describeFilters(f), kind: "daily", ms: Date.now() - t, ok: !data.error, source: opts.source ?? "request" });
  return data;
}

export type ChannelResult = { channel: string; orders: number; buyers: number; revenue: number };
export type ChannelsResponse = { configured: boolean; channels: ChannelResult[]; error?: string };

export async function getChannels(f: CardFilters = defaultFilters()): Promise<ChannelsResponse> {
  const key = "channels:" + JSON.stringify({ from: f.from, to: f.to, country: f.country, basis: f.basis, b2b: f.excludeB2b });
  const hit = cacheGet<ChannelsResponse>(key);
  if (hit && isFresh(hit.at)) return hit.data;

  const { from, toExcl } = windows(f);
  try {
    const rows = queryByOrderChannel(orderFilter({ ...f, orderCreator: "all" }, from, toExcl), { country: f.country });
    const channels: ChannelResult[] = rows.map((r) => ({
      channel: r.channel,
      orders: r.agg.orders,
      buyers: r.agg.buyers,
      revenue: f.basis === "paid" ? r.agg.revenuePaid : r.agg.revenue,
    }));
    const data: ChannelsResponse = { configured: true, channels };
    cacheSet(key, data);
    return data;
  } catch (err) {
    return { configured: true, channels: [], error: String(err) };
  }
}

// --- Реактивация (спячка >= dormancyDays) ---
export type ReactResult = { configured: boolean; react: number; buyers: number; reactFirst: number; reactRepeat: number; error?: string };
export type ReactCountryResult = { configured: boolean; countries: { country: string; react: number; buyers: number; reactFirst: number; reactRepeat: number }[]; error?: string };

export async function getReactivation(f: CardFilters = defaultFilters(), dormancyDays = 180): Promise<ReactResult> {
  const key = "react:" + JSON.stringify({ from: f.from, to: f.to, country: f.country, oc: f.orderCreator, uc: f.userCreator, d: dormancyDays });
  const hit = cacheGet<ReactResult>(key);
  if (hit && isFresh(hit.at)) return hit.data;
  const { from, toExcl } = windows(f);
  try {
    const r = queryReactivation(orderFilter(f, from, toExcl), { country: f.country, userChannel: f.userCreator }, dormancyDays, false)[0];
    const data: ReactResult = { configured: true, react: r.react, buyers: r.buyers, reactFirst: r.reactFirst, reactRepeat: r.reactRepeat };
    cacheSet(key, data);
    return data;
  } catch (err) {
    return { configured: true, react: 0, buyers: 0, reactFirst: 0, reactRepeat: 0, error: String(err) };
  }
}

export async function getReactivationByCountry(f: CardFilters = defaultFilters(), dormancyDays = 180): Promise<ReactCountryResult> {
  const key = "react-country:" + JSON.stringify({ from: f.from, to: f.to, oc: f.orderCreator, uc: f.userCreator, d: dormancyDays });
  const hit = cacheGet<ReactCountryResult>(key);
  if (hit && isFresh(hit.at)) return hit.data;
  const { from, toExcl } = windows(f);
  try {
    const rows = queryReactivation(orderFilter(f, from, toExcl), { userChannel: f.userCreator }, dormancyDays, true);
    const data: ReactCountryResult = { configured: true, countries: rows };
    cacheSet(key, data);
    return data;
  } catch (err) {
    return { configured: true, countries: [], error: String(err) };
  }
}

export type CountryResult = { country: string; orders: number; buyers: number; revenue: number };
export type CountriesResponse = { configured: boolean; countries: CountryResult[]; error?: string };

export async function getByCountry(f: CardFilters = defaultFilters()): Promise<CountriesResponse> {
  const key = "country:" + JSON.stringify({ from: f.from, to: f.to, ocreator: f.orderCreator, basis: f.basis, b2b: f.excludeB2b });
  const hit = cacheGet<CountriesResponse>(key);
  if (hit && isFresh(hit.at)) return hit.data;

  const { from, toExcl } = windows(f);
  try {
    const rows = queryByCountry(orderFilter(f, from, toExcl));
    const countries: CountryResult[] = rows.map((r) => ({
      country: r.country,
      orders: r.agg.orders,
      buyers: r.agg.buyers,
      revenue: f.basis === "paid" ? r.agg.revenuePaid : r.agg.revenue,
    }));
    const data: CountriesResponse = { configured: true, countries };
    cacheSet(key, data);
    return data;
  } catch (err) {
    return { configured: true, countries: [], error: String(err) };
  }
}
