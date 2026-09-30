// Reference data for the synthetic store. No server-only here: client components
// (filter dropdowns) read it too.

export const COUNTRY_CODES = ["KZ", "UZ", "KG", "TJ", "MN"] as const;
export const COUNTRY_WEIGHTS = [0.6, 0.2, 0.11, 0.06, 0.03];

// User sign-up channel (where the account was created).
export const USER_CHANNELS = ["app", "web", "partner"] as const;
export const USER_CHANNEL_WEIGHTS = [0.62, 0.27, 0.11];

// Order channel (the storefront the order was placed through).
export const ORDER_CHANNELS = ["store", "marketplace_a", "marketplace_b", "express"] as const;
export const ORDER_CHANNEL_WEIGHTS = [0.55, 0.25, 0.13, 0.07];
// Median check by channel, $.
export const ORDER_CHANNEL_MEDIAN_PRICE = [24, 17, 31, 45];

// Ad sources. In the raw MMP report these are technical media source ids;
// the screens show human-readable platform names.
export const AD_SOURCES = ["Google Ads", "TikTok Ads", "Meta Ads", "Yandex Direct"] as const;
export type AdSource = (typeof AD_SOURCES)[number];

// Which sources run in which country (ad accounts are set up there too).
export const SOURCES_BY_COUNTRY: Record<string, { source: number; weight: number }[]> = {
  KZ: [{ source: 0, weight: 0.34 }, { source: 1, weight: 0.3 }, { source: 2, weight: 0.22 }, { source: 3, weight: 0.14 }],
  UZ: [{ source: 0, weight: 0.4 }, { source: 1, weight: 0.35 }, { source: 2, weight: 0.25 }],
  KG: [{ source: 1, weight: 0.55 }, { source: 2, weight: 0.45 }],
};

// How well a source converts sign-ups into purchases (multiplier over the base).
export const SOURCE_CONV = [0.95, 0.7, 0.45, 0.8];
// Cost per registration (CPR) by source, $.
export const SOURCE_CPR = [7.3, 7.3, 4.0, 8.3];
export const COUNTRY_CPR_MULT: Record<string, number> = { KZ: 1, UZ: 0.7, KG: 0.65, TJ: 0.55, MN: 0.9 };

// Campaigns by source (the country code is appended to the name).
export const CAMPAIGNS: Record<number, string[]> = {
  0: ["Search_Brand", "Search_Generic", "PMax_Shopping", "UAC_Install"],
  1: ["Video_Promo", "Spark_UGC", "Smart_Plus"],
  2: ["Advantage_Plus", "Retarget_Cart", "Lookalike_Buyers"],
  3: ["Direct_Search", "RSYA_Banner"],
};
