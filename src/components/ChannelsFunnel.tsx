import type { OverviewRaw } from "@/lib/metrics";

const nf = (n: number) => n.toLocaleString("ru-RU");

// Воронка от регистрации до оплаты по когорте: зарегистрированные в периоде и те из них,
// кто в этом же периоде сделал и оплатил заказ.
export function Funnel({ raw }: { raw?: OverviewRaw }) {
  const reg = raw?.registrations || 0;
  const steps = raw
    ? [
        { label: "Регистрации", value: raw.registrations, opacity: 1 },
        { label: "Сделали заказ", value: raw.cohortBuyers, opacity: 0.72 },
        { label: "Оплатили", value: raw.cohortPaidBuyers, opacity: 0.5 },
      ]
    : [];

  return (
    <div className="border border-line bg-surface rounded-xl" style={{ padding: 18 }}>
      <h2 className="font-semibold" style={{ fontSize: 14.5 }}>Воронка</h2>
      <p className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>когорта: зарегистрированные в периоде и их заказы</p>
      <div className="flex flex-col gap-3.5" style={{ marginTop: 18 }}>
        {steps.length === 0 && <span className="text-muted" style={{ fontSize: 12.5 }}>нет данных</span>}
        {steps.map((s) => {
          const pct = reg ? (s.value / reg) * 100 : 0;
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between" style={{ fontSize: 12.5 }}>
                <span>{s.label}</span>
                <span className="mono text-ink-2">{nf(s.value)} · {pct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 3, background: "var(--sunk)", marginTop: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", opacity: s.opacity, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
