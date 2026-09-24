import "server-only";
import { emptyAfConfig, type AfConfig, type AfSync } from "./types";
import { memStore } from "@/lib/demo/memstore";
import { demoAfAggregate } from "@/lib/demo/ads";

// Конфиг AppsFlyer (токен + приложения) и последняя выгрузка. Токен в браузер не отдаётся.
// В продакшене хранится в файле на сервере; в демо это память процесса с демо-приложениями.

const config = memStore<AfConfig>("af_config", () => ({
  token: "demo",
  apps: [
    { id: "com.example.shop", platform: "android" },
    { id: "id000000001", platform: "ios" },
  ],
  timezone: "Asia/Almaty",
}));

const lastSync = memStore<AfSync | null>("af_last_sync", () => {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  return demoAfAggregate(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
});

export async function getAfConfig(): Promise<AfConfig> {
  return config.get();
}

export async function saveAfConfig(c: AfConfig): Promise<AfConfig> {
  const merged = { ...emptyAfConfig(), ...c };
  config.set(merged);
  return merged;
}

export async function getLastSync(): Promise<AfSync | null> {
  return lastSync.get();
}

export async function saveLastSync(s: AfSync): Promise<void> {
  lastSync.set(s);
}
