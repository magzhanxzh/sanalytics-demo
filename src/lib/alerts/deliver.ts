import "server-only";
import { listAlerts } from "./store";
import { evalAll } from "./eval";
import { getConnector } from "@/lib/connectors/store";
import { telegramSend } from "@/lib/connectors/providers";
import { METRIC_LABELS, OP_LABELS, formatMetricValue, type AlertRule } from "./types";
import { COUNTRIES } from "@/lib/queries/cards";
import { memStore } from "@/lib/demo/memstore";

// Alert delivery: evaluate the rules and send a Telegram notification for the fired ones.
// To avoid spam: send on the rising EDGE (was ok -> fired) and repeat no more often than
// COOLDOWN while the rule keeps firing. When the rule stops firing
// the state resets, and the next firing notifies again.

const COOLDOWN_MS = 6 * 3600 * 1000; // repeat reminder at most once every 6 hours

type State = Record<string, { firing: boolean; lastNotifiedAt: number }>;

// Anti-spam state (a file on the server in production, process memory in the demo).
const stateStore = memStore<State>("alerts_state", () => ({}));
async function readState(): Promise<State> {
  return { ...stateStore.get() };
}
async function writeState(s: State): Promise<void> {
  stateStore.set(s);
}

const countryLabel = (code: string) => COUNTRIES.find((c) => c.code === code)?.label ?? code;

function messageFor(rule: AlertRule, value: number): string {
  const m = METRIC_LABELS[rule.metric];
  return [
    `🔴 <b>${rule.name}</b>`,
    `${m} over ${rule.windowDays} d: <b>${formatMetricValue(rule.metric, value)}</b>`,
    `condition: ${m} ${OP_LABELS[rule.operator]} ${formatMetricValue(rule.metric, rule.threshold)}`,
    `country: ${countryLabel(rule.country)}`,
  ].join("\n");
}

export type AlertRun = { checked: number; fired: number; sent: number; skipped: string[]; at: string };

export async function runAlerts(): Promise<AlertRun> {
  const rules = (await listAlerts()).filter((r) => r.enabled);
  if (rules.length === 0) return { checked: 0, fired: 0, sent: 0, skipped: [], at: new Date().toISOString() };

  const statuses = await evalAll(rules);
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const state = await readState();
  const now = Date.now();
  let sent = 0;
  const skipped: string[] = [];

  const tg = await getConnector("telegram");
  const tgReady = Boolean(tg.enabled && tg.fields?.bot_token && tg.fields?.chat_id);

  for (const rule of rules) {
    const st = byId.get(rule.id);
    if (!st) continue;
    const prev = state[rule.id] ?? { firing: false, lastNotifiedAt: 0 };

    if (!st.fired) { state[rule.id] = { firing: false, lastNotifiedAt: prev.lastNotifiedAt }; continue; }

    // fired: notify on the rising edge or after COOLDOWN
    const shouldNotify = !prev.firing || now - prev.lastNotifiedAt > COOLDOWN_MS;
    if (!shouldNotify) { state[rule.id] = { firing: true, lastNotifiedAt: prev.lastNotifiedAt }; continue; }

    if (rule.channel === "email") {
      skipped.push(`${rule.name}: email delivery is not implemented yet`);
      state[rule.id] = { firing: true, lastNotifiedAt: prev.lastNotifiedAt };
      continue;
    }
    if (!tgReady) {
      skipped.push(`${rule.name}: Telegram is not configured (Integrations)`);
      state[rule.id] = { firing: true, lastNotifiedAt: prev.lastNotifiedAt };
      continue;
    }
    const res = await telegramSend(tg, messageFor(rule, st.value));
    if (res.ok) { sent++; state[rule.id] = { firing: true, lastNotifiedAt: now }; }
    else { skipped.push(`${rule.name}: ${res.error}`); state[rule.id] = { firing: true, lastNotifiedAt: prev.lastNotifiedAt }; }
  }

  // drop deleted rules from the state
  const ids = new Set(rules.map((r) => r.id));
  for (const k of Object.keys(state)) if (!ids.has(k)) delete state[k];
  await writeState(state);

  return { checked: rules.length, fired: statuses.filter((s) => s.fired).length, sent, skipped, at: new Date().toISOString() };
}
