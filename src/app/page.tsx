import Link from "next/link";
import { ArrowRight, BarChart3, LayoutGrid, Bot, Bell, Plug, RefreshCw, Users, LineChart } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { ThemeToggle } from "@/components/ThemeToggle";

// Публичный лендинг демо-стенда. Приложение живёт в route group (app) с сайдбаром.

const features = [
  { icon: BarChart3, title: "Маркетинг", text: "KPI со сравнением периодов, динамика по дням, неделям и месяцам, когорты регистраций, экспорт в Excel." },
  { icon: LineChart, title: "AF анализ", text: "Таргет против органики по карте MMP: регистрации, конверсия, выручка, CAC и ROAS по каналам и кампаниям." },
  { icon: Users, title: "LTV", text: "Когортная ценность клиента на регистранта и на покупателя, кривые по месяцам жизни и треугольная матрица." },
  { icon: LayoutGrid, title: "Конструктор дашбордов", text: "Виджеты KPI, графики и таблицы с drag-and-drop, фильтрами уровня дашборда и шарингом только для чтения." },
  { icon: Bot, title: "ИИ-аналитик", text: "Claude с инструментами поверх слоя метрик. Отвечает только по числам из запросов и показывает, какой срез взял." },
  { icon: Bell, title: "Алерты", text: "Правила на метрики с проверкой на текущих данных и доставкой в Telegram с антиспамом." },
  { icon: Plug, title: "Интеграции", text: "ClickHouse, PostgreSQL, AppsFlyer, Google Ads, Meta Ads, TikTok Ads, Yandex Direct. Кабинеты по странам." },
  { icon: RefreshCw, title: "Кеш и прогрев", text: "Единый кеш слоя метрик с TTL, прогрев по расписанию и журнал запусков на экране синхронизации." },
];

const flow = ["Источники", "Коннекторы", "Слой метрик + кеш", "Дашборды, алерты, ИИ"];

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center gap-3 mx-auto" style={{ maxWidth: 1120, padding: "22px 24px" }}>
        <LogoMark size={24} />
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>Sanalytics</span>
        <span className="mono bg-sunk border border-line text-muted" style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99 }}>demo</span>
        <div className="ml-auto flex items-center gap-3">
          <div style={{ width: 150 }}><ThemeToggle /></div>
          <Link href="/marketing" className="inline-flex items-center gap-1.5 text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500 }}>
            Открыть демо <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="mx-auto" style={{ maxWidth: 1120, padding: "40px 24px 80px" }}>
        <section style={{ maxWidth: 760 }}>
          <p className="mono text-accent" style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>BI для маркетинга e-commerce</p>
          <h1 style={{ fontSize: "clamp(30px, 5vw, 46px)", lineHeight: 1.1, letterSpacing: "-0.025em", fontWeight: 650, marginTop: 14 }}>
            Вся аналитика магазина в одном отчёте
          </h1>
          <p className="text-ink-2" style={{ fontSize: 16.5, lineHeight: 1.6, marginTop: 18 }}>
            Sanalytics собирает заказы, регистрации, данные MMP и расход рекламных кабинетов в единый слой метрик.
            Поверх него работают дашборды, когортный LTV, алерты и ИИ-аналитик, который отвечает по реальным цифрам.
          </p>
          <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 26 }}>
            <Link href="/marketing" className="inline-flex items-center gap-2 text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 500 }}>
              Открыть демо <ArrowRight size={15} />
            </Link>
            <Link href="/dashboards" className="inline-flex items-center gap-2 border border-line bg-surface hover:border-line-2" style={{ borderRadius: 9, padding: "11px 18px", fontSize: 14 }}>
              Конструктор дашбордов
            </Link>
          </div>
          <p className="text-muted" style={{ fontSize: 12.5, marginTop: 16 }}>
            Демо-режим: все цифры синтетические и генерируются детерминированно. Входа нет, вы заходите как владелец.
          </p>
        </section>

        <section className="border border-line bg-surface rounded-xl" style={{ marginTop: 48, padding: "18px 20px" }}>
          <div className="flex flex-wrap items-center gap-2">
            {flow.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="mono bg-sunk border border-line" style={{ borderRadius: 8, padding: "7px 12px", fontSize: 12.5 }}>{step}</span>
                {i < flow.length - 1 && <ArrowRight size={14} className="text-muted" />}
              </div>
            ))}
          </div>
        </section>

        <section className="grid" style={{ marginTop: 28, gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="border border-line bg-surface rounded-xl" style={{ padding: 18 }}>
              <span className="flex items-center justify-center bg-accent-soft text-accent" style={{ width: 32, height: 32, borderRadius: 8 }}>
                <Icon size={16} />
              </span>
              <h2 style={{ fontSize: 14.5, fontWeight: 600, marginTop: 12 }}>{title}</h2>
              <p className="text-ink-2" style={{ fontSize: 13, lineHeight: 1.55, marginTop: 6 }}>{text}</p>
            </div>
          ))}
        </section>

        <footer className="text-muted flex flex-wrap gap-x-6 gap-y-2" style={{ marginTop: 48, fontSize: 12.5 }}>
          <span>Next.js 16 · TypeScript · Tailwind 4 · Recharts · Claude API</span>
          <span>Продакшен-версия работает на ClickHouse, PostgreSQL, Supabase и AppsFlyer</span>
        </footer>
      </main>
    </div>
  );
}
