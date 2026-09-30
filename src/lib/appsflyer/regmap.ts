import "server-only";
import { afUsers, todayDay, isoOf, AF_TARGET, AF_ORGANIC } from "@/lib/demo/warehouse";
import { AD_SOURCES } from "@/lib/demo/dims";

// Map of user_id -> sign-up channel (paid or organic) from MMP data.
//
// In production the map is built every morning from raw AppsFlyer sign-up events
// (raw-data in_app_events_report + organic_in_app_events_report for all apps,
// a 90-day window in 30-day chunks because of the Pull API limit). Channel = media source
// of the earliest event; paid beats restricted, restricted beats organic.
// The Attribution screen answers from the ready map without calling the API on every click.
//
// In the demo the map is built from the synthetic store with the same shape and window.

const WINDOW_DAYS = 90;

export type AfGroup = "target" | "organic" | "restricted";
export type RegEntry = { group: AfGroup; channel: string; campaign?: string };
export type RegMap = Record<string, RegEntry>;

export type RegMapMeta = {
  at: string;
  from: string;
  to: string;
  appsSig: string;
  size: number;       // how many users are in the map
  truncated: boolean; // whether the export row limit was hit
  errors: string[];   // errors by app or endpoint (if any)
};

export type BuiltRegMap = { meta: RegMapMeta; map: RegMap };
export type DailyRegMap = BuiltRegMap & { day: string };

function buildDemoMap(): DailyRegMap {
  const to = todayDay();
  const from = to - WINDOW_DAYS;
  const map: RegMap = {};
  for (const u of afUsers(from, to + 1)) {
    const group: AfGroup = u.group === AF_TARGET ? "target" : u.group === AF_ORGANIC ? "organic" : "restricted";
    map[u.userId] = {
      group,
      channel: group === "target" ? AD_SOURCES[u.source] : group,
      campaign: u.campaign || undefined,
    };
  }
  const day = isoOf(to);
  return {
    day,
    meta: {
      at: new Date().toISOString(), from: isoOf(from), to: day,
      appsSig: "demo.android,demo.ios", size: Object.keys(map).length, truncated: false, errors: [],
    },
    map,
  };
}

const g = globalThis as unknown as { __sanalyticsAfMap?: DailyRegMap };

export async function getDailyAfMap(): Promise<DailyRegMap | null> {
  if (!g.__sanalyticsAfMap || g.__sanalyticsAfMap.day !== isoOf(todayDay())) g.__sanalyticsAfMap = buildDemoMap();
  return g.__sanalyticsAfMap;
}

export type DailyRefresh = { status: "ok" | "empty" | "kept_previous" | "not_configured"; meta?: RegMapMeta; day?: string };
export async function refreshDailyAfMap(): Promise<DailyRefresh> {
  g.__sanalyticsAfMap = buildDemoMap();
  return { status: "ok", meta: g.__sanalyticsAfMap.meta, day: g.__sanalyticsAfMap.day };
}

// Scheduler: one map per day.
export async function maybeRefreshDailyAfMap(): Promise<void> {
  await getDailyAfMap();
}
