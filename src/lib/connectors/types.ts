// A single framework for ad and service connectors. Each connector is described by a set
// of fields (some are secrets and are never exposed). Credentials stay on the server.
// Ad account spend and manual input are merged into one layer (src/lib/connectors/spend.ts).

export type ConnectorId = "google_ads" | "meta_ads" | "tiktok_ads" | "yandex_ads" | "telegram";

export type FieldSpec = {
  key: string;
  label: string;
  secret?: boolean;      // the value is never sent to the browser, only a "set" flag
  optional?: boolean;
  placeholder?: string;
};

export type ConnectorSpec = {
  id: ConnectorId;
  ab: string;            // short label for the card
  name: string;
  type: string;          // "ads" | "notifications"
  desc: string;
  kind: "ads" | "notify";
  channel?: string;      // the spend channel name in the unified layer
  fields: FieldSpec[];
};

export const CONNECTORS: ConnectorSpec[] = [
  {
    id: "google_ads", ab: "GA", name: "Google Ads", type: "ads", kind: "ads", channel: "Google Ads",
    desc: "Spend, impressions and clicks by campaign via the Google Ads API.",
    fields: [
      { key: "customer_id", label: "Customer ID", placeholder: "1234567890 (no dashes)" },
      { key: "login_customer_id", label: "Login Customer ID (MCC)", optional: true, placeholder: "for a manager account" },
      { key: "developer_token", label: "Developer Token", secret: true },
      { key: "client_id", label: "OAuth Client ID" },
      { key: "client_secret", label: "OAuth Client Secret", secret: true },
      { key: "refresh_token", label: "OAuth Refresh Token", secret: true },
    ],
  },
  {
    id: "meta_ads", ab: "MA", name: "Meta Ads", type: "ads", kind: "ads", channel: "Meta Ads",
    desc: "Spend and attribution by ad account via the Marketing API.",
    fields: [
      { key: "account_id", label: "Ad Account ID", placeholder: "act_1234567890 or 1234567890" },
      { key: "access_token", label: "Access Token", secret: true },
    ],
  },
  {
    id: "tiktok_ads", ab: "TT", name: "TikTok Ads", type: "ads", kind: "ads", channel: "TikTok Ads",
    desc: "Spend and orders by campaign via the Business API.",
    fields: [
      { key: "advertiser_id", label: "Advertiser ID" },
      { key: "access_token", label: "Access Token", secret: true },
    ],
  },
  {
    id: "yandex_ads", ab: "YD", name: "Yandex Direct", type: "ads", kind: "ads", channel: "Yandex Direct",
    desc: "Spend, impressions and clicks by campaign via the Direct Reports API.",
    fields: [
      { key: "login", label: "Client-Login (advertiser login)", placeholder: "e.g. my-agency-client" },
      { key: "oauth_token", label: "OAuth Token", secret: true },
    ],
  },
  {
    id: "telegram", ab: "TG", name: "Telegram", type: "notifications", kind: "notify",
    desc: "Alerts and a morning digest to a chat.",
    fields: [
      { key: "bot_token", label: "Bot Token", secret: true, placeholder: "123456:ABC-DEF..." },
      { key: "chat_id", label: "Chat ID", placeholder: "-1001234567890 or @username" },
    ],
  },
];

export function specOf(id: ConnectorId): ConnectorSpec | undefined {
  return CONNECTORS.find((c) => c.id === id);
}

// Ad platforms that can have several accounts (one per country).
export type AdProvider = "meta_ads" | "google_ads" | "tiktok_ads" | "yandex_ads";
export const AD_PROVIDERS: AdProvider[] = ["meta_ads", "google_ads", "tiktok_ads", "yandex_ads"];

// An ad account of a given platform in a given country.
export type AdAccount = {
  id: string;            // internal uid
  provider: AdProvider;
  country: string;       // KZ|UZ|KG|TJ|MN
  label?: string;        // free-form label
  enabled: boolean;
  fields: Record<string, string>;
};

// External view: secrets are replaced by a "set" flag.
export type AdAccountView = {
  id: string;
  provider: AdProvider;
  country: string;
  label?: string;
  enabled: boolean;
  configured: boolean;
  fields: Record<string, string>;      // non-secret values
  secretsSet: Record<string, boolean>;
};

export type ConnectorConfig = {
  id: ConnectorId;
  enabled: boolean;
  fields: Record<string, string>;
};

// External view: secrets are replaced by a hasX flag.
export type ConnectorView = {
  id: ConnectorId;
  enabled: boolean;
  configured: boolean;
  fields: Record<string, string>;     // non-secret values only
  secretsSet: Record<string, boolean>; // key -> whether the secret is set
};

// A spend row in the unified layer.
export type SpendRow = {
  date: string;       // YYYY-MM-DD
  channel: string;    // as in breakdowns (Google Ads, Meta Ads, TikTok Ads, Yandex Direct)
  campaign?: string;
  spend: number;      // in the account currency (USD in client reports)
  impressions?: number;
  clicks?: number;
  country?: string;   // ad delivery country (ISO) if the account provides the split (Meta)
  source: "google_ads" | "meta_ads" | "tiktok_ads" | "yandex_ads" | "manual";
};
