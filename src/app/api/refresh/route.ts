import { NextResponse } from "next/server";
import { getCards, getDaily } from "@/lib/metrics";
import { parseFilters } from "@/lib/queries/cards";

export const dynamic = "force-dynamic";

// Принудительный пересчёт среза (сброс кеша). Используется кнопкой «Обновить».
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseFilters(Object.fromEntries(searchParams.entries()));
  await Promise.all([
    getCards(filters, { force: true, source: "request" }),
    getDaily(filters, { force: true, source: "request" }),
  ]);
  return NextResponse.json({ ok: true });
}
