// Модель дашбордов и виджетов (конструктор BI).

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
  country: string; // код или 'all'
  orderCreator: string;
  userCreator: string;
  basis: "gross" | "paid";
  excludeB2b: boolean;
  regFrom: string;
  regTo: string;
  dormancyDays?: number; // «размер спячки» в днях для метрики реактивации (по умолч. 180)
};

export type WidgetLayout = { x: number; y: number; w: number; h: number };

export type Widget = {
  id: string;
  title: string;
  type: WidgetType;
  metric: Metric;
  breakdown: Breakdown;
  filters: WidgetFilters;
  span: 1 | 2 | 3; // legacy, не используется при сетке RGL
  layout?: WidgetLayout; // позиция и размер в сетке (12 колонок)
  text?: string; // для текстового виджета
  inheritFilters?: boolean; // наследовать период/страну дашборда (по умолчанию true)
};

export type DashboardFilters = { from: string; to: string; country: string; regFrom: string; regTo: string; orderCreator: string; userCreator: string; excludeB2b: boolean };

export type Dashboard = {
  id: string;
  title: string;
  owner: string;
  sharedWith: string[]; // email/имена, кому открыт доступ
  filters?: DashboardFilters; // фильтры уровня дашборда (период, страна)
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

// Текущий пользователь. В демо авторизация выключена: все заходят как владелец.
export const CURRENT_USER = "demo@sanalytics.dev";

// Данные, готовые к отрисовке виджета
export type WidgetData =
  | { kind: "value"; value: number }
  | { kind: "points"; points: { label: string; value: number }[] }
  | { kind: "table"; columns: string[]; rows: (string | number)[][] }
  | { kind: "error"; message: string }
  | { kind: "loading" };

export const METRIC_LABELS: Record<Metric, string> = {
  revenue: "Выручка",
  orders: "Заказы",
  buyers: "Покупатели",
  registrations: "Регистрации",
  weight: "Вес, кг",
  avg_check: "Средний чек",
  conversion: "Конверсия",
  reactivation: "Реактивация",
};

export const WIDGET_LABELS: Record<WidgetType, string> = {
  kpi: "Число (KPI)",
  line: "Линия",
  bar: "Столбцы",
  area: "Область",
  pie: "Пирог",
  table: "Таблица",
  text: "Текст/заголовок",
};

export const BREAKDOWN_LABELS: Record<Breakdown, string> = {
  none: "Без разбивки",
  day: "По дням",
  week: "По неделям",
  month: "По месяцам",
  channel: "По каналам заказа",
  country: "По странам",
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

// Значение формата для метрики
export function formatMetric(metric: Metric, value: number): string {
  switch (metric) {
    case "revenue":
    case "avg_check":
      return "$" + (metric === "revenue" ? Math.round(value).toLocaleString("ru-RU") : value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    case "weight":
      return Math.round(value).toLocaleString("ru-RU") + " кг";
    case "conversion":
      return value.toFixed(1) + "%";
    default:
      return Math.round(value).toLocaleString("ru-RU");
  }
}
