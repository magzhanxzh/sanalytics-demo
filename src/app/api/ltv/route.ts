import { NextResponse } from "next/server";
import { buildLtv } from "@/lib/ltv/ltv";
import { enforceCountry } from "@/lib/auth/access";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const country = await enforceCountry(sp.get("country") || "KZ");
  const orderCreator = sp.get("ocreator") || "store";
  const userCreator = sp.get("ucreator") || "all";
  const excludeB2b = sp.get("b2b") !== "include"; // B2B excluded by default (as in the report)
  const data = await buildLtv({ country, orderCreator, userCreator, excludeB2b });
  return NextResponse.json(data);
}
