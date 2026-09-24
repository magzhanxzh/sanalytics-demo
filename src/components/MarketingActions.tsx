"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw, Download } from "lucide-react";
import type { CardFilters } from "@/lib/queries/cards";

export function MarketingActions({ filters }: { filters: CardFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function params(): string {
    const p = new URLSearchParams();
    p.set("from", filters.from);
    p.set("to", filters.to);
    p.set("country", filters.country);
    p.set("ocreator", filters.orderCreator);
    p.set("ucreator", filters.userCreator);
    p.set("basis", filters.basis);
    p.set("b2b", filters.excludeB2b ? "exclude" : "include");
    if (filters.regFrom) p.set("rfrom", filters.regFrom);
    if (filters.regTo) p.set("rto", filters.regTo);
    p.set("grain", filters.grain);
    return p.toString();
  }

  async function refresh() {
    await fetch(`/api/refresh?${params()}`, { method: "POST" }).catch(() => {});
    startTransition(() => router.refresh());
  }

  function exportXlsx() {
    window.location.href = `/api/export?${params()}`;
  }

  return (
    <>
      <button
        onClick={exportXlsx}
        className="flex items-center gap-2 border border-line bg-surface text-ink-2 hover:border-line-2 hover:text-ink transition-colors"
        style={{ borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}
        title="Скачать текущий срез в Excel"
      >
        <Download size={15} /> Экспорт
      </button>
      <button
        onClick={refresh}
        disabled={pending}
        className="flex items-center gap-2 text-[color:var(--accent-ink)] disabled:opacity-60"
        style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 500 }}
      >
        <RefreshCw size={15} className={pending ? "animate-spin" : ""} /> Обновить
      </button>
    </>
  );
}
