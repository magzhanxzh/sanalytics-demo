import "server-only";
import { memStore } from "@/lib/demo/memstore";
import {
  CURRENT_USER,
  defaultDashboardFilters,
  defaultWidgetFilters,
  type Dashboard,
  type Widget,
  type WidgetType,
  type Metric,
  type Breakdown,
  type WidgetLayout,
} from "./types";

// Хранилище дашбордов. В продакшене: Supabase (таблицы dashboards + dashboard_shares,
// изоляция и шаринг через RLS), без Supabase: файл на сервере. В демо: память процесса
// с тремя готовыми дашбордами, один из них «расшарен» коллегой (только чтение).

let seq = 0;
function w(title: string, type: WidgetType, metric: Metric, breakdown: Breakdown, layout: WidgetLayout, extra: Partial<Widget> = {}): Widget {
  return { id: `wdg_demo${++seq}`, title, type, metric, breakdown, filters: defaultWidgetFilters(), span: 1, layout, ...extra };
}

function seed(): Dashboard[] {
  const now = Date.now();
  const hour = 3_600_000;
  const uz = { ...defaultDashboardFilters(), country: "UZ" };
  return [
    {
      id: "dsh_weekly",
      title: "Сводка по продажам",
      owner: CURRENT_USER,
      sharedWith: ["anna@example.com"],
      filters: defaultDashboardFilters(),
      createdAt: now - 20 * 24 * hour,
      updatedAt: now - 2 * hour,
      widgets: [
        w("Выручка", "kpi", "revenue", "none", { x: 0, y: 0, w: 3, h: 3 }),
        w("Заказы", "kpi", "orders", "none", { x: 3, y: 0, w: 3, h: 3 }),
        w("Покупатели", "kpi", "buyers", "none", { x: 6, y: 0, w: 3, h: 3 }),
        w("Средний чек", "kpi", "avg_check", "none", { x: 9, y: 0, w: 3, h: 3 }),
        w("Выручка по дням", "area", "revenue", "day", { x: 0, y: 3, w: 8, h: 6 }),
        w("Выручка по каналам заказа", "pie", "revenue", "channel", { x: 8, y: 3, w: 4, h: 6 }),
        w("Регистрации по неделям", "bar", "registrations", "week", { x: 0, y: 9, w: 6, h: 5 }),
        w("Страны", "table", "revenue", "country", { x: 6, y: 9, w: 6, h: 5 }),
      ],
    },
    {
      id: "dsh_retention",
      title: "Реактивация и удержание",
      owner: CURRENT_USER,
      sharedWith: [],
      filters: defaultDashboardFilters(),
      createdAt: now - 9 * 24 * hour,
      updatedAt: now - 26 * hour,
      widgets: [
        w("", "text", "revenue", "none", { x: 0, y: 0, w: 12, h: 2 }, { text: "Вернувшиеся клиенты: спячка от 180 дней до первого заказа в периоде" }),
        w("Реактивировано", "kpi", "reactivation", "none", { x: 0, y: 2, w: 4, h: 3 }),
        w("Реактивация по странам", "bar", "reactivation", "country", { x: 4, y: 2, w: 8, h: 6 }),
        w("Детали реактивации", "table", "reactivation", "none", { x: 0, y: 5, w: 4, h: 6 }),
        w("Покупатели по неделям", "line", "buyers", "week", { x: 4, y: 8, w: 8, h: 5 }),
      ],
    },
    {
      id: "dsh_uz",
      title: "Маркетинг UZ",
      owner: "anna@example.com",
      sharedWith: [CURRENT_USER],
      filters: uz,
      createdAt: now - 14 * 24 * hour,
      updatedAt: now - 5 * hour,
      widgets: [
        w("Выручка UZ", "kpi", "revenue", "none", { x: 0, y: 0, w: 4, h: 3 }),
        w("Регистрации UZ", "kpi", "registrations", "none", { x: 4, y: 0, w: 4, h: 3 }),
        w("Средний чек UZ", "kpi", "avg_check", "none", { x: 8, y: 0, w: 4, h: 3 }),
        w("Заказы по дням", "line", "orders", "day", { x: 0, y: 3, w: 12, h: 6 }),
      ],
    },
  ];
}

const dashboards = memStore<Dashboard[]>("dashboards", seed);

export async function listDashboards(): Promise<Dashboard[]> {
  return [...dashboards.get()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDashboard(id: string): Promise<Dashboard | null> {
  return dashboards.get().find((d) => d.id === id) ?? null;
}

export async function createDashboard(title: string): Promise<Dashboard> {
  const id = "dsh_" + Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  const d: Dashboard = { id, title: title || "Новый дашборд", owner: CURRENT_USER, sharedWith: [], createdAt: now, updatedAt: now, widgets: [] };
  dashboards.set([...dashboards.get(), d]);
  return d;
}

export async function saveDashboard(d: Dashboard): Promise<Dashboard> {
  const all = dashboards.get();
  const cur = all.find((x) => x.id === d.id);
  // Менять дашборд может только владелец (в продакшене это гарантирует RLS).
  if (cur && cur.owner !== CURRENT_USER) return cur;
  d.updatedAt = Date.now();
  d.owner = d.owner || CURRENT_USER;
  dashboards.set(cur ? all.map((x) => (x.id === d.id ? d : x)) : [...all, d]);
  return d;
}

export async function deleteDashboard(id: string): Promise<void> {
  dashboards.set(dashboards.get().filter((d) => d.id !== id || d.owner !== CURRENT_USER));
}
