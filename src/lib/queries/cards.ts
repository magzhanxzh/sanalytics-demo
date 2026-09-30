// FILTERS, TYPES AND FORMATTING FOR MARKETING CARDS AND CHART.
//
// Filters travel in the URL and apply when a chip changes:
//   - from, to        date range by order time
//   - country         user country: KZ|UZ|KG|TJ|MN|all
//   - orderCreator    ORDER channel: value | all
//   - userCreator     SIGN-UP channel: value | all
//   - regFrom, regTo  sign-up period (cohort), '' = off
//   - basis           revenue gross (all orders) | paid (paid only)
//   - excludeB2b      exclude business accounts (>50 orders a month)
//
// In production this file also held the ClickHouse SQL builders (buildOverviewSql and others).
// In the demo queries run against the synthetic store src/lib/demo/warehouse.ts,
// and the metrics layer (src/lib/metrics.ts) calls it with the same filters.

import { ORDER_CHANNELS, USER_CHANNELS } from "@/lib/demo/dims";

export type RevenueBasis = "gross" | "paid";
export type Grain = "day" | "week" | "month";

export type CardFilters = {
  from: string; // YYYY-MM-DD, order date from
  to: string; // YYYY-MM-DD, order date to (inclusive)
  country: string; // country code or 'all'
  orderCreator: string; // value or 'all'
  userCreator: string; // value or 'all'
  regFrom: string; // YYYY-MM-DD, sign-up period from ('' = no filter)
  regTo: string; // YYYY-MM-DD, sign-up period to ('' = no filter)
  basis: RevenueBasis;
  excludeB2b: boolean;
  grain: Grain; // chart granularity
};

// Whether the sign-up date cohort filter is active.
export function regActive(f: CardFilters): boolean {
  return Boolean(f.regFrom && f.regTo);
}

export const COUNTRIES = [
  { code: "all", label: "All countries" },
  { code: "KZ", label: "Kazakhstan" },
  { code: "UZ", label: "Uzbekistan" },
  { code: "KG", label: "Kyrgyzstan" },
  { code: "TJ", label: "Tajikistan" },
  { code: "MN", label: "Mongolia" },
];

// Channel lists for dropdowns (until /api/meta/creators responds).
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
      return "$" + Math.round(value).toLocaleString("en-US");
    case "currency2":
      return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "weight":
      return value.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " kg";
    case "percent":
      return value.toFixed(1) + "%";
    default:
      return Math.round(value).toLocaleString("en-US");
  }
}

export function deltaPct(value: number, prev: number): number | null {
  if (!prev) return null;
  return ((value - prev) / prev) * 100;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Parse filters from URL query parameters with defaults.
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

  // An explicit empty parameter (from=) means "not set" -> data for the default period.
  // A missing parameter -> the default period (landing page).
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

// Date range for labels: "Sep 17 – Sep 24, 2026" (year once if it matches).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatRange(from: string, to: string): string {
  if (!from || !to) return "";
  const [fy, fm, fd] = from.split("-");
  const [ty, tm, td] = to.split("-");
  const md = (m: string, d: string) => `${MONTHS[Number(m) - 1]} ${Number(d)}`;
  return fy === ty ? `${md(fm, fd)} – ${md(tm, td)}, ${ty}` : `${md(fm, fd)}, ${fy} – ${md(tm, td)}, ${ty}`;
}
