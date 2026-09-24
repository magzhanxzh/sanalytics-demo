import "server-only";
import { afUsers, todayDay, isoOf, AF_TARGET, AF_ORGANIC } from "@/lib/demo/warehouse";
import { AD_SOURCES } from "@/lib/demo/dims";

// Карта user_id -> канал регистрации (таргет/органика) по данным MMP.
//
// В продакшене карта собирается раз в утро из сырых событий регистрации AppsFlyer
// (raw-data in_app_events_report + organic_in_app_events_report по всем приложениям,
// окно 90 дней, кусками по 30 дней из-за лимита Pull API). Канал = медиа-источник
// самого раннего события, платное важнее restricted, restricted важнее органики.
// Экран AF-анализа отвечает из готовой карты, не дергая API на каждый клик.
//
// В демо карта строится из синтетического хранилища с той же формой и тем же окном.

const WINDOW_DAYS = 90;

export type AfGroup = "target" | "organic" | "restricted";
export type RegEntry = { group: AfGroup; channel: string; campaign?: string };
export type RegMap = Record<string, RegEntry>;

export type RegMapMeta = {
  at: string;
  from: string;
  to: string;
  appsSig: string;
  size: number;       // сколько пользователей в карте
  truncated: boolean; // упёрлись ли в лимит строк выгрузки
  errors: string[];   // ошибки по приложениям/эндпоинтам (если были)
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

// Планировщик: карта одна на сутки.
export async function maybeRefreshDailyAfMap(): Promise<void> {
  await getDailyAfMap();
}
