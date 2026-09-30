import { NextResponse } from "next/server";
import { getConnectionView, getClickHouseStatus, getPgBridgeStatus } from "@/lib/integrations";

export const dynamic = "force-dynamic";

const DEMO_MSG = "Demo mode: data is synthetic, the database connection is disabled.";

// Current connection (without password) + source status.
export async function GET() {
  const [view, ch, pg] = await Promise.all([getConnectionView(), getClickHouseStatus(), getPgBridgeStatus()]);
  // canManage=false: the database connection is not configurable in the demo.
  return NextResponse.json({ connection: view, status: { ch, pg }, canManage: false, demo: true });
}

export async function PUT() {
  return NextResponse.json({ error: DEMO_MSG }, { status: 400 });
}

export async function DELETE() {
  return NextResponse.json({ error: DEMO_MSG }, { status: 400 });
}
