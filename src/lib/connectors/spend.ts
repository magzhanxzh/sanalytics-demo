import "server-only";
import { listAccounts } from "./accounts";
import { spendFrom } from "./providers";
import type { SpendRow } from "./types";
import { liveConnectors } from "@/lib/demo/mode";
import { demoSpendRows } from "@/lib/demo/ads";

// Единый слой расхода из рекламных кабинетов (для CAC/ROAS в AF-анализе и Маркетинге).
// В продакшене синк пишет строки в файл на сервере и перекачивает окно начисто
// (последние дни кабинеты меняют задним числом). В демо строки держатся в памяти,
// а без синка отдаются синтетические строки по включённым кабинетам.

const g = globalThis as unknown as { __sanalyticsSpend?: SpendRow[] };
g.__sanalyticsSpend ??= [];

/* ---- Синхронизация расхода из кабинетов за окно ---- */
export type SyncSummary = {
  ok: boolean;
  bySource: Array<{ id: string; provider: string; country: string; rows: number; spend: number; error?: string }>;
  from: string; to: string; at: string;
};

// Синхронизируем расход по всем включённым рекламным кабинетам. Каждый кабинет привязан
// к своей стране: все его строки помечаем этой страной (точная привязка расхода к гео).
export async function syncAdSpend(from: string, to: string): Promise<SyncSummary> {
  const kept = g.__sanalyticsSpend!.filter((r) => !(r.date >= from && r.date <= to)); // перекачиваем окно начисто
  const bySource: SyncSummary["bySource"] = [];
  const fresh: SpendRow[] = [];

  for (const acc of await listAccounts()) {
    if (!acc.enabled) continue;
    const res = await spendFrom({ id: acc.provider, enabled: true, fields: acc.fields }, from, to);
    if (!res.ok) { bySource.push({ id: acc.id, provider: acc.provider, country: acc.country, rows: 0, spend: 0, error: res.error }); continue; }
    // в демо кабинет отдаёт строки всех стран, берём только свою
    const own = liveConnectors() ? res.rows : res.rows.filter((r) => r.country === acc.country);
    const rows = own.map((r) => ({ ...r, country: acc.country })); // страна кабинета
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    bySource.push({ id: acc.id, provider: acc.provider, country: acc.country, rows: rows.length, spend });
    fresh.push(...rows);
  }

  g.__sanalyticsSpend = [...kept, ...fresh];
  return { ok: bySource.every((s) => !s.error), bySource, from, to, at: new Date().toISOString() };
}

// Сырые строки расхода за окно. Агрегация по каналу/кампании/стране – в AF-анализе
// (analysis.ts), где есть знаменатели регистраций.
export async function getSpendRows(from: string, to: string): Promise<SpendRow[]> {
  if (!liveConnectors()) {
    const enabled = new Set((await listAccounts()).filter((a) => a.enabled).map((a) => `${a.provider}|${a.country}`));
    return demoSpendRows(from, to).filter((r) => enabled.has(`${r.source}|${r.country}`));
  }
  return g.__sanalyticsSpend!.filter((r) => r.date >= from && r.date <= to);
}
