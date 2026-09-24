import { NextResponse } from "next/server";
import { getAfConfig, saveAfConfig, getLastSync } from "@/lib/appsflyer/store";
import { emptyAfConfig, type AfApp, type AfConfigView } from "@/lib/appsflyer/types";
import { canManageConnections } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

function view(c: Awaited<ReturnType<typeof getAfConfig>>): AfConfigView {
  const apps = c.apps.filter((a) => a.id);
  return { configured: Boolean(c.token && apps.length > 0), apps, timezone: c.timezone, hasToken: Boolean(c.token) };
}

export async function GET() {
  const [cfg, last] = await Promise.all([getAfConfig(), getLastSync()]);
  return NextResponse.json({ config: view(cfg), lastSync: last, canManage: await canManageConnections() });
}

// Токен: null|undefined = «оставить как было».
export async function PUT(req: Request) {
  if (!(await canManageConnections())) {
    return NextResponse.json({ error: "Недостаточно прав. Менять интеграцию может владелец или админ." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { token?: string | null; apps?: AfApp[]; timezone?: string };
  const current = await getAfConfig();
  const token = body.token === null || body.token === undefined ? current.token : body.token.trim();
  const apps = (Array.isArray(body.apps) ? body.apps : [])
    .map((a) => ({ id: (a.id ?? "").trim(), platform: a.platform ?? "other" }))
    .filter((a) => a.id);
  if (apps.length === 0) return NextResponse.json({ error: "Укажите хотя бы один App ID." }, { status: 400 });

  const saved = await saveAfConfig({ ...emptyAfConfig(), token, apps, timezone: (body.timezone ?? "").trim() });
  const last = await getLastSync();
  return NextResponse.json({ ok: true, config: view(saved), lastSync: last });
}
