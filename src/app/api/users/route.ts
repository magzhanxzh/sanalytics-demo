import { NextResponse } from "next/server";
import { isOwner, getCurrentProfile, listUsers, updateUser } from "@/lib/auth/access";
import type { Role } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getCurrentProfile();
  // Список всех профилей (email/роли коллег) отдаём только владельцу; остальным – только «me».
  if (me?.role !== "owner") return NextResponse.json({ users: [], me });
  return NextResponse.json({ users: listUsers(), me });
}

export async function PUT(request: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { id?: string; role?: Role; countries?: string[] };
  if (!body.id || !body.role) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!updateUser(body.id, body.role, body.countries ?? [])) return NextResponse.json({ error: "not_found" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
