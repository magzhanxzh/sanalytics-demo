import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCards, getDaily, describeFilters } from "@/lib/metrics";
import { parseFilters, COUNTRIES, formatRange } from "@/lib/queries/cards";
import { enforceCountry } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// Экспорт текущего среза в .xlsx: лист «Сводка» (KPI) + лист «Динамика» (по периодам).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseFilters(Object.fromEntries(searchParams.entries()));
  filters.country = await enforceCountry(filters.country); // гео-ограничение как в остальных срезах

  const [cards, daily] = await Promise.all([getCards(filters), getDaily(filters)]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sanalytics";
  wb.created = new Date();

  // Лист «Сводка»
  const s1 = wb.addWorksheet("Сводка");
  s1.columns = [
    { header: "Показатель", key: "k", width: 22 },
    { header: "Значение", key: "v", width: 20 },
  ];
  s1.addRow({ k: "Срез", v: describeFilters(filters) });
  s1.addRow({ k: "Страна", v: COUNTRIES.find((c) => c.code === filters.country)?.label ?? filters.country });
  s1.addRow({ k: "Период заказа", v: formatRange(filters.from, filters.to) });
  if (filters.regFrom && filters.regTo) s1.addRow({ k: "Период регистрации", v: formatRange(filters.regFrom, filters.regTo) });
  s1.addRow({});
  for (const c of cards.cards) s1.addRow({ k: c.title, v: c.value });
  s1.getRow(1).font = { bold: true };

  // Лист «Динамика»
  const s2 = wb.addWorksheet("Динамика");
  s2.columns = [
    { header: "Период", key: "date", width: 12 },
    { header: "Выручка", key: "revenue", width: 14 },
    { header: "Заказы", key: "orders", width: 12 },
    { header: "Покупатели", key: "buyers", width: 14 },
    { header: "Регистрации", key: "registrations", width: 14 },
    { header: "Вес, кг", key: "weight", width: 12 },
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
