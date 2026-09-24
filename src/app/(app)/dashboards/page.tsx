import { AppHeader } from "@/components/AppHeader";
import { DashboardsList } from "@/components/dashboards/DashboardsList";

export default function Page() {
  return (
    <>
      <AppHeader title="Дашборды" subtitle="Сохранённые отчёты из виджетов" />
      <div style={{ padding: "22px 28px 60px" }}>
        <DashboardsList />
      </div>
    </>
  );
}
