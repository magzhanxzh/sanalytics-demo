"use client";

import { useEffect, useState } from "react";
import { Settings2, X, RefreshCw, Loader2, CheckCircle2, XCircle, Plus, Trash2 } from "lucide-react";

type AfPlatform = "android" | "ios" | "other";
type AfApp = { id: string; platform: AfPlatform };
type AfConfigView = { configured: boolean; apps: AfApp[]; timezone: string; hasToken: boolean };
type AfSourceRow = { mediaSource: string; impressions: number; clicks: number; installs: number; cost: number };
type AfAppTotal = { id: string; platform: AfPlatform; installs: number; cost: number; error?: string };
type AfSync = { at: string; from: string; to: string; rows: AfSourceRow[]; byApp: AfAppTotal[]; totalInstalls: number; totalCost: number; note?: string };
type Payload = { config: AfConfigView; lastSync: AfSync | null; canManage: boolean };

const PLATFORM_LABEL: Record<AfPlatform, string> = { android: "Android", ios: "iOS", other: "Другое" };
const nf = new Intl.NumberFormat("ru-RU");
function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }

function Pill({ text, kind }: { text: string; kind: "ok" | "error" | "soon" }) {
  const style =
    kind === "ok" ? { background: "var(--accent-soft)", color: "var(--accent)" }
    : kind === "error" ? { background: "oklch(0.93 0.05 28)", color: "var(--neg)" }
    : { background: "var(--sunk)", color: "var(--muted)" };
  return <span className="mono" style={{ ...style, fontSize: 10.5, padding: "3px 7px", borderRadius: 99 }}>{text}</span>;
}

export function AppsFlyerCard() {
  const [data, setData] = useState<Payload | null>(null);
  const [editing, setEditing] = useState(false);
  const [from, setFrom] = useState(fmtDate(new Date(Date.now() - 30 * 864e5)));
  const [to, setTo] = useState(fmtDate(new Date()));
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try { setData(await (await fetch("/api/appsflyer", { cache: "no-store" })).json()); } catch { /* keep */ }
  }
  useEffect(() => { load(); }, []);

  async function sync() {
    setSyncing(true); setMsg(null);
    try {
      const r = await fetch("/api/appsflyer/sync", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const d = await r.json();
      if (d.ok) { setMsg({ ok: true, text: `Готово: установок ${nf.format(d.sync.totalInstalls)} по ${d.sync.rows.length} источникам` }); load(); }
      else setMsg({ ok: false, text: d.error || "ошибка синхронизации" });
    } catch (e) { setMsg({ ok: false, text: String(e).slice(0, 160) }); }
    finally { setSyncing(false); }
  }

  const cfg = data?.config;
  const last = data?.lastSync;

  return (
    <>
      <div className="border border-line bg-surface rounded-xl flex flex-col" style={{ padding: 16, gap: 12 }}>
        <div className="flex items-center gap-3">
          <span className="mono flex items-center justify-center bg-sunk border border-line" style={{ width: 30, height: 30, borderRadius: 7, fontSize: 12, fontWeight: 600 }}>AF</span>
          <div className="flex-1">
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>AppsFlyer</div>
            <div className="text-muted" style={{ fontSize: 11.5 }}>MMP · установки и медиа-источники</div>
          </div>
          {cfg ? (cfg.configured ? <Pill text="подключён" kind="ok" /> : <Pill text="не настроен" kind="soon" />) : <Pill text="…" kind="soon" />}
        </div>

        <p className="text-ink-2" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          Агрегатный отчёт Pull API v2 (медиа-источник × дата) по всем приложениям: показы, клики, установки, расход.
        </p>

        {cfg?.configured && (
          <div className="flex flex-wrap items-end gap-2 border-t border-line" style={{ paddingTop: 11 }}>
            <label className="flex flex-col gap-1">
              <span className="text-muted" style={{ fontSize: 10.5 }}>с</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-line bg-surface rounded-lg mono" style={{ padding: "5px 7px", fontSize: 12 }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted" style={{ fontSize: 10.5 }}>по</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-line bg-surface rounded-lg mono" style={{ padding: "5px 7px", fontSize: 12 }} />
            </label>
            <button onClick={sync} disabled={syncing} className="inline-flex items-center gap-1.5 border border-line hover:border-line-2 disabled:opacity-50" style={{ borderRadius: 8, padding: "7px 12px", fontSize: 12.5 }}>
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Синхронизировать
            </button>
          </div>
        )}

        {msg && (
          <div className="flex items-start gap-2" style={{ fontSize: 12, color: msg.ok ? "var(--accent)" : "var(--neg)" }}>
            {msg.ok ? <CheckCircle2 size={14} style={{ marginTop: 1 }} /> : <XCircle size={14} style={{ marginTop: 1 }} />}
            <span className="mono" style={{ wordBreak: "break-word" }}>{msg.text}</span>
          </div>
        )}

        {last && last.byApp && last.byApp.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mono text-muted" style={{ fontSize: 11 }}>
            {last.byApp.map((a) => (
              <span key={a.id} style={a.error ? { color: "var(--neg)" } : undefined}>
                {PLATFORM_LABEL[a.platform]}: {a.error ? "ошибка" : nf.format(a.installs)}
              </span>
            ))}
          </div>
        )}

        {last && last.rows.length > 0 && (
          <div className="border-t border-line" style={{ paddingTop: 11 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <span className="text-muted mono" style={{ fontSize: 11 }}>{last.from} → {last.to} · установок {nf.format(last.totalInstalls)}</span>
            </div>
            <table className="w-full" style={{ fontSize: 12 }}>
              <thead>
                <tr className="text-muted" style={{ textAlign: "left" }}>
                  <th style={{ fontWeight: 500, paddingBottom: 4 }}>Медиа-источник</th>
                  <th style={{ fontWeight: 500, textAlign: "right" }}>Установки</th>
                  <th style={{ fontWeight: 500, textAlign: "right" }}>Клики</th>
                  {last.totalCost > 0 && <th style={{ fontWeight: 500, textAlign: "right" }}>Расход</th>}
                </tr>
              </thead>
              <tbody className="mono">
                {last.rows.slice(0, 8).map((r) => (
                  <tr key={r.mediaSource} className="border-t border-line">
                    <td style={{ padding: "5px 0" }}>{r.mediaSource}</td>
                    <td style={{ textAlign: "right" }}>{nf.format(r.installs)}</td>
                    <td style={{ textAlign: "right" }}>{nf.format(r.clicks)}</td>
                    {last.totalCost > 0 && <td style={{ textAlign: "right" }}>${nf.format(Math.round(r.cost))}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {last.note && <p className="text-muted" style={{ fontSize: 10.5, marginTop: 6 }}>{last.note}</p>}
          </div>
        )}

        <div className="border-t border-line flex items-center justify-between" style={{ paddingTop: 11 }}>
          <span className="mono text-muted" style={{ fontSize: 11 }}>
            {cfg && cfg.apps.length > 0 ? cfg.apps.map((a) => PLATFORM_LABEL[a.platform]).join(" · ") : "приложения не заданы"}
          </span>
          {data?.canManage && (
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-muted hover:text-ink" style={{ fontSize: 12 }}>
              <Settings2 size={13} /> Настроить
            </button>
          )}
        </div>
      </div>

      {editing && cfg && (
        <AfEditor initial={cfg} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
      )}
    </>
  );
}

function AfEditor({ initial, onClose, onSaved }: { initial: AfConfigView; onClose: () => void; onSaved: () => void }) {
  const [apps, setApps] = useState<AfApp[]>(
    initial.apps.length > 0 ? initial.apps : [{ id: "", platform: "android" }, { id: "", platform: "ios" }]
  );
  const [timezone, setTimezone] = useState(initial.timezone);
  const [token, setToken] = useState("");
  const [tokenTouched, setTokenTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const setApp = (i: number, patch: Partial<AfApp>) => setApps((xs) => xs.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const addApp = () => setApps((xs) => [...xs, { id: "", platform: "other" }]);
  const removeApp = (i: number) => setApps((xs) => xs.filter((_, j) => j !== i));

  async function save() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/appsflyer", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apps: apps.filter((a) => a.id.trim()), timezone, token: tokenTouched ? token : null }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "не удалось сохранить"); return; }
      onSaved();
    } catch (e) { setErr(String(e).slice(0, 160)); }
    finally { setBusy(false); }
  }

  const field = { padding: "8px 10px", fontSize: 13 } as const;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div className="bg-surface border border-line rounded-xl w-full" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line" style={{ padding: "14px 18px" }}>
          <h2 className="font-semibold" style={{ fontSize: 15 }}>AppsFlyer</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3" style={{ padding: 18 }}>
          <div className="flex flex-col gap-2">
            <span className="text-muted" style={{ fontSize: 11.5 }}>Приложения (App ID из AF)</span>
            {apps.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={a.platform} onChange={(e) => setApp(i, { platform: e.target.value as AfPlatform })} className="border border-line bg-surface rounded-lg" style={{ padding: "8px 8px", fontSize: 12.5 }}>
                  <option value="android">Android</option>
                  <option value="ios">iOS</option>
                  <option value="other">Другое</option>
                </select>
                <input value={a.id} onChange={(e) => setApp(i, { id: e.target.value })} placeholder={a.platform === "ios" ? "id123456789" : "com.example.shop"} className="border border-line bg-surface rounded-lg mono flex-1" style={field} />
                {apps.length > 1 && (
                  <button onClick={() => removeApp(i)} className="text-muted hover:text-[color:var(--neg)]" aria-label="удалить"><Trash2 size={15} /></button>
                )}
              </div>
            ))}
            <button onClick={addApp} className="inline-flex items-center gap-1.5 text-muted hover:text-ink self-start" style={{ fontSize: 12 }}>
              <Plus size={13} /> Добавить приложение
            </button>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-muted" style={{ fontSize: 11.5 }}>Часовой пояс (необязательно)</span>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Almaty" className="border border-line bg-surface rounded-lg mono" style={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted" style={{ fontSize: 11.5 }}>Токен Pull API v2 (Bearer) – один на аккаунт</span>
            <input type="password" value={token} onChange={(e) => { setToken(e.target.value); setTokenTouched(true); }}
              placeholder={initial.hasToken ? "•••••••• (сохранён, оставьте пустым чтобы не менять)" : "вставьте токен из AF Security Center"}
              className="border border-line bg-surface rounded-lg mono" style={field} />
          </label>
          {err && <div style={{ fontSize: 12.5, color: "var(--neg)" }}>{err}</div>}
          <p className="text-muted" style={{ fontSize: 11 }}>Токен один для всех приложений аккаунта, хранится на сервере и в браузер не отдаётся. В демо-режиме Pull API не вызывается.</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line" style={{ padding: "14px 18px" }}>
          <button onClick={onClose} className="border border-line hover:border-line-2" style={{ borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>Отмена</button>
          <button onClick={save} disabled={busy || apps.every((a) => !a.id.trim())} className="inline-flex items-center gap-1.5 disabled:opacity-50 text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500 }}>
            {busy && <Loader2 size={14} className="animate-spin" />} Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
