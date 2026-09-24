// Интеграция AppsFlyer (MMP). Тянем агрегатный отчёт Pull API v2
// (partners_by_date_report): медиа-источник x дата -> показы/клики/установки/расход.
// Токен один на аккаунт, приложений может быть несколько (Android/iOS).
// Токен и данные хранятся на сервере, в боевое хранилище ничего не пишем.

export type AfPlatform = "android" | "ios" | "other";

export type AfApp = { id: string; platform: AfPlatform };

export type AfConfig = {
  token: string;     // Pull API v2 Bearer token (из AF: Security Center)
  apps: AfApp[];     // одно или несколько приложений (com.example.shop, id123..)
  timezone: string;  // напр. Asia/Almaty; пусто = дефолт приложения в AF
};

export function emptyAfConfig(): AfConfig {
  return { token: "", apps: [], timezone: "" };
}

// Наружу (в браузер) токен не отдаём.
export type AfConfigView = {
  configured: boolean;
  apps: AfApp[];
  timezone: string;
  hasToken: boolean;
};

// Строка агрегата по медиа-источнику за окно (сумма по всем приложениям).
export type AfSourceRow = {
  mediaSource: string;
  impressions: number;
  clicks: number;
  installs: number;
  cost: number;
};

// Итог по одному приложению (для разбивки по платформам).
export type AfAppTotal = {
  id: string;
  platform: AfPlatform;
  installs: number;
  cost: number;
  error?: string; // если по этому приложению выгрузка не удалась
};

export type AfSync = {
  at: string;          // ISO времени синхронизации
  from: string;        // окно
  to: string;
  rows: AfSourceRow[]; // агрегат по медиа-источникам (все приложения)
  byApp: AfAppTotal[]; // разбивка по приложениям/платформам
  totalInstalls: number;
  totalCost: number;
  note?: string;       // предупреждения (лимит строк, нет расхода и т.п.)
};

export const PLATFORM_LABEL: Record<AfPlatform, string> = {
  android: "Android",
  ios: "iOS",
  other: "Другое",
};
