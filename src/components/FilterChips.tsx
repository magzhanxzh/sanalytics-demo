"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { COUNTRIES, FALLBACK_CREATORS, FALLBACK_USER_CREATORS, type CardFilters } from "@/lib/queries/cards";
import { DateRangePicker } from "@/components/DateRangePicker";
import { useAccess, countryOptions } from "@/lib/auth/useAccess";

// Панель фильтров в виде чипов (дизайн-хендофф). Применяется на изменение.
// basePath задаёт маршрут, куда едут параметры (по умолчанию /marketing).
export function FilterChips({ filters, basePath = "/marketing" }: { filters: CardFilters; basePath?: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [f, setF] = useState<CardFilters>(filters);
  const [orderCreators, setOrderCreators] = useState<string[]>(FALLBACK_CREATORS);
  const [userCreators, setUserCreators] = useState<string[]>(FALLBACK_USER_CREATORS);
  const access = useAccess();

  useEffect(() => setF(filters), [filters]);

  // Ограниченному пользователю: если выбранная страна вне доступа – переключаем на разрешённую.
  useEffect(() => {
    if (access.loading || access.allowed === null || access.allowed.length === 0) return;
    if (!access.allowed.includes(filters.country)) {
      const n = { ...filters, country: access.allowed[0] };
      startTransition(() => router.push(`${basePath}?${paramsOf(n).toString()}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.loading, filters.country]);
  useEffect(() => {
    fetch("/api/meta/creators")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.orderCreators)) setOrderCreators(d.orderCreators);
        if (Array.isArray(d.userCreators)) setUserCreators(d.userCreators);
      })
      .catch(() => {});
  }, []);

  function paramsOf(cf: CardFilters): URLSearchParams {
    const p = new URLSearchParams();
    p.set("from", cf.from);
    p.set("to", cf.to);
    p.set("country", cf.country);
    p.set("ocreator", cf.orderCreator);
    p.set("ucreator", cf.userCreator);
    p.set("basis", cf.basis);
    p.set("b2b", cf.excludeB2b ? "exclude" : "include");
    if (cf.regFrom) p.set("rfrom", cf.regFrom);
    if (cf.regTo) p.set("rto", cf.regTo);
    p.set("grain", cf.grain);
    return p;
  }
  function apply(next: CardFilters) {
    startTransition(() => router.push(`${basePath}?${paramsOf(next).toString()}`));
  }

  const countryLabel = COUNTRIES.find((c) => c.code === f.country)?.label ?? f.country;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ChipSelect
        label="Страна"
        value={countryLabel}
        selectValue={f.country}
        options={countryOptions(access.allowed).map(([value, label]) => ({ value, label }))}
        onChange={(v) => { const n = { ...f, country: v }; setF(n); apply(n); }}
      />
      <ChipSelect
        label="Канал клиента"
        value={f.userCreator === "all" ? "Все" : f.userCreator}
        selectValue={f.userCreator}
        options={[{ value: "all", label: "Все" }, ...userCreators.map((c) => ({ value: c, label: c }))]}
        onChange={(v) => { const n = { ...f, userCreator: v }; setF(n); apply(n); }}
      />
      <ChipSelect
        label="Канал заказа"
        value={f.orderCreator === "all" ? "Все" : f.orderCreator}
        selectValue={f.orderCreator}
        options={[{ value: "all", label: "Все" }, ...orderCreators.map((c) => ({ value: c, label: c }))]}
        onChange={(v) => { const n = { ...f, orderCreator: v }; setF(n); apply(n); }}
      />
      <ChipSelect
        label="Выручка"
        value={f.basis === "paid" ? "Оплачено" : "Валовая"}
        selectValue={f.basis}
        options={[{ value: "gross", label: "Валовая" }, { value: "paid", label: "Оплачено" }]}
        onChange={(v) => { const n = { ...f, basis: v as CardFilters["basis"] }; setF(n); apply(n); }}
      />
      <ChipSelect
        label="B2B"
        value={f.excludeB2b ? "Искл" : "Вкл"}
        selectValue={f.excludeB2b ? "exclude" : "include"}
        options={[{ value: "include", label: "Вкл" }, { value: "exclude", label: "Искл" }]}
        onChange={(v) => { const n = { ...f, excludeB2b: v === "exclude" }; setF(n); apply(n); }}
      />

      {/* Правая часть: оба периода + обновить */}
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <DateRangePicker
          label="Период регистрации"
          placeholder="не задан"
          from={f.regFrom}
          to={f.regTo}
          onApply={(from, to) => { const n = { ...f, regFrom: from, regTo: to }; setF(n); apply(n); }}
          onClear={() => { const n = { ...f, regFrom: "", regTo: "" }; setF(n); apply(n); }}
        />
        <DateRangePicker
          label="Период заказа"
          from={f.from}
          to={f.to}
          onApply={(from, to) => { const n = { ...f, from, to }; setF(n); apply(n); }}
          onClear={() => { const n = { ...f, from: "", to: "" }; setF(n); apply(n); }}
        />
      </div>
    </div>
  );
}

function ChipSelect({
  label,
  value,
  selectValue,
  options,
  onChange,
}: {
  label: string;
  value: string;
  selectValue: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="relative inline-flex items-center gap-1.5 border border-line bg-surface hover:border-line-2 transition-colors"
      style={{ borderRadius: 7, padding: "6px 10px" }}
    >
      <span className="text-muted" style={{ fontSize: 11.5 }}>{label}</span>
      <span className="font-medium" style={{ fontSize: 12.5 }}>{value}</span>
      <span className="text-muted" style={{ fontSize: 9 }}>▾</span>
      <select
        value={selectValue}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

