"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, RefreshCw, Send } from "lucide-react";
import { COUNTRIES } from "@/lib/queries/cards";
import {
  METRIC_LABELS, OP_LABELS, CHANNEL_LABELS, newAlertRule, formatMetricValue,
  type AlertRule, type AlertStatus, type AlertMetric, type AlertOp, type AlertChannel,
} from "@/lib/alerts/types";

const countryLabel = (c: string) => COUNTRIES.find((x) => x.code === c)?.label ?? c;

export function AlertsManager() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [status, setStatus] = useState<Record<string, AlertStatus>>({});
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  async function sendNow() {
    setSending(true); setRunMsg(null);
    try {
      const d = await fetch("/api/alerts/run", { method: "POST" }).then((x) => x.json());
      if (d.error) setRunMsg(d.error);
      else {
        const parts = [`проверено ${d.checked}`, `сработало ${d.fired}`, `отправлено ${d.sent}`];
        if (d.skipped?.length) parts.push(`пропущено: ${d.skipped.join("; ")}`);
        setRunMsg(parts.join(" · "));
      }
    } catch (e) { setRunMsg(String(e).slice(0, 140)); }
    finally { setSending(false); check(); }
  }

  async function load() {
    const r = await fetch("/api/alerts").then((x) => x.json()).catch(() => ({ rules: [] }));
    setRules(r.rules ?? []);
  }
  async function check() {
    setChecking(true);
    const r = await fetch("/api/alerts/eval").then((x) => x.json()).catch(() => ({ statuses: [] }));
    const map: Record<string, AlertStatus> = {};
    for (const s of r.statuses ?? []) map[s.id] = s;
    setStatus(map);
    setChecking(false);
  }
  useEffect(() => { load().then(check); }, []);

  async function save(rule: AlertRule) {
    await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rule }) });
    setEditing(null);
    await load();
    check();
  }
  async function remove(rule: AlertRule) {
    if (!window.confirm(`Удалить правило «${rule.name}»?`)) return;
    await fetch(`/api/alerts/${rule.id}`, { method: "DELETE" });
    load();
  }
  async function toggle(rule: AlertRule) {
    save({ ...rule, enabled: !rule.enabled });
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
      {/* Правила */}
      <div className="border border-line bg-surface rounded-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-line" style={{ padding: "14px 18px" }}>
          <h2 className="font-semibold" style={{ fontSize: 14.5 }}>Правила</h2>
          <div className="flex items-center gap-2">
            <button onClick={check} disabled={checking} className="flex items-center gap-1.5 border border-line hover:border-line-2 disabled:opacity-60" style={{ borderRadius: 7, padding: "6px 10px", fontSize: 12 }}>
              <RefreshCw size={13} className={checking ? "animate-spin" : ""} /> Проверить
            </button>
            <button onClick={sendNow} disabled={sending} title="Оценить правила и отправить сработавшие в Telegram" className="flex items-center gap-1.5 border border-line hover:border-line-2 disabled:opacity-60" style={{ borderRadius: 7, padding: "6px 10px", fontSize: 12 }}>
              <Send size={13} className={sending ? "animate-pulse" : ""} /> Отправить
            </button>
            <button onClick={() => setEditing(newAlertRule())} className="flex items-center gap-1 text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 500 }}>
              <Plus size={13} /> Правило
            </button>
          </div>
        </div>
        {runMsg && <div className="text-muted border-b border-line" style={{ padding: "8px 18px", fontSize: 11.5 }}>{runMsg}</div>}
        {rules.length === 0 && <div className="text-muted" style={{ padding: "24px 18px", fontSize: 13 }}>Правил пока нет. Создайте первое.</div>}
        {rules.map((r) => {
          const st = status[r.id];
          const color = !r.enabled ? "var(--muted)" : st?.fired ? "var(--neg)" : "var(--pos)";
          const statusText = !r.enabled ? "выключено" : st ? (st.fired ? "сработало" : "ок") : "…";
          return (
            <div key={r.id} className="flex gap-3.5 border-b border-line last:border-0" style={{ padding: "14px 18px" }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: color, marginTop: 6, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.name}</div>
                <div className="mono text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {METRIC_LABELS[r.metric]} {OP_LABELS[r.operator]} {r.threshold.toLocaleString("ru-RU")} · {r.windowDays} дн · {countryLabel(r.country)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-muted" style={{ fontSize: 12 }}>{CHANNEL_LABELS[r.channel]}</div>
                <div className="mono" style={{ fontSize: 11.5, color, marginTop: 2 }}>
                  {statusText}{st && r.enabled ? ` · ${formatMetricValue(r.metric, st.value)}` : ""}
                </div>
              </div>
              <div className="flex items-start gap-0.5 shrink-0">
                <button onClick={() => toggle(r)} className="text-muted hover:text-ink p-1" title={r.enabled ? "Выключить" : "Включить"}>
                  <span style={{ fontSize: 11 }}>{r.enabled ? "◉" : "○"}</span>
                </button>
                <button onClick={() => setEditing(r)} className="text-muted hover:text-ink p-1"><Pencil size={13} /></button>
                <button onClick={() => remove(r)} className="text-muted hover:text-neg p-1"><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Сработавшие сейчас */}
      <div className="border border-line bg-surface rounded-xl" style={{ padding: "4px 18px 14px" }}>
        <h2 className="font-semibold" style={{ fontSize: 14.5, padding: "14px 0 4px" }}>Сработали бы сейчас</h2>
        {rules.filter((r) => r.enabled && status[r.id]?.fired).length === 0 ? (
          <div className="text-muted" style={{ fontSize: 12.5, padding: "6px 0" }}>Сейчас ничего не сработало – все метрики в норме.</div>
        ) : (
          rules.filter((r) => r.enabled && status[r.id]?.fired).map((r) => (
            <div key={r.id} style={{ padding: "11px 0", borderTop: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.name}</div>
              <p className="text-ink-2" style={{ fontSize: 12.5, marginTop: 2 }}>
                {METRIC_LABELS[r.metric]} = {formatMetricValue(r.metric, status[r.id].value)} ({OP_LABELS[r.operator]} {r.threshold.toLocaleString("ru-RU")})
              </p>
            </div>
          ))
        )}
        <p className="text-muted" style={{ fontSize: 11.5, marginTop: 12 }}>
          Проверка на живых данных за окно правила. Доставка в Telegram/Почту подключится позже.
        </p>
      </div>

      {editing && <AlertEditor initial={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AlertEditor({ initial, onSave, onClose }: { initial: AlertRule; onSave: (r: AlertRule) => void; onClose: () => void }) {
  const [r, setR] = useState<AlertRule>(initial);
  const set = <K extends keyof AlertRule>(k: K, v: AlertRule[K]) => setR((x) => ({ ...x, [k]: v }));
  const selCls = "border border-line bg-surface rounded-lg";
  const selStyle = { padding: "7px 9px", fontSize: 13 } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div className="bg-surface border border-line rounded-xl w-full" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line" style={{ padding: "14px 18px" }}>
          <h2 className="font-semibold" style={{ fontSize: 15 }}>Правило алерта</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3" style={{ padding: 18 }}>
          <label className="flex flex-col gap-1"><span className="text-muted" style={{ fontSize: 11.5 }}>Название</span>
            <input value={r.name} onChange={(e) => set("name", e.target.value)} className={selCls} style={selStyle} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className="text-muted" style={{ fontSize: 11.5 }}>Метрика</span>
              <select value={r.metric} onChange={(e) => set("metric", e.target.value as AlertMetric)} className={selCls} style={selStyle}>
                {Object.entries(METRIC_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1"><span className="text-muted" style={{ fontSize: 11.5 }}>Условие</span>
              <select value={r.operator} onChange={(e) => set("operator", e.target.value as AlertOp)} className={selCls} style={selStyle}>
                {Object.entries(OP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className="text-muted" style={{ fontSize: 11.5 }}>Порог</span>
              <input type="number" value={r.threshold} onChange={(e) => set("threshold", Number(e.target.value))} className={`mono ${selCls}`} style={selStyle} />
            </label>
            <label className="flex flex-col gap-1"><span className="text-muted" style={{ fontSize: 11.5 }}>Окно, дней</span>
              <input type="number" min={1} max={90} value={r.windowDays} onChange={(e) => set("windowDays", Number(e.target.value))} className={`mono ${selCls}`} style={selStyle} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className="text-muted" style={{ fontSize: 11.5 }}>Страна</span>
              <select value={r.country} onChange={(e) => set("country", e.target.value)} className={selCls} style={selStyle}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1"><span className="text-muted" style={{ fontSize: 11.5 }}>Канал</span>
              <select value={r.channel} onChange={(e) => set("channel", e.target.value as AlertChannel)} className={selCls} style={selStyle}>
                {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line" style={{ padding: "14px 18px" }}>
          <button onClick={onClose} className="border border-line hover:border-line-2" style={{ borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>Отмена</button>
          <button onClick={() => onSave(r)} className="text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500 }}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}
