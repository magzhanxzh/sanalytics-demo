import { NextResponse } from "next/server";
import { listAlerts, upsertAlert } from "@/lib/alerts/store";
import type { AlertRule } from "@/lib/alerts/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ rules: await listAlerts() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { rule?: AlertRule };
  if (!body.rule) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const saved = await upsertAlert(body.rule);
  return NextResponse.json({ rule: saved });
}
