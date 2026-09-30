import { NextResponse } from "next/server";
import { resolveWidget } from "@/lib/dashboards/data";
import { enforceCountry, allowedCountries } from "@/lib/auth/access";
import type { Widget } from "@/lib/dashboards/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { widget?: Widget };
  if (!body.widget || !body.widget.filters) return NextResponse.json({ kind: "error", message: "No widget" }, { status: 400 });
  // geo restriction: the widget country is clamped to the user's permissions
  body.widget.filters.country = await enforceCountry(body.widget.filters.country);
  // "by country" breakdowns are not filtered by country in SQL, so the result is clamped to permissions
  const allowed = await allowedCountries();
  const data = await resolveWidget(body.widget, allowed);
  return NextResponse.json(data);
}
