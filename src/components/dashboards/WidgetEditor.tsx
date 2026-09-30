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
    title: "New widget",
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
          <h2 className="font-semibold" style={{ fontSize: 15 }}>{initial ? "Edit widget" : "New widget"}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 18, padding: 18 }}>
          {/* Settings */}
          <div className="flex flex-col gap-3">
            <Field label="Title">
              <input value={w.title} onChange={(e) => setW({ ...w, title: e.target.value })} className="border border-line bg-surface rounded-lg" style={{ padding: "7px 9px", fontSize: 13 }} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type"><Select value={w.type} onChange={(v: WidgetType) => setW({ ...w, type: v })} options={Object.entries(WIDGET_LABELS) as [WidgetType, string][]} /></Field>
              {!isText && <Field label="Metric"><Select value={w.metric} onChange={(v: Metric) => setW({ ...w, metric: v, breakdown: v === "reactivation" && w.breakdown !== "country" ? "none" : w.breakdown })} options={Object.entries(METRIC_LABELS) as [Metric, string][]} /></Field>}
            </div>

            {isText ? (
              <Field label="Text (heading or note)">
                <textarea value={w.text ?? ""} onChange={(e) => setW({ ...w, text: e.target.value })} rows={4} className="border border-line bg-surface rounded-lg" style={{ padding: "8px 10px", fontSize: 13 }} placeholder="For example: Revenue section" />
              </Field>
            ) : (
              <>
                <Field label="Breakdown"><Select value={w.breakdown} onChange={(v: Breakdown) => setW({ ...w, breakdown: v })} options={(Object.entries(BREAKDOWN_LABELS) as [Breakdown, string][]).filter(([k]) => w.metric !== "reactivation" || k === "none" || k === "country")} /></Field>

                {w.metric === "reactivation" && (
                  <Field label="Dormancy, days">
                    <input type="number" min={7} max={1095} value={w.filters.dormancyDays ?? 180}
                      onChange={(e) => setF({ dormancyDays: Math.max(1, Number(e.target.value) || 180) })}
                      className="border border-line bg-surface rounded-lg" style={{ padding: "7px 9px", fontSize: 13 }} />
                    <span className="text-muted" style={{ fontSize: 11 }}>Reactivated = ordered in the period after a gap of at least this many days. Order period = reactivation window.</span>
                  </Field>
                )}

                <div className="border-t border-line" style={{ paddingTop: 12, marginTop: 4 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                    <span className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Filters</span>
                    <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12 }}>
                      <input type="checkbox" checked={inherit} onChange={(e) => setW({ ...w, inheritFilters: e.target.checked })} />
                      Inherit dashboard period and country
                    </label>
                  </div>
                  {inherit && <div className="text-muted" style={{ fontSize: 11.5, marginBottom: 8 }}>Period, country, channels and cohort are inherited from the dashboard. Only revenue basis is set here.</div>}
                  <div className="flex flex-col gap-3">
                    {!inherit && (
                      <>
                        <Field label="Order period">
                          <DateRangePicker months={1} align="left" from={w.filters.from} to={w.filters.to} onApply={(from, to) => setF({ from, to })} />
                        </Field>
                        <Field label="Country"><Select value={w.filters.country} onChange={(v) => setF({ country: v })} options={countryOptions(access.allowed)} /></Field>
                      </>
                    )}
                    {/* Revenue basis is NOT inherited from the dashboard, always shown */}
                    <Field label="Revenue"><Select value={w.filters.basis} onChange={(v) => setF({ basis: v as "gross" | "paid" })} options={[["gross", "Gross"], ["paid", "Paid"]]} /></Field>
                    {/* Channels and cohort are inherited from the dashboard, shown only when inheritance is off */}
                    {!inherit && (
                      <>
                        <Field label="Order channel"><Select value={w.filters.orderCreator} onChange={(v) => setF({ orderCreator: v })} options={[["all", "All"], ...ocreators.map((c) => [c, c] as [string, string])]} /></Field>
                        <Field label="User channel"><Select value={w.filters.userCreator} onChange={(v) => setF({ userCreator: v })} options={[["all", "All"], ...ucreators.map((c) => [c, c] as [string, string])]} /></Field>
                        {w.metric !== "reactivation" && (
                          <Field label="Sign-up period (cohort, for conversion)">
                            <DateRangePicker months={1} align="left" from={w.filters.regFrom} to={w.filters.regTo} placeholder="not set" onApply={(from, to) => setF({ regFrom: from, regTo: to })} onClear={() => setF({ regFrom: "", regTo: "" })} />
                          </Field>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Preview */}
          <div>
            <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Preview</div>
            <div style={{ height: isText ? 80 : 280 }}>
              <WidgetCard widget={w} editable={false} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line" style={{ padding: "14px 18px" }}>
          <button onClick={onClose} className="border border-line hover:border-line-2" style={{ borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>Cancel</button>
          <button onClick={() => onSave(w)} className="text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500 }}>Save</button>
        </div>
      </div>
    </div>
  );
}
