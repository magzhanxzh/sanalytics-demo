import { AppHeader } from "@/components/AppHeader";
import { DashboardsList } from "@/components/dashboards/DashboardsList";

export default function Page() {
  return (
    <>
      <AppHeader title="Dashboards" subtitle="Saved reports built from widgets" />
      <div style={{ padding: "22px 28px 60px" }}>
        <DashboardsList />
      </div>
    </>
  );
}
