"use client";

import { useEffect, useState } from "react";
import { Settings2, X, Loader2, CheckCircle2, XCircle, Plus, Trash2 } from "lucide-react";

type FieldSpec = { key: string; label: string; secret?: boolean; optional?: boolean; placeholder?: string };
type Spec = { id: string; ab: string; name: string; fields: FieldSpec[] };
type Country = { code: string; label: string };
type View = { id: string; provider: string; country: string; label?: string; enabled: boolean; configured: boolean; fields: Record<string, string>; secretsSet: Record<string, boolean> };
type Payload = { specs: Spec[]; countries: Country[]; accounts: View[]; canManage: boolean };

function Pill({ text, kind }: { text: string; kind: "ok" | "warn" | "soon" }) {
  const style = kind === "ok" ? { background: "var(--accent-soft)", color: "var(--accent)" } : { background: "var(--sunk)", color: "var(--muted)" };
  return <span className="mono" style={{ ...style, fontSize: 10.5, padding: "3px 7px", borderRadius: 99 }}>{text}</span>;
}

export function AdAccountsPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [editing, setEditing] = useState<View | "new" | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, { ok: boolean; text: string }>>({});

  async function load() {
    try { setData(await (await fetch("/api/ad-accounts", { cache: "no-store" })).json()); } catch { /* keep */ }
  }
  useEffect(() => { load(); }, []);

  const specName = (p: string) => data?.specs.find((s) => s.id === p)?.name ?? p;
  const specAb = (p: string) => data?.specs.find((s) => s.id === p)?.ab ?? "?";
  const countryLabel = (c: string) => data?.countries.find((x) => x.code === c)?.label ?? c;

  async function toggle(a: View, enabled: boolean) {
    await fetch("/api/ad-accounts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id, provider: a.provider, country: a.country, enabled }) });
    load();
  }
  async function test(a: View) {
    setTesting(a.id); setResult((r) => ({ ...r, [a.id]: undefined as never }));
    try {
      const d = await (await fetch("/api/ad-accounts/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) })).json();
      setResult((r) => ({ ...r, [a.id]: { ok: !!d.ok, text: d.ok ? (d.detail || "подключение работает") : (d.error || "ошибка") } }));
    } catch (e) { setResult((r) => ({ ...r, [a.id]: { ok: false, text: String(e).slice(0, 140) } })); }
    finally { setTesting(null); }
  }
  async function remove(a: View) {
    setConfirmId(null);
    await fetch(`/api/ad-accounts?id=${a.id}`, { method: "DELETE" });
    load();
  }

  if (!data) return <div className="text-muted" style={{ fontSize: 13 }}>Загрузка…</div>;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 12.5 }}>Несколько кабинетов на площадку – по одному на страну. Расход каждого привязывается к его стране.</p>
        {data.canManage && (
          <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 500 }}>
            <Plus size={14} /> Добавить кабинет
          </button>
        )}
      </div>

      {data.accounts.length === 0 ? (
        <div className="border border-dashed border-line-2 rounded-xl text-center text-muted" style={{ padding: "28px 20px", fontSize: 13 }}>
          Кабинетов пока нет. {data.canManage ? "Нажмите «Добавить кабинет»." : "Добавить может владелец/админ."}
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {data.accounts.map((a) => {
            const res = result[a.id];
            const pill = a.enabled && a.configured ? <Pill text="подключён" kind="ok" /> : a.configured ? <Pill text="настроен" kind="warn" /> : <Pill text="не настроен" kind="soon" />;
            return (
              <div key={a.id} className="border border-line bg-surface rounded-xl flex flex-col" style={{ padding: 16, gap: 12 }}>
                <div className="flex items-center gap-3">
                  <span className="mono flex items-center justify-center bg-sunk border border-line" style={{ width: 30, height: 30, borderRadius: 7, fontSize: 12, fontWeight: 600 }}>{specAb(a.provider)}</span>
                  <div className="flex-1">
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{specName(a.provider)}</div>
                    <div className="text-muted" style={{ fontSize: 11.5 }}>{countryLabel(a.country)}{a.label ? ` · ${a.label}` : ""}</div>
                  </div>
                  {pill}
                </div>
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
                        <input type="checkbox" checked={a.enabled} disabled={!a.configured} onChange={(e) => toggle(a, e.target.checked)} /> Включён
                      </label>
                      <div className="flex items-center gap-2">
                        {confirmId === a.id ? (
                          <span className="inline-flex items-center gap-2" style={{ fontSize: 12 }}>
                            <span className="text-muted">Удалить?</span>
                            <button onClick={() => remove(a)} className="text-[color:var(--neg)]" style={{ fontWeight: 600 }}>Да</button>
                            <button onClick={() => setConfirmId(null)} className="text-muted hover:text-ink">Нет</button>
                          </span>
                        ) : (
                          <>
                            <button onClick={() => test(a)} disabled={!a.configured || testing === a.id} className="inline-flex items-center gap-1 text-muted hover:text-ink disabled:opacity-40" style={{ fontSize: 12 }}>
                              {testing === a.id ? <Loader2 size={13} className="animate-spin" /> : null} Проверить
                            </button>
                            <button onClick={() => setEditing(a)} className="text-muted hover:text-ink" title="Настроить"><Settings2 size={13} /></button>
                            <button onClick={() => setConfirmId(a.id)} className="text-muted hover:text-[color:var(--neg)]" title="Удалить"><Trash2 size={13} /></button>
                          </>
                        )}
                      </div>
                    </>
                  ) : <span className="text-muted mono" style={{ fontSize: 11 }}>только чтение</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <AccountEditor
          specs={data.specs}
          countries={data.countries}
          account={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function AccountEditor({ specs, countries, account, onClose, onSaved }: {
  specs: Spec[]; countries: Country[]; account: View | null; onClose: () => void; onSaved: () => void;
}) {
  const [provider, setProvider] = useState(account?.provider ?? specs[0]?.id ?? "meta_ads");
  const [country, setCountry] = useState(account?.country ?? countries[0]?.code ?? "KZ");
  const spec = specs.find((s) => s.id === provider)!;
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of spec.fields) init[f.key] = f.secret ? "" : (account?.fields[f.key] ?? "");
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // при смене площадки – сбросить поля под её спеку
  function changeProvider(p: string) {
    setProvider(p);
    const sp = specs.find((s) => s.id === p)!;
    const init: Record<string, string> = {};
    for (const f of sp.fields) init[f.key] = "";
    setFields(init);
  }

  async function save() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/ad-accounts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: account?.id, provider, country, fields }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "не удалось сохранить"); return; }
      onSaved();
    } catch (e) { setErr(String(e).slice(0, 160)); }
    finally { setBusy(false); }
  }

  const inp = { padding: "8px 10px", fontSize: 13 } as const;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div className="bg-surface border border-line rounded-xl w-full" style={{ maxWidth: 520, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line" style={{ padding: "14px 18px" }}>
          <h2 className="font-semibold" style={{ fontSize: 15 }}>{account ? "Кабинет" : "Новый кабинет"}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3" style={{ padding: 18 }}>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-muted" style={{ fontSize: 11.5 }}>Площадка</span>
              <select value={provider} onChange={(e) => changeProvider(e.target.value)} disabled={!!account} className="border border-line bg-surface rounded-lg disabled:opacity-60" style={inp}>
                {specs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted" style={{ fontSize: 11.5 }}>Страна</span>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="border border-line bg-surface rounded-lg" style={inp}>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
          </div>
          {spec.fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-muted" style={{ fontSize: 11.5 }}>{f.label}{f.optional ? " (необязательно)" : ""}</span>
              <input
                type={f.secret ? "password" : "text"}
                value={fields[f.key] ?? ""}
                onChange={(e) => setFields((x) => ({ ...x, [f.key]: e.target.value }))}
                placeholder={f.secret && account?.secretsSet[f.key] ? "•••••••• (сохранён, оставьте пустым)" : (f.placeholder ?? "")}
                className="border border-line bg-surface rounded-lg mono" style={inp}
              />
            </label>
          ))}
          {err && <div style={{ fontSize: 12.5, color: "var(--neg)" }}>{err}</div>}
          <p className="text-muted" style={{ fontSize: 11 }}>Секреты хранятся на сервере (data/), в браузер не отдаются. После сохранения – «Проверить», затем «Включён».</p>
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
