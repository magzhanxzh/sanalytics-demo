import { NextResponse } from "next/server";
import { getAllViews, saveConnector, viewOf } from "@/lib/connectors/store";
import { CONNECTORS, type ConnectorId } from "@/lib/connectors/types";
import { canManageConnections } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ specs: CONNECTORS, connectors: await getAllViews(), canManage: await canManageConnections() });
}

export async function PUT(req: Request) {
  if (!(await canManageConnections())) {
    return NextResponse.json({ error: "Недостаточно прав. Менять интеграции может владелец или админ." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { id?: ConnectorId; enabled?: boolean; fields?: Record<string, string> };
  if (!body.id || !CONNECTORS.some((c) => c.id === body.id)) {
    return NextResponse.json({ error: "Неизвестный коннектор." }, { status: 400 });
  }
  const saved = await saveConnector(body.id, { enabled: body.enabled, fields: body.fields });
  return NextResponse.json({ ok: true, connector: viewOf(saved) });
}
