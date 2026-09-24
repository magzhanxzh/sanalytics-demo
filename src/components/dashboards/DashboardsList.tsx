"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, BarChart3, Pencil, Share2, X, Check, Users } from "lucide-react";
import { CURRENT_USER, type Dashboard, type WidgetType } from "@/lib/dashboards/types";

// Мини-карта реального дашборда: каждый виджет – плитка на своём месте (по layout),
// с цветом и глифом по типу. Без загрузки данных – отражает состав и раскладку.
const TYPE_COLOR: Record<WidgetType, string> = {
  kpi: "--c2", line: "--c1", area: "--c1", bar: "--c3", pie: "--c4", table: "--c5", text: "--muted",
};

function Glyph({ type, color }: { type: WidgetType; color: string }) {
  const st = { stroke: color, fill: "none", strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  let body: React.ReactNode;
  if (type === "line") body = <polyline points="4,18 13,9 21,14 30,5 37,11" {...st} />;
  else if (type === "area") body = <><polygon points="4,18 13,9 21,14 30,5 37,11 37,23 4,23" fill={color} opacity={0.28} /><polyline points="4,18 13,9 21,14 30,5 37,11" {...st} /></>;
  else if (type === "bar") body = <g fill={color}>{[[6, 14], [14, 8], [22, 16], [30, 5]].map(([x, y], i) => <rect key={i} x={x} y={y} width={5} height={22 - y} rx={1} opacity={i % 2 ? 0.7 : 1} />)}</g>;
  else if (type === "pie") body = <circle cx={20} cy={13} r={7.5} fill="none" stroke={color} strokeWidth={4.5} strokeDasharray="30 18" transform="rotate(-90 20 13)" />;
  else if (type === "table") body = <g fill={color}>{[6, 12, 18].map((y, i) => <rect key={i} x={5} y={y} width={30} height={2.4} rx={1.2} opacity={i === 0 ? 1 : 0.55} />)}</g>;
  else if (type === "text") body = <rect x={6} y={11} width={22} height={3.4} rx={1.7} fill={color} opacity={0.7} />;
  else body = <g fill={color}><rect x={6} y={7} width={18} height={4.5} rx={2} /><rect x={6} y={15} width={11} height={3} rx={1.5} opacity={0.6} /></g>; // kpi
  return <svg viewBox="0 0 40 26" style={{ width: "76%", height: "76%" }} preserveAspectRatio="xMidYMid meet">{body}</svg>;
}

function Thumb({ d }: { d: Dashboard }) {
  const ws = d.widgets;
  if (ws.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: 92, borderBottom: "1px solid var(--line)", background: "color-mix(in srgb, var(--c2) 8%, var(--sunk))" }}>
        <BarChart3 size={22} style={{ color: "var(--c2)", opacity: 0.5 }} />
      </div>
    );
  }
  const cols = 12;
  const items = ws.map((w, i) => ({ w, l: w.layout ?? { x: (i % 3) * 4, y: Math.floor(i / 3) * 5, w: 4, h: 4 } }));
  const maxRow = Math.max(6, ...items.map(({ l }) => l.y + l.h));
  return (
    <div style={{ position: "relative", height: 92, background: "var(--sunk)", borderBottom: "1px solid var(--line)", overflow: "hidden" }}>
      {items.map(({ w, l }, i) => {
        const color = `var(${TYPE_COLOR[w.type]})`;
        return (
          <div key={w.id || i} style={{
            position: "absolute",
            left: `calc(${(l.x / cols) * 100}% + 3px)`,
            width: `calc(${(Math.min(l.w, cols - l.x) / cols) * 100}% - 6px)`,
            top: `calc(${(l.y / maxRow) * 100}% + 3px)`,
            height: `calc(${(l.h / maxRow) * 100}% - 6px)`,
            borderRadius: 4,
            background: `color-mix(in srgb, ${color} 15%, var(--surface))`,
            border: `1px solid color-mix(in srgb, ${color} 34%, transparent)`,
            display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          }}>
            <Glyph type={w.type} color={color} />
          </div>
        );
      })}
    </div>
  );
}

export function DashboardsList() {
  const router = useRouter();
  const [list, setList] = useState<Dashboard[] | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareTarget, setShareTarget] = useState<Dashboard | null>(null);
  const me = CURRENT_USER;

  async function load() {
    const r = await fetch("/api/dashboards").then((x) => x.json()).catch(() => ({ dashboards: [] }));
    setList((r.dashboards ?? []).map((d: Dashboard) => ({ ...d, sharedWith: d.sharedWith ?? [] })));
  }
  useEffect(() => { load(); }, []);

  async function save(d: Dashboard) {
    setList((l) => (l ? l.map((x) => (x.id === d.id ? d : x)) : l));
    await fetch(`/api/dashboards/${d.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dashboard: d }),
    }).catch(() => {});
  }

  async function create() {
    const r = await fetch("/api/dashboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Новый дашборд" }),
    }).then((x) => x.json());
    if (r.dashboard) router.push(`/dashboards/${r.dashboard.id}`);
  }
  async function remove(d: Dashboard) {
    if (!window.confirm(`Удалить дашборд «${d.title}»? Это действие необратимо.`)) return;
    await fetch(`/api/dashboards/${d.id}`, { method: "DELETE" }).catch(() => {});
    load();
  }
  function commitRename(d: Dashboard) {
    const title = renameValue.trim() || d.title;
    setRenamingId(null);
    if (title !== d.title) save({ ...d, title });
  }

  const mine = (list ?? []).filter((d) => d.owner === me);
  const shared = (list ?? []).filter((d) => d.owner !== me && (d.sharedWith ?? []).includes(me));

  function Card({ d }: { d: Dashboard }) {
    const renaming = renamingId === d.id;
    return (
      <div className="border border-line bg-surface rounded-xl overflow-hidden hover:border-line-2 transition-colors">
        <Link href={`/dashboards/${d.id}`} className="block">
          <Thumb d={d} />
        </Link>
        <div style={{ padding: "12px 14px" }}>
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => commitRename(d)}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(d); if (e.key === "Escape") setRenamingId(null); }}
              className="w-full border border-line rounded-md bg-surface"
              style={{ padding: "4px 6px", fontSize: 13.5, fontWeight: 600 }}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <Link href={`/dashboards/${d.id}`} style={{ fontSize: 13.5, fontWeight: 600 }} className="flex-1 truncate">{d.title}</Link>
              {d.owner === me && (
                <button onClick={() => { setRenamingId(d.id); setRenameValue(d.title); }} className="text-muted hover:text-ink p-0.5" title="Переименовать"><Pencil size={13} /></button>
              )}
            </div>
          )}
          <div className="text-muted flex items-center gap-2" style={{ fontSize: 11.5, marginTop: 3 }}>
            <span>{d.widgets.length} виджет(ов)</span>
            {(d.sharedWith ?? []).length > 0 && (
              <span className="flex items-center gap-1"><Users size={11} /> {d.sharedWith.length}</span>
            )}
            {d.owner !== me && <span>· от {d.owner}</span>}
          </div>
          {d.owner === me && (
            <div className="flex items-center gap-3" style={{ marginTop: 10 }}>
              <button onClick={() => setShareTarget(d)} className="flex items-center gap-1 text-accent" style={{ fontSize: 12 }}><Share2 size={13} /> Поделиться</button>
              <button onClick={() => remove(d)} className="flex items-center gap-1 text-muted hover:text-neg" style={{ fontSize: 12 }}><Trash2 size={13} /> Удалить</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  function Section({ title, hint, items, empty }: { title: string; hint?: string; items: Dashboard[]; empty: string }) {
    return (
      <div style={{ marginBottom: 28 }}>
        <div className="flex items-baseline gap-2" style={{ marginBottom: 12 }}>
          <h2 className="font-semibold" style={{ fontSize: 15 }}>{title}</h2>
          <span className="text-muted" style={{ fontSize: 12 }}>{items.length}{hint ? ` · ${hint}` : ""}</span>
        </div>
        {items.length === 0 ? (
          <div className="border border-dashed border-line-2 rounded-xl text-center text-muted" style={{ padding: "32px 20px", fontSize: 13 }}>{empty}</div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {items.map((d) => <Card key={d.id} d={d} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <span className="text-muted" style={{ fontSize: 13 }}>{list ? `${list.length} дашборд(ов)` : "загрузка…"}</span>
        <button onClick={create} className="flex items-center gap-2 text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 500 }}>
          <Plus size={15} /> Новый дашборд
        </button>
      </div>

      <Section title="Моя рабочая зона" items={mine} empty="Здесь ваши дашборды. Создайте первый." />
      <Section title="Предоставили доступ" hint="дашборды, которыми поделились с вами" items={shared} empty="Пока никто не поделился с вами дашбордом." />

      {shareTarget && (
        <ShareModal
          dashboard={shareTarget}
          onClose={() => setShareTarget(null)}
          onChange={(d) => { setShareTarget(d); save(d); }}
        />
      )}
    </div>
  );
}

function ShareModal({ dashboard, onClose, onChange }: { dashboard: Dashboard; onClose: () => void; onChange: (d: Dashboard) => void }) {
  const [email, setEmail] = useState("");
  const shared = dashboard.sharedWith ?? [];

  function add() {
    const v = email.trim().toLowerCase();
    if (!v || shared.includes(v)) return;
    onChange({ ...dashboard, sharedWith: [...shared, v] });
    setEmail("");
  }
  function removeUser(u: string) {
    onChange({ ...dashboard, sharedWith: shared.filter((x) => x !== u) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div className="bg-surface border border-line rounded-xl w-full" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line" style={{ padding: "14px 18px" }}>
          <h2 className="font-semibold" style={{ fontSize: 15 }}>Доступ к «{dashboard.title}»</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div style={{ padding: 18 }}>
          <div className="flex items-center gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
              placeholder="email коллеги"
              className="flex-1 border border-line bg-surface rounded-lg"
              style={{ padding: "8px 10px", fontSize: 13 }}
            />
            <button onClick={add} className="text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500 }}>Добавить</button>
          </div>
          <div className="flex flex-col gap-1" style={{ marginTop: 14 }}>
            <div className="text-muted" style={{ fontSize: 11.5, marginBottom: 4 }}>Есть доступ:</div>
            <div className="flex items-center gap-2" style={{ fontSize: 13 }}>
              <span className="mono flex items-center justify-center bg-sunk border border-line" style={{ width: 24, height: 24, borderRadius: 99, fontSize: 11 }}>{dashboard.owner[0]?.toUpperCase()}</span>
              {dashboard.owner} <span className="text-muted" style={{ fontSize: 12 }}>· владелец</span>
            </div>
            {shared.length === 0 ? (
              <div className="text-muted" style={{ fontSize: 12.5, marginTop: 4 }}>Пока только у вас.</div>
            ) : (
              shared.map((u) => (
                <div key={u} className="flex items-center gap-2 justify-between" style={{ fontSize: 13, padding: "4px 0" }}>
                  <span className="flex items-center gap-2"><Check size={14} className="text-pos" /> {u}</span>
                  <button onClick={() => removeUser(u)} className="text-muted hover:text-neg" title="Убрать"><X size={14} /></button>
                </div>
              ))
            )}
          </div>
          <p className="text-muted" style={{ fontSize: 11.5, marginTop: 14 }}>
            Реальная выдача доступа заработает после подключения авторизации. Пока список сохраняется в дашборде.
          </p>
        </div>
      </div>
    </div>
  );
}
