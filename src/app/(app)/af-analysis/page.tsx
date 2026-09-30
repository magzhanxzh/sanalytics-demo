import { AppHeader } from "@/components/AppHeader";
import { FilterChips } from "@/components/FilterChips";
import { AfAnalysisView } from "@/components/af/AfAnalysisView";
import { parseFilters } from "@/lib/queries/cards";
import { getSettings } from "@/lib/settings/store";

export const dynamic = "force-dynamic";

function queryOf(f: ReturnType<typeof parseFilters>): string {
  const p = new URLSearchParams();
  p.set("from", f.from);
  p.set("to", f.to);
  p.set("country", f.country);
  p.set("ocreator", f.orderCreator);
  p.set("ucreator", f.userCreator);
  p.set("basis", f.basis);
  p.set("b2b", f.excludeB2b ? "exclude" : "include");
  if (f.regFrom) p.set("rfrom", f.regFrom);
  if (f.regTo) p.set("rto", f.regTo);
  return p.toString();
}

export default async function AfAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  // On Attribution both periods are "not set" by default (unlike Marketing, where the
  // order period is the last 30 days). If the URL has no parameter, leave it empty.
  if (sp.from === undefined) filters.from = "";
  if (sp.to === undefined) filters.to = "";
  // Revenue basis defaults to Settings (unless chosen in the URL).
  if (sp.basis === undefined) filters.basis = (await getSettings()).revenueBasis;

  return (
    <>
      <AppHeader title="Attribution" subtitle="Paid vs organic from AppsFlyer data">
        <FilterChips filters={filters} basePath="/af-analysis" />
      </AppHeader>

      <AfAnalysisView query={queryOf(filters)} basis={filters.basis} />
    </>
  );
}
