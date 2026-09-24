import { NextResponse } from "next/server";
import { getDashboard, saveDashboard, deleteDashboard } from "@/lib/dashboards/store";
import type { Dashboard } from "@/lib/dashboards/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = await getDashboard(id);
  if (!d) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ dashboard: d });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { dashboard?: Dashboard };
  if (!body.dashboard || body.dashboard.id !== id) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const saved = await saveDashboard(body.dashboard);
  return NextResponse.json({ dashboard: saved });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await deleteDashboard(id);
  return NextResponse.json({ ok: true });
}
