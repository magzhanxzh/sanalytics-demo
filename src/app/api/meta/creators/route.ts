import { NextResponse } from "next/server";
import { ORDER_CHANNELS, USER_CHANNELS } from "@/lib/demo/dims";

export const dynamic = "force-dynamic";

// Channel lists for dropdowns. In production it is a DISTINCT over the order and user
// tables in the warehouse; in the demo it is the synthetic store's reference data.
export async function GET() {
  return NextResponse.json({
    configured: true,
    orderCreators: [...ORDER_CHANNELS],
    userCreators: [...USER_CHANNELS],
  });
}
