import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings/store";
import type { Settings } from "@/lib/settings/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ settings: await getSettings() });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { settings?: Settings };
  if (!body.settings) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const saved = await saveSettings(body.settings);
  return NextResponse.json({ settings: saved });
}
