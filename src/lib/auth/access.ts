import "server-only";
import { memStore } from "@/lib/demo/memstore";
import { CURRENT_USER } from "@/lib/dashboards/types";
import type { Role, UserProfile } from "./roles";

// Roles and geo access (RBAC). In production the profile comes from Supabase (profiles.role +
// profiles.countries, RLS); here it is the same model, but demo users live in memory and
// the current user is always the owner (auth is disabled in the demo).

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

// Current user profile (role + allowed countries).
export async function getCurrentProfile(): Promise<UserProfile | null> {
  return users.get().find((u) => u.email === CURRENT_USER) ?? null;
}

// Geo restriction: returns the country the user is allowed to see.
// owner/admin: any. marketer/viewer: only from their list; otherwise '__none__' (no data).
export async function enforceCountry(requested: string): Promise<string> {
  const p = await getCurrentProfile();
  if (!p) return requested; // no session (e.g. cache warm-up), no restriction
  if (p.role === "owner" || p.role === "admin") return requested;
  const allowed = p.countries ?? [];
  if (allowed.length === 0) return "__none__"; // access not granted yet
  if (requested !== "all" && allowed.includes(requested)) return requested;
  return allowed[0]; // clamp to the first allowed one
}

export async function isOwner(): Promise<boolean> {
  return (await getCurrentProfile())?.role === "owner";
}

// The user's allowed countries for "by country" breakdowns.
// null means no restriction (owner/admin or no session/warm-up); [] means no access.
export async function allowedCountries(): Promise<string[] | null> {
  const p = await getCurrentProfile();
  if (!p) return null;
  if (p.role === "owner" || p.role === "admin") return null;
  return p.countries ?? [];
}

export function roleOf(p: UserProfile | null): Role {
  return p?.role ?? "pending";
}

// Who can change data source connections: the owner or an admin.
export async function canManageConnections(): Promise<boolean> {
  const p = await getCurrentProfile();
  return p?.role === "owner" || p?.role === "admin";
}
