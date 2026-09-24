import "server-only";
import { specOf, type AdAccount, type AdAccountView, type AdProvider } from "./types";
import { memStore } from "@/lib/demo/memstore";

// Рекламные кабинеты по странам: несколько на площадку. Секреты хранятся на сервере,
// наружу не отдаются (viewOf). В продакшене список лежит в файле на сервере;
// в демо это память процесса с заранее заведёнными кабинетами.

const DEMO_FIELDS: Record<AdProvider, Record<string, string>> = {
  meta_ads: { account_id: "act_0000000001", access_token: "demo" },
  google_ads: { customer_id: "1000000001", developer_token: "demo", client_id: "demo-client", client_secret: "demo", refresh_token: "demo" },
  tiktok_ads: { advertiser_id: "7000000000000000001", access_token: "demo" },
  yandex_ads: { login: "demo-shop", oauth_token: "demo" },
};
const DEMO_ACCOUNTS: [AdProvider, string][] = [
  ["google_ads", "KZ"], ["meta_ads", "KZ"], ["tiktok_ads", "KZ"], ["yandex_ads", "KZ"],
  ["google_ads", "UZ"], ["meta_ads", "UZ"], ["tiktok_ads", "UZ"],
  ["meta_ads", "KG"], ["tiktok_ads", "KG"],
];

const accounts = memStore<AdAccount[]>("ad_accounts", () =>
  DEMO_ACCOUNTS.map(([provider, country], i) => ({
    id: "adacc_demo" + (i + 1), provider, country, label: "Demo " + country, enabled: true, fields: { ...DEMO_FIELDS[provider] },
  })),
);

async function readAll(): Promise<AdAccount[]> {
  return accounts.get();
}
async function writeAll(list: AdAccount[]): Promise<void> {
  accounts.set(list);
}

function isConfigured(a: AdAccount): boolean {
  const spec = specOf(a.provider);
  if (!spec) return false;
  return spec.fields.every((f) => f.optional || Boolean(a.fields[f.key]));
}

export function viewOf(a: AdAccount): AdAccountView {
  const spec = specOf(a.provider)!;
  const fields: Record<string, string> = {};
  const secretsSet: Record<string, boolean> = {};
  for (const f of spec.fields) {
    if (f.secret) secretsSet[f.key] = Boolean(a.fields[f.key]);
    else fields[f.key] = a.fields[f.key] ?? "";
  }
  return { id: a.id, provider: a.provider, country: a.country, label: a.label, enabled: a.enabled, configured: isConfigured(a), fields, secretsSet };
}

export async function listAccounts(): Promise<AdAccount[]> {
  return readAll();
}
export async function listAccountViews(): Promise<AdAccountView[]> {
  return (await readAll()).map(viewOf);
}
export async function getAccount(id: string): Promise<AdAccount | undefined> {
  return (await readAll()).find((a) => a.id === id);
}

// Создать/обновить. Секреты: пустое значение = «оставить как было» (не затираем).
export async function upsertAccount(input: {
  id?: string; provider: AdProvider; country: string; label?: string; enabled?: boolean; fields?: Record<string, string>;
}): Promise<AdAccount> {
  const spec = specOf(input.provider);
  if (!spec) throw new Error("Неизвестная площадка: " + input.provider);
  const all = await readAll();
  const idx = input.id ? all.findIndex((a) => a.id === input.id) : -1;
  const cur: AdAccount = idx >= 0 ? all[idx] : { id: "adacc_" + Math.random().toString(36).slice(2, 10), provider: input.provider, country: input.country, enabled: false, fields: {} };
  const fields = { ...cur.fields };
  if (input.fields) {
    for (const f of spec.fields) {
      const incoming = input.fields[f.key];
      if (incoming === undefined) continue;
      if (f.secret && incoming === "") continue; // пустой секрет -> не менять
      fields[f.key] = incoming.trim();
    }
  }
  const next: AdAccount = {
    id: cur.id, provider: input.provider, country: input.country || cur.country,
    label: input.label ?? cur.label, enabled: input.enabled ?? cur.enabled, fields,
  };
  if (idx >= 0) all[idx] = next; else all.push(next);
  await writeAll(all);
  return next;
}

export async function removeAccount(id: string): Promise<void> {
  await writeAll((await readAll()).filter((a) => a.id !== id));
}
