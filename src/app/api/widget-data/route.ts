import { NextResponse } from "next/server";
import { resolveWidget } from "@/lib/dashboards/data";
import { enforceCountry, allowedCountries } from "@/lib/auth/access";
import type { Widget } from "@/lib/dashboards/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { widget?: Widget };
  if (!body.widget || !body.widget.filters) return NextResponse.json({ kind: "error", message: "Нет виджета" }, { status: 400 });
  // гео-ограничение: страна виджета зажимается по правам пользователя
  body.widget.filters.country = await enforceCountry(body.widget.filters.country);
  // разбивки «по странам» не фильтруются country в SQL – зажимаем результат по правам
  const allowed = await allowedCountries();
  const data = await resolveWidget(body.widget, allowed);
  return NextResponse.json(data);
}
