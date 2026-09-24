import "server-only";
import { defaultSettings, type Settings } from "./types";
import { memStore } from "@/lib/demo/memstore";

// Настройки организации. В продакшене: Supabase (per-user), без Supabase: файл на сервере.
// В демо: память процесса.
const settings = memStore<Settings>("settings", defaultSettings);

export async function getSettings(): Promise<Settings> {
  return { ...defaultSettings(), ...settings.get() };
}

export async function saveSettings(s: Settings): Promise<Settings> {
  const merged = { ...defaultSettings(), ...s };
  settings.set(merged);
  return merged;
}
