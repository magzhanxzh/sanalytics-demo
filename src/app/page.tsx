import Link from "next/link";
import { ArrowRight, BarChart3, LayoutGrid, Bot, Bell, Plug, RefreshCw, Users, LineChart } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { ThemeToggle } from "@/components/ThemeToggle";

// Public landing page of the demo. The app itself lives in the (app) route group with a sidebar.

const features = [
  { icon: BarChart3, title: "Marketing", text: "KPIs with period comparison, daily, weekly and monthly trends, sign-up cohorts, Excel export." },
  { icon: LineChart, title: "Attribution", text: "Paid vs organic from the MMP map: sign-ups, conversion, revenue, CAC and ROAS by channel and campaign." },
  { icon: Users, title: "LTV", text: "Cohort customer value per sign-up and per buyer, curves by month of life and a triangle matrix." },
  { icon: LayoutGrid, title: "Dashboard builder", text: "KPI widgets, charts and tables with drag-and-drop, dashboard-level filters and read-only sharing." },
  { icon: Bot, title: "AI analyst", text: "Claude with tools over the metrics layer. It answers only with numbers from its queries and shows which slice it used." },
  { icon: Bell, title: "Alerts", text: "Metric rules checked against live data, delivered to Telegram with anti-spam." },
  { icon: Plug, title: "Integrations", text: "ClickHouse, PostgreSQL, AppsFlyer, Google Ads, Meta Ads, TikTok Ads, Yandex Direct. Ad accounts per country." },
  { icon: RefreshCw, title: "Cache and warm-up", text: "A single metrics cache with TTL, scheduled warm-up and a run log on the sync screen." },
];

const flow = ["Data sources", "Connectors", "Metrics layer + cache", "Dashboards, alerts, AI"];

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
            Open demo <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="mx-auto" style={{ maxWidth: 1120, padding: "40px 24px 80px" }}>
        <section style={{ maxWidth: 760 }}>
          <p className="mono text-accent" style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>BI for e-commerce marketing</p>
          <h1 style={{ fontSize: "clamp(30px, 5vw, 46px)", lineHeight: 1.1, letterSpacing: "-0.025em", fontWeight: 650, marginTop: 14 }}>
            All your store analytics in one report
          </h1>
          <p className="text-ink-2" style={{ fontSize: 16.5, lineHeight: 1.6, marginTop: 18 }}>
            Sanalytics combines orders, sign-ups, MMP attribution and ad spend into a single metrics layer.
            On top of it run dashboards, cohort LTV, alerts and an AI analyst that answers with real numbers.
          </p>
          <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 26 }}>
            <Link href="/marketing" className="inline-flex items-center gap-2 text-[color:var(--accent-ink)]" style={{ background: "var(--accent)", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 500 }}>
              Open demo <ArrowRight size={15} />
            </Link>
            <Link href="/dashboards" className="inline-flex items-center gap-2 border border-line bg-surface hover:border-line-2" style={{ borderRadius: 9, padding: "11px 18px", fontSize: 14 }}>
              Dashboard builder
            </Link>
          </div>
          <p className="text-muted" style={{ fontSize: 12.5, marginTop: 16 }}>
            Demo mode: all numbers are synthetic and generated deterministically. No sign-in, you are the owner.
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
          <span>The production version runs on ClickHouse, PostgreSQL, Supabase and AppsFlyer</span>
        </footer>
      </main>
    </div>
  );
}
