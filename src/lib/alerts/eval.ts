import "server-only";
import { getCards } from "@/lib/metrics";
import { defaultFilters } from "@/lib/queries/cards";
import { enforceCountry } from "@/lib/auth/access";
import type { AlertMetric, AlertRule, AlertStatus } from "./types";

function metricValue(metric: AlertMetric, raw: { revenue: number; orders: number; buyers: number; registrations: number; weight: number }): number {
  switch (metric) {
    case "revenue": return raw.revenue;
    case "orders": return raw.orders;
    case "buyers": return raw.buyers;
    case "registrations": return raw.registrations;
    case "weight": return raw.weight;
    case "avg_check": return raw.orders ? raw.revenue / raw.orders : 0;
  }
}

export async function evalRule(rule: AlertRule): Promise<AlertStatus> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - Math.max(1, rule.windowDays));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const country = await enforceCountry(rule.country || "all");
  const f = { ...defaultFilters(), from: iso(from), to: iso(to), country, basis: "gross" as const };
  const res = await getCards(f);
  const raw = res.raw;
  if (!raw) return { id: rule.id, value: 0, fired: false };

  const value = metricValue(rule.metric, raw);
  const fired = rule.operator === "lt" ? value < rule.threshold : value > rule.threshold;
  return { id: rule.id, value, fired };
}

export async function evalAll(rules: AlertRule[]): Promise<AlertStatus[]> {
  return Promise.all(rules.filter((r) => r.enabled).map(evalRule));
}
