import { NextResponse } from "next/server";
import { listDashboards, createDashboard } from "@/lib/dashboards/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ dashboards: await listDashboards() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const d = await createDashboard(String(body.title ?? "").trim() || "Новый дашборд");
  return NextResponse.json({ dashboard: d });
}
