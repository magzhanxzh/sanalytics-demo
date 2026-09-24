import { AppHeader } from "@/components/AppHeader";
import { ConnectedSources } from "@/components/integrations/ConnectedSources";
import { AppsFlyerCard } from "@/components/integrations/AppsFlyerCard";
import { ConnectorsPanel } from "@/components/integrations/ConnectorsPanel";
import { AdAccountsPanel } from "@/components/integrations/AdAccountsPanel";

export const dynamic = "force-dynamic";

function Pill({ text, kind }: { text: string; kind: "ok" | "error" | "soon" }) {
  const style =
    kind === "ok" ? { background: "var(--accent-soft)", color: "var(--accent)" }
    : kind === "error" ? { background: "oklch(0.93 0.05 28)", color: "var(--neg)" }
    : { background: "var(--sunk)", color: "var(--muted)" };
  return <span className="mono" style={{ ...style, fontSize: 10.5, padding: "3px 7px", borderRadius: 99 }}>{text}</span>;
}

function Card({ ab, name, type, desc, pill, detail }: { ab: string; name: string; type: string; desc: string; pill: React.ReactNode; detail: string }) {
  return (
    <div className="border border-line bg-surface rounded-xl flex flex-col" style={{ padding: 16, gap: 12 }}>
      <div className="flex items-center gap-3">
        <span className="mono flex items-center justify-center bg-sunk border border-line" style={{ width: 30, height: 30, borderRadius: 7, fontSize: 12, fontWeight: 600 }}>{ab}</span>
        <div className="flex-1">
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{name}</div>
          <div className="text-muted" style={{ fontSize: 11.5 }}>{type}</div>
        </div>
        {pill}
      </div>
      <p className="text-ink-2" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{desc}</p>
      <div className="border-t border-line" style={{ paddingTop: 11 }}>
        <span className="mono text-muted" style={{ fontSize: 11 }}>{detail}</span>
      </div>
    </div>
  );
}

// Ещё не реализованные коннекторы (нужны отдельные API/интеграции).
const soon = [
  { ab: "ST", name: "Stripe", type: "платежи", desc: "Транзакции и статусы оплат." },
  { ab: "AM", name: "amoCRM", type: "CRM", desc: "Сделки, воронка, менеджеры." },
];

export default function Page() {
  return (
    <>
      <AppHeader title="Интеграции" subtitle="Источники данных, рекламные кабинеты и расход" />
      <div style={{ padding: "22px 28px 60px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div><ConnectedSources /></div>

        <div>
          <h2 className="font-semibold" style={{ fontSize: 15, marginBottom: 12 }}>MMP</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
            <AppsFlyerCard />
          </div>
        </div>

        <div>
          <h2 className="font-semibold" style={{ fontSize: 15, marginBottom: 4 }}>Рекламные кабинеты (по странам)</h2>
          <p className="text-muted" style={{ fontSize: 12.5, marginBottom: 12 }}>Google Ads, Meta Ads, TikTok Ads, Yandex Direct. По кабинету на каждую страну, расход привязывается к стране кабинета. В демо кабинеты заведены заранее, расход синтетический.</p>
          <AdAccountsPanel />
        </div>

        <div>
          <h2 className="font-semibold" style={{ fontSize: 15, marginBottom: 4 }}>Уведомления</h2>
          <p className="text-muted" style={{ fontSize: 12.5, marginBottom: 12 }}>Вставьте ключи, нажмите «Проверить», затем «Включён». Секреты хранятся на сервере. В демо-режиме проверки и отправки не уходят во внешние API.</p>
          <ConnectorsPanel />
        </div>

        <div>
          <h2 className="font-semibold" style={{ fontSize: 15, marginBottom: 12 }}>Скоро</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {soon.map((s) => (
              <Card key={s.ab} ab={s.ab} name={s.name} type={s.type} desc={s.desc} pill={<Pill text="скоро" kind="soon" />} detail="позже" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
