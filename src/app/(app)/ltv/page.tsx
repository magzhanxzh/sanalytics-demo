import { AppHeader } from "@/components/AppHeader";
import { LtvView } from "@/components/ltv/LtvView";

export const dynamic = "force-dynamic";

export default async function LtvPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const country = one(sp.country) || "KZ";
  const ocreator = one(sp.ocreator) || "store";
  const ucreator = one(sp.ucreator) || "all";
  const excludeB2b = one(sp.b2b) !== "include";

  return (
    <>
      <AppHeader title="LTV" subtitle="Когортная ценность клиента по месяцу регистрации" />
      <LtvView country={country} orderCreator={ocreator} userCreator={ucreator} excludeB2b={excludeB2b} />
    </>
  );
}
