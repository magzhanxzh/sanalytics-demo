import { AppHeader } from "@/components/AppHeader";
import { AlertsManager } from "@/components/AlertsManager";

export default function Page() {
  return (
    <>
      <AppHeader title="Алерты" subtitle="Правила на метрики и проверка на живых данных" />
      <div style={{ padding: "22px 28px 60px" }}>
        <AlertsManager />
      </div>
    </>
  );
}
