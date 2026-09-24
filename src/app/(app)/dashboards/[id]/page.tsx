import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { DashboardView } from "@/components/dashboards/DashboardView";
import { getDashboard } from "@/lib/dashboards/store";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dashboard = await getDashboard(id);

  return (
    <>
      <AppHeader title="Дашборд" subtitle="Конструктор отчёта" />
      <div style={{ padding: "22px 28px 60px" }}>
        {dashboard ? (
          <DashboardView initial={dashboard} />
        ) : (
          <div className="text-muted" style={{ fontSize: 13.5 }}>
            Дашборд не найден. <Link href="/dashboards" className="text-accent">К списку</Link>
          </div>
        )}
      </div>
    </>
  );
}
