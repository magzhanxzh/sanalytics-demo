"use client";

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { formatMetric, type Widget, type WidgetData } from "@/lib/dashboards/types";

const PALETTE = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];
const compact = (v: number) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + "k" : String(Math.round(v)));

export function WidgetChart({ widget, data }: { widget: Widget; data: WidgetData }) {
  if (data.kind === "loading") return <div className="text-muted" style={{ fontSize: 12, padding: 8 }}>Загрузка…</div>;
  if (data.kind === "error") return <div className="text-neg" style={{ fontSize: 12, padding: 8 }}>{data.message}</div>;

  if (data.kind === "value") {
    return (
      <div className="flex items-center justify-center h-full w-full text-center" style={{ minHeight: 60, padding: 8 }}>
        <span className="mono" style={{ fontSize: 34, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.1, wordBreak: "break-word" }}>
          {formatMetric(widget.metric, data.value)}
        </span>
      </div>
    );
  }

  if (data.kind === "table") {
    return (
      <div className="overflow-auto" style={{ maxHeight: 260 }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {data.columns.map((c, i) => <th key={i} className={i === 0 ? "" : "text-right"} style={{ padding: "6px 8px" }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-line">
                {row.map((cell, ci) => (
                  <td key={ci} className={ci === 0 ? "" : "text-right mono"} style={{ padding: "7px 8px", fontSize: 12.5 }}>
                    {typeof cell === "number" ? cell.toLocaleString("ru-RU") : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // points
  const points = data.points;
  const tip = (v: number | string) => formatMetric(widget.metric, Number(v));

  if (widget.type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={points} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={45}>
            {points.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => tip(v as number)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const axis = {
    grid: <CartesianGrid stroke="var(--line)" vertical={false} />,
    x: <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--line-2)" }} tick={{ fontSize: 10.5, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} minTickGap={20} />,
    y: <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 10.5, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} tickFormatter={compact} />,
    tt: <Tooltip formatter={(v) => tip(v as number)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />,
  };

  if (widget.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points}>
          {axis.grid}{axis.x}{axis.y}{axis.tt}
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {points.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points}>
          <defs>
            <linearGradient id={`g-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-soft)" stopOpacity={0.8} />
              <stop offset="100%" stopColor="var(--accent-soft)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          {axis.grid}{axis.x}{axis.y}{axis.tt}
          <Area type="monotone" dataKey="value" stroke="var(--c1)" strokeWidth={2} fill={`url(#g-${widget.id})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // line (default)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points}>
        {axis.grid}{axis.x}{axis.y}{axis.tt}
        <Line type="monotone" dataKey="value" stroke="var(--c1)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
