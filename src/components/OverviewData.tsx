import { Suspense } from "react";
import { KpiStrip } from "@/components/KpiStrip";
import { MarketingChart } from "@/components/MarketingChart";
import { AiPanel } from "@/components/AiPanel";
import { Funnel } from "@/components/ChannelsFunnel";
import { AcquisitionChannels, AcquisitionChannelsSkeleton } from "@/components/AcquisitionChannels";
import { GranularityToggle } from "@/components/GranularityToggle";
import { getCards, getDaily } from "@/lib/metrics";
import { enforceCountry } from "@/lib/auth/access";
import { formatRange, type CardFilters, type DailyPoint } from "@/lib/queries/cards";

export async function OverviewData({ filters: raw }: { filters: CardFilters }) {
  const filters: CardFilters = { ...raw, country: await enforceCountry(raw.country) };
  const [data, daily] = await Promise.all([getCards(filters), getDaily(filters)]);
  const live = data.configured && data.cards.length > 0 && !data.error;

  if (!live) {
    return (
      <div style={{ padding: "22px 28px 60px" }}>
        <div className="border border-line bg-surface rounded-xl" style={{ padding: 22 }}>
          <p className="text-muted" style={{ fontSize: 13 }}>
            {data.error
              ? "Не удалось посчитать срез. Попробуйте «Обновить»."
              : "Источник данных не настроен."}
          </p>
        </div>
      </div>
    );
  }

  const points: DailyPoint[] = daily.points;
  const cardVal = (code: string) => data.cards.find((c) => c.code === code)?.value ?? "";
  const totals: Record<string, string> = {
    revenue: cardVal("revenue"),
    orders: cardVal("orders"),
    buyers: cardVal("buyers"),
    registrations: cardVal("registrations"),
    weight: cardVal("weight_kg"),
  };

  return (
    <div style={{ padding: "22px 28px 60px", display: "flex", flexDirection: "column", gap: 18 }}>
      <KpiStrip cards={data.cards} points={points} />

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 18, alignItems: "start" }}>
        <div className="border border-line bg-surface rounded-xl" style={{ padding: "18px 18px 14px" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="font-semibold" style={{ fontSize: 14.5 }}>Динамика</h2>
              <span className="text-muted" style={{ fontSize: 12 }}>{filters.from && filters.to ? formatRange(filters.from, filters.to) : "последние 30 дней"}</span>
            </div>
            <GranularityToggle filters={filters} />
          </div>
          <MarketingChart data={points} totals={totals} />
        </div>
        <AiPanel filters={filters} />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        {/* Каналы привлечения – реальные данные из подключённых кабинетов, стримятся отдельно (тяжёлый AF-запрос) */}
        <Suspense fallback={<AcquisitionChannelsSkeleton />}>
          <AcquisitionChannels filters={filters} />
        </Suspense>
        <Funnel raw={data.raw} />
      </div>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div style={{ padding: "22px 28px 60px", display: "flex", flexDirection: "column", gap: 18 }} className="animate-pulse">
      <div className="border border-line rounded-xl bg-surface" style={{ height: 104 }} />
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 18 }}>
        <div className="border border-line rounded-xl bg-surface" style={{ height: 360 }} />
        <div className="border border-line rounded-xl bg-surface" style={{ height: 360 }} />
      </div>
    </div>
  );
}
