"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { CardFilters, Grain } from "@/lib/queries/cards";

const OPTS: { value: Grain; label: string }[] = [
  { value: "day", label: "дни" },
  { value: "week", label: "недели" },
  { value: "month", label: "месяцы" },
];

export function GranularityToggle({ filters }: { filters: CardFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setGrain(g: Grain) {
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
    p.set("grain", g);
    startTransition(() => router.push(`/marketing?${p.toString()}`));
  }

  return (
    <div className="inline-flex overflow-hidden border border-line" style={{ borderRadius: 7, opacity: pending ? 0.6 : 1 }}>
      {OPTS.map((o) => {
        const active = filters.grain === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setGrain(o.value)}
            className={active ? "bg-sunk text-ink font-semibold" : "text-muted hover:text-ink"}
            style={{ fontSize: 12, padding: "5px 10px" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
