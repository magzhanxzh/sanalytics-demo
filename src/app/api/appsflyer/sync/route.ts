import { NextResponse } from "next/server";
import { getAfConfig, saveLastSync } from "@/lib/appsflyer/store";
import { pullAf } from "@/lib/appsflyer/pull";
import { canManageConnections } from "@/lib/auth/access";
import { liveConnectors } from "@/lib/demo/mode";
import { demoAfAggregate } from "@/lib/demo/ads";

export const dynamic = "force-dynamic";

function fmt(d: Date) { return d.toISOString().slice(0, 10); }

// Синхронизация AF за окно. По умолчанию – последние 30 дней.
export async function POST(req: Request) {
  if (!(await canManageConnections())) {
    return NextResponse.json({ ok: false, error: "Недостаточно прав." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { from?: string; to?: string };
  const to = body.to || fmt(new Date());
  const from = body.from || fmt(new Date(Date.now() - 30 * 864e5));

  const cfg = await getAfConfig();
  if (!cfg.token || cfg.apps.filter((a) => a.id).length === 0) {
    return NextResponse.json({ ok: false, error: "Сначала задайте токен и хотя бы один App ID." }, { status: 400 });
  }

  // Демо: агрегат из синтетических данных, Pull API не вызывается.
  if (!liveConnectors()) {
    const sync = demoAfAggregate(from, to);
    await saveLastSync(sync);
    return NextResponse.json({ ok: true, sync });
  }

  const result = await pullAf(cfg, from, to);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error });
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ok, ...sync } = result;
  await saveLastSync(sync);
  return NextResponse.json({ ok: true, sync });
}
