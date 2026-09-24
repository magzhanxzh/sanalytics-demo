"use client";

import { useEffect, useState } from "react";
import { Settings2, X, Loader2, CheckCircle2, XCircle, Send } from "lucide-react";

type FieldSpec = { key: string; label: string; secret?: boolean; optional?: boolean; placeholder?: string };
type Spec = { id: string; ab: string; name: string; type: string; desc: string; kind: "ads" | "notify"; fields: FieldSpec[] };
type View = { id: string; enabled: boolean; configured: boolean; fields: Record<string, string>; secretsSet: Record<string, boolean> };
type Payload = { specs: Spec[]; connectors: View[]; canManage: boolean };

function Pill({ text, kind }: { text: string; kind: "ok" | "warn" | "soon" }) {
  const style =
    kind === "ok" ? { background: "var(--accent-soft)", color: "var(--accent)" }
    : kind === "warn" ? { background: "var(--sunk)", color: "var(--ink-2)" }
    : { background: "var(--sunk)", color: "var(--muted)" };
  return <span className="mono" style={{ ...style, fontSize: 10.5, padding: "3px 7px", borderRadius: 99 }}>{text}</span>;
}

export function ConnectorsPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, { ok: boolean; text: string }>>({});

  async function load() {
    try { setData(await (await fetch("/api/connectors", { cache: "no-store" })).json()); } catch { /* keep */ }
  }
  useEffect(() => { load(); }, []);

  async function toggle(id: string, enabled: boolean) {
    await fetch("/api/connectors", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, enabled }) });
    load();
  }
  async function telegramTest() {
    setTesting("telegram"); setResult((r) => ({ ...r, telegram: undefined as never }));
    try {
      const d = await (await fetch("/api/connectors/telegram-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json();
      setResult((r) => ({ ...r, telegram: { ok: !!d.ok, text: d.ok ? "сообщение отправлено" : (d.error || "ошибка") } }));
    } catch (e) { setResult((r) => ({ ...r, telegram: { ok: false, text: String(e).slice(0, 140) } })); }
    finally { setTesting(null); }
  }

  if (!data) return <div className="text-muted" style={{ fontSize: 13 }}>Загрузка…</div>;
  const specById = (id: string) => data.specs.find((s) => s.id === id)!;
  // Рекламные площадки вынесены в «Рекламные кабинеты» (по странам); здесь – уведомления.
  const notifyConnectors = data.connectors.filter((v) => specById(v.id)?.kind === "notify");

  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
      {notifyConnectors.map((v) => {
        const spec = specById(v.id);
        const res = result[v.id];
        const pill = v.enabled && v.configured ? <Pill text="подключён" kind="ok" />
          : v.configured ? <Pill text="настроен" kind="warn" />
          : <Pill text="не настроен" kind="soon" />;
        return (
          <div key={v.id} className="border border-line bg-surface rounded-xl flex flex-col" style={{ padding: 16, gap: 12 }}>
            <div className="flex items-center gap-3">
              <span className="mono flex items-center justify-center bg-sunk border border-line" style={{ width: 30, height: 30, borderRadius: 7, fontSize: 12, fontWeight: 600 }}>{spec.ab}</span>
              <div className="flex-1">
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{spec.name}</div>
                <div className="text-muted" style={{ fontSize: 11.5 }}>{spec.type}</div>
              </div>
              {pill}
            </div>
            <p className="text-ink-2" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{spec.desc}</p>

            {res && (
              <div className="flex items-start gap-1.5" style={{ fontSize: 11.5, color: res.ok ? "var(--accent)" : "var(--neg)" }}>
                {res.ok ? <CheckCircle2 size={13} style={{ marginTop: 1 }} /> : <XCircle size={13} style={{ marginTop: 1 }} />}
                <span className="mono" style={{ wordBreak: "break-word" }}>{res.text}</span>
              </div>
            )}

            <div className="border-t border-line flex items-center justify-between gap-2" style={{ paddingTop: 11 }}>
              {data.canManage ? (
                <>
                  <label className="flex items-center gap-1.5 cursor-pointer text-muted" style={{ fontSize: 12 }}>
                    <input type="checkbox" checked={v.enabled} disabled={!v.configured} onChange={(e) => toggle(v.id, e.target.checked)} />
                    Включён
                  </label>
                  <div className="flex items-center gap-2">
                    <button onClick={telegramTest} disabled={!v.configured || testing === v.id} className="inline-flex items-center gap-1 text-muted hover:text-ink disabled:opacity-40" style={{ fontSize: 12 }}>
                      {testing === v.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Тест
                    </button>
                    <button onClick={() => setEditing(v.id)} className="inline-flex items-center gap-1 text-muted hover:text-ink" style={{ fontSize: 12 }}>
                      <Settings2 size={13} /> Настроить
                    </button>
                  </div>
                </>
              ) : <span className="text-muted mono" style={{ fontSize: 11 }}>только чтение</span>}
            </div>
          </div>
        );
      })}

      {editing && (
        <ConnectorEditor
          spec={specById(editing)}
          view={data.connectors.find((c) => c.id === editing)!}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ConnectorEditor({ spec, view, onClose, onSaved }: { spec: Spec; view: View; onClose: () => void; onSaved: () => void }) {
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of spec.fields) init[f.key] = f.secret ? "" : (view.fields[f.key] ?? "");
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/connectors", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: spec.id, fields }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "не удалось сохранить"); return; }
      onSaved();
    } catch (e) { setErr(String(e).slice(0, 160)); }
    finally { setBusy(false); }
  }

  const field = { padding: "8px 10px", fontSize: 13 } as const;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div className="bg-surface border border-line rounded-xl w-full" style={{ maxWidth: 520, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line" style={{ padding: "14px 18px" }}>
          <h2 className="font-semibold" style={{ fontSize: 15 }}>{spec.name}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3" style={{ padding: 18 }}>
          {spec.fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-muted" style={{ fontSize: 11.5 }}>{f.label}{f.optional ? " (необязательно)" : ""}</span>
              <input
                type={f.secret ? "password" : "text"}
                value={fields[f.key]}
                onChange={(e) => setFields((x) => ({ ...x, [f.key]: e.target.value }))}
                placeholder={f.secret && view.secretsSet[f.key] ? "•••••••• (сохранён, оставьте пустым)" : (f.placeholder ?? "")}
                className="border border-line bg-surface rounded-lg mono" style={field}
              />
            </label>
          ))}
          {err && <div style={{ fontSize: 12.5, color: "var(--neg)" }}>{err}</div>}
          <p className="text-muted" style={{ fontSize: 11 }}>Секреты хранятся на сервере (data/), в браузер не отдаются. После сохранения нажмите «Проверить», затем «Включён».</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line" style={{ padding: "14px 18px" }}>
          <button onClick={onClose} className="border border-line hover:border-line-2" style={{ borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>Отмена</button>
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 disabled:opacity-50 text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500 }}>
            {busy && <Loader2 size={14} className="animate-spin" />} Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
