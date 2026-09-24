import "server-only";
import { CONNECTORS, specOf, type ConnectorConfig, type ConnectorId, type ConnectorView } from "./types";
import { memStore } from "@/lib/demo/memstore";

// Сервисные коннекторы (уведомления). В демо: память процесса, Telegram заведён заранее.
type Store = Record<string, ConnectorConfig>;
const connectors = memStore<Store>("connectors", () => ({
  telegram: { id: "telegram", enabled: true, fields: { bot_token: "demo", chat_id: "@sanalytics_demo" } },
}));

async function readAll(): Promise<Store> {
  return connectors.get();
}
async function writeAll(s: Store): Promise<void> {
  connectors.set(s);
}

export async function getConnector(id: ConnectorId): Promise<ConnectorConfig> {
  const all = await readAll();
  return all[id] ?? { id, enabled: false, fields: {} };
}

// Сохранить. Секреты: пустое значение = «оставить как было» (не затираем).
export async function saveConnector(id: ConnectorId, patch: { enabled?: boolean; fields?: Record<string, string> }): Promise<ConnectorConfig> {
  const spec = specOf(id);
  if (!spec) throw new Error("Неизвестный коннектор: " + id);
  const all = await readAll();
  const cur = all[id] ?? { id, enabled: false, fields: {} as Record<string, string> };
  const fields = { ...cur.fields };
  if (patch.fields) {
    for (const f of spec.fields) {
      const incoming = patch.fields[f.key];
      if (incoming === undefined) continue;
      if (f.secret && incoming === "") continue; // пустой секрет -> не менять
      fields[f.key] = incoming.trim();
    }
  }
  const next: ConnectorConfig = { id, enabled: patch.enabled ?? cur.enabled, fields };
  all[id] = next;
  await writeAll(all);
  return next;
}

function isConfigured(cfg: ConnectorConfig): boolean {
  const spec = specOf(cfg.id);
  if (!spec) return false;
  return spec.fields.every((f) => f.optional || Boolean(cfg.fields[f.key]));
}

export function viewOf(cfg: ConnectorConfig): ConnectorView {
  const spec = specOf(cfg.id)!;
  const fields: Record<string, string> = {};
  const secretsSet: Record<string, boolean> = {};
  for (const f of spec.fields) {
    if (f.secret) secretsSet[f.key] = Boolean(cfg.fields[f.key]);
    else fields[f.key] = cfg.fields[f.key] ?? "";
  }
  return { id: cfg.id, enabled: cfg.enabled, configured: isConfigured(cfg), fields, secretsSet };
}

export async function getAllViews(): Promise<ConnectorView[]> {
  const all = await readAll();
  return CONNECTORS.map((s) => viewOf(all[s.id] ?? { id: s.id, enabled: false, fields: {} }));
}
