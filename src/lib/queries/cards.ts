// ФИЛЬТРЫ, ТИПЫ И ФОРМАТИРОВАНИЕ КАРТОЧЕК И ГРАФИКА МАРКЕТИНГА.
//
// Фильтры едут в URL и применяются при изменении чипа:
//   - from, to        диапазон дат по времени заказа
//   - country         страна пользователя: KZ|UZ|KG|TJ|MN|all
//   - orderCreator    канал ЗАКАЗА: значение | all
//   - userCreator     канал РЕГИСТРАЦИИ: значение | all
//   - regFrom, regTo  период регистрации (когорта), '' = выкл
//   - basis           выручка gross (все заказы) | paid (только оплаченные)
//   - excludeB2b      исключать корпоративные аккаунты (>50 заказов в месяц)
//
// В продакшене здесь же лежали SQL-билдеры под ClickHouse (buildOverviewSql и др.).
// В демо запросы исполняет синтетическое хранилище src/lib/demo/warehouse.ts,
// а слой метрик (src/lib/metrics.ts) вызывает его через те же фильтры.

import { ORDER_CHANNELS, USER_CHANNELS } from "@/lib/demo/dims";

export type RevenueBasis = "gross" | "paid";
export type Grain = "day" | "week" | "month";

export type CardFilters = {
  from: string; // YYYY-MM-DD, дата заказа с
  to: string; // YYYY-MM-DD, дата заказа по (включительно по дню)
  country: string; // код страны или 'all'
  orderCreator: string; // значение или 'all'
  userCreator: string; // значение или 'all'
  regFrom: string; // YYYY-MM-DD, период регистрации с ('' = без фильтра)
  regTo: string; // YYYY-MM-DD, период регистрации по ('' = без фильтра)
  basis: RevenueBasis;
  excludeB2b: boolean;
  grain: Grain; // гранулярность графика
};

// Активен ли когортный фильтр по дате регистрации.
export function regActive(f: CardFilters): boolean {
  return Boolean(f.regFrom && f.regTo);
}

export const COUNTRIES = [
  { code: "all", label: "Все страны" },
  { code: "KZ", label: "Казахстан" },
  { code: "UZ", label: "Узбекистан" },
  { code: "KG", label: "Кыргызстан" },
  { code: "TJ", label: "Таджикистан" },
  { code: "MN", label: "Монголия" },
];

// Списки каналов для выпадашек (до ответа /api/meta/creators).
export const FALLBACK_CREATORS: string[] = [...ORDER_CHANNELS];
export const FALLBACK_USER_CREATORS: string[] = [...USER_CHANNELS];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function defaultFilters(): CardFilters {
  return {
    from: isoDaysAgo(7),
    to: new Date().toISOString().slice(0, 10),
    country: "KZ",
    orderCreator: "all",
    userCreator: "all",
    regFrom: "",
    regTo: "",
    basis: "gross",
    excludeB2b: false,
    grain: "day",
  };
}

export type DailyPoint = {
  date: string;
  revenue: number;
  orders: number;
  buyers: number;
  weight: number;
  registrations: number;
};

export type CardUnit = "currency" | "currency2" | "count" | "weight" | "percent";

const num = (v: number | string): number => Number(v ?? 0);

export { num };

export function formatCardValue(unit: CardUnit, value: number): string {
  switch (unit) {
    case "currency":
      return "$" + Math.round(value).toLocaleString("ru-RU");
    case "currency2":
      return "$" + value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "weight":
      return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " кг";
    case "percent":
      return value.toFixed(1) + "%";
    default:
      return Math.round(value).toLocaleString("ru-RU");
  }
}

export function deltaPct(value: number, prev: number): number | null {
  if (!prev) return null;
  return ((value - prev) / prev) * 100;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Разбор фильтров из query-параметров (URL) с дефолтами.
export function parseFilters(sp: Record<string, string | string[] | undefined>): CardFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const d = defaultFilters();

  const from = one(sp.from);
  const to = one(sp.to);
  const country = one(sp.country);
  const orderCreator = one(sp.ocreator);
  const userCreator = one(sp.ucreator);
  const regFrom = one(sp.rfrom);
  const regTo = one(sp.rto);
  const basis = one(sp.basis) === "paid" ? "paid" : "gross";
  const grainRaw = one(sp.grain);
  const grain: Grain = grainRaw === "week" || grainRaw === "month" ? grainRaw : "day";

  // Пустой явный параметр (from=) означает «не задан» -> данные за период по умолчанию.
  // Отсутствие параметра -> дефолтный период (посадочная страница).
  return {
    from: from === "" ? "" : from && ISO.test(from) ? from : d.from,
    to: to === "" ? "" : to && ISO.test(to) ? to : d.to,
    country: country || d.country,
    orderCreator: orderCreator || d.orderCreator,
    userCreator: userCreator || d.userCreator,
    regFrom: regFrom && ISO.test(regFrom) ? regFrom : "",
    regTo: regTo && ISO.test(regTo) ? regTo : "",
    basis,
    excludeB2b: one(sp.b2b) === "exclude",
    grain,
  };
}

// Диапазон дат для подписей: «17.09 – 24.09.2026» (год один раз, если совпадает).
export function formatRange(from: string, to: string): string {
  if (!from || !to) return "";
  const [fy, fm, fd] = from.split("-");
  const [ty, tm, td] = to.split("-");
  return fy === ty ? `${fd}.${fm} – ${td}.${tm}.${ty}` : `${fd}.${fm}.${fy} – ${td}.${tm}.${ty}`;
}
