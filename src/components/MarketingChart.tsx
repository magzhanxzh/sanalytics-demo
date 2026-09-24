"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { DailyPoint } from "@/lib/queries/cards";

type Serie = { key: string; label: string; color: string; width: number; area?: boolean };
const SERIES: Serie[] = [
  { key: "revenue", label: "Выручка", color: "var(--c1)", width: 2, area: true },
  { key: "orders", label: "Заказы", color: "var(--c4)", width: 1.5 },
  { key: "buyers", label: "Покупатели", color: "var(--c5)", width: 1.5 },
  { key: "registrations", label: "Регистрации", color: "var(--c2)", width: 1.5 },
  { key: "weight", label: "Вес", color: "var(--c3)", width: 1.5 },
];

const compact = (v: number) =>
  Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + "k" : String(Math.round(v));

export function MarketingChart({
  data,
  totals,
}: {
  data: DailyPoint[];
  totals: Record<string, string>;
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setHidden((h) => ({ ...h, [k]: !h[k] }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={246}>
        <ComposedChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mkt-rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-soft)" stopOpacity={0.75} />
              <stop offset="100%" stopColor="var(--accent-soft)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: "var(--line-2)" }} tick={{ fontSize: 10.5, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 10.5, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} tickFormatter={compact} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }}
            formatter={(value) => Number(value).toLocaleString("ru-RU")}
          />
          {SERIES.map((s) =>
            s.area ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.width}
                fill="url(#mkt-rev)"
                strokeOpacity={hidden[s.key] ? 0.12 : 1}
                fillOpacity={hidden[s.key] ? 0.05 : 1}
                dot={false}
                hide={false}
              />
            ) : (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.width}
                strokeOpacity={hidden[s.key] ? 0.12 : 1}
                dot={false}
              />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Легенда-тоггл */}
      <div className="flex flex-wrap gap-3.5 border-t border-line" style={{ paddingTop: 12, marginTop: 4 }}>
        {SERIES.map((s) => (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            className="flex items-center gap-2 transition-opacity"
            style={{ opacity: hidden[s.key] ? 0.4 : 1 }}
          >
            <span style={{ width: 10, height: 2, background: s.color, borderRadius: 2 }} />
            <span style={{ fontSize: 12.5 }}>{s.label}</span>
            <span className="mono text-muted" style={{ fontSize: 11.5 }}>{totals[s.key] ?? ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
