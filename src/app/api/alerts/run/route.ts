import { NextResponse } from "next/server";
import { runAlerts } from "@/lib/alerts/deliver";
import { canManageConnections } from "@/lib/auth/access";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Manual alert delivery run (a UI button). Same permissions as managing integrations.
export async function POST() {
  if (!(await canManageConnections())) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  return NextResponse.json(await runAlerts());
}
