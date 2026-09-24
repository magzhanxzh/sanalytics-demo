"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { LogoMark } from "./LogoMark";
import { CURRENT_USER } from "@/lib/dashboards/types";

const nav = [
  { n: "01", href: "/marketing", label: "Маркетинг" },
  { n: "02", href: "/af-analysis", label: "AF анализ" },
  { n: "03", href: "/ltv", label: "LTV" },
  { n: "04", href: "/dashboards", label: "Дашборды" },
  { n: "05", href: "/ai", label: "ИИ-аналитик" },
  { n: "06", href: "/integrations", label: "Интеграции", badge: "2" },
  { n: "07", href: "/sync", label: "Синхронизация" },
  { n: "08", href: "/alerts", label: "Алерты", badge: "4" },
  { n: "09", href: "/settings", label: "Настройки" },
];

export function Sidebar() {
  const pathname = usePathname();
  // Авторизация в демо выключена: все заходят как владелец.
  const email = CURRENT_USER;

  return (
    <aside className="w-58 shrink-0 border-r border-line bg-surface sticky top-0 h-screen flex flex-col" style={{ width: 232 }}>
      {/* Логотип */}
      <div className="flex items-center gap-2.5" style={{ padding: "22px 20px 18px" }}>
        <LogoMark size={22} />
        <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em" }}>Sanalytics</span>
        <span className="mono bg-sunk border border-line text-muted" style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 99, marginLeft: "auto" }}>demo</span>
      </div>

      {/* Навигация */}
      <nav className="flex flex-col gap-px" style={{ padding: "4px 10px" }}>
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg text-left transition-colors ${
                active ? "bg-sunk text-ink font-semibold" : "text-ink-2 hover:bg-sunk hover:text-ink"
              }`}
              style={{ padding: "9px 11px", fontSize: 13.5, boxShadow: active ? "inset 2px 0 0 var(--accent)" : undefined }}
            >
              <span className="mono opacity-50" style={{ fontSize: 10, width: 16 }}>
                {item.n}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span
                  className="mono bg-accent-soft text-accent"
                  style={{ fontSize: 10, padding: "1px 5px", borderRadius: 99 }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Низ */}
      <div className="mt-auto flex flex-col gap-2.5 border-t border-line" style={{ padding: 14 }}>
        <ThemeToggle />
        <div className="flex items-center gap-2.5">
          <span
            className="mono flex items-center justify-center shrink-0 bg-sunk border border-line"
            style={{ width: 26, height: 26, borderRadius: 99, fontSize: 11, fontWeight: 600 }}
          >
            {email[0]?.toUpperCase()}
          </span>
          <div className="leading-tight min-w-0 flex-1">
            <div className="truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>{email}</div>
            <div className="text-muted mono" style={{ fontSize: 11 }}>Demo Shop · owner</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
