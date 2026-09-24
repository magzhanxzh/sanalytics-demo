import { NextResponse } from "next/server";
import { listAccountViews, upsertAccount, removeAccount, viewOf, getAccount } from "@/lib/connectors/accounts";
import { CONNECTORS, AD_PROVIDERS, type AdProvider } from "@/lib/connectors/types";
import { COUNTRIES } from "@/lib/queries/cards";
import { canManageConnections } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// Спеки полей для рекламных площадок (переиспользуем описания коннекторов).
const specs = CONNECTORS.filter((c) => (AD_PROVIDERS as string[]).includes(c.id));
const countries = COUNTRIES.filter((c) => c.code !== "all");

export async function GET() {
  return NextResponse.json({
    specs, countries,
    accounts: await listAccountViews(),
    canManage: await canManageConnections(),
  });
}

export async function PUT(req: Request) {
  if (!(await canManageConnections())) return NextResponse.json({ error: "Недостаточно прав. Менять кабинеты может владелец или админ." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; provider?: AdProvider; country?: string; label?: string; enabled?: boolean; fields?: Record<string, string> };
  if (!b.provider || !(AD_PROVIDERS as string[]).includes(b.provider)) return NextResponse.json({ error: "Неизвестная площадка." }, { status: 400 });
  if (!b.country) return NextResponse.json({ error: "Укажите страну кабинета." }, { status: 400 });
  const saved = await upsertAccount({ id: b.id, provider: b.provider, country: b.country, label: b.label, enabled: b.enabled, fields: b.fields });
  return NextResponse.json({ ok: true, account: viewOf(saved) });
}

export async function DELETE(req: Request) {
  if (!(await canManageConnections())) return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !(await getAccount(id))) return NextResponse.json({ error: "Кабинет не найден." }, { status: 400 });
  await removeAccount(id);
  return NextResponse.json({ ok: true });
}
