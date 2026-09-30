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
  // The order period defaults to the last 7 days (parseFilters -> defaultFilters)
  // so the page doesn't load all history. If the period is cleared explicitly (from= in the URL),
  // parseFilters returns "" and the data is computed without a time filter (all time).
  // Revenue basis defaults to Settings (unless chosen in the URL).
  if (sp.basis === undefined) filters.basis = (await getSettings()).revenueBasis;
  const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <AppHeader
        title="Marketing"
        subtitle="Sales and advertising overview"
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
