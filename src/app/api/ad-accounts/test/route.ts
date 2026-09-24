import { NextResponse } from "next/server";
import { getAccount } from "@/lib/connectors/accounts";
import { testConnector } from "@/lib/connectors/providers";
import { AD_PROVIDERS } from "@/lib/connectors/types";
import { canManageConnections } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// Проверить кабинет по id (сохранённый). Секреты берутся из сохранённого кабинета.
export async function POST(req: Request) {
  if (!(await canManageConnections())) return NextResponse.json({ ok: false, error: "Недостаточно прав." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string };
  if (!b.id) return NextResponse.json({ ok: false, error: "Сначала сохраните кабинет." }, { status: 400 });
  const acc = await getAccount(b.id);
  if (!acc || !(AD_PROVIDERS as string[]).includes(acc.provider)) return NextResponse.json({ ok: false, error: "Кабинет не найден." }, { status: 400 });
  return NextResponse.json(await testConnector({ id: acc.provider, enabled: true, fields: acc.fields }));
}
