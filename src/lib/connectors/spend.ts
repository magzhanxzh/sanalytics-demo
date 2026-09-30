import "server-only";
import { listAccounts } from "./accounts";
import { spendFrom } from "./providers";
import type { SpendRow } from "./types";
import { liveConnectors } from "@/lib/demo/mode";
import { demoSpendRows } from "@/lib/demo/ads";

// A single spend layer from ad accounts (for CAC/ROAS in Attribution and Marketing).
// In production the sync writes rows to a file on the server and reloads the window from scratch
// (ad platforms revise recent days retroactively). In the demo rows are kept in memory,
// and without a sync synthetic rows are returned for enabled accounts.

const g = globalThis as unknown as { __sanalyticsSpend?: SpendRow[] };
g.__sanalyticsSpend ??= [];

/* ---- Sync ad account spend for a window ---- */
export type SyncSummary = {
  ok: boolean;
  bySource: Array<{ id: string; provider: string; country: string; rows: number; spend: number; error?: string }>;
  from: string; to: string; at: string;
};

// Sync spend for all enabled ad accounts. Each account belongs to its country:
// all of its rows are tagged with that country (exact geo attribution of spend).
export async function syncAdSpend(from: string, to: string): Promise<SyncSummary> {
  const kept = g.__sanalyticsSpend!.filter((r) => !(r.date >= from && r.date <= to)); // reload the window from scratch
  const bySource: SyncSummary["bySource"] = [];
  const fresh: SpendRow[] = [];

  for (const acc of await listAccounts()) {
    if (!acc.enabled) continue;
    const res = await spendFrom({ id: acc.provider, enabled: true, fields: acc.fields }, from, to);
    if (!res.ok) { bySource.push({ id: acc.id, provider: acc.provider, country: acc.country, rows: 0, spend: 0, error: res.error }); continue; }
    // in the demo an account returns rows for all countries, keep only its own
    const own = liveConnectors() ? res.rows : res.rows.filter((r) => r.country === acc.country);
    const rows = own.map((r) => ({ ...r, country: acc.country })); // the account's country
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    bySource.push({ id: acc.id, provider: acc.provider, country: acc.country, rows: rows.length, spend });
    fresh.push(...rows);
  }

  g.__sanalyticsSpend = [...kept, ...fresh];
  return { ok: bySource.every((s) => !s.error), bySource, from, to, at: new Date().toISOString() };
}

// Raw spend rows for a window. Aggregation by channel/campaign/country happens in Attribution
// (analysis.ts), where the sign-up denominators are.
export async function getSpendRows(from: string, to: string): Promise<SpendRow[]> {
  if (!liveConnectors()) {
    const enabled = new Set((await listAccounts()).filter((a) => a.enabled).map((a) => `${a.provider}|${a.country}`));
    return demoSpendRows(from, to).filter((r) => enabled.has(`${r.source}|${r.country}`));
  }
  return g.__sanalyticsSpend!.filter((r) => r.date >= from && r.date <= to);
}
