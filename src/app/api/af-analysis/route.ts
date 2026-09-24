import { NextResponse } from "next/server";
import { parseFilters } from "@/lib/queries/cards";
import { buildAfAnalysis } from "@/lib/appsflyer/analysis";
import { enforceCountry, canManageConnections } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { sp[k] = v; });
  const filters = parseFilters(sp);
  filters.country = await enforceCountry(filters.country);
  // Пересборку карты AF (тратит квоту) разрешаем только владельцу/админу.
  const rebuildMap = sp.rebuildMap === "1" && (await canManageConnections());
  const syncSpend = sp.sync === "1";
  const bypassCache = sp.force === "1" || syncSpend || rebuildMap;

  const analysis = await buildAfAnalysis(filters, { bypassCache, rebuildMap, syncSpend });
  return NextResponse.json(analysis);
}
