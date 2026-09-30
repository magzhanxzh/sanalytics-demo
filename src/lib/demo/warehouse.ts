import "server-only";
import { mulberry32, hashSeed, lognormal, exponential, pick, normal, type Rng } from "./prng";
import {
  COUNTRY_CODES, COUNTRY_WEIGHTS, USER_CHANNELS, USER_CHANNEL_WEIGHTS,
  ORDER_CHANNELS, ORDER_CHANNEL_WEIGHTS, ORDER_CHANNEL_MEDIAN_PRICE,
  SOURCES_BY_COUNTRY, SOURCE_CONV, CAMPAIGNS,
} from "./dims";

// SYNTHETIC STORE (demo replacement for ClickHouse + PostgreSQL).
//
// In production metrics are SQL queries against the DWH. Here the same set of facts
// (users, orders) is generated deterministically from a seed and stored as columns
// in typed arrays, and the metrics layer queries run as scans over these columns.
// The function interface mirrors the shape of the SQL aggregates, so the metrics layer, cache and
// dashboard resolver run on top of it unchanged.
//
// All dates are day numbers since the epoch (UTC). Windows are half-open: [from, toExcl).

const SEED = 20240101;
export const DAY_MS = 86_400_000;
export const START_DAY = Math.floor(Date.UTC(2024, 0, 1) / DAY_MS);

export const dayOf = (iso: string): number => Math.floor(Date.parse(iso + "T00:00:00Z") / DAY_MS);
export const isoOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);
export const todayDay = (): number => Math.floor(Date.now() / DAY_MS);

// The user's AF group: how the MMP sees them.
export const AF_TARGET = 0, AF_ORGANIC = 1, AF_RESTRICTED = 2, AF_NONE = 3;

type Store = {
  builtFor: number; // the day data is generated up to
  nUsers: number;
  uRegDay: Int32Array;
  uCountry: Uint8Array;
  uChannel: Uint8Array;
  uAfGroup: Uint8Array;
  uAfSource: Uint8Array; // AD_SOURCES index (for paid)
  uCampaign: Int16Array; // index into campaignNames, -1 = none
  uB2b: Uint8Array;
  uOrdStart: Int32Array; // user orders: [uOrdStart[i], uOrdStart[i+1]) in time order
  nOrders: number;
  oUser: Int32Array;
  oDay: Int32Array;
  oChannel: Uint8Array;
  oPrice: Float32Array;
  oWeight: Float32Array;
  oPaid: Uint8Array;
  byDay: Int32Array;     // order permutation sorted by day
  dayStart: Int32Array;  // byDay[dayStart[d-START_DAY] .. dayStart[d-START_DAY+1])
  campaignNames: string[];
};

const campaignNames: string[] = [];
const campaignIndex = new Map<string, number>();
for (const [cc, list] of Object.entries(SOURCES_BY_COUNTRY)) {
  for (const { source } of list) {
    for (const base of CAMPAIGNS[source]) {
      const name = `${base}_${cc}`;
      campaignIndex.set(`${source}|${cc}|${base}`, campaignNames.length);
      campaignNames.push(name);
    }
  }
}

// Sign-ups per day: ~30% yearly growth, seasonality, weekends, promo spikes.
function regsForDay(day: number, rng: Rng): number {
  const d = new Date(day * DAY_MS);
  const years = (day - START_DAY) / 365;
  const month = d.getUTCMonth();
  const dow = d.getUTCDay();
  const season = [0.9, 0.93, 1, 1, 0.98, 0.95, 0.94, 0.97, 1.03, 1.06, 1.25, 1.12][month];
  const weekend = dow === 0 || dow === 6 ? 0.86 : 1;
  const promo = d.getUTCDate() >= 9 && d.getUTCDate() <= 12 && (month === 2 || month === 10) ? 1.35 : 1;
  const base = 92 * (1 + 0.3 * years);
  return Math.max(10, Math.round(base * season * weekend * promo * (1 + 0.1 * normal(rng))));
}

function build(horizon: number): Store {
  const uRegDay: number[] = [], uCountry: number[] = [], uChannel: number[] = [];
  const uAfGroup: number[] = [], uAfSource: number[] = [], uCampaign: number[] = [], uB2b: number[] = [];
  const uOrdStart: number[] = [];
  const oUser: number[] = [], oDay: number[] = [], oChannel: number[] = [];
  const oPrice: number[] = [], oWeight: number[] = [], oPaid: number[] = [];

  const addOrder = (u: number, day: number, ch: number, rng: Rng, medianPrice: number) => {
    const price = Math.min(900, Math.max(2, lognormal(rng, medianPrice, 0.65)));
    const weight = Math.max(0.1, (price / 19) * lognormal(rng, 1, 0.35));
    oUser.push(u); oDay.push(day); oChannel.push(ch);
    oPrice.push(Math.round(price * 100) / 100);
    oWeight.push(Math.round(weight * 100) / 100);
    oPaid.push(rng() < 0.93 ? 1 : 0);
  };

  // B2B accounts: a few business customers with dozens of orders a month.
  const b2bRng = mulberry32(hashSeed(SEED, 777));
  const b2bRegDays = new Map<number, number>(); // sign-up day -> how many B2B that day
  for (let k = 0; k < 12; k++) {
    const day = START_DAY + 20 + Math.floor(b2bRng() * 560);
    b2bRegDays.set(day, (b2bRegDays.get(day) ?? 0) + 1);
  }

  for (let day = START_DAY; day <= horizon; day++) {
    const dayRng = mulberry32(hashSeed(SEED, day));
    const n = regsForDay(day, dayRng) + (b2bRegDays.get(day) ?? 0);
    const nB2b = b2bRegDays.get(day) ?? 0;

    for (let k = 0; k < n; k++) {
      const u = uRegDay.length;
      const rng = mulberry32(hashSeed(day, k + 1));
      const isB2b = k < nB2b;
      const country = isB2b ? 0 : pick(rng, COUNTRY_WEIGHTS);
      const cc = COUNTRY_CODES[country];
      const channel = isB2b ? 1 : pick(rng, USER_CHANNEL_WEIGHTS);

      // How the MMP sees the user: only the app is tracked.
      let afGroup = AF_NONE, afSource = 0, campaign = -1;
      if (channel === 0) {
        const r = rng();
        const sources = SOURCES_BY_COUNTRY[cc];
        const targetShare = sources ? 0.6 : 0;
        if (r < targetShare) {
          afGroup = AF_TARGET;
          const s = sources![pick(rng, sources!.map((x) => x.weight))];
          afSource = s.source;
          const bases = CAMPAIGNS[afSource];
          const base = bases[pick(rng, bases.map((_, i) => 1 / (i + 1)))];
          campaign = campaignIndex.get(`${afSource}|${cc}|${base}`) ?? -1;
        } else if (r < 0.94) afGroup = AF_ORGANIC;
        else if (r < 0.975) afGroup = AF_RESTRICTED;
      }

      uRegDay.push(day); uCountry.push(country); uChannel.push(channel);
      uAfGroup.push(afGroup); uAfSource.push(afSource); uCampaign.push(campaign); uB2b.push(isB2b ? 1 : 0);
      uOrdStart.push(oUser.length);

      if (isB2b) {
        // 55-90 orders a month since sign-up
        let d = day + 1;
        const perMonth = 55 + Math.floor(rng() * 35);
        while (d <= horizon) {
          const count = Math.round(perMonth * (0.85 + 0.3 * rng()));
          for (let j = 0; j < count; j++) {
            const od = d + Math.floor(rng() * 30);
            if (od <= horizon) addOrder(u, od, rng() < 0.7 ? 0 : 3, rng, 38);
          }
          d += 30;
        }
        // B2B orders are generated out of day order, so sort the user's tail
        sortTail(oUser, oDay, oChannel, oPrice, oWeight, oPaid, uOrdStart[u]);
        continue;
      }

      // Will they become a buyer.
      const countryConv = [1, 0.85, 0.9, 0.7, 0.8][country];
      const channelConv = [1, 0.8, 1.3][channel];
      const afConv = afGroup === AF_TARGET ? SOURCE_CONV[afSource] : afGroup === AF_ORGANIC ? 1.35 : 1;
      const pBuy = Math.min(0.9, 0.36 * countryConv * channelConv * afConv);
      if (rng() >= pBuy) continue;

      // First purchase: usually in the first days, sometimes months later.
      const rr = rng();
      let od = day + (rr < 0.62 ? Math.floor(rng() * 4) : rr < 0.84 ? 4 + Math.floor(rng() * 27) : 31 + Math.floor(exponential(rng, 70)));
      // Meta customers more often come for cheap impulse buys and return less.
      const isMeta = afGroup === AF_TARGET && afSource === 2;
      const priceMult = isMeta ? 0.25 : 1;
      const nOrders = 1 + Math.min(80, Math.floor(exponential(rng, Math.exp((isMeta ? 0.2 : 1) + 0.9 * normal(rng)))));
      const primary = pick(rng, ORDER_CHANNEL_WEIGHTS);
      const gapMean = 18 + 40 * rng();
      for (let j = 0; j < nOrders && od <= horizon; j++) {
        const ch = rng() < 0.75 ? primary : pick(rng, ORDER_CHANNEL_WEIGHTS);
        addOrder(u, od, ch, rng, ORDER_CHANNEL_MEDIAN_PRICE[ch] * priceMult);
        // sometimes a customer disappears for a long time and then comes back (reactivation)
        const gap = rng() < 0.07 ? 180 + Math.floor(rng() * 240) : 1 + Math.floor(exponential(rng, gapMean));
        od += gap;
      }
    }
  }
  const nUsers = uRegDay.length;
  uOrdStart.push(oUser.length);

  // Order index by day (counting sort).
  const nDays = horizon - START_DAY + 1;
  const counts = new Int32Array(nDays + 1);
  for (const d of oDay) counts[d - START_DAY + 1]++;
  for (let i = 1; i <= nDays; i++) counts[i] += counts[i - 1];
  const dayStart = Int32Array.from(counts);
  const cursor = Int32Array.from(counts);
  const byDay = new Int32Array(oDay.length);
  for (let i = 0; i < oDay.length; i++) byDay[cursor[oDay[i] - START_DAY]++] = i;

  // B2B by volume: > 50 orders in any month.
  const b2b = Uint8Array.from(uB2b);
  for (let u = 0; u < nUsers; u++) {
    const a = uOrdStart[u], b = uOrdStart[u + 1];
    if (b - a <= 50 || b2b[u]) continue;
    const perMonth = new Map<number, number>();
    for (let i = a; i < b; i++) {
      const m = monthIndex(oDay[i]);
      const c = (perMonth.get(m) ?? 0) + 1;
      perMonth.set(m, c);
      if (c > 50) { b2b[u] = 1; break; }
    }
  }

  return {
    builtFor: horizon,
    nUsers,
    uRegDay: Int32Array.from(uRegDay), uCountry: Uint8Array.from(uCountry), uChannel: Uint8Array.from(uChannel),
    uAfGroup: Uint8Array.from(uAfGroup), uAfSource: Uint8Array.from(uAfSource), uCampaign: Int16Array.from(uCampaign),
    uB2b: b2b, uOrdStart: Int32Array.from(uOrdStart),
    nOrders: oUser.length,
    oUser: Int32Array.from(oUser), oDay: Int32Array.from(oDay), oChannel: Uint8Array.from(oChannel),
    oPrice: Float32Array.from(oPrice), oWeight: Float32Array.from(oWeight), oPaid: Uint8Array.from(oPaid),
    byDay, dayStart, campaignNames,
  };
}

// Sort one user's orders by day starting at position from.
function sortTail(
  user: number[], day: number[], ch: number[], price: number[], weight: number[], paid: number[], from: number,
) {
  const idx = Array.from({ length: day.length - from }, (_, i) => from + i).sort((a, b) => day[a] - day[b]);
  const cols = [user, day, ch, price, weight, paid];
  for (const col of cols) {
    const copy = idx.map((i) => col[i]);
    for (let i = 0; i < copy.length; i++) col[from + i] = copy[i];
  }
}

export function monthIndex(day: number): number {
  const d = new Date(day * DAY_MS);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

// The store lives on globalThis to survive HMR in dev and not rebuild on every request.
const g = globalThis as unknown as { __sanalyticsStore?: Store };
export function store(): Store {
  const today = todayDay();
  if (!g.__sanalyticsStore || g.__sanalyticsStore.builtFor !== today) g.__sanalyticsStore = build(today);
  return g.__sanalyticsStore;
}

export const userIdOf = (u: number): string => "u" + String(100000 + u);

/* ============================== Queries ============================== */

export type UserFilter = {
  country?: string;      // code or 'all'
  userChannel?: string;  // sign-up channel or 'all'
  regFrom?: number;      // cohort: sign-up day from
  regToExcl?: number;    // cohort: to (exclusive)
};
export type OrderFilter = {
  from: number;
  toExcl: number;
  orderChannel?: string; // order channel or 'all'
  excludeB2b?: boolean;
};

const countryIdx = (c?: string) => (c && c !== "all" ? COUNTRY_CODES.indexOf(c as (typeof COUNTRY_CODES)[number]) : -1);
const userChIdx = (c?: string) => (c && c !== "all" ? USER_CHANNELS.indexOf(c as (typeof USER_CHANNELS)[number]) : -1);
const orderChIdx = (c?: string) => (c && c !== "all" ? ORDER_CHANNELS.indexOf(c as (typeof ORDER_CHANNELS)[number]) : -1);

function userPredicate(s: Store, f: UserFilter): (u: number) => boolean {
  const ci = countryIdx(f.country);
  const uc = userChIdx(f.userChannel);
  const unknownCountry = f.country && f.country !== "all" && ci < 0; // e.g. '__none__' = no access
  const unknownCh = f.userChannel && f.userChannel !== "all" && uc < 0;
  if (unknownCountry || unknownCh) return () => false;
  return (u) =>
    (ci < 0 || s.uCountry[u] === ci) &&
    (uc < 0 || s.uChannel[u] === uc) &&
    (f.regFrom === undefined || s.uRegDay[u] >= f.regFrom) &&
    (f.regToExcl === undefined || s.uRegDay[u] < f.regToExcl);
}

// Scan the window's orders with order and user filters.
function scanOrders(s: Store, of: OrderFilter, uf: UserFilter, fn: (o: number, u: number) => void) {
  const oc = orderChIdx(of.orderChannel);
  if (of.orderChannel && of.orderChannel !== "all" && oc < 0) return;
  const keepUser = userPredicate(s, uf);
  const from = Math.max(of.from, START_DAY);
  const toExcl = Math.min(of.toExcl, s.builtFor + 1);
  if (toExcl <= from) return;
  const a = s.dayStart[from - START_DAY], b = s.dayStart[toExcl - START_DAY];
  for (let k = a; k < b; k++) {
    const o = s.byDay[k];
    if (oc >= 0 && s.oChannel[o] !== oc) continue;
    const u = s.oUser[o];
    if (of.excludeB2b && s.uB2b[u]) continue;
    if (!keepUser(u)) continue;
    fn(o, u);
  }
}

export type Agg = { orders: number; buyers: number; paidBuyers: number; revenue: number; revenuePaid: number; weight: number };

class AggBuilder {
  orders = 0; revenue = 0; revenuePaid = 0; weight = 0;
  buyers = new Set<number>(); paid = new Set<number>();
  add(s: Store, o: number, u: number) {
    this.orders++;
    this.revenue += s.oPrice[o];
    this.weight += s.oWeight[o];
    this.buyers.add(u);
    if (s.oPaid[o]) { this.revenuePaid += s.oPrice[o]; this.paid.add(u); }
  }
  done(): Agg {
    return {
      orders: this.orders, buyers: this.buyers.size, paidBuyers: this.paid.size,
      revenue: Math.round(this.revenue), revenuePaid: Math.round(this.revenuePaid),
      weight: Math.round(this.weight * 100) / 100,
    };
  }
}

// Summary aggregate for the window (like buildOverviewSql).
export function queryOverview(of: OrderFilter, uf: UserFilter): Agg {
  const s = store();
  const acc = new AggBuilder();
  scanOrders(s, of, uf, (o, u) => acc.add(s, o, u));
  return acc.done();
}

// Sign-ups for the window (like buildRegistrationsSql).
export function queryRegistrations(uf: UserFilter & { regFrom: number; regToExcl: number }): number {
  const s = store();
  const keep = userPredicate(s, uf);
  let n = 0;
  for (let u = lowerBoundUser(s, uf.regFrom); u < s.nUsers && s.uRegDay[u] < uf.regToExcl; u++) if (keep(u)) n++;
  return n;
}

// Users are sorted by sign-up day: binary search for the first with regDay >= day.
function lowerBoundUser(s: Store, day: number): number {
  let lo = 0, hi = s.nUsers;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (s.uRegDay[mid] < day) lo = mid + 1; else hi = mid; }
  return lo;
}

export type Grain = "day" | "week" | "month";
export function bucketStart(day: number, grain: Grain): number {
  if (grain === "day") return day;
  const d = new Date(day * DAY_MS);
  if (grain === "week") return day - ((d.getUTCDay() + 6) % 7);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / DAY_MS);
}

// Series by bucket (like buildDailySql): key = ISO date of the bucket start.
export function queryDaily(of: OrderFilter, uf: UserFilter, grain: Grain): Map<string, Agg> {
  const s = store();
  const buckets = new Map<number, AggBuilder>();
  scanOrders(s, of, uf, (o, u) => {
    const b = bucketStart(s.oDay[o], grain);
    let acc = buckets.get(b);
    if (!acc) { acc = new AggBuilder(); buckets.set(b, acc); }
    acc.add(s, o, u);
  });
  const out = new Map<string, Agg>();
  for (const [b, acc] of [...buckets.entries()].sort((x, y) => x[0] - y[0])) out.set(isoOf(b), acc.done());
  return out;
}

// Sign-ups by bucket (like buildDailyRegSql).
export function queryDailyRegs(uf: UserFilter, from: number, toExcl: number, grain: Grain): Map<string, number> {
  const s = store();
  const keep = userPredicate(s, uf);
  const m = new Map<string, number>();
  for (let u = lowerBoundUser(s, from); u < s.nUsers && s.uRegDay[u] < toExcl; u++) {
    if (!keep(u)) continue;
    const k = isoOf(bucketStart(s.uRegDay[u], grain));
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

// Breakdown by order channel (like buildChannelsSql).
export function queryByOrderChannel(of: OrderFilter, uf: UserFilter): { channel: string; agg: Agg }[] {
  const s = store();
  const accs = ORDER_CHANNELS.map(() => new AggBuilder());
  scanOrders(s, { ...of, orderChannel: "all" }, uf, (o, u) => accs[s.oChannel[o]].add(s, o, u));
  return accs.map((a, i) => ({ channel: ORDER_CHANNELS[i], agg: a.done() }))
    .filter((r) => r.agg.orders > 0)
    .sort((a, b) => b.agg.revenue - a.agg.revenue);
}

// Breakdown by user country (like buildCountrySql).
export function queryByCountry(of: OrderFilter): { country: string; agg: Agg }[] {
  const s = store();
  const accs = COUNTRY_CODES.map(() => new AggBuilder());
  scanOrders(s, of, {}, (o, u) => accs[s.uCountry[u]].add(s, o, u));
  return accs.map((a, i) => ({ country: COUNTRY_CODES[i], agg: a.done() }))
    .filter((r) => r.agg.orders > 0)
    .sort((a, b) => b.agg.revenue - a.agg.revenue);
}

// Per-user cohort facts for Attribution (like the per-user cohort SQL):
// everyone who signed up in the sign-up window + their orders in the order window. No country filter.
export type CohortUserRow = {
  user_id: string; country: string; reg_day: string;
  orders: number; revenue: number; revenue_paid: number; weight: number;
};
export function queryCohortByUser(
  userChannel: string, regFrom: number, regToExcl: number, of: OrderFilter,
): CohortUserRow[] {
  const s = store();
  const keep = userPredicate(s, { userChannel });
  const oc = orderChIdx(of.orderChannel);
  const rows: CohortUserRow[] = [];
  for (let u = lowerBoundUser(s, regFrom); u < s.nUsers && s.uRegDay[u] < regToExcl; u++) {
    if (!keep(u)) continue;
    let orders = 0, revenue = 0, revenuePaid = 0, weight = 0;
    if (!(of.excludeB2b && s.uB2b[u])) {
      for (let o = s.uOrdStart[u]; o < s.uOrdStart[u + 1]; o++) {
        const d = s.oDay[o];
        if (d < of.from || d >= of.toExcl) continue;
        if (oc >= 0 && s.oChannel[o] !== oc) continue;
        orders++; revenue += s.oPrice[o]; weight += s.oWeight[o];
        if (s.oPaid[o]) revenuePaid += s.oPrice[o];
      }
    }
    rows.push({
      user_id: userIdOf(u), country: COUNTRY_CODES[s.uCountry[u]], reg_day: isoOf(s.uRegDay[u]),
      orders, revenue: Math.round(revenue), revenue_paid: Math.round(revenuePaid), weight: Math.round(weight * 100) / 100,
    });
  }
  return rows;
}

// Reactivation (like buildReactivationSql): a buyer in the window for whom the gap between the "anchor"
// (the last order before the window across all channels, or sign-up if there were no orders) and the first
// order in the window is >= dormancy days. History before the window has no lower bound.
export type ReactRow = { country: string; buyers: number; react: number; reactFirst: number; reactRepeat: number };
export function queryReactivation(of: OrderFilter, uf: UserFilter, dormancy: number, byCountry: boolean): ReactRow[] {
  const s = store();
  const firstInWin = new Map<number, number>();
  scanOrders(s, { ...of, excludeB2b: false }, uf, (o, u) => {
    if (!firstInWin.has(u)) firstInWin.set(u, s.oDay[o]); // the scan goes in ascending day order
  });
  const acc = new Map<string, ReactRow>();
  for (const [u, first] of firstInWin) {
    let lastBefore = -1;
    for (let o = s.uOrdStart[u]; o < s.uOrdStart[u + 1]; o++) {
      if (s.oDay[o] < of.from) lastBefore = s.oDay[o]; else break;
    }
    const isFirst = lastBefore < 0;
    const anchor = isFirst ? s.uRegDay[u] : lastBefore;
    const sleeping = first - anchor >= dormancy;
    const key = byCountry ? COUNTRY_CODES[s.uCountry[u]] : "all";
    const r = acc.get(key) ?? { country: key, buyers: 0, react: 0, reactFirst: 0, reactRepeat: 0 };
    r.buyers++;
    if (sleeping) { r.react++; if (isFirst) r.reactFirst++; else r.reactRepeat++; }
    acc.set(key, r);
  }
  const rows = [...acc.values()].sort((a, b) => b.react - a.react);
  return byCountry ? rows : rows.length ? rows : [{ country: "all", buyers: 0, react: 0, reactFirst: 0, reactRepeat: 0 }];
}

/* ------------------------------ LTV ------------------------------ */

export type LtvUserFact = { cohortMonth: number; revenue: number; orders: number };
export type LtvScan = {
  cohortSize: Map<number, number>;                   // cohort month -> size
  perUser: LtvUserFact[];                            // segment buyers (rev > 0)
  cohortMol: Map<number, Map<number, number>>;       // cohort -> month of life -> revenue
  firstMol: Map<number, Map<number, number>>;        // cohort -> first purchase month -> new buyers
};

// A single pass for LTV: users who signed up in [winStart, winEnd) and their orders in the window.
export function scanLtv(winStart: number, winEnd: number, uf: UserFilter, orderChannel: string, excludeB2b: boolean): LtvScan {
  const s = store();
  const keep = userPredicate(s, uf);
  const oc = orderChIdx(orderChannel);
  const cohortSize = new Map<number, number>();
  const perUser: LtvUserFact[] = [];
  const cohortMol = new Map<number, Map<number, number>>();
  const firstMol = new Map<number, Map<number, number>>();
  const bump = (m: Map<number, Map<number, number>>, a: number, b: number, v: number) => {
    let inner = m.get(a); if (!inner) { inner = new Map(); m.set(a, inner); }
    inner.set(b, (inner.get(b) ?? 0) + v);
  };
  for (let u = lowerBoundUser(s, winStart); u < s.nUsers && s.uRegDay[u] < winEnd; u++) {
    if (!keep(u)) continue;
    const cm = monthIndex(s.uRegDay[u]);
    cohortSize.set(cm, (cohortSize.get(cm) ?? 0) + 1);
    if (excludeB2b && s.uB2b[u]) continue;
    let rev = 0, orders = 0, first = -1;
    for (let o = s.uOrdStart[u]; o < s.uOrdStart[u + 1]; o++) {
      const d = s.oDay[o];
      if (d < winStart || d >= winEnd) continue;
      if (oc >= 0 && s.oChannel[o] !== oc) continue;
      const mol = monthIndex(d) - cm;
      if (mol < 0) continue;
      rev += s.oPrice[o]; orders++;
      if (first < 0) first = mol;
      bump(cohortMol, cm, mol, s.oPrice[o]);
    }
    if (orders > 0) {
      bump(firstMol, cm, first, 1);
      if (rev > 0) perUser.push({ cohortMonth: cm, revenue: rev, orders });
    }
  }
  return { cohortSize, perUser, cohortMol, firstMol };
}

/* ------------------------------ AF / MMP ------------------------------ */

// Users visible to the MMP for the sign-up window (for the daily AF map).
export type AfUser = { userId: string; regDay: number; country: string; group: number; source: number; campaign: string };
export function afUsers(from: number, toExcl: number): AfUser[] {
  const s = store();
  const out: AfUser[] = [];
  for (let u = lowerBoundUser(s, from); u < s.nUsers && s.uRegDay[u] < toExcl; u++) {
    if (s.uAfGroup[u] === AF_NONE) continue;
    out.push({
      userId: userIdOf(u), regDay: s.uRegDay[u], country: COUNTRY_CODES[s.uCountry[u]],
      group: s.uAfGroup[u], source: s.uAfSource[u],
      campaign: s.uCampaign[u] >= 0 ? s.campaignNames[s.uCampaign[u]] : "",
    });
  }
  return out;
}

// Dataset size (for the Sync and Integrations screens).
export function storeStats(): { users: number; orders: number; from: string; to: string } {
  const s = store();
  return { users: s.nUsers, orders: s.nOrders, from: isoOf(START_DAY), to: isoOf(s.builtFor) };
}

// Acquisition channels: period orders split by the ad source the user came from
// (MMP attribution is stored on the user). Plus new buyers in the period
// (their first ever order falls in the window) for CAC.
export type AcqRow = { source: number; orders: number; buyers: number; newBuyers: number; revenue: number; revenuePaid: number };
export function queryAcquisition(of: OrderFilter, uf: UserFilter): { rows: AcqRow[]; total: Agg } {
  const s = store();
  const acc = new Map<number, { orders: number; revenue: number; revenuePaid: number; buyers: Set<number>; fresh: Set<number> }>();
  const total = new AggBuilder();
  scanOrders(s, of, uf, (o, u) => {
    total.add(s, o, u);
    if (s.uAfGroup[u] !== AF_TARGET) return;
    const src = s.uAfSource[u];
    let a = acc.get(src);
    if (!a) { a = { orders: 0, revenue: 0, revenuePaid: 0, buyers: new Set(), fresh: new Set() }; acc.set(src, a); }
    a.orders++; a.revenue += s.oPrice[o]; if (s.oPaid[o]) a.revenuePaid += s.oPrice[o];
    a.buyers.add(u);
    if (s.oDay[s.uOrdStart[u]] >= of.from) a.fresh.add(u);
  });
  const rows = [...acc.entries()].map(([source, a]) => ({
    source, orders: a.orders, buyers: a.buyers.size, newBuyers: a.fresh.size,
    revenue: Math.round(a.revenue), revenuePaid: Math.round(a.revenuePaid),
  }));
  return { rows, total: total.done() };
}
