import { NextResponse } from "next/server";
import { ORDER_CHANNELS, USER_CHANNELS } from "@/lib/demo/dims";

export const dynamic = "force-dynamic";

// Списки каналов для выпадашек. В продакшене это DISTINCT по таблицам заказов и
// пользователей в хранилище, в демо справочник синтетического магазина.
export async function GET() {
  return NextResponse.json({
    configured: true,
    orderCreators: [...ORDER_CHANNELS],
    userCreators: [...USER_CHANNELS],
  });
}
