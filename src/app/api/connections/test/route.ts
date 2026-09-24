import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// В продакшене проверяет произвольное подключение к ClickHouse без сохранения.
export async function POST() {
  return NextResponse.json({ ok: false, error: "Демо-режим: подключение к базе отключено." });
}
