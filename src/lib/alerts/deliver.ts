import "server-only";
import { listAlerts } from "./store";
import { evalAll } from "./eval";
import { getConnector } from "@/lib/connectors/store";
import { telegramSend } from "@/lib/connectors/providers";
import { METRIC_LABELS, OP_LABELS, formatMetricValue, type AlertRule } from "./types";
import { COUNTRIES } from "@/lib/queries/cards";
import { memStore } from "@/lib/demo/memstore";

// Доставка алертов: считаем правила, и по сработавшим шлём уведомление в Telegram.
// Чтобы не спамить: шлём на ФРОНТЕ срабатывания (was ok -> fired) и повторно не чаще
// COOLDOWN, пока правило продолжает срабатывать. Когда правило перестаёт срабатывать –
// состояние сбрасывается, и следующее срабатывание снова уведомит.

const COOLDOWN_MS = 6 * 3600 * 1000; // повторное напоминание не чаще раза в 6 часов

type State = Record<string, { firing: boolean; lastNotifiedAt: number }>;

// Состояние антиспама (в продакшене файл на сервере, в демо память процесса).
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
    `${m} за ${rule.windowDays} дн.: <b>${formatMetricValue(rule.metric, value)}</b>`,
    `условие: ${m} ${OP_LABELS[rule.operator]} ${formatMetricValue(rule.metric, rule.threshold)}`,
    `страна: ${countryLabel(rule.country)}`,
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

    // сработало: уведомляем на фронте срабатывания или по прошествии COOLDOWN
    const shouldNotify = !prev.firing || now - prev.lastNotifiedAt > COOLDOWN_MS;
    if (!shouldNotify) { state[rule.id] = { firing: true, lastNotifiedAt: prev.lastNotifiedAt }; continue; }

    if (rule.channel === "email") {
      skipped.push(`${rule.name}: доставка по почте пока не реализована`);
      state[rule.id] = { firing: true, lastNotifiedAt: prev.lastNotifiedAt };
      continue;
    }
    if (!tgReady) {
      skipped.push(`${rule.name}: Telegram не настроен (Интеграции)`);
      state[rule.id] = { firing: true, lastNotifiedAt: prev.lastNotifiedAt };
      continue;
    }
    const res = await telegramSend(tg, messageFor(rule, st.value));
    if (res.ok) { sent++; state[rule.id] = { firing: true, lastNotifiedAt: now }; }
    else { skipped.push(`${rule.name}: ${res.error}`); state[rule.id] = { firing: true, lastNotifiedAt: prev.lastNotifiedAt }; }
  }

  // убираем из состояния удалённые правила
  const ids = new Set(rules.map((r) => r.id));
  for (const k of Object.keys(state)) if (!ids.has(k)) delete state[k];
  await writeState(state);

  return { checked: rules.length, fired: statuses.filter((s) => s.fired).length, sent, skipped, at: new Date().toISOString() };
}
