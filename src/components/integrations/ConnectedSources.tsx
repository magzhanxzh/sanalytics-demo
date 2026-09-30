"use client";

import { useEffect, useState } from "react";
import { Settings2, X, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type SourceStatus = { configured: boolean; ok: boolean; detail?: string };
type ConnView = { source: "ui" | "env" | "none"; url: string; username: string; database: string; hasPassword: boolean };
type Payload = { connection: ConnView; status: { ch: SourceStatus; pg: SourceStatus }; canManage: boolean };

function Pill({ text, kind }: { text: string; kind: "ok" | "error" | "soon" }) {
  const style =
    kind === "ok" ? { background: "var(--accent-soft)", color: "var(--accent)" }
    : kind === "error" ? { background: "oklch(0.93 0.05 28)", color: "var(--neg)" }
    : { background: "var(--sunk)", color: "var(--muted)" };
  return <span className="mono" style={{ ...style, fontSize: 10.5, padding: "3px 7px", borderRadius: 99 }}>{text}</span>;
}
function pillFor(s: SourceStatus) {
  if (!s.configured) return <Pill text="not configured" kind="soon" />;
  return s.ok ? <Pill text="connected" kind="ok" /> : <Pill text="error" kind="error" />;
}

function Card({ ab, name, type, desc, pill, detail, badge }: {
  ab: string; name: string; type: string; desc: string; pill: React.ReactNode; detail: string; badge?: React.ReactNode;
}) {
  return (
    <div className="border border-line bg-surface rounded-xl flex flex-col" style={{ padding: 16, gap: 12 }}>
      <div className="flex items-center gap-3">
        <span className="mono flex items-center justify-center bg-sunk border border-line" style={{ width: 30, height: 30, borderRadius: 7, fontSize: 12, fontWeight: 600 }}>{ab}</span>
        <div className="flex-1">
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{name}</div>
          <div className="text-muted" style={{ fontSize: 11.5 }}>{type}</div>
        </div>
        {pill}
      </div>
      <p className="text-ink-2" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{desc}</p>
      <div className="border-t border-line flex items-center justify-between gap-2" style={{ paddingTop: 11 }}>
        <span className="mono text-muted" style={{ fontSize: 11 }}>{detail}</span>
        {badge}
      </div>
    </div>
  );
}

export function ConnectedSources() {
  const [data, setData] = useState<Payload | null>(null);
  const [editing, setEditing] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/connections", { cache: "no-store" });
      setData(await r.json());
    } catch { /* keep the previous state */ }
  }
  useEffect(() => { load(); }, []);

  const c = data?.connection;
  const sourceBadge = c
    ? c.source === "ui" ? <Pill text="set in UI" kind="ok" />
      : c.source === "env" ? <Pill text="from .env.local" kind="soon" />
      : <Pill text="demo mode" kind="soon" />
    : null;

  return (
    <>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h2 className="font-semibold" style={{ fontSize: 15 }}>Connected</h2>
        {data?.canManage && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 border border-line hover:border-line-2"
            style={{ borderRadius: 8, padding: "7px 12px", fontSize: 12.5 }}
          >
            <Settings2 size={14} /> Configure connection
          </button>
        )}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 28 }}>
        <Card
          ab="CH" name="ClickHouse" type="database (synthetic in demo)"
          desc="Orders, revenue, users. The main DWH. In the demo it is replaced by a synthetic in-memory store."
          pill={data ? pillFor(data.status.ch) : <Pill text="…" kind="soon" />}
          detail={data?.status.ch.detail ?? ""}
          badge={sourceBadge}
        />
        <Card
          ab="PG" name="PostgreSQL" type="database (via ClickHouse)"
          desc="Sign-ups and user profiles, read through the ClickHouse -> PostgreSQL bridge."
          pill={data ? pillFor(data.status.pg) : <Pill text="…" kind="soon" />}
          detail={data?.status.pg.detail ?? ""}
        />
      </div>

      {editing && c && (
        <ConnectionEditor
          initial={c}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}
    </>
  );
}

function ConnectionEditor({ initial, onClose, onSaved }: {
  initial: ConnView; onClose: () => void; onSaved: () => void;
}) {
  const [url, setUrl] = useState(initial.url);
  const [username, setUsername] = useState(initial.username);
  const [database, setDatabase] = useState(initial.database);
  const [password, setPassword] = useState("");
  const [pwTouched, setPwTouched] = useState(false);
  const [busy, setBusy] = useState<"test" | "save" | "reset" | null>(null);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [err, setErr] = useState("");

  // password: if the field was not touched, send null ("keep as is")
  const pwPayload = () => (pwTouched ? password : null);

  async function doTest() {
    setBusy("test"); setTest(null); setErr("");
    try {
      const r = await fetch("/api/connections/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, username, database, password: pwPayload() }),
      });
      const d = await r.json();
      if (d.ok) setTest({ ok: true, text: `version ${d.version}, ${d.ms} ms, PostgreSQL bridge: ${d.pgBridge ? "yes" : "no"}` });
      else setTest({ ok: false, text: d.error || "could not connect" });
    } catch (e) { setTest({ ok: false, text: String(e).slice(0, 160) }); }
    finally { setBusy(null); }
  }

  async function doSave() {
    setBusy("save"); setErr("");
    try {
      const r = await fetch("/api/connections", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, username, database, password: pwPayload() }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "could not save"); return; }
      onSaved();
    } catch (e) { setErr(String(e).slice(0, 160)); }
    finally { setBusy(null); }
  }

  async function doReset() {
    if (!window.confirm("Remove the UI connection and fall back to .env.local?")) return;
    setBusy("reset"); setErr("");
    try {
      const r = await fetch("/api/connections", { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "could not reset"); return; }
      onSaved();
    } catch (e) { setErr(String(e).slice(0, 160)); }
    finally { setBusy(null); }
  }

  const field = { padding: "8px 10px", fontSize: 13 } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div className="bg-surface border border-line rounded-xl w-full" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line" style={{ padding: "14px 18px" }}>
          <h2 className="font-semibold" style={{ fontSize: 15 }}>ClickHouse connection</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>

        <div className="flex flex-col gap-3" style={{ padding: 18 }}>
          <label className="flex flex-col gap-1">
            <span className="text-muted" style={{ fontSize: 11.5 }}>URL (host:port)</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://host:8123" className="border border-line bg-surface rounded-lg mono" style={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-muted" style={{ fontSize: 11.5 }}>User</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="default" className="border border-line bg-surface rounded-lg mono" style={field} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted" style={{ fontSize: 11.5 }}>Database (optional)</span>
              <input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="default" className="border border-line bg-surface rounded-lg mono" style={field} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-muted" style={{ fontSize: 11.5 }}>Password</span>
            <input
              type="password" value={password}
              onChange={(e) => { setPassword(e.target.value); setPwTouched(true); }}
              placeholder={initial.hasPassword ? "•••••••• (saved, leave empty to keep)" : "not set"}
              className="border border-line bg-surface rounded-lg mono" style={field}
            />
          </label>

          {test && (
            <div className="flex items-start gap-2" style={{ fontSize: 12.5, color: test.ok ? "var(--accent)" : "var(--neg)" }}>
              {test.ok ? <CheckCircle2 size={15} style={{ marginTop: 1 }} /> : <XCircle size={15} style={{ marginTop: 1 }} />}
              <span className="mono" style={{ wordBreak: "break-word" }}>{test.text}</span>
            </div>
          )}
          {err && <div style={{ fontSize: 12.5, color: "var(--neg)" }}>{err}</div>}
          <p className="text-muted" style={{ fontSize: 11 }}>A UI connection takes priority over .env.local. The password is stored on the server (data/) and never sent to the browser.</p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line" style={{ padding: "14px 18px" }}>
          <div>
            {initial.source === "ui" && (
              <button onClick={doReset} disabled={busy !== null} className="text-muted hover:text-ink disabled:opacity-50" style={{ fontSize: 12.5 }}>
                Reset to .env
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={doTest} disabled={busy !== null || !url} className="inline-flex items-center gap-1.5 border border-line hover:border-line-2 disabled:opacity-50" style={{ borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>
              {busy === "test" && <Loader2 size={14} className="animate-spin" />} Test
            </button>
            <button onClick={doSave} disabled={busy !== null || !url} className="inline-flex items-center gap-1.5 disabled:opacity-50 text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500 }}>
              {busy === "save" && <Loader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
