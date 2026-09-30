"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Play, RefreshCw, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAccess } from "@/lib/auth/useAccess";

type Grp = {
  key: string; label: string; registrations: number; buyers: number; cr: number;
  orders: number; revenue: number; weight: number; avgCheck: number;
  spend?: number; cac?: number; cpr?: number; roas?: number;
};
type Analysis = {
  afConfigured: boolean; chConfigured: boolean; error?: string;
  window?: { regFrom: string; regTo: string; orderFrom: string; orderTo: string };
  map?: { at: string; from: string; to: string; size: number; truncated: boolean; coverage: number; errors: string[] };
  groups: Grp[]; targetChannels: Grp[]; targetCampaigns: Grp[]; hasSpend?: boolean; hasCampaignSpend?: boolean; spendAttributed?: boolean; channelDaily?: DailySeries[]; totals?: Grp;
};
type DailyPoint = { date: string; spend: number; registrations: number };
type DailySeries = { channel: string; points: DailyPoint[] };

const nf = new Intl.NumberFormat("en-US");
const money = (v: number) => "$" + nf.format(Math.round(v));
const pct = (v: number) => v.toFixed(1) + "%";

export function AfAnalysisView({ query, basis }: { query: string; basis: "gross" | "paid" }) {
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const access = useAccess();

  useEffect(() => {
    if (loading) {
      setElapsed(0);
      const t0 = Date.now();
      timer.current = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    } else if (timer.current) {
      clearInterval(timer.current); timer.current = null;
    }
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [loading]);

  // Builds the analysis. By default it also pulls spend from ad accounts (sync=1);
  // rebuildMap additionally rebuilds the daily AppsFlyer map.
  async function run(mode: "build" | "rebuildMap") {
    setLoading(true); setErr(""); setData(null);
    const extra = mode === "rebuildMap" ? "&rebuildMap=1&sync=1" : "&sync=1";
    try {
      const r = await fetch(`/api/af-analysis?${query}${extra}`, { cache: "no-store" });
      if (r.status === 401) { setErr("Sign-in required. Reload the page and sign in."); return; }
      const d: Analysis = await r.json();
      setData(d);
      if (d.error) setErr(d.error);
    } catch (e) { setErr("Request failed: " + String(e).slice(0, 200)); }
    finally { setLoading(false); }
  }

  const notReady = data && (!data.afConfigured || !data.chConfigured);
  const mapFailed = !!data && !!data.map && data.map.size === 0 && data.map.errors.length > 0;
  const quotaHit = mapFailed && data!.map!.errors.some((e) => /maximum number of in-app event reports/i.test(e));
  const target = data?.groups.find((g) => g.key === "target");
  const organic = data?.groups.find((g) => g.key === "organic");
  const totals = data?.totals;
  const targetShare = target && totals && totals.registrations ? (target.registrations / totals.registrations) * 100 : 0;
  const revLabel = basis === "paid" ? "Revenue (paid)" : "Revenue";

  return (
    <div style={{ padding: "18px 28px 60px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => run("build")} disabled={loading} className="inline-flex items-center gap-1.5 text-[color:var(--accent-ink)] disabled:opacity-50" style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500 }}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Build analysis
        </button>
        {data && !notReady && access.canManage && (
          <button onClick={() => run("rebuildMap")} disabled={loading} title="Rebuild the daily AppsFlyer map for 90 days now (uses AF quota; usually not needed, the map refreshes every morning). Owner and admin only." className="inline-flex items-center gap-1.5 border border-line hover:border-line-2 disabled:opacity-50" style={{ borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}>
            <RefreshCw size={14} /> Refresh AF map
          </button>
        )}
        <span className="text-muted" style={{ fontSize: 12 }}>
          Matches AppsFlyer user_id with orders in the warehouse, plus spend from ad accounts. The AF map loads every morning for 90 days.
        </span>
      </div>

      {loading && (
        <div className="border border-line bg-surface rounded-xl flex items-center gap-3" style={{ padding: 18 }}>
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
          <div style={{ fontSize: 13 }}>
            <div>Computing the slice and matching orders… {elapsed} s</div>
            <div className="text-muted" style={{ fontSize: 11.5, marginTop: 2 }}>Usually a few seconds (the AF map is already loaded). “Refresh AF map” does a first 90-day load in 1–2 minutes.</div>
          </div>
        </div>
      )}

      {!data && !loading && (
        <div className="border border-line bg-surface rounded-xl text-muted" style={{ padding: 22, fontSize: 13, lineHeight: 1.6 }}>
          Set the filters above and click “Build analysis”. The channel (paid or organic) comes from the AppsFlyer map by user_id for the sign-up period.
          <div style={{ marginTop: 8, color: "var(--ink-2)" }}>
            Tip: AppsFlyer covers only the mobile app, so for a meaningful result set <b>User channel = app</b> and a <b>Sign-up period</b> within the last 90 days. Spend, CAC and ROAS are pulled automatically from the ad accounts connected in Integrations.
          </div>
        </div>
      )}

      {notReady && (
        <div className="border border-line bg-surface rounded-xl" style={{ padding: 22, fontSize: 13 }}>
          {!data!.afConfigured && <p>AppsFlyer is not configured. Set the token and App ID in Integrations.</p>}
          {!data!.chConfigured && <p>The warehouse is not connected. Set up the connection in Integrations.</p>}
        </div>
      )}

      {err && <div className="border border-line rounded-xl" style={{ padding: 16, fontSize: 12.5, color: "var(--neg)" }}>{err}</div>}

      {mapFailed && (
        <div className="rounded-xl" style={{ padding: 16, fontSize: 13, lineHeight: 1.55, background: "oklch(0.96 0.04 60)", border: "1px solid oklch(0.85 0.08 60)", color: "var(--ink)" }}>
          <b>The AppsFlyer map did not load, so the paid vs organic split is unavailable.</b> Everything is shown as “No AF data”.
          {quotaHit ? (
            <div style={{ marginTop: 6 }}>Reason: the <b>daily AppsFlyer quota</b> for raw data reports is used up (a per-app daily limit). This is not an app error. What to do: open a window that is already cached (for example “last 30 days”), or wait for the quota to reset (usually daily) and click “Refresh AF map”.</div>
          ) : (
            <div style={{ marginTop: 6, fontFamily: "var(--font-mono, monospace)", fontSize: 11.5, color: "var(--muted)" }}>{data!.map!.errors[0]}</div>
          )}
        </div>
      )}

      {data && !notReady && !data.error && totals && (
        <>
          {/* KPI strip */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
            <Kpi title="Total sign-ups" value={nf.format(totals.registrations)} />
            {mapFailed ? (
              <>
                <Kpi title="Buyers" value={nf.format(totals.buyers)} />
                <Kpi title="Conversion" value={pct(totals.cr)} accent />
                <Kpi title="AF split" value="–" sub="map not loaded" />
              </>
            ) : (
              <>
                <Kpi title="Paid share" value={pct(targetShare)} sub={target ? `${nf.format(target.registrations)} sign-ups` : "–"} />
                <Kpi title="Paid CR" value={target ? pct(target.cr) : "–"} sub={target ? `${nf.format(target.buyers)} buyers` : ""} accent />
                <Kpi title="Organic CR" value={organic ? pct(organic.cr) : "–"} sub={organic ? `${nf.format(organic.buyers)} buyers` : ""} />
              </>
            )}
            <Kpi title="AF coverage" value={data.map ? pct(data.map.coverage) : "–"} sub={data.map ? `${nf.format(data.map.size)} users in the map` : ""} />
          </div>

          {/* Table by group */}
          <div className="border border-line bg-surface rounded-xl" style={{ padding: "16px 18px" }}>
            <h2 className="font-semibold" style={{ fontSize: 14.5, marginBottom: 10 }}>Paid vs organic</h2>
            <GroupTable rows={[...data.groups, { ...totals }]} revLabel={revLabel} highlightTotalKey="total" />
          </div>

          {/* Paid split by channel (with spend, CAC and ROAS if ad accounts are connected) */}
          {data.targetChannels.length > 0 && (
            <div className="border border-line bg-surface rounded-xl" style={{ padding: "16px 18px" }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <h2 className="font-semibold" style={{ fontSize: 14.5 }}>Paid by channel</h2>
                {data.hasSpend
                  ? (data.spendAttributed && <span className="text-muted" style={{ fontSize: 11, maxWidth: 480, textAlign: "right" }}>Spend by ad delivery country from the account (Meta); accounts without a country split are allocated by share of sign-ups</span>)
                  : <span className="text-muted" style={{ fontSize: 11 }}>Spend, CAC and ROAS appear once you connect ad accounts in Integrations</span>}
              </div>
              <GroupTable rows={data.targetChannels} revLabel={revLabel} showSpend={data.hasSpend} nameCol="Channel" />
            </div>
          )}

          {/* Daily spend and sign-ups per ad account */}
          {data.channelDaily && data.channelDaily.length > 0 && (
            <div className="border border-line bg-surface rounded-xl" style={{ padding: "16px 18px" }}>
              <h2 className="font-semibold" style={{ fontSize: 14.5, marginBottom: 4 }}>Daily spend and sign-ups</h2>
              <p className="text-muted" style={{ fontSize: 11.5, marginBottom: 12 }}>For each ad account: spend (orange) and sign-ups (accent) by day.</p>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
                {data.channelDaily.map((s) => <DailyChart key={s.channel} series={s} />)}
              </div>
            </div>
          )}

          {/* Ad campaigns */}
          {data.targetChannels.length > 0 && (() => {
            const named = data.targetCampaigns.filter((c) => c.key !== "(no campaign)");
            return (
              <div className="border border-line bg-surface rounded-xl" style={{ padding: "16px 18px" }}>
                <h2 className="font-semibold" style={{ fontSize: 14.5, marginBottom: 10 }}>Ad campaigns</h2>
                {named.length > 0 ? (
                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    <GroupTable rows={data.targetCampaigns} revLabel={revLabel} nameCol="Campaign" showSpend={data.hasCampaignSpend} />
                  </div>
                ) : (
                  <div className="text-muted" style={{ fontSize: 12.5 }}>The campaign split will appear after the next AppsFlyer map build (the “Refresh AF map” button when quota allows, or automatically in the morning). The current map was built without the campaign field.</div>
                )}
              </div>
            );
          })()}

          {/* Map metadata */}
          {data.map && (
            <div className="flex items-start gap-2 text-muted" style={{ fontSize: 11.5 }}>
              <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>
                Sign-up window {data.window?.regFrom}…{data.window?.regTo}, orders {data.window?.orderFrom}…{data.window?.orderTo}.
                AF map for {data.map.from}…{data.map.to}, {nf.format(data.map.size)} users.
                {data.map.truncated && " ⚠ Hit the AF row limit, the map is incomplete. Narrow the window."}
                {data.map.errors.length > 0 && ` AF errors: ${data.map.errors.join("; ")}`}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ title, value, sub, accent }: { title: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="border border-line bg-surface rounded-xl" style={{ padding: "14px 16px" }}>
      <div className="text-muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{title}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: accent ? "var(--accent)" : undefined }}>{value}</div>
      {sub && <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ddmm(d: string): string {
  const p = String(d).split("-");
  return p.length === 3 ? `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(p[1]) - 1]} ${Number(p[2])}` : String(d);
}
function DailyChart({ series }: { series: DailySeries }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{series.channel}</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={series.points} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={ddmm} tick={{ fontSize: 10, fill: "var(--muted)" }} minTickGap={24} />
          <YAxis yAxisId="reg" tick={{ fontSize: 10, fill: "var(--muted)" }} width={38} />
          <YAxis yAxisId="spend" orientation="right" tick={{ fontSize: 10, fill: "var(--muted)" }} width={46} tickFormatter={(v: number) => "$" + v} />
          <Tooltip
            labelFormatter={(l) => ddmm(String(l))}
            formatter={(value, name) => [name === "Spend" ? "$" + Math.round(Number(value)) : nf.format(Number(value)), name] as [string, string]}
            contentStyle={{ fontSize: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}
          />
          <Line yAxisId="reg" type="monotone" dataKey="registrations" name="Sign-ups" stroke="var(--accent)" strokeWidth={2} dot={false} />
          <Line yAxisId="spend" type="monotone" dataKey="spend" name="Spend" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function GroupTable({ rows, revLabel, highlightTotalKey, showSpend, nameCol = "Group" }: {
  rows: Grp[]; revLabel: string; highlightTotalKey?: string; showSpend?: boolean; nameCol?: string;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="w-full" style={{ fontSize: 12.5, minWidth: showSpend ? 820 : 620 }}>
        <thead>
          <tr className="text-muted" style={{ textAlign: "right" }}>
            <th style={{ fontWeight: 500, textAlign: "left", paddingBottom: 6 }}>{nameCol}</th>
            <th style={{ fontWeight: 500 }}>Sign-ups</th>
            <th style={{ fontWeight: 500 }}>Buyers</th>
            <th style={{ fontWeight: 500 }}>CR</th>
            <th style={{ fontWeight: 500 }}>Orders</th>
            <th style={{ fontWeight: 500 }}>{revLabel}</th>
            <th style={{ fontWeight: 500 }}>Avg check</th>
            <th style={{ fontWeight: 500 }}>Weight, kg</th>
            {showSpend && <th style={{ fontWeight: 500 }}>Spend</th>}
            {showSpend && <th style={{ fontWeight: 500 }}>CAC</th>}
            {showSpend && <th style={{ fontWeight: 500 }}>ROAS</th>}
          </tr>
        </thead>
        <tbody className="mono">
          {rows.map((g) => {
            const bold = highlightTotalKey && g.key === highlightTotalKey;
            return (
              <tr key={g.key} className="border-t border-line" style={{ textAlign: "right", fontWeight: bold ? 600 : undefined }}>
                <td style={{ textAlign: "left", padding: "6px 0", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.label}>{g.label}</td>
                <td>{nf.format(g.registrations)}</td>
                <td>{nf.format(g.buyers)}</td>
                <td style={{ color: bold ? undefined : "var(--accent)" }}>{pct(g.cr)}</td>
                <td>{nf.format(g.orders)}</td>
                <td>{money(g.revenue)}</td>
                <td>${g.avgCheck.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>{g.weight.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                {showSpend && <td>{g.spend ? money(g.spend) : "–"}</td>}
                {showSpend && <td>{g.cac ? "$" + g.cac.toFixed(2) : "–"}</td>}
                {showSpend && <td style={{ color: g.roas ? (g.roas >= 1 ? "var(--accent)" : "var(--neg)") : undefined }}>{g.roas ? pct(g.roas * 100) : "–"}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
