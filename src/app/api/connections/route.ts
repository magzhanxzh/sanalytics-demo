import { NextResponse } from "next/server";
import { getConnectionView, getClickHouseStatus, getPgBridgeStatus } from "@/lib/integrations";

export const dynamic = "force-dynamic";

const DEMO_MSG = "Демо-режим: данные синтетические, подключение к базе отключено.";

// Текущее подключение (без пароля) + статус источников.
export async function GET() {
  const [view, ch, pg] = await Promise.all([getConnectionView(), getClickHouseStatus(), getPgBridgeStatus()]);
  // canManage=false: в демо подключение к базе не настраивается.
  return NextResponse.json({ connection: view, status: { ch, pg }, canManage: false, demo: true });
}

export async function PUT() {
  return NextResponse.json({ error: DEMO_MSG }, { status: 400 });
}

export async function DELETE() {
  return NextResponse.json({ error: DEMO_MSG }, { status: 400 });
}
