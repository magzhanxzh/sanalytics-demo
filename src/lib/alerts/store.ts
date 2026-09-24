import "server-only";
import type { AlertRule } from "./types";
import { memStore } from "@/lib/demo/memstore";

// Правила алертов. В продакшене: Supabase (per-user, RLS), без Supabase: файл на сервере.
// В демо: память процесса с несколькими готовыми правилами.
const alerts = memStore<AlertRule[]>("alerts", () => [
  { id: "alr_demo1", name: "Выручка KZ за сутки просела", metric: "revenue", operator: "lt", threshold: 2500, windowDays: 1, country: "KZ", channel: "telegram", enabled: true },
  { id: "alr_demo2", name: "Мало регистраций в KZ", metric: "registrations", operator: "lt", threshold: 60, windowDays: 1, country: "KZ", channel: "telegram", enabled: true },
  { id: "alr_demo3", name: "Средний чек вырос", metric: "avg_check", operator: "gt", threshold: 32, windowDays: 7, country: "all", channel: "email", enabled: true },
  { id: "alr_demo4", name: "Заказы UZ за неделю", metric: "orders", operator: "lt", threshold: 300, windowDays: 7, country: "UZ", channel: "telegram", enabled: false },
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
