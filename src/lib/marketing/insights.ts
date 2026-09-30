import "server-only";
import { getAcquisitionChannels } from "./acquisition";
import { getChannels } from "@/lib/metrics";
import type { CardFilters } from "@/lib/queries/cards";

// Short insights for the AI analyst panel on Marketing. Computed from the same data
// as the screen: acquisition channels (ROAS/CAC) and revenue change by order channel
// versus the previous period of the same length.

export type Insight = { tag: string; src: string; tone: "pos" | "neg" | "neutral"; text: string; action: string };

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const money = (v: number) => "$" + Math.round(v).toLocaleString("en-US");
const pct = (v: number) => (v > 0 ? "+" : "") + v.toFixed(0) + "%";

export async function getMarketingInsights(f: CardFilters): Promise<Insight[]> {
  const to = f.to || iso(new Date());
  const from = f.from || iso(new Date(Date.parse(to) - 29 * DAY_MS));
  const len = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
  const prev = { ...f, from: iso(new Date(Date.parse(from) - len * DAY_MS)), to: iso(new Date(Date.parse(from) - DAY_MS)) };
  const cur = { ...f, from, to };

  const out: Insight[] = [];
  const acq = await getAcquisitionChannels(cur);
  const ranked = acq.channels.filter((c) => c.spend > 0).sort((a, b) => a.roas - b.roas);
  if (ranked.length >= 2) {
    const worst = ranked[0];
    const best = ranked[ranked.length - 1];
    out.push({
      tag: "ROAS " + worst.roas.toFixed(1), src: worst.name, tone: "neg",
      text: `Weakest payback in the portfolio: ${money(worst.spend)} spend, ${money(worst.revenue)} revenue, CAC $${worst.cac.toFixed(2)}.`,
      action: "Review campaigns",
    });
    const shift = worst.spend * 0.2;
    out.push({
      tag: "ROAS " + best.roas.toFixed(1), src: best.name, tone: "pos",
      text: `Best ROAS in the period. Moving 20% of the budget from ${worst.name} (${money(shift)}) at current payback would add roughly +${money(shift * (best.roas - worst.roas))} revenue.`,
      action: "Model the shift",
    });
  }

  const [c1, c0] = await Promise.all([getChannels(cur), getChannels(prev)]);
  const before = new Map(c0.channels.map((c) => [c.channel, c.revenue]));
  const moves = c1.channels
    .filter((c) => (before.get(c.channel) ?? 0) > 0)
    .map((c) => ({ c, d: ((c.revenue - before.get(c.channel)!) / before.get(c.channel)!) * 100 }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const m = moves[0];
  if (m) {
    out.push({
      tag: pct(m.d), src: `order channel ${m.c.channel}`, tone: m.d >= 0 ? "pos" : "neg",
      text: `Channel revenue ${m.d >= 0 ? "grew" : "fell"} vs the previous period: ${money(before.get(m.c.channel)!)} → ${money(m.c.revenue)}.`,
      action: "Ask why",
    });
  }
  return out;
}
