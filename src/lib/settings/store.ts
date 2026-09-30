import "server-only";
import { defaultSettings, type Settings } from "./types";
import { memStore } from "@/lib/demo/memstore";

// Organization settings. In production: Supabase (per user), without Supabase: a file on the server.
// In the demo: process memory.
const settings = memStore<Settings>("settings", defaultSettings);

export async function getSettings(): Promise<Settings> {
  return { ...defaultSettings(), ...settings.get() };
}

export async function saveSettings(s: Settings): Promise<Settings> {
  const merged = { ...defaultSettings(), ...s };
  settings.set(merged);
  return merged;
}
