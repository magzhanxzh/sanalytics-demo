// AppsFlyer (MMP) integration. We pull the Pull API v2 aggregate report
// (partners_by_date_report): media source x date -> impressions/clicks/installs/spend.
// One token per account, there can be several apps (Android/iOS).
// The token and data stay on the server; nothing is written to the production warehouse.

export type AfPlatform = "android" | "ios" | "other";

export type AfApp = { id: string; platform: AfPlatform };

export type AfConfig = {
  token: string;     // Pull API v2 Bearer token (from AF Security Center)
  apps: AfApp[];     // one or more apps (com.example.shop, id123..)
  timezone: string;  // e.g. Asia/Almaty; empty = the app default in AF
};

export function emptyAfConfig(): AfConfig {
  return { token: "", apps: [], timezone: "" };
}

// The token is never exposed to the browser.
export type AfConfigView = {
  configured: boolean;
  apps: AfApp[];
  timezone: string;
  hasToken: boolean;
};

// Aggregate row per media source for the window (sum across all apps).
export type AfSourceRow = {
  mediaSource: string;
  impressions: number;
  clicks: number;
  installs: number;
  cost: number;
};

// Total for one app (for the platform split).
export type AfAppTotal = {
  id: string;
  platform: AfPlatform;
  installs: number;
  cost: number;
  error?: string; // if the export failed for this app
};

export type AfSync = {
  at: string;          // sync time, ISO
  from: string;        // window
  to: string;
  rows: AfSourceRow[]; // aggregate by media source (all apps)
  byApp: AfAppTotal[]; // split by app/platform
  totalInstalls: number;
  totalCost: number;
  note?: string;       // warnings (row limit, no spend and so on)
};

export const PLATFORM_LABEL: Record<AfPlatform, string> = {
  android: "Android",
  ios: "iOS",
  other: "Other",
};
