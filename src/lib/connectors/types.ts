// Единый фреймворк рекламных/сервисных коннекторов. Каждый коннектор описан набором
// полей (часть – секреты, наружу не отдаются). Креды хранятся на сервере.
// Расход из кабинетов и ручной ввод сводятся в единый слой (src/lib/connectors/spend.ts).

export type ConnectorId = "google_ads" | "meta_ads" | "tiktok_ads" | "yandex_ads" | "telegram";

export type FieldSpec = {
  key: string;
  label: string;
  secret?: boolean;      // не отдаём значение в браузер, только признак «задано»
  optional?: boolean;
  placeholder?: string;
};

export type ConnectorSpec = {
  id: ConnectorId;
  ab: string;            // короткая метка для карточки
  name: string;
  type: string;          // «реклама» | «уведомления»
  desc: string;
  kind: "ads" | "notify";
  channel?: string;      // как называется канал расхода в едином слое
  fields: FieldSpec[];
};

export const CONNECTORS: ConnectorSpec[] = [
  {
    id: "google_ads", ab: "GA", name: "Google Ads", type: "реклама", kind: "ads", channel: "Google Ads",
    desc: "Расход, показы, клики по кампаниям через Google Ads API.",
    fields: [
      { key: "customer_id", label: "Customer ID", placeholder: "1234567890 (без дефисов)" },
      { key: "login_customer_id", label: "Login Customer ID (MCC)", optional: true, placeholder: "для управляющего аккаунта" },
      { key: "developer_token", label: "Developer Token", secret: true },
      { key: "client_id", label: "OAuth Client ID" },
      { key: "client_secret", label: "OAuth Client Secret", secret: true },
      { key: "refresh_token", label: "OAuth Refresh Token", secret: true },
    ],
  },
  {
    id: "meta_ads", ab: "MA", name: "Meta Ads", type: "реклама", kind: "ads", channel: "Meta Ads",
    desc: "Расход и атрибуция по кабинетам через Marketing API.",
    fields: [
      { key: "account_id", label: "Ad Account ID", placeholder: "act_1234567890 или 1234567890" },
      { key: "access_token", label: "Access Token", secret: true },
    ],
  },
  {
    id: "tiktok_ads", ab: "TT", name: "TikTok Ads", type: "реклама", kind: "ads", channel: "TikTok Ads",
    desc: "Расход и заказы по кампаниям через Business API.",
    fields: [
      { key: "advertiser_id", label: "Advertiser ID" },
      { key: "access_token", label: "Access Token", secret: true },
    ],
  },
  {
    id: "yandex_ads", ab: "YD", name: "Yandex Direct", type: "реклама", kind: "ads", channel: "Yandex Direct",
    desc: "Расход, показы, клики по кампаниям через Reports API (Директ).",
    fields: [
      { key: "login", label: "Client-Login (логин рекламодателя)", placeholder: "например my-agency-client" },
      { key: "oauth_token", label: "OAuth Token", secret: true },
    ],
  },
  {
    id: "telegram", ab: "TG", name: "Telegram", type: "уведомления", kind: "notify",
    desc: "Алерты и утренняя сводка в чат.",
    fields: [
      { key: "bot_token", label: "Bot Token", secret: true, placeholder: "123456:ABC-DEF..." },
      { key: "chat_id", label: "Chat ID", placeholder: "-1001234567890 или @username" },
    ],
  },
];

export function specOf(id: ConnectorId): ConnectorSpec | undefined {
  return CONNECTORS.find((c) => c.id === id);
}

// Рекламные площадки, у которых может быть несколько кабинетов (по одному на страну).
export type AdProvider = "meta_ads" | "google_ads" | "tiktok_ads" | "yandex_ads";
export const AD_PROVIDERS: AdProvider[] = ["meta_ads", "google_ads", "tiktok_ads", "yandex_ads"];

// Рекламный кабинет конкретной площадки в конкретной стране.
export type AdAccount = {
  id: string;            // внутренний uid
  provider: AdProvider;
  country: string;       // KZ|UZ|KG|TJ|MN
  label?: string;        // произвольная подпись
  enabled: boolean;
  fields: Record<string, string>;
};

// Вид наружу: секреты заменены на признак «задано».
export type AdAccountView = {
  id: string;
  provider: AdProvider;
  country: string;
  label?: string;
  enabled: boolean;
  configured: boolean;
  fields: Record<string, string>;      // несекретные значения
  secretsSet: Record<string, boolean>;
};

export type ConnectorConfig = {
  id: ConnectorId;
  enabled: boolean;
  fields: Record<string, string>;
};

// Вид наружу: секреты заменены на признак hasX.
export type ConnectorView = {
  id: ConnectorId;
  enabled: boolean;
  configured: boolean;
  fields: Record<string, string>;     // только несекретные значения
  secretsSet: Record<string, boolean>; // key -> задан ли секрет
};

// Строка расхода в едином слое.
export type SpendRow = {
  date: string;       // YYYY-MM-DD
  channel: string;    // как в разрезах (Google Ads, Meta Ads, TikTok Ads, Yandex Direct)
  campaign?: string;
  spend: number;      // в валюте кабинета (доллары в отчётах клиента)
  impressions?: number;
  clicks?: number;
  country?: string;   // страна показа рекламы (ISO), если кабинет отдаёт разбивку (Meta)
  source: "google_ads" | "meta_ads" | "tiktok_ads" | "yandex_ads" | "manual";
};
