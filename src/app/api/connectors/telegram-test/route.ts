import { NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/store";
import { telegramSend } from "@/lib/connectors/providers";
import { canManageConnections } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await canManageConnections())) {
    return NextResponse.json({ ok: false, error: "Недостаточно прав." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const cfg = await getConnector("telegram");
  const text = body.text || "✅ Sanalytics: тестовое сообщение. Интеграция Telegram работает.";
  return NextResponse.json(await telegramSend(cfg, text));
}
