import Link from "next/link";

import { getMarketingInsights } from "@/lib/marketing/insights";
import type { CardFilters } from "@/lib/queries/cards";

// Панель ИИ-аналитика на Маркетинге: инсайты посчитаны из данных текущего среза, чат на /ai.
const TONE = { pos: "var(--pos)", neg: "var(--neg)", neutral: "var(--c2)" } as const;

export async function AiPanel({ filters }: { filters: CardFilters }) {
  const insights = await getMarketingInsights(filters);
  const now = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="border border-line bg-surface rounded-xl flex flex-col" style={{ padding: 18, gap: 14, minHeight: 400 }}>
      <div className="flex items-center gap-2">
        <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--accent)" }} />
        <span className="font-semibold" style={{ fontSize: 14.5 }}>ИИ-аналитик</span>
        <span className="mono text-muted ml-auto" style={{ fontSize: 10.5 }}>{now}</span>
      </div>
      <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Что изменилось за период
      </div>

      <div className="flex flex-col">
        {insights.length === 0 && <p className="text-muted" style={{ fontSize: 13, padding: "12px 0" }}>Недостаточно данных за период.</p>}
        {insights.map((ins, i) => (
          <div key={i} style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
            <div className="flex items-center gap-2">
              <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: TONE[ins.tone] }}>{ins.tag}</span>
              <span className="text-muted" style={{ fontSize: 11.5 }}>{ins.src}</span>
            </div>
            <p className="text-ink-2" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{ins.text}</p>
            <Link href="/ai" className="text-accent inline-block" style={{ fontSize: 12, marginTop: 6 }}>
              {ins.action} →
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-2">
          {["что просело за неделю?", "куда перенести бюджет?"].map((c) => (
            <Link
              key={c}
              href="/ai"
              className="bg-sunk hover:border-accent border border-transparent transition-colors"
              style={{ borderRadius: 99, padding: "5px 11px", fontSize: 11.5 }}
            >
              {c}
            </Link>
          ))}
        </div>
        <Link
          href="/ai"
          className="flex items-center justify-between border border-line-2 bg-bg text-muted"
          style={{ borderRadius: 8, padding: "10px 12px", fontSize: 13 }}
        >
          Спросить о данных…
          <span className="mono" style={{ fontSize: 10.5 }}>⌘K</span>
        </Link>
      </div>
    </div>
  );
}
