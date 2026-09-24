import { getAcquisitionChannels } from "@/lib/marketing/acquisition";
import type { CardFilters } from "@/lib/queries/cards";

const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];
const money0 = (v: number) => "$" + Math.round(v).toLocaleString("ru-RU");
const nf = (v: number) => Math.round(v).toLocaleString("ru-RU");

function Shell({ head, children }: { head?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-line bg-surface rounded-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-line" style={{ padding: "16px 18px" }}>
        <h2 className="font-semibold" style={{ fontSize: 14.5 }}>Каналы привлечения</h2>
        {head}
      </div>
      {children}
    </div>
  );
}

export async function AcquisitionChannels({ filters }: { filters: CardFilters }) {
  const r = await getAcquisitionChannels(filters);

  if (!r.connected) {
    return (
      <Shell>
        <div className="text-muted" style={{ padding: "22px 18px", fontSize: 13, lineHeight: 1.6 }}>
          Пока не подключён ни один рекламный кабинет. Добавьте кабинет в разделе{" "}
          <span className="text-ink" style={{ fontWeight: 500 }}>Интеграции → Рекламные кабинеты</span>, и здесь появятся его расход, выручка и ROAS.
        </div>
      </Shell>
    );
  }

  if (r.channels.length === 0) {
    return (
      <Shell>
        <div className="text-muted" style={{ padding: "22px 18px", fontSize: 13, lineHeight: 1.6 }}>
          {r.note ?? "Нет данных по каналам за период."}
        </div>
      </Shell>
    );
  }

  const maxSpend = Math.max(...r.channels.map((c) => c.spend), 1);

  return (
    <Shell head={<span className="text-muted mono" style={{ fontSize: 12 }}>расход {money0(r.totalSpend)} · ROAS {r.roas.toFixed(1)}</span>}>
      <div className="grid text-muted" style={{ gridTemplateColumns: "minmax(0,1.4fr) repeat(4, minmax(0,1fr)) minmax(0,88px)", padding: "10px 18px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <span>Канал</span>
        <span className="text-right">Расход</span>
        <span className="text-right">Выручка</span>
        <span className="text-right">Заказы</span>
        <span className="text-right">CAC</span>
        <span className="text-right">ROAS</span>
      </div>
      {r.channels.map((c, i) => (
        <div key={c.name} className="grid items-center border-t border-line hover:bg-sunk transition-colors" style={{ gridTemplateColumns: "minmax(0,1.4fr) repeat(4, minmax(0,1fr)) minmax(0,88px)", padding: "12px 18px" }}>
          <span className="flex items-center gap-2 min-w-0">
            <span style={{ width: 7, height: 7, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <span className="truncate" style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</span>
          </span>
          <span className="mono text-right" style={{ fontSize: 13 }}>{money0(c.spend)}</span>
          <span className="mono text-right" style={{ fontSize: 13 }}>{money0(c.revenue)}</span>
          <span className="mono text-right" style={{ fontSize: 13 }}>{nf(c.orders)}</span>
          <span className="mono text-right" style={{ fontSize: 13 }}>${c.cac.toFixed(2)}</span>
          <span className="flex items-center justify-end gap-2">
            <span style={{ height: 4, borderRadius: 2, background: "var(--accent)", opacity: 0.75, width: `${(c.spend / maxSpend) * 100}%`, maxWidth: 52 }} />
            <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{c.roas.toFixed(1)}</span>
          </span>
        </div>
      ))}
      <div className="text-muted" style={{ padding: "10px 18px", fontSize: 11, borderTop: "1px solid var(--line)" }}>
        расход из подключённых кабинетов · заказы и выручка по источнику привлечения клиента (AppsFlyer){r.paidOrdersShare !== undefined ? ` · платные каналы: ${r.paidOrdersShare.toFixed(0)}% заказов` : ""}
      </div>
    </Shell>
  );
}

export function AcquisitionChannelsSkeleton() {
  return (
    <div className="border border-line bg-surface rounded-xl animate-pulse" style={{ height: 260 }}>
      <div className="border-b border-line" style={{ padding: "16px 18px", fontSize: 14.5, fontWeight: 600 }}>Каналы привлечения</div>
      <div className="text-muted" style={{ padding: "22px 18px", fontSize: 12.5 }}>Считаем расход и ROAS по кабинетам…</div>
    </div>
  );
}
