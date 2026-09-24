import "server-only";
import { cacheGet, cacheSet, isFresh } from "@/lib/cache";
import { scanLtv, dayOf } from "@/lib/demo/warehouse";

// КОГОРТНЫЙ LTV.
//   - база: пользователи страны, ЗАРЕГИСТРИРОВАННЫЕ ВНУТРИ ОКНА отчёта, чтобы у каждого
//     была полная история с момента регистрации (LTV не обрезан слева);
//   - канал заказа фильтруется отдельно (по умолчанию собственный магазин);
//   - B2B (> 50 заказов в каком-либо месяце) по умолчанию исключается;
//   - два знаменателя LTV, оба накопительные: на регистранта и на покупателя.
// В продакшене это пять SQL-запросов к ClickHouse (размеры когорт, KPI с медианой и
// топ-10%, распределение, когорта x месяц жизни, новые покупатели). В демо те же
// агрегаты считаются одним проходом по синтетическому хранилищу, когортная математика общая.

export type LtvFilters = { country: string; orderCreator: string; userCreator: string; excludeB2b: boolean };

const WINDOW_START = "2025-01-01";

// Конец окна = первое число текущего месяца (только полные месяцы).
function windowEnd(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/* ------------------------------ Результат ------------------------------ */

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
  curveReg?: LtvCurvePoint[];       // накопленный LTV на регистранта по месяцам жизни
  curveBuyer?: LtvCurvePoint[];     // накопленный LTV на покупателя
  curveCohorts?: string[];          // какие когорты в линиях графика
  totals?: CohortTotal[];
  dist?: DistBucket[];
  matrix?: { mols: number[]; rows: LtvMatrixRow[] };  // треугольник LTV/рег
  error?: string;
};

const BUCKETS: [string, number][] = [["$0–10", 10], ["$10–50", 50], ["$50–100", 100], ["$100–500", 500], ["$500–1000", 1000], ["$1000–5000", 5000], ["$5000+", Infinity]];
const r2 = (v: number) => Math.round(v * 100) / 100;
const ymOf = (monthIdx: number) => `${Math.floor(monthIdx / 12)}-${String((monthIdx % 12) + 1).padStart(2, "0")}`;

export async function buildLtv(f: LtvFilters): Promise<LtvResult> {
  const winEnd = windowEnd();
  const key = "ltv:" + JSON.stringify(f) + ":" + winEnd; // winEnd в ключ: на стыке месяцев кеш не устареет
  const hit = cacheGet<LtvResult>(key);
  if (hit && isFresh(hit.at)) return hit.data;

  try {
    const scan = scanLtv(dayOf(WINDOW_START), dayOf(winEnd), { country: f.country, userChannel: f.userCreator }, f.orderCreator, f.excludeB2b);

    // --- размеры когорт ---
    const size = new Map<string, number>();
    let totalCustomers = 0;
    for (const [m, n] of [...scan.cohortSize.entries()].sort((a, b) => a[0] - b[0])) { size.set(ymOf(m), n); totalCustomers += n; }

    // --- KPI по покупателям (rev > 0) ---
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

    // --- распределение по размеру LTV ---
    const dist: DistBucket[] = [{ bucket: "Без выручки", users: Math.max(totalCustomers - paying, 0), revenue: 0 }];
    for (const [label] of BUCKETS) dist.push({ bucket: label, users: 0, revenue: 0 });
    for (const v of revs) {
      const i = BUCKETS.findIndex(([, hi]) => v < hi);
      dist[i + 1].users++; dist[i + 1].revenue += v;
    }
    for (const d of dist) d.revenue = Math.round(d.revenue);

    // --- когортная математика ---
    const revByCohort = new Map<string, Map<number, number>>();
    let maxMol = 0;
    for (const [cm, mols] of scan.cohortMol) {
      revByCohort.set(ymOf(cm), mols);
      for (const mol of mols.keys()) if (mol > maxMol) maxMol = mol;
    }
    const newBuyers = new Map<string, Map<number, number>>();
    for (const [cm, mols] of scan.firstMol) newBuyers.set(ymOf(cm), mols);

    const cohorts = [...size.keys()].sort();
    // Возраст когорты = сколько месяцев жизни она уже прожила к концу окна.
    const ageOf = (c: string) => {
      const [y, mo] = c.split("-").map(Number);
      const [ey, em] = winEnd.split("-").map(Number);
      return (ey * 12 + (em - 1)) - (y * 12 + (mo - 1)) - 1; // winEnd эксклюзивный
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

    // --- линии графика: каждая 3-я когорта, максимум 8 ---
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

    // --- матрица LTV/рег (треугольник), колонки 0..min(maxMol,12) ---
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
      totals: totals.reverse(), // свежие когорты сверху
      dist,
      matrix,
    };
    cacheSet(key, data);
    return data;
  } catch (err) {
    return { configured: true, error: String(err).slice(0, 300) };
  }
}
