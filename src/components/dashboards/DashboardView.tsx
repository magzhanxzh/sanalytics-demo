"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import RGL, { WidthProvider, type Layout as LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Plus, ArrowLeft, Check, RefreshCw } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { WidgetEditor } from "./WidgetEditor";
import { DateRangePicker } from "@/components/DateRangePicker";
import { COUNTRIES, FALLBACK_CREATORS, FALLBACK_USER_CREATORS, formatRange } from "@/lib/queries/cards";
import { useAccess, countryOptions } from "@/lib/auth/useAccess";
import { CURRENT_USER, defaultDashboardFilters, type Dashboard, type Widget, type WidgetLayout } from "@/lib/dashboards/types";

const Grid = WidthProvider(RGL);
const COLS = 12;

function defaultLayout(w: Widget, idx: number): WidgetLayout {
  const h = w.type === "kpi" ? 3 : w.type === "text" ? 2 : 5;
  return { x: (idx % 3) * 4, y: Math.floor(idx / 3) * 5, w: 4, h };
}

export function DashboardView({ initial }: { initial: Dashboard }) {
  const [dash, setDash] = useState<Dashboard>({ ...initial, filters: initial.filters ?? defaultDashboardFilters(), sharedWith: initial.sharedWith ?? [] });
  const [editing, setEditing] = useState<Widget | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ocreators, setOcreators] = useState<string[]>(FALLBACK_CREATORS);
  const [ucreators, setUcreators] = useState<string[]>(FALLBACK_USER_CREATORS);
  const access = useAccess();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Редактировать может только владелец. Получатель общего дашборда видит его только для чтения.
  const canEdit = dash.owner === CURRENT_USER;

  useEffect(() => {
    fetch("/api/meta/creators").then((r) => r.json()).then((d) => {
      if (Array.isArray(d.orderCreators)) setOcreators(d.orderCreators);
      if (Array.isArray(d.userCreators)) setUcreators(d.userCreators);
    }).catch(() => {});
  }, []);

  // В продакшене получатель подписан на Supabase Realtime и видит правки владельца сразу.

  // Перечитать актуальную версию дашборда.
  async function reloadDash() {
    try {
      const r = await fetch(`/api/dashboards/${dash.id}`).then((x) => x.json());
      if (r.dashboard) setDash({ ...r.dashboard, filters: r.dashboard.filters ?? defaultDashboardFilters(), sharedWith: r.dashboard.sharedWith ?? [] });
    } catch { /* оставляем текущее */ }
  }
  // «Обновить всё»: перечитать данные виджетов И конфиг дашборда.
  async function refreshAll() {
    setRefreshKey((k) => k + 1);
    await reloadDash();
  }

  const df = { ...defaultDashboardFilters(), ...(dash.filters ?? {}) };

  function persist(next: Dashboard, immediate = false) {
    if (!canEdit) return; // получатель доступа менять дашборд не может
    setDash(next);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    const doSave = async () => {
      await fetch(`/api/dashboards/${next.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboard: next }),
      }).catch(() => {});
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    };
    if (immediate) doSave();
    else timer.current = setTimeout(doSave, 700);
  }

  // Виджет с наследованием фильтров дашборда
  function effective(w: Widget): Widget {
    if (w.inheritFilters === false) return w;
    // Фильтры дашборда переопределяют виджет. Периоды – только если заданы (иначе «не задан»
    // = виджет использует свой период). Страна и каналы задаются всегда (у них есть «Все»).
    const f = { ...w.filters, country: df.country, orderCreator: df.orderCreator, userCreator: df.userCreator, excludeB2b: df.excludeB2b };
    if (df.from && df.to) { f.from = df.from; f.to = df.to; }
    if (df.regFrom && df.regTo) { f.regFrom = df.regFrom; f.regTo = df.regTo; }
    return { ...w, filters: f };
  }

  function openNew() { setEditing(null); setEditorOpen(true); }
  function openEdit(w: Widget) { setEditing(w); setEditorOpen(true); }

  function saveWidget(w: Widget) {
    const exists = dash.widgets.some((x) => x.id === w.id);
    let widgets: Widget[];
    if (exists) widgets = dash.widgets.map((x) => (x.id === w.id ? { ...w, layout: x.layout } : x));
    else widgets = [...dash.widgets, { ...w, layout: { ...defaultLayout(w, dash.widgets.length), y: bottomY() } }];
    persist({ ...dash, widgets }, true);
    setEditorOpen(false);
  }
  function duplicateWidget(w: Widget) {
    const copy: Widget = { ...w, id: "wgt_" + Math.random().toString(36).slice(2, 10), title: w.title + " (копия)", layout: { ...(w.layout ?? defaultLayout(w, 0)), y: bottomY() } };
    persist({ ...dash, widgets: [...dash.widgets, copy] }, true);
  }
  function removeWidget(w: Widget) {
    if (!window.confirm(`Удалить виджет «${w.title}»?`)) return;
    persist({ ...dash, widgets: dash.widgets.filter((x) => x.id !== w.id) }, true);
  }
  function bottomY(): number {
    return dash.widgets.reduce((m, x) => Math.max(m, (x.layout?.y ?? 0) + (x.layout?.h ?? 5)), 0);
  }

  function onLayoutChange(layout: LayoutItem[]) {
    const byId = new Map(layout.map((l) => [l.i, l]));
    const widgets = dash.widgets.map((w) => {
      const l = byId.get(w.id);
      return l ? { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } } : w;
    });
    persist({ ...dash, widgets });
  }

  const rglLayout: LayoutItem[] = dash.widgets.map((w, i) => {
    const l = w.layout ?? defaultLayout(w, i);
    return { i: w.id, x: l.x, y: l.y, w: l.w, h: l.h, minW: 2, minH: w.type === "kpi" || w.type === "text" ? 2 : 3 };
  });

  return (
    <div>
      {/* Шапка дашборда */}
      <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
        <Link href="/dashboards" className="text-muted hover:text-ink"><ArrowLeft size={18} /></Link>
        <input
          value={dash.title}
          onChange={(e) => canEdit && setDash({ ...dash, title: e.target.value })}
          onBlur={() => persist(dash, true)}
          readOnly={!canEdit}
          className="bg-transparent outline-none font-semibold flex-1"
          style={{ fontSize: 17 }}
        />
        {!canEdit && (
          <span className="text-muted flex items-center gap-1.5" style={{ fontSize: 12 }}>
            только просмотр · от {dash.owner}
          </span>
        )}
        {saved && <span className="text-pos flex items-center gap-1" style={{ fontSize: 12 }}><Check size={14} /> сохранено</span>}
        <button onClick={refreshAll} className="flex items-center gap-2 border border-line hover:border-line-2" style={{ borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}>
          <RefreshCw size={14} /> Обновить всё
        </button>
        {canEdit && (
          <button onClick={openNew} className="flex items-center gap-2 text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 500 }}>
            <Plus size={15} /> Виджет
          </button>
        )}
      </div>

      {/* Фильтры дашборда */}
      <div className="flex flex-wrap items-center gap-3 border border-line bg-surface rounded-xl" style={{ padding: "10px 14px", marginBottom: 16 }}>
        <span className="text-muted" style={{ fontSize: 11.5 }}>Фильтры дашборда</span>
        {canEdit ? (
          <>
            <DateRangePicker label="Период регистрации" months={1} align="left" placeholder="не задан" from={df.regFrom} to={df.regTo} onApply={(from, to) => persist({ ...dash, filters: { ...df, regFrom: from, regTo: to } }, true)} onClear={() => persist({ ...dash, filters: { ...df, regFrom: "", regTo: "" } }, true)} />
            <DateRangePicker label="Период заказа" months={1} align="left" placeholder="не задан" from={df.from} to={df.to} onApply={(from, to) => persist({ ...dash, filters: { ...df, from, to } }, true)} onClear={() => persist({ ...dash, filters: { ...df, from: "", to: "" } }, true)} />
            <ChipSelect label="Страна" value={COUNTRIES.find((c) => c.code === df.country)?.label ?? df.country} selectValue={df.country} options={countryOptions(access.allowed)} onChange={(v) => persist({ ...dash, filters: { ...df, country: v } }, true)} />
            <ChipSelect label="Канал клиента" value={df.userCreator === "all" ? "Все" : df.userCreator} selectValue={df.userCreator} options={[["all", "Все"], ...ucreators.map((c) => [c, c] as [string, string])]} onChange={(v) => persist({ ...dash, filters: { ...df, userCreator: v } }, true)} />
            <ChipSelect label="Канал заказа" value={df.orderCreator === "all" ? "Все" : df.orderCreator} selectValue={df.orderCreator} options={[["all", "Все"], ...ocreators.map((c) => [c, c] as [string, string])]} onChange={(v) => persist({ ...dash, filters: { ...df, orderCreator: v } }, true)} />
            <ChipSelect label="B2B" value={df.excludeB2b ? "Искл" : "Вкл"} selectValue={df.excludeB2b ? "exclude" : "include"} options={[["include", "Вкл"], ["exclude", "Искл"]]} onChange={(v) => persist({ ...dash, filters: { ...df, excludeB2b: v === "exclude" } }, true)} />
            <span className="text-muted" style={{ fontSize: 11.5 }}>применяются к виджетам с наследованием</span>
          </>
        ) : (
          <>
            <StaticChip label="Период регистрации" value={rangeLabel(df.regFrom, df.regTo)} />
            <StaticChip label="Период заказа" value={rangeLabel(df.from, df.to)} />
            <StaticChip label="Страна" value={COUNTRIES.find((c) => c.code === df.country)?.label ?? df.country} />
            <StaticChip label="Канал клиента" value={df.userCreator === "all" ? "Все" : df.userCreator} />
            <StaticChip label="Канал заказа" value={df.orderCreator === "all" ? "Все" : df.orderCreator} />
            <StaticChip label="B2B" value={df.excludeB2b ? "Искл" : "Вкл"} />
            <span className="text-muted" style={{ fontSize: 11.5 }}>фильтры задаёт владелец</span>
          </>
        )}
      </div>

      {dash.widgets.length === 0 ? (
        <div className="border border-dashed border-line-2 rounded-xl text-center text-muted" style={{ padding: "60px 20px", fontSize: 13.5 }}>
          {canEdit
            ? "Пока пусто. Нажмите «Виджет», чтобы добавить график, показатель или заголовок. Виджеты можно перетаскивать и менять размер."
            : "В этом дашборде пока нет виджетов."}
        </div>
      ) : (
        <Grid
          className="layout"
          layout={rglLayout}
          cols={COLS}
          rowHeight={56}
          margin={[16, 16]}
          isDraggable={canEdit}
          isResizable={canEdit}
          draggableHandle=".drag-handle"
          draggableCancel=".no-drag"
          onLayoutChange={onLayoutChange}
        >
          {dash.widgets.map((w) => (
            <div key={w.id}>
              <WidgetCard widget={effective(w)} editable={canEdit} refreshKey={refreshKey} onEdit={openEdit} onRemove={removeWidget} onDuplicate={duplicateWidget} />
            </div>
          ))}
        </Grid>
      )}

      {editorOpen && <WidgetEditor initial={editing} onSave={saveWidget} onClose={() => setEditorOpen(false)} />}
    </div>
  );
}

function rangeLabel(from?: string, to?: string): string {
  if (!from || !to) return "не задан";
  return formatRange(from, to);
}
function StaticChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 border border-line bg-surface rounded-[7px]" style={{ padding: "6px 10px" }}>
      <span className="text-muted" style={{ fontSize: 11.5 }}>{label}</span>
      <span className="font-medium" style={{ fontSize: 12.5 }}>{value}</span>
    </div>
  );
}

function ChipSelect({ label, value, selectValue, options, onChange }: { label: string; value: string; selectValue: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 border border-line bg-surface hover:border-line-2 transition-colors rounded-[7px] relative" style={{ padding: "6px 10px" }}>
      <span className="text-muted" style={{ fontSize: 11.5 }}>{label}</span>
      <span className="font-medium" style={{ fontSize: 12.5 }}>{value}</span>
      <span className="text-muted" style={{ fontSize: 9 }}>▾</span>
      <select value={selectValue} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full" aria-label={label}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
