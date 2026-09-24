import "server-only";
import type { ConnectorConfig, SpendRow } from "./types";
import { liveConnectors } from "@/lib/demo/mode";
import { demoTest, demoSpendRows } from "@/lib/demo/ads";

// Настоящие клиенты API рекламных кабинетов и Telegram. В демо-режиме (по умолчанию)
// диспетчеры внизу файла отвечают синтетикой и никуда не ходят.

export type TestResult = { ok: boolean; detail?: string; error?: string };
export type SpendResult = { ok: true; rows: SpendRow[] } | { ok: false; error: string };

const TIMEOUT = 60_000;
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
async function jsonFetch(url: string, init?: RequestInit): Promise<{ status: number; body: string; json: unknown }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
  const body = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(body); } catch { /* не JSON */ }
  return { status: res.status, body, json };
}

/* ----------------------------- Meta Ads ----------------------------- */
function actId(raw: string): string {
  const s = (raw || "").trim();
  return s.startsWith("act_") ? s : `act_${s}`;
}
export async function metaTest(cfg: ConnectorConfig): Promise<TestResult> {
  const { access_token, account_id } = cfg.fields;
  if (!access_token || !account_id) return { ok: false, error: "Заполните Ad Account ID и Access Token." };
  const url = `https://graph.facebook.com/v21.0/${actId(account_id)}?fields=name,currency&access_token=${encodeURIComponent(access_token)}`;
  try {
    const r = await jsonFetch(url);
    const j = r.json as { name?: string; currency?: string; error?: { message?: string } };
    if (r.status === 200 && j?.name) return { ok: true, detail: `${j.name} (${j.currency ?? "?"})` };
    return { ok: false, error: j?.error?.message || r.body.slice(0, 160) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}
export async function metaSpend(cfg: ConnectorConfig, from: string, to: string): Promise<SpendResult> {
  const { access_token, account_id } = cfg.fields;
  if (!access_token || !account_id) return { ok: false, error: "Meta Ads не настроен." };
  const rows: SpendRow[] = [];
  let url =
    `https://graph.facebook.com/v21.0/${actId(account_id)}/insights` +
    `?level=campaign&time_increment=1&limit=500&breakdowns=country` +
    `&fields=spend,impressions,clicks,campaign_name` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since: from, until: to }))}` +
    `&access_token=${encodeURIComponent(access_token)}`;
  try {
    for (let guard = 0; guard < 100 && url; guard++) {
      const r = await jsonFetch(url);
      const j = r.json as { data?: Array<Record<string, string>>; paging?: { next?: string }; error?: { message?: string } };
      if (r.status !== 200) return { ok: false, error: j?.error?.message || r.body.slice(0, 160) };
      for (const d of j.data ?? []) {
        rows.push({
          date: d.date_start, channel: "Meta Ads", campaign: d.campaign_name,
          spend: num(d.spend), impressions: num(d.impressions), clicks: num(d.clicks),
          country: d.country || undefined, source: "meta_ads",
        });
      }
      url = j.paging?.next ?? "";
    }
    return { ok: true, rows };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}

/* ----------------------------- TikTok Ads ----------------------------- */
const TT_BASE = "https://business-api.tiktok.com/open_api/v1.3";
export async function tiktokTest(cfg: ConnectorConfig): Promise<TestResult> {
  const { access_token, advertiser_id } = cfg.fields;
  if (!access_token || !advertiser_id) return { ok: false, error: "Заполните Advertiser ID и Access Token." };
  const url = `${TT_BASE}/advertiser/info/?advertiser_ids=${encodeURIComponent(JSON.stringify([advertiser_id]))}&fields=${encodeURIComponent(JSON.stringify(["name", "currency"]))}`;
  try {
    const r = await jsonFetch(url, { headers: { "Access-Token": access_token } });
    const j = r.json as { code?: number; message?: string; data?: { list?: Array<{ name?: string; currency?: string }> } };
    if (j?.code === 0) {
      const a = j.data?.list?.[0];
      return { ok: true, detail: a ? `${a.name} (${a.currency ?? "?"})` : "ок" };
    }
    return { ok: false, error: j?.message || r.body.slice(0, 160) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}
export async function tiktokSpend(cfg: ConnectorConfig, from: string, to: string): Promise<SpendResult> {
  const { access_token, advertiser_id } = cfg.fields;
  if (!access_token || !advertiser_id) return { ok: false, error: "TikTok Ads не настроен." };
  const rows: SpendRow[] = [];
  const dims = JSON.stringify(["campaign_id", "stat_time_day"]);
  const metrics = JSON.stringify(["spend", "impressions", "clicks", "campaign_name"]);
  try {
    for (let page = 1; page <= 50; page++) {
      const url =
        `${TT_BASE}/report/integrated/get/?advertiser_id=${encodeURIComponent(advertiser_id)}` +
        `&report_type=BASIC&data_level=AUCTION_CAMPAIGN&dimensions=${encodeURIComponent(dims)}` +
        `&metrics=${encodeURIComponent(metrics)}&start_date=${from}&end_date=${to}` +
        `&page=${page}&page_size=1000`;
      const r = await jsonFetch(url, { headers: { "Access-Token": access_token } });
      const j = r.json as {
        code?: number; message?: string;
        data?: { list?: Array<{ dimensions?: Record<string, string>; metrics?: Record<string, string> }>; page_info?: { total_page?: number } };
      };
      if (j?.code !== 0) return { ok: false, error: j?.message || r.body.slice(0, 160) };
      for (const it of j.data?.list ?? []) {
        rows.push({
          date: it.dimensions?.stat_time_day?.slice(0, 10) ?? from,
          channel: "TikTok Ads",
          campaign: it.metrics?.campaign_name,
          spend: num(it.metrics?.spend), impressions: num(it.metrics?.impressions), clicks: num(it.metrics?.clicks),
          source: "tiktok_ads",
        });
      }
      const totalPage = j.data?.page_info?.total_page ?? 1;
      if (page >= totalPage) break;
    }
    return { ok: true, rows };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}

/* ----------------------------- Google Ads ----------------------------- */
async function googleAccessToken(cfg: ConnectorConfig): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const { client_id, client_secret, refresh_token } = cfg.fields;
  if (!client_id || !client_secret || !refresh_token) return { ok: false, error: "Заполните OAuth client_id/secret/refresh_token." };
  try {
    const r = await jsonFetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }).toString(),
    });
    const j = r.json as { access_token?: string; error_description?: string; error?: string };
    if (j?.access_token) return { ok: true, token: j.access_token };
    return { ok: false, error: j?.error_description || j?.error || r.body.slice(0, 160) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}
function googleHeaders(cfg: ConnectorConfig, token: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": cfg.fields.developer_token ?? "",
    "Content-Type": "application/json",
  };
  if (cfg.fields.login_customer_id) h["login-customer-id"] = cfg.fields.login_customer_id.replace(/-/g, "");
  return h;
}
export async function googleTest(cfg: ConnectorConfig): Promise<TestResult> {
  if (!cfg.fields.customer_id || !cfg.fields.developer_token) return { ok: false, error: "Заполните Customer ID и Developer Token." };
  const tok = await googleAccessToken(cfg);
  if (!tok.ok) return { ok: false, error: tok.error };
  const cid = cfg.fields.customer_id.replace(/-/g, "");
  try {
    const r = await jsonFetch(`https://googleads.googleapis.com/v17/customers/${cid}/googleAds:search`, {
      method: "POST", headers: googleHeaders(cfg, tok.token),
      body: JSON.stringify({ query: "SELECT customer.descriptive_name FROM customer LIMIT 1" }),
    });
    const j = r.json as { results?: Array<{ customer?: { descriptiveName?: string } }>; error?: { message?: string } };
    if (r.status === 200) return { ok: true, detail: j.results?.[0]?.customer?.descriptiveName || "ок" };
    return { ok: false, error: j?.error?.message || r.body.slice(0, 200) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}
export async function googleSpend(cfg: ConnectorConfig, from: string, to: string): Promise<SpendResult> {
  const tok = await googleAccessToken(cfg);
  if (!tok.ok) return { ok: false, error: tok.error };
  const cid = (cfg.fields.customer_id ?? "").replace(/-/g, "");
  const query =
    `SELECT campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, segments.date ` +
    `FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}'`;
  const rows: SpendRow[] = [];
  try {
    let pageToken: string | undefined;
    for (let guard = 0; guard < 50; guard++) {
      const r = await jsonFetch(`https://googleads.googleapis.com/v17/customers/${cid}/googleAds:search`, {
        method: "POST", headers: googleHeaders(cfg, tok.token),
        body: JSON.stringify({ query, pageToken }),
      });
      const j = r.json as {
        results?: Array<{ campaign?: { name?: string }; metrics?: { costMicros?: string; impressions?: string; clicks?: string }; segments?: { date?: string } }>;
        nextPageToken?: string; error?: { message?: string };
      };
      if (r.status !== 200) return { ok: false, error: j?.error?.message || r.body.slice(0, 200) };
      for (const row of j.results ?? []) {
        rows.push({
          date: row.segments?.date ?? from, channel: "Google Ads", campaign: row.campaign?.name,
          spend: num(row.metrics?.costMicros) / 1_000_000,
          impressions: num(row.metrics?.impressions), clicks: num(row.metrics?.clicks), source: "google_ads",
        });
      }
      if (!j.nextPageToken) break;
      pageToken = j.nextPageToken;
    }
    return { ok: true, rows };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}

/* ----------------------------- Yandex Direct ----------------------------- */
const YD_API = "https://api.direct.yandex.com/json/v5";
function ydHeaders(cfg: ConnectorConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.fields.oauth_token}`,
    "Client-Login": cfg.fields.login ?? "",
    "Accept-Language": "ru",
    "Content-Type": "application/json; charset=utf-8",
  };
}
export async function yandexTest(cfg: ConnectorConfig): Promise<TestResult> {
  const { oauth_token, login } = cfg.fields;
  if (!oauth_token || !login) return { ok: false, error: "Заполните Client-Login и OAuth Token." };
  try {
    const res = await fetch(`${YD_API}/campaigns`, {
      method: "POST", headers: ydHeaders(cfg), signal: AbortSignal.timeout(TIMEOUT),
      body: JSON.stringify({ method: "get", params: { SelectionCriteria: {}, FieldNames: ["Id", "Name"], Page: { Limit: 1 } } }),
    });
    const body = await res.text();
    let j: unknown = null; try { j = JSON.parse(body); } catch { /* */ }
    const jj = j as { result?: unknown; error?: { error_detail?: string; error_string?: string } };
    if (res.status === 200 && jj?.result) return { ok: true, detail: "доступ к Директу подтверждён" };
    return { ok: false, error: jj?.error?.error_detail || jj?.error?.error_string || body.slice(0, 160) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}
export async function yandexSpend(cfg: ConnectorConfig, from: string, to: string): Promise<SpendResult> {
  const { oauth_token, login } = cfg.fields;
  if (!oauth_token || !login) return { ok: false, error: "Yandex Direct не настроен." };
  const headers: Record<string, string> = {
    ...ydHeaders(cfg),
    processingMode: "auto",
    returnMoneyInMicros: "false",
    skipReportHeader: "true",
    skipReportSummary: "true",
  };
  const reportBody = JSON.stringify({
    params: {
      SelectionCriteria: { DateFrom: from, DateTo: to },
      FieldNames: ["Date", "CampaignName", "Cost", "Impressions", "Clicks"],
      ReportName: `sanalytics_${from}_${to}_${Date.now()}`,
      ReportType: "CAMPAIGN_PERFORMANCE_REPORT",
      DateRangeType: "CUSTOM_DATE",
      Format: "TSV",
      IncludeVAT: "YES",
      IncludeDiscount: "NO",
    },
  });
  try {
    // Отчёты Директа асинхронные: 200 = готов, 201/202 = в очереди/готовится, ждём Retry-In.
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await fetch(`${YD_API}/reports`, { method: "POST", headers, body: reportBody, signal: AbortSignal.timeout(TIMEOUT) });
      if (res.status === 200) {
        const tsv = await res.text();
        return { ok: true, rows: parseYandexTsv(tsv) };
      }
      if (res.status === 201 || res.status === 202) {
        const retryIn = Number(res.headers.get("retryIn") || "5");
        await new Promise((r) => setTimeout(r, Math.min(Math.max(retryIn, 1), 10) * 1000));
        continue;
      }
      const body = await res.text();
      let j: unknown = null; try { j = JSON.parse(body); } catch { /* */ }
      const jj = j as { error?: { error_detail?: string; error_string?: string } };
      return { ok: false, error: jj?.error?.error_detail || jj?.error?.error_string || body.slice(0, 200) };
    }
    return { ok: false, error: "Отчёт Директа не готов за отведённое время, попробуйте ещё раз." };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}
function parseYandexTsv(tsv: string): SpendRow[] {
  const lines = tsv.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const header = lines[0].split("\t");
  const idx = (name: string) => header.indexOf(name);
  const iDate = idx("Date"), iCamp = idx("CampaignName"), iCost = idx("Cost"), iImp = idx("Impressions"), iClk = idx("Clicks");
  const rows: SpendRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split("\t");
    rows.push({
      date: (iDate >= 0 ? c[iDate] : "").slice(0, 10),
      channel: "Yandex Direct",
      campaign: iCamp >= 0 ? c[iCamp] : undefined,
      spend: num(iCost >= 0 ? c[iCost] : 0),
      impressions: num(iImp >= 0 ? c[iImp] : 0),
      clicks: num(iClk >= 0 ? c[iClk] : 0),
      source: "yandex_ads",
    });
  }
  return rows;
}

/* ----------------------------- Telegram ----------------------------- */
export async function telegramTest(cfg: ConnectorConfig): Promise<TestResult> {
  const { bot_token } = cfg.fields;
  if (!bot_token) return { ok: false, error: "Заполните Bot Token." };
  try {
    const r = await jsonFetch(`https://api.telegram.org/bot${bot_token}/getMe`);
    const j = r.json as { ok?: boolean; result?: { username?: string }; description?: string };
    if (j?.ok) return { ok: true, detail: `@${j.result?.username ?? "бот"}` };
    return { ok: false, error: j?.description || r.body.slice(0, 160) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}
async function telegramSendLive(cfg: ConnectorConfig, text: string): Promise<TestResult> {
  const { bot_token, chat_id } = cfg.fields;
  if (!bot_token || !chat_id) return { ok: false, error: "Заполните Bot Token и Chat ID." };
  try {
    const r = await jsonFetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const j = r.json as { ok?: boolean; description?: string };
    if (j?.ok) return { ok: true, detail: "отправлено" };
    return { ok: false, error: j?.description || r.body.slice(0, 160) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}

/* ----------------------------- Диспетчеры ----------------------------- */
export async function telegramSend(cfg: ConnectorConfig, text: string): Promise<TestResult> {
  if (!liveConnectors()) return { ok: true, detail: "демо-режим: сообщение не отправлялось" };
  return telegramSendLive(cfg, text);
}
export async function testConnector(cfg: ConnectorConfig): Promise<TestResult> {
  if (!liveConnectors()) return demoTest(cfg);
  switch (cfg.id) {
    case "meta_ads": return metaTest(cfg);
    case "tiktok_ads": return tiktokTest(cfg);
    case "google_ads": return googleTest(cfg);
    case "yandex_ads": return yandexTest(cfg);
    case "telegram": return telegramTest(cfg);
    default: return { ok: false, error: "Неизвестный коннектор." };
  }
}
export async function spendFrom(cfg: ConnectorConfig, from: string, to: string): Promise<SpendResult> {
  if (!liveConnectors()) return { ok: true, rows: demoSpendRows(from, to).filter((r) => r.source === cfg.id) };
  switch (cfg.id) {
    case "meta_ads": return metaSpend(cfg, from, to);
    case "tiktok_ads": return tiktokSpend(cfg, from, to);
    case "google_ads": return googleSpend(cfg, from, to);
    case "yandex_ads": return yandexSpend(cfg, from, to);
    default: return { ok: false, error: "Этот коннектор не отдаёт расход." };
  }
}
