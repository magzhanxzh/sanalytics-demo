import { Sparkline } from "./Sparkline";
import type { CardResult } from "@/lib/metrics";
import type { DailyPoint } from "@/lib/queries/cards";

function seriesFor(code: string, points: DailyPoint[]): number[] {
  switch (code) {
    case "registrations": return points.map((p) => p.registrations);
    case "buyers": return points.map((p) => p.buyers);
    case "orders": return points.map((p) => p.orders);
    case "weight_kg": return points.map((p) => p.weight);
    case "avg_check": return points.map((p) => (p.orders ? p.revenue / p.orders : 0));
    case "conversion": return points.map((p) => (p.registrations ? (p.buyers / p.registrations) * 100 : 0));
    default: return points.map((p) => p.revenue);
  }
}

export function KpiStrip({ cards, points }: { cards: CardResult[]; points: DailyPoint[] }) {
  return (
    <div className="border border-line bg-surface rounded-xl overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {cards.map((c, i) => {
          const up = c.deltaPct !== null && c.deltaPct >= 0;
          const color = c.deltaPct === null ? "var(--muted)" : up ? "var(--pos)" : "var(--neg)";
          return (
            <div
              key={c.code}
              style={{ padding: "16px 18px 14px", borderLeft: i === 0 ? undefined : "1px solid var(--line)" }}
            >
              <div className="text-muted" style={{ fontSize: 12 }}>{c.title}</div>
              <div className="mono" style={{ fontSize: 25, fontWeight: 500, letterSpacing: "-0.03em", marginTop: 7 }}>
                {c.value}
              </div>
              <div className="flex items-center justify-between" style={{ marginTop: 9 }}>
                <span className="mono" style={{ fontSize: 11.5, color }}>
                  {c.deltaPct === null ? "–" : `${up ? "+" : ""}${c.deltaPct.toFixed(1)}%`}
                </span>
                <Sparkline data={seriesFor(c.code, points)} color={color} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
