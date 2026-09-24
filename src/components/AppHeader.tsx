import type { ReactNode } from "react";

// Шапка контентной области: заголовок + подзаголовок слева, действия справа.
export function AppHeader({
  title,
  subtitle,
  live,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  live?: string; // напр. "08:45"
  actions?: ReactNode;
  children?: ReactNode; // вторая строка (фильтры)
}) {
  return (
    <header
      className="sticky top-0 z-20 bg-bg border-b border-line"
      style={{ padding: "16px 28px 0" }}
    >
      <div className="flex items-start gap-3">
        <div>
          <h1 className="font-semibold" style={{ fontSize: 19, letterSpacing: "-0.015em" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted" style={{ fontSize: 12.5 }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {live && (
            <span
              className="mono flex items-center gap-2 border border-line bg-surface rounded-lg"
              style={{ padding: "7px 11px", fontSize: 12 }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 99, background: "var(--pos)" }} />
              live · {live}
            </span>
          )}
          {actions}
        </div>
      </div>
      {children ? <div style={{ padding: "14px 0 15px" }}>{children}</div> : <div style={{ height: 16 }} />}
    </header>
  );
}

// Кнопки шапки
export function HeaderButtons() {
  return null;
}
