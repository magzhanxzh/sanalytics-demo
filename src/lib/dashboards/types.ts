// Dashboard and widget model (BI builder).

export type WidgetType = "kpi" | "line" | "bar" | "area" | "pie" | "table" | "text";
export type Metric =
  | "revenue"
  | "orders"
  | "buyers"
  | "registrations"
  | "weight"
  | "avg_check"
  | "conversion"
  | "reactivation";
export type Breakdown = "none" | "day" | "week" | "month" | "channel" | "country";

export type WidgetFilters = {
  from: string;
  to: string;
  country: string; // code or 'all'
  orderCreator: string;
  userCreator: string;
  basis: "gross" | "paid";
  excludeB2b: boolean;
  regFrom: string;
  regTo: string;
  dormancyDays?: number; // dormancy in days for the reactivation metric (default 180)
};

export type WidgetLayout = { x: number; y: number; w: number; h: number };

export type Widget = {
  id: string;
  title: string;
  type: WidgetType;
  metric: Metric;
  breakdown: Breakdown;
  filters: WidgetFilters;
  span: 1 | 2 | 3; // legacy, unused with the RGL grid
  layout?: WidgetLayout; // position and size in the grid (12 columns)
  text?: string; // for the text widget
  inheritFilters?: boolean; // inherit dashboard period and country (default true)
};

export type DashboardFilters = { from: string; to: string; country: string; regFrom: string; regTo: string; orderCreator: string; userCreator: string; excludeB2b: boolean };

export type Dashboard = {
  id: string;
  title: string;
  owner: string;
  sharedWith: string[]; // emails or names with access
  filters?: DashboardFilters; // dashboard-level filters (period, country)
  createdAt: number;
  updatedAt: number;
  widgets: Widget[];
};

export function defaultDashboardFilters(): DashboardFilters {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to), country: "KZ", regFrom: "", regTo: "", orderCreator: "all", userCreator: "all", excludeB2b: false };
}

// Current user. Auth is disabled in the demo: everyone is the owner.
export const CURRENT_USER = "demo@sanalytics.dev";

// Data ready to render a widget
export type WidgetData =
  | { kind: "value"; value: number }
  | { kind: "points"; points: { label: string; value: number }[] }
  | { kind: "table"; columns: string[]; rows: (string | number)[][] }
  | { kind: "error"; message: string }
  | { kind: "loading" };

export const METRIC_LABELS: Record<Metric, string> = {
  revenue: "Revenue",
  orders: "Orders",
  buyers: "Buyers",
  registrations: "Sign-ups",
  weight: "Weight, kg",
  avg_check: "Avg check",
  conversion: "Conversion",
  reactivation: "Reactivation",
};

export const WIDGET_LABELS: Record<WidgetType, string> = {
  kpi: "Number (KPI)",
  line: "Line",
  bar: "Bars",
  area: "Area",
  pie: "Pie",
  table: "Table",
  text: "Text / heading",
};

export const BREAKDOWN_LABELS: Record<Breakdown, string> = {
  none: "No breakdown",
  day: "By day",
  week: "By week",
  month: "By month",
  channel: "By order channel",
  country: "By country",
};

export function defaultWidgetFilters(): WidgetFilters {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    from: iso(from),
    to: iso(to),
    country: "KZ",
    orderCreator: "all",
    userCreator: "all",
    basis: "gross",
    excludeB2b: false,
    regFrom: "",
    regTo: "",
    dormancyDays: 180,
  };
}

// Formatted value for a metric
export function formatMetric(metric: Metric, value: number): string {
  switch (metric) {
    case "revenue":
    case "avg_check":
      return "$" + (metric === "revenue" ? Math.round(value).toLocaleString("en-US") : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    case "weight":
      return Math.round(value).toLocaleString("en-US") + " kg";
    case "conversion":
      return value.toFixed(1) + "%";
    default:
      return Math.round(value).toLocaleString("en-US");
  }
}
