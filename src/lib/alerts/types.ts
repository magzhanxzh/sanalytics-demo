// Alert rules.

export type AlertMetric = "revenue" | "orders" | "buyers" | "registrations" | "weight" | "avg_check";
export type AlertOp = "lt" | "gt";
export type AlertChannel = "telegram" | "email";

export type AlertRule = {
  id: string;
  name: string;
  metric: AlertMetric;
  operator: AlertOp;
  threshold: number;
  windowDays: number; // window the metric is computed over
  country: string; // code or 'all'
  channel: AlertChannel;
  enabled: boolean;
};

export type AlertStatus = {
  id: string;
  value: number; // current metric value over the window
  fired: boolean; // would fire now
};

export const METRIC_LABELS: Record<AlertMetric, string> = {
  revenue: "Revenue",
  orders: "Orders",
  buyers: "Buyers",
  registrations: "Sign-ups",
  weight: "Weight, kg",
  avg_check: "Avg check",
};
export const OP_LABELS: Record<AlertOp, string> = { lt: "below", gt: "above" };
export const CHANNEL_LABELS: Record<AlertChannel, string> = { telegram: "Telegram", email: "Email" };

export function newAlertRule(): AlertRule {
  return {
    id: "alr_" + Math.random().toString(36).slice(2, 10),
    name: "New rule",
    metric: "revenue",
    operator: "lt",
    threshold: 3000,
    windowDays: 1,
    country: "KZ",
    channel: "telegram",
    enabled: true,
  };
}

export function formatMetricValue(metric: AlertMetric, v: number): string {
  if (metric === "revenue" || metric === "avg_check") return "$" + Math.round(v).toLocaleString("en-US");
  if (metric === "weight") return Math.round(v).toLocaleString("en-US") + " kg";
  return Math.round(v).toLocaleString("en-US");
}
