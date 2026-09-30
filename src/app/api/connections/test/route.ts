import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// In production this tests an arbitrary ClickHouse connection without saving it.
export async function POST() {
  return NextResponse.json({ ok: false, error: "Demo mode: the database connection is disabled." });
}
