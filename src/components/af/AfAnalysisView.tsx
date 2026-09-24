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

const nf = new Intl.NumberFormat("ru-RU");
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

  // Построение анализа. По умолчанию сразу подтягивает расход из кабинетов (sync=1);
  // rebuildMap – дополнительно пересобирает суточную карту AppsFlyer.
  async function run(mode: "build" | "rebuildMap") {
    setLoading(true); setErr(""); setData(null);
    const extra = mode === "rebuildMap" ? "&rebuildMap=1&sync=1" : "&sync=1";
    try {
      const r = await fetch(`/api/af-analysis?${query}${extra}`, { cache: "no-store" });
      if (r.status === 401) { setErr("Требуется вход. Обновите страницу и войдите."); return; }
      const d: Analysis = await r.json();
      setData(d);
      if (d.error) setErr(d.error);
    } catch (e) { setErr("Сбой запроса: " + String(e).slice(0, 200)); }
    finally { setLoading(false); }
  }

  const notReady = data && (!data.afConfigured || !data.chConfigured);
  const mapFailed = !!data && !!data.map && data.map.size === 0 && data.map.errors.length > 0;
  const quotaHit = mapFailed && data!.map!.errors.some((e) => /maximum number of in-app event reports/i.test(e));
  const target = data?.groups.find((g) => g.key === "target");
  const organic = data?.groups.find((g) => g.key === "organic");
  const totals = data?.totals;
  const targetShare = target && totals && totals.registrations ? (target.registrations / totals.registrations) * 100 : 0;
  const revLabel = basis === "paid" ? "Выручка (опл.)" : "Выручка";

  return (
    <div style={{ padding: "18px 28px 60px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => run("build")} disabled={loading} className="inline-flex items-center gap-1.5 text-[color:var(--accent-ink)] disabled:opacity-50" style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500 }}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Построить анализ
        </button>
        {data && !notReady && access.canManage && (
          <button onClick={() => run("rebuildMap")} disabled={loading} title="Пересобрать суточную карту AppsFlyer за 90 дней сейчас (тратит квоту AF; обычно не нужно – карта обновляется каждое утро). Доступно владельцу/админу." className="inline-flex items-center gap-1.5 border border-line hover:border-line-2 disabled:opacity-50" style={{ borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}>
            <RefreshCw size={14} /> Обновить карту AF
          </button>
        )}
        <span className="text-muted" style={{ fontSize: 12 }}>
          Матчим user_id из AppsFlyer с заказами в хранилище + расход из кабинетов. Карта AF грузится раз в утро за 90 дней.
        </span>
      </div>

      {loading && (
        <div className="border border-line bg-surface rounded-xl flex items-center gap-3" style={{ padding: 18 }}>
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
          <div style={{ fontSize: 13 }}>
            <div>Считаем срез и матчим с заказами… {elapsed} с</div>
            <div className="text-muted" style={{ fontSize: 11.5, marginTop: 2 }}>Обычно несколько секунд (карта AF уже загружена). «Обновить карту AF» – первая загрузка за 90 дней 1–2 минуты.</div>
          </div>
        </div>
      )}

      {!data && !loading && (
        <div className="border border-line bg-surface rounded-xl text-muted" style={{ padding: 22, fontSize: 13, lineHeight: 1.6 }}>
          Задайте фильтры сверху и нажмите «Построить анализ». Канал (таргет/органика) берётся из карты AppsFlyer по user_id за период регистрации.
          <div style={{ marginTop: 8, color: "var(--ink-2)" }}>
            Совет: AppsFlyer покрывает только мобильное приложение, поэтому для осмысленного результата задайте <b>Канал клиента = app</b> и <b>Период регистрации</b> внутри последних 90 дней. Расход/CAC/ROAS подтянутся автоматически из подключённых на «Интеграции» кабинетов.
          </div>
        </div>
      )}

      {notReady && (
        <div className="border border-line bg-surface rounded-xl" style={{ padding: 22, fontSize: 13 }}>
          {!data!.afConfigured && <p>AppsFlyer не настроен. Задайте токен и App ID на экране «Интеграции».</p>}
          {!data!.chConfigured && <p>Хранилище не подключено. Настройте подключение на «Интеграции».</p>}
        </div>
      )}

      {err && <div className="border border-line rounded-xl" style={{ padding: 16, fontSize: 12.5, color: "var(--neg)" }}>{err}</div>}

      {mapFailed && (
        <div className="rounded-xl" style={{ padding: 16, fontSize: 13, lineHeight: 1.55, background: "oklch(0.96 0.04 60)", border: "1px solid oklch(0.85 0.08 60)", color: "var(--ink)" }}>
          <b>Карта AppsFlyer не загрузилась – разбивка на таргет и органику недоступна.</b> Всё показано как «Нет данных AF».
          {quotaHit ? (
            <div style={{ marginTop: 6 }}>Причина: исчерпана <b>суточная квота AppsFlyer</b> на выгрузку сырых отчётов (лимит на приложение в сутки). Это не ошибка приложения. Что делать: открыть уже закэшированное окно (например «последние 30 дней»), либо подождать сброса квоты (обычно раз в сутки) и нажать «Обновить карту AF».</div>
          ) : (
            <div style={{ marginTop: 6, fontFamily: "var(--font-mono, monospace)", fontSize: 11.5, color: "var(--muted)" }}>{data!.map!.errors[0]}</div>
          )}
        </div>
      )}

      {data && !notReady && !data.error && totals && (
        <>
          {/* KPI-полоса */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
            <Kpi title="Регистраций всего" value={nf.format(totals.registrations)} />
            {mapFailed ? (
              <>
                <Kpi title="Покупатели" value={nf.format(totals.buyers)} />
                <Kpi title="Конверсия" value={pct(totals.cr)} accent />
                <Kpi title="Разбивка AF" value="–" sub="карта не загружена" />
              </>
            ) : (
              <>
                <Kpi title="Доля таргета" value={pct(targetShare)} sub={target ? `${nf.format(target.registrations)} рег.` : "–"} />
                <Kpi title="CR таргета" value={target ? pct(target.cr) : "–"} sub={target ? `${nf.format(target.buyers)} покупателей` : ""} accent />
                <Kpi title="CR органики" value={organic ? pct(organic.cr) : "–"} sub={organic ? `${nf.format(organic.buyers)} покупателей` : ""} />
              </>
            )}
            <Kpi title="Покрытие AF" value={data.map ? pct(data.map.coverage) : "–"} sub={data.map ? `${nf.format(data.map.size)} пользователей в карте` : ""} />
          </div>

          {/* Таблица по группам */}
          <div className="border border-line bg-surface rounded-xl" style={{ padding: "16px 18px" }}>
            <h2 className="font-semibold" style={{ fontSize: 14.5, marginBottom: 10 }}>Таргет против органики</h2>
            <GroupTable rows={[...data.groups, { ...totals }]} revLabel={revLabel} highlightTotalKey="total" />
          </div>

          {/* Разбивка таргета по каналам (с расходом/CAC/ROAS если подключены кабинеты) */}
          {data.targetChannels.length > 0 && (
            <div className="border border-line bg-surface rounded-xl" style={{ padding: "16px 18px" }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <h2 className="font-semibold" style={{ fontSize: 14.5 }}>Таргет по каналам</h2>
                {data.hasSpend
                  ? (data.spendAttributed && <span className="text-muted" style={{ fontSize: 11, maxWidth: 480, textAlign: "right" }}>Расход – по стране показа рекламы из кабинета (Meta); кабинеты без разбивки по стране – пропорционально доле регистраций</span>)
                  : <span className="text-muted" style={{ fontSize: 11 }}>Расход/CAC/ROAS появятся, когда подключите кабинеты на «Интеграции»</span>}
              </div>
              <GroupTable rows={data.targetChannels} revLabel={revLabel} showSpend={data.hasSpend} nameCol="Канал" />
            </div>
          )}

          {/* Расход и регистрации по дням – по каждому кабинету */}
          {data.channelDaily && data.channelDaily.length > 0 && (
            <div className="border border-line bg-surface rounded-xl" style={{ padding: "16px 18px" }}>
              <h2 className="font-semibold" style={{ fontSize: 14.5, marginBottom: 4 }}>Расход и регистрации по дням</h2>
              <p className="text-muted" style={{ fontSize: 11.5, marginBottom: 12 }}>По каждому кабинету: расход (оранжевая) и регистрации (акцент) по дням.</p>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
                {data.channelDaily.map((s) => <DailyChart key={s.channel} series={s} />)}
              </div>
            </div>
          )}

          {/* Рекламные кампании */}
          {data.targetChannels.length > 0 && (() => {
            const named = data.targetCampaigns.filter((c) => c.key !== "(без кампании)");
            return (
              <div className="border border-line bg-surface rounded-xl" style={{ padding: "16px 18px" }}>
                <h2 className="font-semibold" style={{ fontSize: 14.5, marginBottom: 10 }}>Рекламные кампании</h2>
                {named.length > 0 ? (
                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    <GroupTable rows={data.targetCampaigns} revLabel={revLabel} nameCol="Кампания" showSpend={data.hasCampaignSpend} />
                  </div>
                ) : (
                  <div className="text-muted" style={{ fontSize: 12.5 }}>Разбивка по кампаниям появится после следующей сборки карты AppsFlyer (кнопка «Обновить карту AF» при доступной квоте или автоматически утром). Текущая карта была собрана без поля кампании.</div>
                )}
              </div>
            );
          })()}

          {/* Мета карты */}
          {data.map && (
            <div className="flex items-start gap-2 text-muted" style={{ fontSize: 11.5 }}>
              <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>
                Окно регистрации {data.window?.regFrom}…{data.window?.regTo}, заказы {data.window?.orderFrom}…{data.window?.orderTo}.
                Карта AF за {data.map.from}…{data.map.to}, {nf.format(data.map.size)} пользователей.
                {data.map.truncated && " ⚠ Упёрлись в лимит строк AF – карта неполная, сузьте окно."}
                {data.map.errors.length > 0 && ` Ошибки AF: ${data.map.errors.join("; ")}`}
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
  return p.length === 3 ? `${p[2]}.${p[1]}` : String(d);
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
            formatter={(value, name) => [name === "Расход" ? "$" + Math.round(Number(value)) : nf.format(Number(value)), name] as [string, string]}
            contentStyle={{ fontSize: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}
          />
          <Line yAxisId="reg" type="monotone" dataKey="registrations" name="Реги" stroke="var(--accent)" strokeWidth={2} dot={false} />
          <Line yAxisId="spend" type="monotone" dataKey="spend" name="Расход" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function GroupTable({ rows, revLabel, highlightTotalKey, showSpend, nameCol = "Группа" }: {
  rows: Grp[]; revLabel: string; highlightTotalKey?: string; showSpend?: boolean; nameCol?: string;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="w-full" style={{ fontSize: 12.5, minWidth: showSpend ? 820 : 620 }}>
        <thead>
          <tr className="text-muted" style={{ textAlign: "right" }}>
            <th style={{ fontWeight: 500, textAlign: "left", paddingBottom: 6 }}>{nameCol}</th>
            <th style={{ fontWeight: 500 }}>Регистрации</th>
            <th style={{ fontWeight: 500 }}>Покупатели</th>
            <th style={{ fontWeight: 500 }}>CR</th>
            <th style={{ fontWeight: 500 }}>Заказы</th>
            <th style={{ fontWeight: 500 }}>{revLabel}</th>
            <th style={{ fontWeight: 500 }}>Ср. чек</th>
            <th style={{ fontWeight: 500 }}>Вес, кг</th>
            {showSpend && <th style={{ fontWeight: 500 }}>Расход</th>}
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
                <td>${g.avgCheck.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>{g.weight.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}</td>
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
