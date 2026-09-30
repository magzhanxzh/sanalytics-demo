import { AppHeader } from "@/components/AppHeader";
import { AlertsManager } from "@/components/AlertsManager";

export default function Page() {
  return (
    <>
      <AppHeader title="Alerts" subtitle="Metric rules checked against live data" />
      <div style={{ padding: "22px 28px 60px" }}>
        <AlertsManager />
      </div>
    </>
  );
}
