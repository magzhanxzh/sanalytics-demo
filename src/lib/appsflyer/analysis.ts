import "server-only";
import { cacheGet, cacheSet, isFresh } from "@/lib/cache";
import { regActive, num, type CardFilters } from "@/lib/queries/cards";
import { queryCohortByUser, dayOf } from "@/lib/demo/warehouse";
import { getAfConfig } from "./store";
import { getDailyAfMap, refreshDailyAfMap, type AfGroup, type RegMap, type RegMapMeta } from "./regmap";
import { getSpendRows, syncAdSpend } from "@/lib/connectors/spend";

// Spend sync throttling: don't hit ad account APIs more than once per 5 min per window.
const lastSpendSync = new Map<string, number>();
const SPEND_SYNC_TTL = 5 * 60 * 1000;

const DAY_MS = 86_400_000;
function toDate(s: string): Date { return new Date(s + "T00:00:00Z"); }
function fmt(d: Date): string { return d.toISOString().slice(0, 10); }
function shiftDays(d: Date, n: number): Date { return new Date(d.getTime() + n * DAY_MS); }

export type AfGroupResult = {
  key: string;
  label: string;
  registrations: number;
  buyers: number;
  cr: number;         // %
  orders: number;
  revenue: number;
  weight: number;
  avgCheck: number;
  spend?: number;   // spend from the ad account (if the channel is connected)
  cac?: number;     // spend / buyers
  cpr?: number;     // spend / sign-ups
  roas?: number;    // revenue / spend (ratio)
};

export type AfAnalysis = {
  afConfigured: boolean;
  chConfigured: boolean;
  error?: string;
  window?: { regFrom: string; regTo: string; orderFrom: string; orderTo: string };
  map?: { at: string; from: string; to: string; size: number; truncated: boolean; coverage: number; errors: string[] };
  groups: AfGroupResult[];
  targetChannels: AfGroupResult[];
  targetCampaigns: AfGroupResult[];
  hasSpend?: boolean;          // whether there is channel spend in the window
  hasCampaignSpend?: boolean;  // whether there is campaign spend in the window
  spendAttributed?: boolean;   // a country is selected -> spend is allocated to it proportionally
  channelDaily?: AfDailySeries[]; // daily spend + sign-ups for ad accounts (with spend)
  totals?: AfGroupResult;
};

export type AfDailyPoint = { date: string; spend: number; registrations: number };
export type AfDailySeries = { channel: string; points: AfDailyPoint[] };

const GROUP_LABEL: Record<string, string> = {
  target: "Paid",
  organic: "Organic",
  restricted: "Restricted (iOS without ATT)",
  no_af: "No AF data",
};

type Acc = { registrations: number; buyers: number; orders: number; revenue: number; weight: number };
function emptyAcc(): Acc { return { registrations: 0, buyers: 0, orders: 0, revenue: 0, weight: 0 }; }
function finalize(key: string, label: string, a: Acc): AfGroupResult {
  return {
    key, label,
    registrations: a.registrations,
    buyers: a.buyers,
    cr: a.registrations ? (a.buyers / a.registrations) * 100 : 0,
    orders: a.orders,
    revenue: a.revenue,
    weight: a.weight,
    avgCheck: a.orders ? a.revenue / a.orders : 0,
  };
}

// Windows from filters: sign-up (cohort or order period) and order.
function windows(f: CardFilters) {
  const now = new Date();
  const oFromStr = f.from || fmt(shiftDays(now, -30));
  const oToStr = f.to || fmt(now);
  const orderFrom = toDate(oFromStr);
  const orderToExcl = shiftDays(toDate(oToStr), 1);
  const reg = regActive(f)
    ? { from: toDate(f.regFrom), toExcl: shiftDays(toDate(f.regTo), 1) }
    : { from: orderFrom, toExcl: orderToExcl };
  return { orderFrom, orderToExcl, regFrom: reg.from, regToExcl: reg.toExcl };
}

// bypassCache recomputes the analysis (CH + spend), rebuildMap also rebuilds the AF map.
export async function buildAfAnalysis(
  f: CardFilters,
  opts: { bypassCache?: boolean; rebuildMap?: boolean; syncSpend?: boolean } = {},
): Promise<AfAnalysis> {
  const cfg = await getAfConfig();
  const afConfigured = Boolean(cfg.token && cfg.apps.filter((a) => a.id).length > 0);
  const chConfigured = true; // the fact source (a synthetic store in the demo) is always available
  if (!afConfigured || !chConfigured) {
    return { afConfigured, chConfigured, groups: [], targetChannels: [], targetCampaigns: [] };
  }

  const bypass = Boolean(opts.bypassCache || opts.rebuildMap);
  const key = "af-analysis:" + JSON.stringify(f);
  if (!bypass) {
    const hit = cacheGet<AfAnalysis>(key);
    if (hit && isFresh(hit.at)) return hit.data;
  }

  const w = windows(f);
  const win = { regFrom: fmt(w.regFrom), regTo: fmt(w.regToExcl), orderFrom: fmt(w.orderFrom), orderTo: fmt(w.orderToExcl) };

  try {
    // 1) Daily user_id->channel map from AF (last 90 days). Built every morning;
    // rebuildMap (the "Refresh AF map" button) rebuilds it right away.
    if (opts.rebuildMap) await refreshDailyAfMap();
    const daily = await getDailyAfMap();
    const map: RegMap = daily?.map ?? {};
    const mapMeta: RegMapMeta = daily?.meta ?? {
      at: "", from: "", to: "", appsSig: "", size: 0, truncated: false,
      errors: ["The AppsFlyer map is not loaded yet. It refreshes every morning; click \"Refresh AF map\" to load it now."],
    };

    // 2) Per-user cohort facts from the store (SQL against the DWH in production).
    const rows = queryCohortByUser(f.userCreator, dayOf(win.regFrom), dayOf(win.regTo), {
      from: dayOf(win.orderFrom), toExcl: dayOf(win.orderTo), orderChannel: f.orderCreator, excludeB2b: f.excludeB2b,
    });

    // 3) Join and aggregate. We display the selected country (or all), but in parallel
    // count paid sign-ups by channel and campaign ACROSS ALL countries; that is the denominator
    // for a fair split of ad account spend across countries.
    const groups = new Map<string, Acc>();
    const channels = new Map<string, Acc>();
    const campaigns = new Map<string, Acc>();
    const channelAllRegs = new Map<string, number>();
    const campaignAllRegs = new Map<string, number>();
    const dailyRegByCh = new Map<string, Map<string, number>>(); // channel -> sign-up date -> count (display)
    const total = emptyAcc();
    let matched = 0;
    const paid = f.basis === "paid";
    const isAll = !f.country || f.country === "all";

    for (const r of rows) {
      const entry = map[r.user_id];

      // denominator (all countries): paid sign-ups by channel and campaign
      if (entry && entry.group === "target") {
        const ck = entry.channel || "(not set)";
        channelAllRegs.set(ck, (channelAllRegs.get(ck) ?? 0) + 1);
        const camp = entry.campaign || "(no campaign)";
        campaignAllRegs.set(camp, (campaignAllRegs.get(camp) ?? 0) + 1);
      }

      // display: only the selected country (geo restriction is respected)
      if (!isAll && (r.country || "") !== f.country) continue;

      const orders = num(r.orders);
      const revenue = paid ? num(r.revenue_paid) : num(r.revenue);
      const weight = num(r.weight);
      const isBuyer = orders > 0 ? 1 : 0;
      const gkey: string = entry ? entry.group : "no_af";
      if (entry) matched++;

      const g = groups.get(gkey) ?? emptyAcc();
      g.registrations += 1; g.buyers += isBuyer; g.orders += orders; g.revenue += revenue; g.weight += weight;
      groups.set(gkey, g);
      total.registrations += 1; total.buyers += isBuyer; total.orders += orders; total.revenue += revenue; total.weight += weight;

      if (entry && entry.group === "target") {
        const ck = entry.channel || "(not set)";
        const c = channels.get(ck) ?? emptyAcc();
        c.registrations += 1; c.buyers += isBuyer; c.orders += orders; c.revenue += revenue; c.weight += weight;
        channels.set(ck, c);
        const camp = entry.campaign || "(no campaign)";
        const cm = campaigns.get(camp) ?? emptyAcc();
        cm.registrations += 1; cm.buyers += isBuyer; cm.orders += orders; cm.revenue += revenue; cm.weight += weight;
        campaigns.set(camp, cm);

        // daily sign-ups for the channel (day = sign-up date)
        const rd = String(r.reg_day).slice(0, 10);
        let dm = dailyRegByCh.get(ck); if (!dm) { dm = new Map(); dailyRegByCh.set(ck, dm); }
        dm.set(rd, (dm.get(rd) ?? 0) + 1);
      }
    }

    const order: AfGroup[] = ["target", "organic", "restricted"];
    const groupResults: AfGroupResult[] = [];
    for (const k of order) if (groups.has(k)) groupResults.push(finalize(k, GROUP_LABEL[k], groups.get(k)!));
    if (groups.has("no_af")) groupResults.push(finalize("no_af", GROUP_LABEL.no_af, groups.get("no_af")!));

    // 4) Ad account spend for the sign-up window, ALLOCATED to the country in proportion
    // to the channel/campaign share of sign-ups there (account spend is shared, split fairly;
    // the sum over all countries equals total spend). This way a single-country marketer sees spend too.
    const regFromInc = win.regFrom;
    const regToInc = fmt(shiftDays(w.regToExcl, -1));
    if (opts.syncSpend) {
      const wkey = `${regFromInc}_${regToInc}`;
      if (opts.rebuildMap || Date.now() - (lastSpendSync.get(wkey) ?? 0) > SPEND_SYNC_TTL) {
        try { await syncAdSpend(regFromInc, regToInc); lastSpendSync.set(wkey, Date.now()); } catch { /* spend stays as it was */ }
      }
    }
    // Spend rows for the window. Meta has a delivery country (row.country), so spend is tied
    // to the country DIRECTLY (exact). Accounts without a country are allocated in proportion
    // to the channel's sign-up share in the country (fallback).
    const spendRows = await getSpendRows(regFromInc, regToInc);
    // key -> {byCountry: Map<country,spend>, noCountry: spend}
    type SpendAgg = { byCountry: Map<string, number>; noCountry: number };
    const chSpend = new Map<string, SpendAgg>();
    const campSpend = new Map<string, SpendAgg>();
    const addSpend = (m: Map<string, SpendAgg>, key: string, country: string | undefined, spend: number) => {
      const cur = m.get(key) ?? { byCountry: new Map(), noCountry: 0 };
      if (country) cur.byCountry.set(country, (cur.byCountry.get(country) ?? 0) + spend);
      else cur.noCountry += spend;
      m.set(key, cur);
    };
    for (const s of spendRows) {
      if (s.channel) addSpend(chSpend, s.channel, s.country, s.spend);
      if (s.campaign) addSpend(campSpend, s.campaign, s.country, s.spend);
    }
    const hasSpend = spendRows.some((s) => s.spend > 0);
    const hasCampaignSpend = spendRows.some((s) => s.campaign && s.spend > 0);
    const spendAttributed = !isAll;

    // Final row spend: exact (by delivery country) + proportional (for accounts without a country).
    const spendFor = (agg: SpendAgg | undefined, dispRegs: number, allRegs: number): number => {
      if (!agg) return 0;
      const exact = isAll
        ? [...agg.byCountry.values()].reduce((a, b) => a + b, 0)
        : (agg.byCountry.get(f.country) ?? 0);
      const prop = agg.noCountry ? (isAll ? agg.noCountry : allRegs > 0 ? agg.noCountry * (dispRegs / allRegs) : 0) : 0;
      return exact + prop;
    };
    const attach = (g: AfGroupResult, aggMap: Map<string, SpendAgg>, allRegsMap: Map<string, number>): AfGroupResult => {
      const cs = spendFor(aggMap.get(g.key), g.registrations, allRegsMap.get(g.key) ?? 0);
      if (!cs) return g;
      return {
        ...g, spend: cs,
        cac: g.buyers ? cs / g.buyers : 0,
        cpr: g.registrations ? cs / g.registrations : 0,
        roas: cs ? g.revenue / cs : 0,
      };
    };

    const targetChannels = [...channels.entries()]
      .map(([ck, a]) => attach(finalize(ck, ck, a), chSpend, channelAllRegs))
      .sort((a, b) => b.registrations - a.registrations);
    const targetCampaigns = [...campaigns.entries()]
      .map(([ck, a]) => attach(finalize(ck, ck, a), campSpend, campaignAllRegs))
      .sort((a, b) => b.registrations - a.registrations)
      .slice(0, 40);

    // Daily spend for ad accounts (channel -> date -> spend) for the displayed slice.
    // For a country take rows of that country (exact); rows without a country only for "All".
    const dailySpendByCh = new Map<string, Map<string, number>>();
    for (const s of spendRows) {
      if (!s.channel || !s.spend) continue;
      if (!isAll) { if (!s.country || s.country !== f.country) continue; }
      let m = dailySpendByCh.get(s.channel); if (!m) { m = new Map(); dailySpendByCh.set(s.channel, m); }
      m.set(s.date, (m.get(s.date) ?? 0) + s.spend);
    }
    // Ad accounts = channels with spend. The date axis is the sign-up window.
    const dates: string[] = [];
    for (let d = w.regFrom; d < w.regToExcl; d = shiftDays(d, 1)) dates.push(fmt(d));
    const channelDaily = [...dailySpendByCh.keys()].map((ch) => ({
      channel: ch,
      points: dates.map((date) => ({
        date,
        spend: dailySpendByCh.get(ch)?.get(date) ?? 0,
        registrations: dailyRegByCh.get(ch)?.get(date) ?? 0,
      })),
    }));

    const result: AfAnalysis = {
      afConfigured: true,
      chConfigured: true,
      window: win,
      map: {
        at: mapMeta.at, from: mapMeta.from, to: mapMeta.to,
        size: mapMeta.size, truncated: mapMeta.truncated,
        coverage: total.registrations ? (matched / total.registrations) * 100 : 0,
        errors: mapMeta.errors,
      },
      groups: groupResults,
      targetChannels,
      targetCampaigns,
      hasSpend,
      hasCampaignSpend,
      spendAttributed,
      channelDaily,
      totals: finalize("total", "Total", total),
    };
    cacheSet(key, result);
    return result;
  } catch (err) {
    return { afConfigured: true, chConfigured: true, error: String(err).slice(0, 300), groups: [], targetChannels: [], targetCampaigns: [] };
  }
}
