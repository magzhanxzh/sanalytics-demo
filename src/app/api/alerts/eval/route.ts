import { NextResponse } from "next/server";
import { listAlerts } from "@/lib/alerts/store";
import { evalAll } from "@/lib/alerts/eval";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const rules = await listAlerts();
  const statuses = await evalAll(rules);
  return NextResponse.json({ statuses });
}
