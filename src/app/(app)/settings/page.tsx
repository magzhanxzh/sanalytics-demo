import { AppHeader } from "@/components/AppHeader";
import { SettingsForm } from "@/components/SettingsForm";
import { UsersManager } from "@/components/UsersManager";
import { getSettings } from "@/lib/settings/store";
import { isOwner } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [settings, owner] = await Promise.all([getSettings(), isOwner()]);
  return (
    <>
      <AppHeader title="Настройки" subtitle="Организация, доступы, модель данных и ИИ" />
      <div style={{ padding: "22px 28px 60px" }}>
        <div className="mx-auto flex flex-col" style={{ maxWidth: 840, gap: 18 }}>
          {owner && <UsersManager />}
          <SettingsForm initial={settings} />
        </div>
      </div>
    </>
  );
}
