"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  TIMEZONES, CURRENCIES, ATTRIBUTIONS, AI_MODELS,
  type Settings, type AiModel,
} from "@/lib/settings/types";

function Group({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="border border-line bg-surface rounded-xl overflow-hidden">
      <div className="border-b border-line" style={{ padding: "14px 18px" }}>
        <h2 className="font-semibold" style={{ fontSize: 14.5 }}>{title}</h2>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</p>
      </div>
      {children}
    </div>
  );
}

// Setting status: active now / reference only (no effect) / coming soon.
function Tag({ kind }: { kind: "on" | "info" | "soon" }) {
  const map = {
    on: { t: "active", bg: "var(--accent-soft)", c: "var(--accent)" },
    info: { t: "reference", bg: "var(--sunk)", c: "var(--muted)" },
    soon: { t: "soon", bg: "var(--sunk)", c: "var(--muted)" },
  }[kind];
  return <span className="mono" style={{ background: map.bg, color: map.c, fontSize: 10, padding: "2px 6px", borderRadius: 99 }}>{map.t}</span>;
}

function Row({ name, desc, tag, children }: { name: string; desc: string; tag?: "on" | "info" | "soon"; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-b border-line last:border-0" style={{ padding: "14px 18px" }}>
      <div className="flex-1">
        <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 500 }}>
          {name} {tag && <Tag kind={tag} />}
        </div>
        <div className="text-muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>{desc}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}
function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: (string | [string, string])[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="mono border border-line bg-surface rounded-[7px]" style={{ padding: "6px 11px", fontSize: 12.5 }}>
      {options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{l}</option>; })}
    </select>
  );
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: s }) }).catch(() => {});
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto flex flex-col" style={{ maxWidth: 840, gap: 18 }}>
      <div className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
        Labels: <Tag kind="on" /> affects the app right now; <Tag kind="info" /> is saved but not used in calculations yet; <Tag kind="soon" /> is coming later.
      </div>

      <Group title="Organization" sub="Reference details">
        <Row name="Name" tag="info" desc="Your organization name. Reference only for now, not used in calculations or export.">
          <input value={s.orgName} onChange={(e) => set("orgName", e.target.value)} className="border border-line bg-surface rounded-[7px]" style={{ padding: "6px 11px", fontSize: 13 }} />
        </Row>
        <Row name="Time zone" tag="info" desc="Time zone used to group days and weeks. Data marts are already computed in Almaty time (UTC+5); this choice does not override that yet.">
          <Sel value={s.timezone} onChange={(v) => set("timezone", v)} options={TIMEZONES} />
        </Row>
        <Row name="Report currency" tag="info" desc="Currency for displayed amounts. Amounts are shown in USD (as in the source); no currency conversion yet.">
          <Sel value={s.currency} onChange={(v) => set("currency", v)} options={CURRENCIES} />
        </Row>
      </Group>

      <Group title="Access" sub="People and sign-in">
        <Row name="Roles and geo access" tag="on" desc="Which countries each person sees and who can change settings, assigned per user in the Users block below (owner only). This is the active access system (RBAC).">
          <span className="text-muted" style={{ fontSize: 12 }}>see Users</span>
        </Row>
        <Row name="SSO" tag="soon" desc="Sign in with a company account (Google Workspace and similar). Not implemented yet, sign-in is by email and password.">
          <button onClick={() => set("sso", !s.sso)} disabled className="mono border rounded-[7px] disabled:opacity-60" style={{ padding: "6px 11px", fontSize: 12.5, borderColor: "var(--line)", background: "transparent", color: "var(--muted)", cursor: "not-allowed" }}>
            off
          </button>
        </Row>
      </Group>

      <Group title="Data model" sub="How metrics are computed">
        <Row name="Default revenue" tag="on" desc="What to show by default: all billed revenue (gross) or only paid orders. Applies to Marketing and Attribution unless another option is picked in the Revenue filter.">
          <Sel value={s.revenueBasis} onChange={(v) => set("revenueBasis", v as "gross" | "paid")} options={[["gross", "Gross"], ["paid", "Paid"]]} />
        </Row>
        <Row name="Attribution model" tag="soon" desc="How conversions are credited to ad channels (last click, first click, linear and so on). Takes effect in channel ROAS and CAC once ad accounts are connected.">
          <Sel value={s.attribution} onChange={(v) => set("attribution", v)} options={ATTRIBUTIONS} />
        </Row>
        <Row name="Conversion window" tag="soon" desc="How many days after a click or install an order is credited to ads. Applies to channel economics once ad accounts are connected. (In Attribution the window is set by the sign-up and order periods.)">
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={90} value={s.conversionWindowDays} onChange={(e) => set("conversionWindowDays", Number(e.target.value))} className="mono border border-line bg-surface rounded-[7px]" style={{ padding: "6px 10px", fontSize: 12.5, width: 64 }} />
            <span className="text-muted" style={{ fontSize: 12.5 }}>days</span>
          </div>
        </Row>
      </Group>

      <Group title="AI analyst" sub="Claude model for the AI analyst chat">
        <Row name="Model" tag="on" desc={`Affects the AI analyst chat: answer quality and cost. ${AI_MODELS.find((m) => m.value === s.aiModel)?.hint ?? ""}. Requires ANTHROPIC_API_KEY.`}>
          <Sel value={s.aiModel} onChange={(v) => set("aiModel", v as AiModel)} options={AI_MODELS.map((m) => [m.value, m.label] as [string, string])} />
        </Row>
      </Group>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="text-[color:var(--accent-ink)] disabled:opacity-60" style={{ background: "var(--accent)", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 500 }}>
          Save
        </button>
        {saved && <span className="text-pos flex items-center gap-1" style={{ fontSize: 12.5 }}><Check size={15} /> saved</span>}
      </div>
    </div>
  );
}
