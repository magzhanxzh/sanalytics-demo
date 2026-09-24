"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "light";
    setTheme(current);
  }, []);

  function apply(t: Theme) {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("theme", t);
    } catch {}
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {(["light", "dark"] as Theme[]).map((t) => {
        const active = theme === t;
        return (
          <button
            key={t}
            onClick={() => apply(t)}
            className={`text-xs rounded-[7px] px-2 py-[7px] border transition-colors ${
              active
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:text-ink"
            }`}
          >
            {t === "light" ? "Светлая" : "Тёмная"}
          </button>
        );
      })}
    </div>
  );
}
