import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCards, getDaily, describeFilters } from "@/lib/metrics";
import { parseFilters, COUNTRIES, formatRange } from "@/lib/queries/cards";
import { enforceCountry } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// Export the current slice to .xlsx: a Summary sheet (KPIs) + a Trend sheet (by period).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseFilters(Object.fromEntries(searchParams.entries()));
  filters.country = await enforceCountry(filters.country); // geo restriction as in the other slices

  const [cards, daily] = await Promise.all([getCards(filters), getDaily(filters)]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sanalytics";
  wb.created = new Date();

  // Summary sheet
  const s1 = wb.addWorksheet("Summary");
  s1.columns = [
    { header: "Metric", key: "k", width: 22 },
    { header: "Value", key: "v", width: 20 },
  ];
  s1.addRow({ k: "Slice", v: describeFilters(filters) });
  s1.addRow({ k: "Country", v: COUNTRIES.find((c) => c.code === filters.country)?.label ?? filters.country });
  s1.addRow({ k: "Order period", v: formatRange(filters.from, filters.to) });
  if (filters.regFrom && filters.regTo) s1.addRow({ k: "Sign-up period", v: formatRange(filters.regFrom, filters.regTo) });
  s1.addRow({});
  for (const c of cards.cards) s1.addRow({ k: c.title, v: c.value });
  s1.getRow(1).font = { bold: true };

  // Trend sheet
  const s2 = wb.addWorksheet("Trend");
  s2.columns = [
    { header: "Period", key: "date", width: 12 },
    { header: "Revenue", key: "revenue", width: 14 },
    { header: "Orders", key: "orders", width: 12 },
    { header: "Buyers", key: "buyers", width: 14 },
    { header: "Sign-ups", key: "registrations", width: 14 },
    { header: "Weight, kg", key: "weight", width: 12 },
  ];
  for (const p of daily.points) {
    s2.addRow({ date: p.date, revenue: p.revenue, orders: p.orders, buyers: p.buyers, registrations: p.registrations, weight: p.weight });
  }
  s2.getRow(1).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  const name = `sanalytics_${filters.country}_${filters.from}_${filters.to}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
