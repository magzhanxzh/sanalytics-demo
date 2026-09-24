"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { WidgetCard } from "./WidgetCard";
import { FALLBACK_CREATORS, FALLBACK_USER_CREATORS } from "@/lib/queries/cards";
import { useAccess, countryOptions } from "@/lib/auth/useAccess";
import {
  METRIC_LABELS, WIDGET_LABELS, BREAKDOWN_LABELS, defaultWidgetFilters,
  type Widget, type WidgetType, type Metric, type Breakdown,
} from "@/lib/dashboards/types";

function newWidget(): Widget {
  return {
    id: "wgt_" + Math.random().toString(36).slice(2, 10),
    title: "Новый виджет",
    type: "line",
    metric: "revenue",
    breakdown: "day",
    span: 1,
    inheritFilters: true,
    filters: defaultWidgetFilters(),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted" style={{ fontSize: 11.5 }}>{label}</span>
      {children}
    </label>
  );
}
function Select<T extends string>({ value, onChange, options, disabled }: { value: T; onChange: (v: T) => void; options: [T, string][]; disabled?: boolean }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)} className="border border-line bg-surface rounded-lg disabled:opacity-50" style={{ padding: "7px 9px", fontSize: 13 }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function WidgetEditor({ initial, onSave, onClose }: { initial: Widget | null; onSave: (w: Widget) => void; onClose: () => void }) {
  const [w, setW] = useState<Widget>(initial ?? newWidget());
  const [ocreators, setOcreators] = useState<string[]>(FALLBACK_CREATORS);
  const [ucreators, setUcreators] = useState<string[]>(FALLBACK_USER_CREATORS);
  const access = useAccess();
  const isText = w.type === "text";
  const inherit = w.inheritFilters !== false;

  useEffect(() => {
    fetch("/api/meta/creators").then((r) => r.json()).then((d) => {
      if (Array.isArray(d.orderCreators)) setOcreators(d.orderCreators);
      if (Array.isArray(d.userCreators)) setUcreators(d.userCreators);
    }).catch(() => {});
  }, []);

  const setF = (patch: Partial<Widget["filters"]>) => setW((x) => ({ ...x, filters: { ...x.filters, ...patch } }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div className="bg-surface border border-line rounded-xl w-full" style={{ maxWidth: 860, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line" style={{ padding: "14px 18px" }}>
          <h2 className="font-semibold" style={{ fontSize: 15 }}>{initial ? "Изменить виджет" : "Новый виджет"}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 18, padding: 18 }}>
          {/* Настройки */}
          <div className="flex flex-col gap-3">
            <Field label="Название">
              <input value={w.title} onChange={(e) => setW({ ...w, title: e.target.value })} className="border border-line bg-surface rounded-lg" style={{ padding: "7px 9px", fontSize: 13 }} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Тип"><Select value={w.type} onChange={(v: WidgetType) => setW({ ...w, type: v })} options={Object.entries(WIDGET_LABELS) as [WidgetType, string][]} /></Field>
              {!isText && <Field label="Метрика"><Select value={w.metric} onChange={(v: Metric) => setW({ ...w, metric: v, breakdown: v === "reactivation" && w.breakdown !== "country" ? "none" : w.breakdown })} options={Object.entries(METRIC_LABELS) as [Metric, string][]} /></Field>}
            </div>

            {isText ? (
              <Field label="Текст (заголовок или заметка)">
                <textarea value={w.text ?? ""} onChange={(e) => setW({ ...w, text: e.target.value })} rows={4} className="border border-line bg-surface rounded-lg" style={{ padding: "8px 10px", fontSize: 13 }} placeholder="Например: Раздел «Выручка»" />
              </Field>
            ) : (
              <>
                <Field label="Разбивка"><Select value={w.breakdown} onChange={(v: Breakdown) => setW({ ...w, breakdown: v })} options={(Object.entries(BREAKDOWN_LABELS) as [Breakdown, string][]).filter(([k]) => w.metric !== "reactivation" || k === "none" || k === "country")} /></Field>

                {w.metric === "reactivation" && (
                  <Field label="Размер спячки, дней">
                    <input type="number" min={7} max={1095} value={w.filters.dormancyDays ?? 180}
                      onChange={(e) => setF({ dormancyDays: Math.max(1, Number(e.target.value) || 180) })}
                      className="border border-line bg-surface rounded-lg" style={{ padding: "7px 9px", fontSize: 13 }} />
                    <span className="text-muted" style={{ fontSize: 11 }}>Реактивирован = заказал в периоде после паузы ≥ этого числа дней. Период заказа = окно реактивации.</span>
                  </Field>
                )}

                <div className="border-t border-line" style={{ paddingTop: 12, marginTop: 4 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                    <span className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Фильтры</span>
                    <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12 }}>
                      <input type="checkbox" checked={inherit} onChange={(e) => setW({ ...w, inheritFilters: e.target.checked })} />
                      Наследовать период и страну дашборда
                    </label>
                  </div>
                  {inherit && <div className="text-muted" style={{ fontSize: 11.5, marginBottom: 8 }}>Период, страна, создатели и когорта наследуются из дашборда. Здесь – только выручка.</div>}
                  <div className="flex flex-col gap-3">
                    {!inherit && (
                      <>
                        <Field label="Период заказа">
                          <DateRangePicker months={1} align="left" from={w.filters.from} to={w.filters.to} onApply={(from, to) => setF({ from, to })} />
                        </Field>
                        <Field label="Страна"><Select value={w.filters.country} onChange={(v) => setF({ country: v })} options={countryOptions(access.allowed)} /></Field>
                      </>
                    )}
                    {/* Выручка дашбордом НЕ наследуется – показываем всегда */}
                    <Field label="Выручка"><Select value={w.filters.basis} onChange={(v) => setF({ basis: v as "gross" | "paid" })} options={[["gross", "Валовая"], ["paid", "Оплачено"]]} /></Field>
                    {/* Создатели и когорта наследуются от дашборда – показываем только когда наследование выключено */}
                    {!inherit && (
                      <>
                        <Field label="Канал заказа"><Select value={w.filters.orderCreator} onChange={(v) => setF({ orderCreator: v })} options={[["all", "Все"], ...ocreators.map((c) => [c, c] as [string, string])]} /></Field>
                        <Field label="Канал клиента"><Select value={w.filters.userCreator} onChange={(v) => setF({ userCreator: v })} options={[["all", "Все"], ...ucreators.map((c) => [c, c] as [string, string])]} /></Field>
                        {w.metric !== "reactivation" && (
                          <Field label="Период регистрации (когорта, для конверсии)">
                            <DateRangePicker months={1} align="left" from={w.filters.regFrom} to={w.filters.regTo} placeholder="не задан" onApply={(from, to) => setF({ regFrom: from, regTo: to })} onClear={() => setF({ regFrom: "", regTo: "" })} />
                          </Field>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Превью */}
          <div>
            <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Превью</div>
            <div style={{ height: isText ? 80 : 280 }}>
              <WidgetCard widget={w} editable={false} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line" style={{ padding: "14px 18px" }}>
          <button onClick={onClose} className="border border-line hover:border-line-2" style={{ borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>Отмена</button>
          <button onClick={() => onSave(w)} className="text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500 }}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}
