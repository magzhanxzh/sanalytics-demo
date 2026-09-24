// Правила алертов.

export type AlertMetric = "revenue" | "orders" | "buyers" | "registrations" | "weight" | "avg_check";
export type AlertOp = "lt" | "gt";
export type AlertChannel = "telegram" | "email";

export type AlertRule = {
  id: string;
  name: string;
  metric: AlertMetric;
  operator: AlertOp;
  threshold: number;
  windowDays: number; // окно, за которое считается метрика
  country: string; // код или 'all'
  channel: AlertChannel;
  enabled: boolean;
};

export type AlertStatus = {
  id: string;
  value: number; // текущее значение метрики за окно
  fired: boolean; // сработало бы сейчас
};

export const METRIC_LABELS: Record<AlertMetric, string> = {
  revenue: "Выручка",
  orders: "Заказы",
  buyers: "Покупатели",
  registrations: "Регистрации",
  weight: "Вес, кг",
  avg_check: "Средний чек",
};
export const OP_LABELS: Record<AlertOp, string> = { lt: "меньше", gt: "больше" };
export const CHANNEL_LABELS: Record<AlertChannel, string> = { telegram: "Telegram", email: "Почта" };

export function newAlertRule(): AlertRule {
  return {
    id: "alr_" + Math.random().toString(36).slice(2, 10),
    name: "Новое правило",
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
  if (metric === "revenue" || metric === "avg_check") return "$" + Math.round(v).toLocaleString("ru-RU");
  if (metric === "weight") return Math.round(v).toLocaleString("ru-RU") + " кг";
  return Math.round(v).toLocaleString("ru-RU");
}
