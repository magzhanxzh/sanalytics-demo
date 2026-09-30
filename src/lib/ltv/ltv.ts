import "server-only";
import { cacheGet, cacheSet, isFresh } from "@/lib/cache";
import { scanLtv, dayOf } from "@/lib/demo/warehouse";

// COHORT LTV.
//   - base: users of the country who SIGNED UP INSIDE the report window, so that everyone
//     has full history since sign-up (LTV is not truncated on the left);
//   - order channel is filtered separately (own store by default);
//   - B2B (> 50 orders in any month) is excluded by default;
//   - two LTV denominators, both cumulative: per sign-up and per buyer.
// In production these are five ClickHouse SQL queries (cohort sizes, KPIs with median and
// top 10%, distribution, cohort x month of life, new buyers). In the demo the same
// aggregates are computed in one pass over the synthetic store; the cohort math is shared.

export type LtvFilters = { country: string; orderCreator: string; userCreator: string; excludeB2b: boolean };

const WINDOW_START = "2025-01-01";

// Window end = first day of the current month (full months only).
function windowEnd(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/* ------------------------------ Result ------------------------------ */

export type LtvKpi = {
  totalCustomers: number; payingCustomers: number; payingShare: number;
  totalRevenue: number; avgLtvPaying: number; avgLtvReg: number;
  medianLtvPaying: number; avgOrders: number; top10Share: number;
};
export type LtvCurvePoint = { mol: number } & Record<string, number | null>;
export type CohortTotal = {
  cohort: string; size: number; buyers: number; payingShare: number;
  totalRevenue: number; ltvReg: number; ltvBuyer: number; monthsObserved: number;
};
export type DistBucket = { bucket: string; users: number; revenue: number };
export type LtvMatrixRow = { cohort: string; size: number; cells: (number | null)[] };

export type LtvResult = {
  configured: boolean;
  window?: { start: string; end: string };
  kpi?: LtvKpi;
  curveReg?: LtvCurvePoint[];       // cumulative LTV per sign-up by month of life
  curveBuyer?: LtvCurvePoint[];     // cumulative LTV per buyer
  curveCohorts?: string[];          // which cohorts are in the chart lines
  totals?: CohortTotal[];
  dist?: DistBucket[];
  matrix?: { mols: number[]; rows: LtvMatrixRow[] };  // LTV per sign-up triangle
  error?: string;
};

const BUCKETS: [string, number][] = [["$0–10", 10], ["$10–50", 50], ["$50–100", 100], ["$100–500", 500], ["$500–1000", 1000], ["$1000–5000", 5000], ["$5000+", Infinity]];
const r2 = (v: number) => Math.round(v * 100) / 100;
const ymOf = (monthIdx: number) => `${Math.floor(monthIdx / 12)}-${String((monthIdx % 12) + 1).padStart(2, "0")}`;

export async function buildLtv(f: LtvFilters): Promise<LtvResult> {
  const winEnd = windowEnd();
  const key = "ltv:" + JSON.stringify(f) + ":" + winEnd; // winEnd in the key: the cache won't go stale across a month boundary
  const hit = cacheGet<LtvResult>(key);
  if (hit && isFresh(hit.at)) return hit.data;

  try {
    const scan = scanLtv(dayOf(WINDOW_START), dayOf(winEnd), { country: f.country, userChannel: f.userCreator }, f.orderCreator, f.excludeB2b);

    // --- cohort sizes ---
    const size = new Map<string, number>();
    let totalCustomers = 0;
    for (const [m, n] of [...scan.cohortSize.entries()].sort((a, b) => a[0] - b[0])) { size.set(ymOf(m), n); totalCustomers += n; }

    // --- KPIs over buyers (rev > 0) ---
    const revs = scan.perUser.map((u) => u.revenue).sort((a, b) => a - b);
    const paying = revs.length;
    const totalRev = revs.reduce((s, v) => s + v, 0);
    const median = paying ? (paying % 2 ? revs[(paying - 1) / 2] : (revs[paying / 2 - 1] + revs[paying / 2]) / 2) : 0;
    const topN = Math.max(Math.round(paying * 0.1), 1);
    const topSum = revs.slice(-topN).reduce((s, v) => s + v, 0);
    const ordersSum = scan.perUser.reduce((s, u) => s + u.orders, 0);
    const kpi: LtvKpi = {
      totalCustomers, payingCustomers: paying,
      payingShare: totalCustomers ? (paying / totalCustomers) * 100 : 0,
      totalRevenue: r2(totalRev),
      avgLtvPaying: paying ? totalRev / paying : 0,
      avgLtvReg: totalCustomers ? totalRev / totalCustomers : 0,
      medianLtvPaying: r2(median), avgOrders: paying ? r2(ordersSum / paying) : 0,
      top10Share: totalRev ? Math.round((1000 * topSum) / totalRev) / 10 : 0,
    };

    // --- distribution by LTV size ---
    const dist: DistBucket[] = [{ bucket: "No revenue", users: Math.max(totalCustomers - paying, 0), revenue: 0 }];
    for (const [label] of BUCKETS) dist.push({ bucket: label, users: 0, revenue: 0 });
    for (const v of revs) {
      const i = BUCKETS.findIndex(([, hi]) => v < hi);
      dist[i + 1].users++; dist[i + 1].revenue += v;
    }
    for (const d of dist) d.revenue = Math.round(d.revenue);

    // --- cohort math ---
    const revByCohort = new Map<string, Map<number, number>>();
    let maxMol = 0;
    for (const [cm, mols] of scan.cohortMol) {
      revByCohort.set(ymOf(cm), mols);
      for (const mol of mols.keys()) if (mol > maxMol) maxMol = mol;
    }
    const newBuyers = new Map<string, Map<number, number>>();
    for (const [cm, mols] of scan.firstMol) newBuyers.set(ymOf(cm), mols);

    const cohorts = [...size.keys()].sort();
    // Cohort age = how many months of life it has lived by the end of the window.
    const ageOf = (c: string) => {
      const [y, mo] = c.split("-").map(Number);
      const [ey, em] = winEnd.split("-").map(Number);
      return (ey * 12 + (em - 1)) - (y * 12 + (mo - 1)) - 1; // winEnd is exclusive
    };

    const totals: CohortTotal[] = [];
    const ltvRegByCohort = new Map<string, Map<number, number>>();
    const ltvBuyerByCohort = new Map<string, Map<number, number>>();

    for (const c of cohorts) {
      const sz = size.get(c) ?? 0;
      const rev = revByCohort.get(c) ?? new Map<number, number>();
      const nb = newBuyers.get(c) ?? new Map<number, number>();
      const age = Math.max(ageOf(c), 0);
      let cumRev = 0, buyersEver = 0;
      const regMap = new Map<number, number>(), buyerMap = new Map<number, number>();
      for (let mol = 0; mol <= age; mol++) {
        cumRev += rev.get(mol) ?? 0;
        buyersEver += nb.get(mol) ?? 0;
        regMap.set(mol, sz ? cumRev / sz : 0);
        buyerMap.set(mol, buyersEver ? cumRev / buyersEver : 0);
      }
      ltvRegByCohort.set(c, regMap);
      ltvBuyerByCohort.set(c, buyerMap);
      totals.push({
        cohort: c, size: sz, buyers: buyersEver,
        payingShare: sz ? (buyersEver / sz) * 100 : 0,
        totalRevenue: cumRev, ltvReg: sz ? cumRev / sz : 0,
        ltvBuyer: buyersEver ? cumRev / buyersEver : 0, monthsObserved: age + 1,
      });
    }

    // --- chart lines: every 3rd cohort, at most 8 ---
    const pick = cohorts.filter((_, i) => i % 3 === 0).slice(0, 8);
    const mkCurve = (byCohort: Map<string, Map<number, number>>): LtvCurvePoint[] => {
      const pts: LtvCurvePoint[] = [];
      for (let mol = 0; mol <= maxMol; mol++) {
        const point: LtvCurvePoint = { mol };
        for (const c of pick) {
          const v = byCohort.get(c)?.get(mol);
          point[c] = v === undefined ? null : r2(v);
        }
        pts.push(point);
      }
      return pts;
    };

    // --- LTV per sign-up matrix (triangle), columns 0..min(maxMol,12) ---
    const matMols = Array.from({ length: Math.min(maxMol, 12) + 1 }, (_, i) => i);
    const matrix = {
      mols: matMols,
      rows: cohorts.map((c) => ({
        cohort: c, size: size.get(c) ?? 0,
        cells: matMols.map((mol) => {
          const v = ltvRegByCohort.get(c)?.get(mol);
          return v === undefined ? null : r2(v);
        }),
      })),
    };

    const data: LtvResult = {
      configured: true,
      window: { start: WINDOW_START, end: winEnd },
      kpi,
      curveReg: mkCurve(ltvRegByCohort),
      curveBuyer: mkCurve(ltvBuyerByCohort),
      curveCohorts: pick,
      totals: totals.reverse(), // newest cohorts on top
      dist,
      matrix,
    };
    cacheSet(key, data);
    return data;
  } catch (err) {
    return { configured: true, error: String(err).slice(0, 300) };
  }
}
