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

// Dashboard store. In production: Supabase (dashboards + dashboard_shares tables,
// isolation and sharing through RLS), without Supabase: a file on the server. In the demo: process memory
// with three ready-made dashboards, one of them "shared" by a colleague (read only).

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
      title: "Sales overview",
      owner: CURRENT_USER,
      sharedWith: ["anna@example.com"],
      filters: defaultDashboardFilters(),
      createdAt: now - 20 * 24 * hour,
      updatedAt: now - 2 * hour,
      widgets: [
        w("Revenue", "kpi", "revenue", "none", { x: 0, y: 0, w: 3, h: 3 }),
        w("Orders", "kpi", "orders", "none", { x: 3, y: 0, w: 3, h: 3 }),
        w("Buyers", "kpi", "buyers", "none", { x: 6, y: 0, w: 3, h: 3 }),
        w("Avg check", "kpi", "avg_check", "none", { x: 9, y: 0, w: 3, h: 3 }),
        w("Revenue by day", "area", "revenue", "day", { x: 0, y: 3, w: 8, h: 6 }),
        w("Revenue by order channel", "pie", "revenue", "channel", { x: 8, y: 3, w: 4, h: 6 }),
        w("Sign-ups by week", "bar", "registrations", "week", { x: 0, y: 9, w: 6, h: 5 }),
        w("Countries", "table", "revenue", "country", { x: 6, y: 9, w: 6, h: 5 }),
      ],
    },
    {
      id: "dsh_retention",
      title: "Reactivation and retention",
      owner: CURRENT_USER,
      sharedWith: [],
      filters: defaultDashboardFilters(),
      createdAt: now - 9 * 24 * hour,
      updatedAt: now - 26 * hour,
      widgets: [
        w("", "text", "revenue", "none", { x: 0, y: 0, w: 12, h: 2 }, { text: "Returning customers: 180+ days of dormancy before their first order in the period" }),
        w("Reactivated", "kpi", "reactivation", "none", { x: 0, y: 2, w: 4, h: 3 }),
        w("Reactivation by country", "bar", "reactivation", "country", { x: 4, y: 2, w: 8, h: 6 }),
        w("Reactivation details", "table", "reactivation", "none", { x: 0, y: 5, w: 4, h: 6 }),
        w("Buyers by week", "line", "buyers", "week", { x: 4, y: 8, w: 8, h: 5 }),
      ],
    },
    {
      id: "dsh_uz",
      title: "Marketing UZ",
      owner: "anna@example.com",
      sharedWith: [CURRENT_USER],
      filters: uz,
      createdAt: now - 14 * 24 * hour,
      updatedAt: now - 5 * hour,
      widgets: [
        w("Revenue UZ", "kpi", "revenue", "none", { x: 0, y: 0, w: 4, h: 3 }),
        w("Sign-ups UZ", "kpi", "registrations", "none", { x: 4, y: 0, w: 4, h: 3 }),
        w("Avg check UZ", "kpi", "avg_check", "none", { x: 8, y: 0, w: 4, h: 3 }),
        w("Orders by day", "line", "orders", "day", { x: 0, y: 3, w: 12, h: 6 }),
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
  const d: Dashboard = { id, title: title || "New dashboard", owner: CURRENT_USER, sharedWith: [], createdAt: now, updatedAt: now, widgets: [] };
  dashboards.set([...dashboards.get(), d]);
  return d;
}

export async function saveDashboard(d: Dashboard): Promise<Dashboard> {
  const all = dashboards.get();
  const cur = all.find((x) => x.id === d.id);
  // Only the owner can change a dashboard (RLS enforces this in production).
  if (cur && cur.owner !== CURRENT_USER) return cur;
  d.updatedAt = Date.now();
  d.owner = d.owner || CURRENT_USER;
  dashboards.set(cur ? all.map((x) => (x.id === d.id ? d : x)) : [...all, d]);
  return d;
}

export async function deleteDashboard(id: string): Promise<void> {
  dashboards.set(dashboards.get().filter((d) => d.id !== id || d.owner !== CURRENT_USER));
}
