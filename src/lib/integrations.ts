import "server-only";
import type { ChConnectionView } from "@/lib/connections/types";
import { storeStats } from "@/lib/demo/warehouse";

export type SourceStatus = { configured: boolean; ok: boolean; detail?: string };

// Статус источников данных для экрана Интеграций.
// В продакшене: живой ping ClickHouse (SELECT version()) и проверка моста в PostgreSQL.
// В демо оба источника заменяет синтетическое хранилище в памяти процесса.
export async function getClickHouseStatus(): Promise<SourceStatus> {
  const s = storeStats();
  return { configured: true, ok: true, detail: `демо: ${s.orders.toLocaleString("ru-RU")} заказов` };
}

export async function getPgBridgeStatus(): Promise<SourceStatus> {
  const s = storeStats();
  return { configured: true, ok: true, detail: `демо: ${s.users.toLocaleString("ru-RU")} пользователей` };
}

// Активное подключение для UI (без пароля).
export async function getConnectionView(): Promise<ChConnectionView> {
  return { source: "none", url: "demo://in-memory", username: "demo", database: "sanalytics_demo", hasPassword: false };
}
