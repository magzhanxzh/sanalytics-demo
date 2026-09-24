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

// Статус настройки: работает сейчас / справочно (не влияет) / скоро.
function Tag({ kind }: { kind: "on" | "info" | "soon" }) {
  const map = {
    on: { t: "работает", bg: "var(--accent-soft)", c: "var(--accent)" },
    info: { t: "справочно", bg: "var(--sunk)", c: "var(--muted)" },
    soon: { t: "скоро", bg: "var(--sunk)", c: "var(--muted)" },
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
        Метки: <Tag kind="on" /> – влияет на приложение прямо сейчас; <Tag kind="info" /> – сохраняется, но пока не участвует в расчётах; <Tag kind="soon" /> – появится позже.
      </div>

      <Group title="Организация" sub="Справочные реквизиты">
        <Row name="Название" tag="info" desc="Название вашей организации. Пока справочно – в расчёты и экспорт не подставляется.">
          <input value={s.orgName} onChange={(e) => set("orgName", e.target.value)} className="border border-line bg-surface rounded-[7px]" style={{ padding: "6px 11px", fontSize: 13 }} />
        </Row>
        <Row name="Часовой пояс" tag="info" desc="В каком поясе группировать дни и недели. Сейчас витрины уже считаются по Алматы (+5); этот выбор пока не переопределяет расчёт.">
          <Sel value={s.timezone} onChange={(v) => set("timezone", v)} options={TIMEZONES} />
        </Row>
        <Row name="Валюта отчётов" tag="info" desc="Валюта отображения сумм. Сейчас суммы показываются в долларах (как в источнике); конвертация валют пока не делается.">
          <Sel value={s.currency} onChange={(v) => set("currency", v)} options={CURRENCIES} />
        </Row>
      </Group>

      <Group title="Доступы" sub="Управление людьми и входом">
        <Row name="Роли и гео-доступ" tag="on" desc="Кто какие страны видит и кто может менять настройки – назначается каждому пользователю в блоке «Пользователи» ниже (только владелец). Это активная система доступа (RBAC).">
          <span className="text-muted" style={{ fontSize: 12 }}>см. «Пользователи»</span>
        </Row>
        <Row name="SSO (единый вход)" tag="soon" desc="Вход через корпоративный аккаунт (Google Workspace и т.п.). Пока не реализован – вход по email и паролю.">
          <button onClick={() => set("sso", !s.sso)} disabled className="mono border rounded-[7px] disabled:opacity-60" style={{ padding: "6px 11px", fontSize: 12.5, borderColor: "var(--line)", background: "transparent", color: "var(--muted)", cursor: "not-allowed" }}>
            выключено
          </button>
        </Row>
      </Group>

      <Group title="Модель данных" sub="Как считаются метрики">
        <Row name="Выручка по умолчанию" tag="on" desc="Что показывать по умолчанию: всю выставленную выручку (валовая) или только оплаченные заказы. Применяется к Маркетингу и AF-анализу, пока вручную не выбран другой вариант в фильтре «Выручка».">
          <Sel value={s.revenueBasis} onChange={(v) => set("revenueBasis", v as "gross" | "paid")} options={[["gross", "Валовая"], ["paid", "Оплачено"]]} />
        </Row>
        <Row name="Модель атрибуции" tag="soon" desc="Как приписывать конверсию рекламным каналам (последний клик, первый клик, линейная и т.д.). Заработает после подключения рекламных кабинетов – в расчёте ROAS/CAC по каналам.">
          <Sel value={s.attribution} onChange={(v) => set("attribution", v)} options={ATTRIBUTIONS} />
        </Row>
        <Row name="Окно конверсии" tag="soon" desc="Сколько дней после клика/установки засчитывать заказ рекламе. Применится в экономике по каналам после подключения кабинетов. (В AF-анализе окно задаётся периодами регистрации и заказа.)">
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={90} value={s.conversionWindowDays} onChange={(e) => set("conversionWindowDays", Number(e.target.value))} className="mono border border-line bg-surface rounded-[7px]" style={{ padding: "6px 10px", fontSize: 12.5, width: 64 }} />
            <span className="text-muted" style={{ fontSize: 12.5 }}>дней</span>
          </div>
        </Row>
      </Group>

      <Group title="ИИ-аналитик" sub="Модель Claude для чата на экране «ИИ-аналитик»">
        <Row name="Модель" tag="on" desc={`Влияет на чат ИИ-аналитика: качество и цену ответов. ${AI_MODELS.find((m) => m.value === s.aiModel)?.hint ?? ""}. Нужен ключ ANTHROPIC_API_KEY.`}>
          <Sel value={s.aiModel} onChange={(v) => set("aiModel", v as AiModel)} options={AI_MODELS.map((m) => [m.value, m.label] as [string, string])} />
        </Row>
      </Group>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="text-[color:var(--accent-ink)] disabled:opacity-60" style={{ background: "var(--accent)", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 500 }}>
          Сохранить
        </button>
        {saved && <span className="text-pos flex items-center gap-1" style={{ fontSize: 12.5 }}><Check size={15} /> сохранено</span>}
      </div>
    </div>
  );
}
