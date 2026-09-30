"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseYMD(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
function labelShort(d: Date): string {
  return shortDate.format(d);
}
function chipLabel(from?: Date, to?: Date, placeholder = "not set"): string {
  if (!from) return placeholder;
  if (!to || fmtLocal(from) === fmtLocal(to)) return `${labelShort(from)}, ${from.getFullYear()}`;
  return `${labelShort(from)} – ${labelShort(to)}, ${to.getFullYear()}`;
}

// Calendar labels without date-fns
const monthName = new Intl.DateTimeFormat("en-US", { month: "long" });
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const formatters = {
  formatCaption: (d: Date) => `${monthName.format(d)} ${d.getFullYear()}`,
  formatWeekdayName: (d: Date) => weekday.format(d).slice(0, 2),
};

type Preset = { label: string; range: () => DateRange };

function buildPresets(): Preset[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = (base: Date, days: number) => {
    const x = new Date(base);
    x.setDate(x.getDate() + days);
    return x;
  };
  const startOfWeek = (base: Date) => d(base, -((base.getDay() + 6) % 7)); // Monday
  const startOfMonth = (base: Date) => new Date(base.getFullYear(), base.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const thisWeekStart = startOfWeek(today);
  const prevWeekStart = d(thisWeekStart, -7);

  return [
    { label: "Today", range: () => ({ from: today, to: today }) },
    { label: "Yesterday", range: () => ({ from: d(today, -1), to: d(today, -1) }) },
    { label: "Last 7 days", range: () => ({ from: d(today, -6), to: today }) },
    { label: "Last 30 days", range: () => ({ from: d(today, -29), to: today }) },
    { label: "This week", range: () => ({ from: thisWeekStart, to: today }) },
    { label: "Last week", range: () => ({ from: prevWeekStart, to: d(prevWeekStart, 6) }) },
    { label: "This month", range: () => ({ from: startOfMonth(today), to: today }) },
    { label: "Last month", range: () => ({ from: prevMonthStart, to: prevMonthEnd }) },
  ];
}

export function DateRangePicker({
  from,
  to,
  onApply,
  onClear,
  label,
  placeholder,
  months = 2,
  align = "right",
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  onClear?: () => void;
  label?: string;
  placeholder?: string;
  months?: number;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>({ from: parseYMD(from), to: parseYMD(to) });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft({ from: parseYMD(from), to: parseYMD(to) });
  }, [from, to]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const presets = buildPresets();

  function apply() {
    if (draft?.from) {
      onApply(fmtLocal(draft.from), fmtLocal(draft.to ?? draft.from));
    }
    setOpen(false);
  }

  return (
    <div className="relative inline-block" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 border border-line bg-surface hover:border-line-2 transition-colors mono"
        style={{ borderRadius: 7, padding: "6px 10px", fontSize: 12 }}
      >
        {label && <span className="text-muted" style={{ fontSize: 11.5, fontFamily: "var(--font-sans)" }}>{label}</span>}
        <span>{chipLabel(parseYMD(from), parseYMD(to), placeholder)}</span>
        <span className="text-muted" style={{ fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-2 flex bg-surface border border-line rounded-xl shadow-lg"
          style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)", ...(align === "left" ? { left: 0 } : { right: 0 }) }}
        >
          {/* Presets */}
          <div className="flex flex-col gap-0.5 border-r border-line" style={{ padding: 8, minWidth: 150 }}>
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setDraft(p.range())}
                className="text-left hover:bg-sunk rounded-md transition-colors"
                style={{ padding: "7px 9px", fontSize: 12.5 }}
              >
                {p.label}
              </button>
            ))}
            {onClear && (
              <button
                onClick={() => { onClear(); setOpen(false); }}
                className="text-left text-muted hover:text-neg rounded-md transition-colors mt-1"
                style={{ padding: "7px 9px", fontSize: 12.5 }}
              >
                Reset
              </button>
            )}
          </div>

          {/* Calendar */}
          <div style={{ padding: 12 }} className="rdp-wrap">
            <DayPicker
              mode="range"
              numberOfMonths={months}
              defaultMonth={draft?.from ?? new Date()}
              selected={draft}
              onSelect={setDraft}
              weekStartsOn={1}
              formatters={formatters}
              showOutsideDays
            />
            <div className="flex items-center justify-end gap-2 border-t border-line" style={{ paddingTop: 10, marginTop: 4 }}>
              <button onClick={() => setOpen(false)} className="border border-line hover:border-line-2 transition-colors" style={{ borderRadius: 7, padding: "6px 12px", fontSize: 12.5 }}>
                Cancel
              </button>
              <button onClick={apply} className="text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 7, padding: "6px 14px", fontSize: 12.5, fontWeight: 500 }}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
