"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { RefreshCw, Loader2 } from "lucide-react";
import { COUNTRIES, FALLBACK_CREATORS, FALLBACK_USER_CREATORS } from "@/lib/queries/cards";
import { useAccess, countryOptions } from "@/lib/auth/useAccess";
import type { LtvResult } from "@/lib/ltv/ltv";

const LINE_COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ec4899", "#10b981", "#3b82f6", "#ef4444", "#a855f7"];

const money0 = (v: number) => "$" + Math.round(v).toLocaleString("ru-RU");
const money2 = (v: number) => "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (v: number) => Math.round(v).toLocaleString("ru-RU");
const pct = (v: number) => v.toFixed(1) + "%";
const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  const names = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${names[Number(m) - 1]} ${y.slice(2)}`;
};

export function LtvView({ country: initCountry, orderCreator: initCreator, userCreator: initUcreator, excludeB2b: initB2b }: { country: string; orderCreator: string; userCreator: string; excludeB2b: boolean }) {
  const access = useAccess();
  const [country, setCountry] = useState(initCountry);
  const [creator, setCreator] = useState(initCreator);
  const [ucreator, setUcreator] = useState(initUcreator);
  const [b2b, setB2b] = useState(initB2b);
  const [orderCreators, setOrderCreators] = useState<string[]>(FALLBACK_CREATORS);
  const [userCreators, setUserCreators] = useState<string[]>(FALLBACK_USER_CREATORS);
  const [data, setData] = useState<LtvResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [denom, setDenom] = useState<"reg" | "buyer">("reg");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    fetch("/api/meta/creators").then((r) => r.json()).then((d) => {
      if (d.orderCreators?.length) setOrderCreators(d.orderCreators);
      if (d.userCreators?.length) setUserCreators(d.userCreators);
    }).catch(() => {});
  }, []);

  // Ограниченному пользователю подставляем его страну.
  useEffect(() => {
    if (access.allowed && access.allowed.length && !access.allowed.includes(country)) setCountry(access.allowed[0]);
  }, [access.allowed, country]);

  const clearTimer = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true); setElapsed(0);
    clearTimer();
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    try {
      const qs = new URLSearchParams({ country, ocreator: creator, ucreator, b2b: b2b ? "exclude" : "include" });
      const r = await fetch(`/api/ltv?${qs.toString()}`, { cache: "no-store" });
      const d = await r.json();
      if (id === reqId.current) setData(d); // игнорируем ответы устаревших запросов
    } catch (e) {
      if (id === reqId.current) setData({ configured: true, error: String(e) });
    } finally {
      if (id === reqId.current) { setLoading(false); clearTimer(); }
    }
  }, [country, creator, ucreator, b2b]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => clearTimer(), []); // очистка интервала при размонтировании

  const countryOpts = countryOptions(access.allowed);
  const cOpts = countryOpts.length ? countryOpts : COUNTRIES.filter((c) => c.code !== "all").map((c) => [c.code, c.label] as [string, string]);

  return (
    <div className="flex flex-col gap-4" style={{ padding: "0 4px 40px" }}>
      {/* Фильтры */}
      <div className="flex flex-wrap items-center gap-2">
        <Select label="Страна" value={country} onChange={setCountry} options={cOpts} />
        <Select label="Канал заказа" value={creator} onChange={setCreator} options={orderCreators.map((c) => [c, c])} />
        <Select label="Канал рег." value={ucreator} onChange={setUcreator} options={[["all", "Все"], ...userCreators.map((c) => [c, c] as [string, string])]} />
        <Select label="B2B" value={b2b ? "exclude" : "include"} onChange={(v) => setB2b(v === "exclude")} options={[["exclude", "Искл"], ["include", "Вкл"]]} />
        {data?.window && (
          <span className="text-muted mono" style={{ fontSize: 11.5 }}>
            окно регистрации {data.window.start} … {data.window.end} (до текущего месяца)
          </span>
        )}
        <button onClick={load} disabled={loading} className="ml-auto inline-flex items-center gap-1.5 border border-line hover:border-line-2 disabled:opacity-50" style={{ borderRadius: 8, padding: "7px 13px", fontSize: 13 }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Обновить
        </button>
      </div>

      {loading && !data && <Skeleton elapsed={elapsed} />}
      {data && !data.configured && <Note text="Хранилище не подключено. Задайте подключение в Интеграциях." />}
      {data?.error && <Note text={`Ошибка данных: ${data.error}`} bad />}
      {loading && data && <div className="text-muted mono" style={{ fontSize: 11.5 }}>Пересчёт… {elapsed}с</div>}

      {data?.kpi && (
        <>
          <KpiStrip d={data} />

          {/* Кривая накопленного LTV */}
          <Card>
            <CardHead
              title="Накопленный LTV по месяцам жизни когорты"
              hint={denom === "reg" ? "выручка ÷ все зарегистрированные в когорте" : "выручка ÷ покупатели, накопленные к этому месяцу"}
              right={
                <div className="flex items-center gap-1">
                  <Toggle active={denom === "reg"} onClick={() => setDenom("reg")}>на регистранта</Toggle>
                  <Toggle active={denom === "buyer"} onClick={() => setDenom("buyer")}>на покупателя</Toggle>
                </div>
              }
            />
            <div style={{ height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={denom === "reg" ? data.curveReg : data.curveBuyer} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="mol" tickLine={false} axisLine={{ stroke: "var(--line-2)" }} tick={{ fontSize: 10.5, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} label={{ value: "месяц жизни", position: "insideBottom", offset: -2, fontSize: 10, fill: "var(--muted)" }} />
                  <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 10.5, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} tickFormatter={(v) => "$" + v} />
                  <Tooltip formatter={(v, n) => [money2(Number(v)), monthLabel(String(n))]} labelFormatter={(l) => `Месяц жизни ${l}`} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
                  <Legend formatter={(v) => monthLabel(String(v))} wrapperStyle={{ fontSize: 11 }} />
                  {(data.curveCohorts ?? []).map((c, i) => (
                    <Line key={c} type="monotone" dataKey={c} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={false} connectNulls={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
            {/* Распределение */}
            <Card>
              <CardHead title="Распределение покупателей по размеру LTV" hint="сколько клиентов в каждом диапазоне суммарной выручки" />
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dist} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="bucket" tickLine={false} axisLine={{ stroke: "var(--line-2)" }} tick={{ fontSize: 9.5, fill: "var(--muted)" }} interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 10.5, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} tickFormatter={(v) => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v))} />
                    <Tooltip formatter={(v) => [int(Number(v)) + " клиентов", "Клиенты"]} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="users" radius={[3, 3, 0, 0]}>
                      {(data.dist ?? []).map((_, i) => <Cell key={i} fill={i === 0 ? "var(--muted)" : "var(--accent)"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Итоги по когортам */}
            <Card>
              <CardHead title="Итоги по когортам" hint="суммарно к текущему моменту" />
              <div className="overflow-auto" style={{ maxHeight: 300 }}>
                <table className="w-full" style={{ fontSize: 12.5 }}>
                  <thead>
                    <tr className="text-left text-muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <Th>Когорта</Th><Th r>Рег.</Th><Th r>Покуп.</Th><Th r>Платят</Th><Th r>Выручка</Th><Th r>LTV/рег</Th><Th r>LTV/пок</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.totals ?? []).map((t) => (
                      <tr key={t.cohort} className="border-t border-line">
                        <Td>{monthLabel(t.cohort)}</Td>
                        <Td r>{int(t.size)}</Td>
                        <Td r>{int(t.buyers)}</Td>
                        <Td r>{pct(t.payingShare)}</Td>
                        <Td r>{money0(t.totalRevenue)}</Td>
                        <Td r>{money2(t.ltvReg)}</Td>
                        <Td r>{money2(t.ltvBuyer)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Матрица LTV/рег */}
          {data.matrix && (
            <Card>
              <CardHead title="Матрица LTV на регистранта" hint="накопленный LTV когорты (строка) к месяцу жизни (столбец)" />
              <Matrix matrix={data.matrix} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------ подкомпоненты ------------------------------ */

function KpiStrip({ d }: { d: LtvResult }) {
  const k = d.kpi!;
  const items: { label: string; value: string; hint?: string }[] = [
    { label: "Клиентов в базе", value: int(k.totalCustomers), hint: "зарегистрированы в окне" },
    { label: "Платящих", value: `${int(k.payingCustomers)} · ${pct(k.payingShare)}` },
    { label: "Выручка (LTV сумма)", value: money0(k.totalRevenue) },
    { label: "Ср. LTV платящего", value: money2(k.avgLtvPaying) },
    { label: "Медиана LTV платящего", value: money2(k.medianLtvPaying) },
    { label: "Ср. LTV на регистранта", value: money2(k.avgLtvReg) },
    { label: "Заказов на платящего", value: k.avgOrders.toFixed(2) },
    { label: "Топ-10% дают", value: pct(k.top10Share), hint: "доля выручки" },
  ];
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
      {items.map((it) => (
        <div key={it.label} className="border border-line bg-surface rounded-xl" style={{ padding: "12px 14px" }}>
          <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>{it.label}</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>{it.value}</div>
          {it.hint && <div className="text-muted" style={{ fontSize: 10.5, marginTop: 2 }}>{it.hint}</div>}
        </div>
      ))}
    </div>
  );
}

function Matrix({ matrix }: { matrix: NonNullable<LtvResult["matrix"]> }) {
  const max = Math.max(1, ...matrix.rows.flatMap((r) => r.cells.map((c) => c ?? 0)));
  return (
    <div className="overflow-auto" style={{ maxHeight: 420 }}>
      <table style={{ fontSize: 11.5, borderCollapse: "separate", borderSpacing: 0 }}>
        <thead>
          <tr className="text-muted" style={{ fontSize: 10 }}>
            <Th>Когорта</Th>
            {matrix.mols.map((m) => <th key={m} style={{ padding: "5px 8px", textAlign: "right" }}>M{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.cohort}>
              <td style={{ padding: "5px 8px", whiteSpace: "nowrap", fontWeight: 500 }}>{monthLabel(row.cohort)} <span className="text-muted mono" style={{ fontSize: 10 }}>({int(row.size)})</span></td>
              {row.cells.map((c, i) => (
                <td key={i} className="mono" style={{ padding: "5px 8px", textAlign: "right", background: c == null ? "transparent" : `color-mix(in srgb, var(--accent) ${Math.round((c / max) * 70)}%, transparent)` }}>
                  {c == null ? "" : money2(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-line bg-surface rounded-xl" style={{ padding: 16 }}>{children}</div>;
}
function CardHead({ title, hint, right }: { title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3" style={{ marginBottom: 12 }}>
      <div>
        <div className="font-semibold" style={{ fontSize: 14 }}>{title}</div>
        {hint && <div className="text-muted" style={{ fontSize: 11.5, marginTop: 2 }}>{hint}</div>}
      </div>
      {right}
    </div>
  );
}
function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={active ? "text-[color:var(--accent-ink)]" : "text-muted hover:text-ink"} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 7, background: active ? "var(--accent)" : "var(--sunk)" }}>
      {children}
    </button>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="inline-flex items-center gap-1.5 border border-line bg-surface" style={{ borderRadius: 8, padding: "5px 9px" }}>
      <span className="text-muted" style={{ fontSize: 11 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent outline-none" style={{ fontSize: 12.5, fontWeight: 500 }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
function Th({ children, r }: { children: React.ReactNode; r?: boolean }) {
  return <th style={{ padding: "6px 8px", textAlign: r ? "right" : "left", position: "sticky", top: 0, background: "var(--surface)" }}>{children}</th>;
}
function Td({ children, r }: { children: React.ReactNode; r?: boolean }) {
  return <td className={r ? "mono" : ""} style={{ padding: "6px 8px", textAlign: r ? "right" : "left" }}>{children}</td>;
}
function Note({ text, bad }: { text: string; bad?: boolean }) {
  return <div className="border rounded-xl" style={{ padding: 14, fontSize: 13, borderColor: bad ? "var(--neg)" : "var(--line)", color: bad ? "var(--neg)" : "var(--ink-2)" }}>{text}</div>;
}
function Skeleton({ elapsed }: { elapsed: number }) {
  return (
    <div className="border border-line rounded-xl flex items-center gap-2 text-muted" style={{ padding: 20, fontSize: 13 }}>
      <Loader2 size={16} className="animate-spin" /> Считаем когорты LTV… {elapsed}с
      <span className="mono" style={{ fontSize: 11 }}>(первый расчёт тяжёлый, потом из кеша)</span>
    </div>
  );
}
