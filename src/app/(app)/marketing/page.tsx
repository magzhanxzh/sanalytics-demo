import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { FilterChips } from "@/components/FilterChips";
import { MarketingActions } from "@/components/MarketingActions";
import { OverviewData, OverviewSkeleton } from "@/components/OverviewData";
import { parseFilters } from "@/lib/queries/cards";
import { getSettings } from "@/lib/settings/store";

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  // Период заказа по умолчанию – последние 7 дней (parseFilters -> defaultFilters),
  // чтобы страница не грузила весь период. Если период явно очищен (from= в URL),
  // parseFilters вернёт "" и данные посчитаются без фильтра по времени (весь период).
  // Выручка по умолчанию из Настроек (если в URL не выбрана).
  if (sp.basis === undefined) filters.basis = (await getSettings()).revenueBasis;
  const now = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <AppHeader
        title="Маркетинг"
        subtitle="Сводка по продажам и рекламе"
        live={now}
        actions={<MarketingActions filters={filters} />}
      >
        <FilterChips filters={filters} />
      </AppHeader>

      <Suspense key={JSON.stringify(sp)} fallback={<OverviewSkeleton />}>
        <OverviewData filters={filters} />
      </Suspense>
    </>
  );
}
