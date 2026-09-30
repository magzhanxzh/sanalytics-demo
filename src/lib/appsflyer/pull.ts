import "server-only";
import type { AfApp, AfConfig, AfAppTotal, AfSourceRow, AfSync } from "./types";

const BASE = "https://hq1.appsflyer.com/api/agg-data/export/app";
const REPORT = "partners_by_date_report"; // media source x date (aggregate)

// Tiny CSV parser that handles quotes, commas and line breaks inside fields.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

// AF accepts only an IANA name (Asia/Almaty) or an offset (UTC+5, GMT+05:00).
// Otherwise -> HTTP 400 "Invalid time or timezone format". Bare city names from our region
// are normalized to IANA; anything else invalid is dropped (AF uses the app time zone).
const CITY_TZ: Record<string, string> = {
  almaty: "Asia/Almaty", aqtau: "Asia/Aqtau", astana: "Asia/Almaty", nursultan: "Asia/Almaty",
  tashkent: "Asia/Tashkent", bishkek: "Asia/Bishkek", dushanbe: "Asia/Dushanbe", ulaanbaatar: "Asia/Ulaanbaatar",
};
export function validTz(tz: string | undefined): string | null {
  const t = (tz ?? "").trim();
  if (!t) return null;
  if (t.includes("/")) return t; // IANA, e.g. Asia/Almaty
  if (/^(utc|gmt)?[+-]\d{1,2}(:\d{2})?$/i.test(t)) return t; // offset
  return CITY_TZ[t.toLowerCase()] ?? null; // bare city -> IANA, otherwise drop
}

export function findCol(header: string[], candidates: string[]): number {
  const norm = header.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const idx = norm.indexOf(c.toLowerCase());
    if (idx !== -1) return idx;
  }
  for (let i = 0; i < norm.length; i++) {
    if (candidates.some((c) => norm[i].includes(c.toLowerCase()))) return i;
  }
  return -1;
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

type OneOk = { ok: true; rows: AfSourceRow[]; hasCost: boolean };
type OneErr = { ok: false; status: number; error: string };

// Export for a single app.
async function pullOne(token: string, appId: string, timezone: string, from: string, to: string): Promise<OneOk | OneErr> {
  const qs = new URLSearchParams({ from, to });
  const tz = validTz(timezone);
  if (tz) qs.set("timezone", tz);
  const url = `${BASE}/${encodeURIComponent(appId)}/${REPORT}/v5?${qs.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, accept: "text/csv" },
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    return { ok: false, status: 0, error: "Network/timeout: " + String(e).slice(0, 160) };
  }

  const body = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: body.slice(0, 300) || res.statusText };

  const table = parseCsv(body);
  if (table.length < 2) return { ok: true, rows: [], hasCost: true };

  const header = table[0];
  const iSrc = findCol(header, ["Media Source (pid)", "media source", "pid"]);
  const iImp = findCol(header, ["Impressions"]);
  const iClk = findCol(header, ["Clicks"]);
  const iIns = findCol(header, ["Installs"]);
  const iCost = findCol(header, ["Total Cost", "Cost"]);

  const agg = new Map<string, AfSourceRow>();
  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    const src = (iSrc >= 0 ? row[iSrc] : "") || "(not set)";
    const cur = agg.get(src) ?? { mediaSource: src, impressions: 0, clicks: 0, installs: 0, cost: 0 };
    cur.impressions += num(row[iImp]);
    cur.clicks += num(row[iClk]);
    cur.installs += num(row[iIns]);
    cur.cost += num(row[iCost]);
    agg.set(src, cur);
  }
  return { ok: true, rows: [...agg.values()], hasCost: iCost >= 0 };
}

export type AfPullOk = { ok: true } & AfSync;
export type AfPullErr = { ok: false; error: string };

// Pull the AF aggregate for all apps over [from, to] and roll up by media source.
export async function pullAf(cfg: AfConfig, from: string, to: string): Promise<AfPullOk | AfPullErr> {
  if (!cfg.token) return { ok: false, error: "AppsFlyer token is not set." };
  const apps = cfg.apps.filter((a) => a.id.trim());
  if (apps.length === 0) return { ok: false, error: "No App ID is set." };

  const merged = new Map<string, AfSourceRow>();
  const byApp: AfAppTotal[] = [];
  let anyOk = false;
  let missingCost = false;

  for (const app of apps as AfApp[]) {
    const one = await pullOne(cfg.token, app.id.trim(), cfg.timezone, from, to);
    if (!one.ok) {
      byApp.push({ id: app.id, platform: app.platform, installs: 0, cost: 0, error: (one.status ? `AF ${one.status}: ` : "") + one.error });
      continue;
    }
    anyOk = true;
    if (!one.hasCost) missingCost = true;
    let appInstalls = 0, appCost = 0;
    for (const row of one.rows) {
      appInstalls += row.installs; appCost += row.cost;
      const cur = merged.get(row.mediaSource) ?? { mediaSource: row.mediaSource, impressions: 0, clicks: 0, installs: 0, cost: 0 };
      cur.impressions += row.impressions; cur.clicks += row.clicks; cur.installs += row.installs; cur.cost += row.cost;
      merged.set(row.mediaSource, cur);
    }
    byApp.push({ id: app.id, platform: app.platform, installs: appInstalls, cost: appCost });
  }

  if (!anyOk) {
    const first = byApp.find((a) => a.error)?.error;
    return { ok: false, error: first || "No app could be exported." };
  }

  const rows = [...merged.values()].sort((a, b) => b.installs - a.installs);
  const totalInstalls = rows.reduce((s, x) => s + x.installs, 0);
  const totalCost = rows.reduce((s, x) => s + x.cost, 0);
  const notes: string[] = [];
  if (missingCost) notes.push("The report has no cost column (AF cost integration is required).");
  const failed = byApp.filter((a) => a.error);
  if (failed.length) notes.push(`Failed to export: ${failed.map((a) => a.id).join(", ")}.`);

  return {
    ok: true, at: new Date().toISOString(), from, to,
    rows, byApp, totalInstalls, totalCost,
    note: notes.join(" ") || undefined,
  };
}
