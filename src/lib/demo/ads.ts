import "server-only";
import { afUsers, dayOf, isoOf, AF_TARGET, AF_ORGANIC } from "./warehouse";
import { AD_SOURCES, SOURCE_CPR, COUNTRY_CPR_MULT } from "./dims";
import { mulberry32, hashSeed } from "./prng";
import type { ConnectorConfig, SpendRow, AdProvider } from "@/lib/connectors/types";
import type { AfSync, AfSourceRow } from "@/lib/appsflyer/types";

// Демо-ответы рекламных кабинетов и MMP. Расход считается от синтетических
// таргет-регистраций (регистрации x CPR источника x шум), поэтому CAC/ROAS
// на экранах согласованы с остальными цифрами.

export const PROVIDER_OF_SOURCE: AdProvider[] = ["google_ads", "tiktok_ads", "meta_ads", "yandex_ads"];

// Строки расхода по дням/кампаниям/странам за окно [from, to] включительно.
export function demoSpendRows(from: string, to: string): SpendRow[] {
  const agg = new Map<string, { date: string; source: number; country: string; campaign: string; regs: number }>();
  for (const u of afUsers(dayOf(from), dayOf(to) + 1)) {
    if (u.group !== AF_TARGET) continue;
    const date = isoOf(u.regDay);
    const key = `${date}|${u.source}|${u.country}|${u.campaign}`;
    const cur = agg.get(key) ?? { date, source: u.source, country: u.country, campaign: u.campaign, regs: 0 };
    cur.regs++;
    agg.set(key, cur);
  }
  // Средние регистрации кампании в день: часть бюджета тратится ровно, независимо от
  // того, сколько регистраций пришло в конкретный день (иначе расход копирует регистрации).
  const campTotals = new Map<string, { regs: number; days: number }>();
  for (const a of agg.values()) {
    const k = `${a.source}|${a.country}|${a.campaign}`;
    const t = campTotals.get(k) ?? { regs: 0, days: 0 };
    t.regs += a.regs; t.days += 1;
    campTotals.set(k, t);
  }
  const rows: SpendRow[] = [];
  for (const [key, a] of agg) {
    const rng = mulberry32(hashSeed(key.length * 7919, [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)));
    const t = campTotals.get(`${a.source}|${a.country}|${a.campaign}`)!;
    const cpr = SOURCE_CPR[a.source] * (COUNTRY_CPR_MULT[a.country] ?? 1) * (0.75 + 0.5 * rng());
    const spend = Math.round((0.45 * a.regs + 0.55 * (t.regs / t.days)) * cpr * 100) / 100;
    const impressions = Math.round(spend * (380 + 160 * rng()));
    rows.push({
      date: a.date,
      channel: AD_SOURCES[a.source],
      campaign: a.campaign || undefined,
      spend,
      impressions,
      clicks: Math.round(impressions * (0.009 + 0.008 * rng())),
      country: a.country,
      source: PROVIDER_OF_SOURCE[a.source],
    });
  }
  return rows.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

// «Проверка» кабинета в демо: реального запроса нет.
export function demoTest(cfg: ConnectorConfig): { ok: boolean; detail?: string; error?: string } {
  const label = cfg.id === "telegram" ? "@sanalytics_demo_bot" : "Demo account (USD)";
  return { ok: true, detail: `${label}, демо-режим: запрос к API не отправлялся` };
}

// Агрегат AppsFlyer (медиа-источник x окно) для карточки MMP на Интеграциях.
export function demoAfAggregate(from: string, to: string): AfSync {
  const bySource = new Map<string, AfSourceRow>();
  let android = 0, ios = 0;
  const spend = demoSpendRows(from, to);
  const costBy = new Map<string, number>();
  for (const s of spend) costBy.set(s.channel, (costBy.get(s.channel) ?? 0) + s.spend);
  for (const u of afUsers(dayOf(from), dayOf(to) + 1)) {
    const src = u.group === AF_TARGET ? AD_SOURCES[u.source] : u.group === AF_ORGANIC ? "organic" : "restricted";
    const row = bySource.get(src) ?? { mediaSource: src, impressions: 0, clicks: 0, installs: 0, cost: 0 };
    // установок больше, чем регистраций: не все установившие регистрируются
    row.installs += 1.35;
    bySource.set(src, row);
    if (u.regDay % 3 === 0) ios++; else android++;
  }
  for (const row of bySource.values()) {
    row.installs = Math.round(row.installs);
    row.cost = Math.round((costBy.get(row.mediaSource) ?? 0) * 100) / 100;
    row.clicks = row.cost ? Math.round(row.installs * 9.5) : 0;
    row.impressions = row.clicks * 85;
  }
  const rows = [...bySource.values()].sort((a, b) => b.installs - a.installs);
  const totalInstalls = rows.reduce((s, r) => s + r.installs, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const share = android + ios ? android / (android + ios) : 0.66;
  return {
    at: new Date().toISOString(), from, to, rows,
    byApp: [
      { id: "com.example.shop", platform: "android", installs: Math.round(totalInstalls * share), cost: Math.round(totalCost * share) },
      { id: "id000000001", platform: "ios", installs: Math.round(totalInstalls * (1 - share)), cost: Math.round(totalCost * (1 - share)) },
    ],
    totalInstalls, totalCost,
    note: "Демо-режим: агрегат собран из синтетических данных, Pull API не вызывался.",
  };
}
