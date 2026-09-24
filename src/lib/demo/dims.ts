// Справочники синтетического магазина. Файл без server-only: его читают и
// клиентские компоненты (выпадашки фильтров).

export const COUNTRY_CODES = ["KZ", "UZ", "KG", "TJ", "MN"] as const;
export const COUNTRY_WEIGHTS = [0.6, 0.2, 0.11, 0.06, 0.03];

// Канал регистрации пользователя (где создан аккаунт).
export const USER_CHANNELS = ["app", "web", "partner"] as const;
export const USER_CHANNEL_WEIGHTS = [0.62, 0.27, 0.11];

// Канал заказа (витрина, через которую оформлен заказ).
export const ORDER_CHANNELS = ["store", "marketplace_a", "marketplace_b", "express"] as const;
export const ORDER_CHANNEL_WEIGHTS = [0.55, 0.25, 0.13, 0.07];
// Медианный чек по каналу, $.
export const ORDER_CHANNEL_MEDIAN_PRICE = [24, 17, 31, 45];

// Рекламные источники. В сыром отчёте MMP это технические media source id,
// на экранах показываем человеческие названия площадок.
export const AD_SOURCES = ["Google Ads", "TikTok Ads", "Meta Ads", "Yandex Direct"] as const;
export type AdSource = (typeof AD_SOURCES)[number];

// Какие источники крутятся в какой стране (там же заведены рекламные кабинеты).
export const SOURCES_BY_COUNTRY: Record<string, { source: number; weight: number }[]> = {
  KZ: [{ source: 0, weight: 0.34 }, { source: 1, weight: 0.3 }, { source: 2, weight: 0.22 }, { source: 3, weight: 0.14 }],
  UZ: [{ source: 0, weight: 0.4 }, { source: 1, weight: 0.35 }, { source: 2, weight: 0.25 }],
  KG: [{ source: 1, weight: 0.55 }, { source: 2, weight: 0.45 }],
};

// Насколько хорошо источник конвертирует регистрацию в покупку (множитель к базе).
export const SOURCE_CONV = [0.95, 0.7, 0.45, 0.8];
// Стоимость регистрации (CPR) по источнику, $.
export const SOURCE_CPR = [7.3, 7.3, 4.0, 8.3];
export const COUNTRY_CPR_MULT: Record<string, number> = { KZ: 1, UZ: 0.7, KG: 0.65, TJ: 0.55, MN: 0.9 };

// Кампании по источнику (к имени добавляется код страны).
export const CAMPAIGNS: Record<number, string[]> = {
  0: ["Search_Brand", "Search_Generic", "PMax_Shopping", "UAC_Install"],
  1: ["Video_Promo", "Spark_UGC", "Smart_Plus"],
  2: ["Advantage_Plus", "Retarget_Cart", "Lookalike_Buyers"],
  3: ["Direct_Search", "RSYA_Banner"],
};
