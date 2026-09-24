import { NextResponse } from "next/server";
import { runAlerts } from "@/lib/alerts/deliver";
import { canManageConnections } from "@/lib/auth/access";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Ручной прогон доставки алертов (кнопка в UI). Права как у управления интеграциями.
export async function POST() {
  if (!(await canManageConnections())) {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  }
  return NextResponse.json(await runAlerts());
}
