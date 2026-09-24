import "server-only";
import { memStore } from "@/lib/demo/memstore";
import { CURRENT_USER } from "@/lib/dashboards/types";
import type { Role, UserProfile } from "./roles";

// Роли и гео-доступ (RBAC). В продакшене профиль берётся из Supabase (profiles.role +
// profiles.countries, RLS), здесь та же модель, но пользователи демо лежат в памяти, а
// текущий пользователь всегда владелец (авторизация в демо выключена).

const users = memStore<UserProfile[]>("users", () => [
  { id: "usr_owner", email: CURRENT_USER, role: "owner", countries: [], created_at: "2025-01-10T09:00:00Z" },
  { id: "usr_anna", email: "anna@example.com", role: "admin", countries: [], created_at: "2025-02-03T10:20:00Z" },
  { id: "usr_timur", email: "timur@example.com", role: "marketer", countries: ["KZ", "KG"], created_at: "2025-04-18T12:05:00Z" },
  { id: "usr_dilnoza", email: "dilnoza@example.com", role: "marketer", countries: ["UZ"], created_at: "2025-06-02T08:40:00Z" },
  { id: "usr_guest", email: "guest@example.com", role: "pending", countries: [], created_at: "2026-09-01T15:30:00Z" },
]);

export function listUsers(): UserProfile[] {
  return users.get();
}
export function updateUser(id: string, role: Role, countries: string[]): boolean {
  const all = users.get();
  if (!all.some((u) => u.id === id && u.role !== "owner")) return false;
  users.set(all.map((u) => (u.id === id ? { ...u, role, countries } : u)));
  return true;
}

// Профиль текущего пользователя (роль + разрешённые страны).
export async function getCurrentProfile(): Promise<UserProfile | null> {
  return users.get().find((u) => u.email === CURRENT_USER) ?? null;
}

// Гео-ограничение: возвращает страну, которую пользователю разрешено смотреть.
// owner/admin – любую. marketer/viewer – только из своего списка; иначе '__none__' (нет данных).
export async function enforceCountry(requested: string): Promise<string> {
  const p = await getCurrentProfile();
  if (!p) return requested; // нет сессии (например прогрев кеша) – без ограничений
  if (p.role === "owner" || p.role === "admin") return requested;
  const allowed = p.countries ?? [];
  if (allowed.length === 0) return "__none__"; // доступ ещё не выдан
  if (requested !== "all" && allowed.includes(requested)) return requested;
  return allowed[0]; // ограничиваем первым разрешённым
}

export async function isOwner(): Promise<boolean> {
  return (await getCurrentProfile())?.role === "owner";
}

// Список разрешённых стран пользователя для разбивок «по странам».
// null – без ограничений (owner/admin или нет сессии/прогрев); [] – доступа нет.
export async function allowedCountries(): Promise<string[] | null> {
  const p = await getCurrentProfile();
  if (!p) return null;
  if (p.role === "owner" || p.role === "admin") return null;
  return p.countries ?? [];
}

export function roleOf(p: UserProfile | null): Role {
  return p?.role ?? "pending";
}

// Кто может менять подключения к источникам данных: владелец или админ.
export async function canManageConnections(): Promise<boolean> {
  const p = await getCurrentProfile();
  return p?.role === "owner" || p?.role === "admin";
}
