import "server-only";
import type { ChConnectionView } from "@/lib/connections/types";
import { storeStats } from "@/lib/demo/warehouse";

export type SourceStatus = { configured: boolean; ok: boolean; detail?: string };

// Data source status for the Integrations screen.
// In production: a live ClickHouse ping (SELECT version()) and a PostgreSQL bridge check.
// In the demo both sources are replaced by the synthetic in-memory store.
export async function getClickHouseStatus(): Promise<SourceStatus> {
  const s = storeStats();
  return { configured: true, ok: true, detail: `demo: ${s.orders.toLocaleString("en-US")} orders` };
}

export async function getPgBridgeStatus(): Promise<SourceStatus> {
  const s = storeStats();
  return { configured: true, ok: true, detail: `demo: ${s.users.toLocaleString("en-US")} users` };
}

// Active connection for the UI (without password).
export async function getConnectionView(): Promise<ChConnectionView> {
  return { source: "none", url: "demo://in-memory", username: "demo", database: "sanalytics_demo", hasPassword: false };
}
