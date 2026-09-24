import { NextResponse } from "next/server";
import { deleteAlert } from "@/lib/alerts/store";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await deleteAlert(id);
  return NextResponse.json({ ok: true });
}
