// Настройки организации.

export type AiModel = "claude-opus-5" | "claude-sonnet-5" | "claude-haiku-4-5";

export type Settings = {
  orgName: string;
  timezone: string;
  currency: string;
  defaultRole: string;
  sso: boolean;
  attribution: string;
  conversionWindowDays: number;
  revenueBasis: "gross" | "paid";
  aiModel: AiModel;
};

export function defaultSettings(): Settings {
  return {
    orgName: "Demo Shop",
    timezone: "Asia/Almaty",
    currency: "USD",
    defaultRole: "Аналитик",
    sso: false,
    attribution: "Last non-direct",
    conversionWindowDays: 7,
    revenueBasis: "gross",
    aiModel: "claude-opus-5",
  };
}

export const TIMEZONES = ["Asia/Almaty", "Asia/Tashkent", "Asia/Bishkek", "UTC"];
export const CURRENCIES = ["USD", "KZT", "EUR"];
export const ROLES = ["Владелец", "Администратор", "Аналитик", "Маркетолог", "Наблюдатель"];
export const ATTRIBUTIONS = ["Last non-direct", "Last click", "First click", "Linear"];
export const AI_MODELS: { value: AiModel; label: string; hint: string }[] = [
  { value: "claude-opus-5", label: "Opus 5", hint: "макс качество, дороже" },
  { value: "claude-sonnet-5", label: "Sonnet 5", hint: "баланс цена/качество" },
  { value: "claude-haiku-4-5", label: "Haiku 4.5", hint: "самый дешёвый" },
];
