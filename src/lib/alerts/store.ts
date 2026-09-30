import "server-only";
import type { AlertRule } from "./types";
import { memStore } from "@/lib/demo/memstore";

// Alert rules. In production: Supabase (per user, RLS), without Supabase: a file on the server.
// In the demo: process memory with a few ready-made rules.
const alerts = memStore<AlertRule[]>("alerts", () => [
  { id: "alr_demo1", name: "KZ daily revenue dropped", metric: "revenue", operator: "lt", threshold: 2500, windowDays: 1, country: "KZ", channel: "telegram", enabled: true },
  { id: "alr_demo2", name: "Few sign-ups in KZ", metric: "registrations", operator: "lt", threshold: 60, windowDays: 1, country: "KZ", channel: "telegram", enabled: true },
  { id: "alr_demo3", name: "Average check went up", metric: "avg_check", operator: "gt", threshold: 32, windowDays: 7, country: "all", channel: "email", enabled: true },
  { id: "alr_demo4", name: "UZ weekly orders", metric: "orders", operator: "lt", threshold: 300, windowDays: 7, country: "UZ", channel: "telegram", enabled: false },
]);

export async function listAlerts(): Promise<AlertRule[]> {
  return alerts.get();
}

export async function upsertAlert(rule: AlertRule): Promise<AlertRule> {
  const all = alerts.get();
  const i = all.findIndex((r) => r.id === rule.id);
  alerts.set(i >= 0 ? all.map((r) => (r.id === rule.id ? rule : r)) : [...all, rule]);
  return rule;
}

export async function deleteAlert(id: string): Promise<void> {
  alerts.set(alerts.get().filter((r) => r.id !== id));
}
