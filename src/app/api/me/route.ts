import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const p = await getCurrentProfile();
  return NextResponse.json({ role: p?.role ?? null, countries: p?.countries ?? [] });
}
