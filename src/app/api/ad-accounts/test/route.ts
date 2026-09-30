import { NextResponse } from "next/server";
import { getAccount } from "@/lib/connectors/accounts";
import { testConnector } from "@/lib/connectors/providers";
import { AD_PROVIDERS } from "@/lib/connectors/types";
import { canManageConnections } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// Test a saved ad account by id. Secrets are taken from the saved account.
export async function POST(req: Request) {
  if (!(await canManageConnections())) return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string };
  if (!b.id) return NextResponse.json({ ok: false, error: "Save the ad account first." }, { status: 400 });
  const acc = await getAccount(b.id);
  if (!acc || !(AD_PROVIDERS as string[]).includes(acc.provider)) return NextResponse.json({ ok: false, error: "Ad account not found." }, { status: 400 });
  return NextResponse.json(await testConnector({ id: acc.provider, enabled: true, fields: acc.fields }));
}
