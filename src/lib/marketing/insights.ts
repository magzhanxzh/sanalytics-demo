import "server-only";
import { getAcquisitionChannels } from "./acquisition";
import { getChannels } from "@/lib/metrics";
import type { CardFilters } from "@/lib/queries/cards";

// Короткие инсайты для панели ИИ-аналитика на Маркетинге. Считаются из тех же данных,
// что и экран: каналы привлечения (ROAS/CAC) и динамика выручки по каналам заказа
// относительно прошлого периода такой же длины.

export type Insight = { tag: string; src: string; tone: "pos" | "neg" | "neutral"; text: string; action: string };

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const money = (v: number) => "$" + Math.round(v).toLocaleString("ru-RU");
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
      text: `Самая слабая окупаемость в портфеле: ${money(worst.spend)} расхода, ${money(worst.revenue)} выручки, CAC $${worst.cac.toFixed(2)}.`,
      action: "Разобрать кампании",
    });
    const shift = worst.spend * 0.2;
    out.push({
      tag: "ROAS " + best.roas.toFixed(1), src: best.name, tone: "pos",
      text: `Лучший ROAS за период. Перенос 20% бюджета из ${worst.name} (${money(shift)}) при текущей окупаемости даст ориентировочно +${money(shift * (best.roas - worst.roas))} выручки.`,
      action: "Смоделировать перенос",
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
      tag: pct(m.d), src: `канал заказа ${m.c.channel}`, tone: m.d >= 0 ? "pos" : "neg",
      text: `Выручка канала ${m.d >= 0 ? "выросла" : "снизилась"} к прошлому периоду: ${money(before.get(m.c.channel)!)} → ${money(m.c.revenue)}.`,
      action: "Спросить почему",
    });
  }
  return out;
}
