export type Role = "owner" | "admin" | "marketer" | "viewer" | "pending";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Владелец",
  admin: "Администратор",
  marketer: "Маркетолог",
  viewer: "Наблюдатель",
  pending: "Ожидает доступа",
};

// Роли, которые владелец может назначать (себя-владельца не выдаём через UI).
export const ASSIGNABLE_ROLES: Role[] = ["admin", "marketer", "viewer"];

// Ограничены по гео (страны обязательны). owner/admin видят всё.
export function isGeoRestricted(role: Role): boolean {
  return role === "marketer" || role === "viewer";
}

export type UserProfile = {
  id: string;
  email: string;
  role: Role;
  countries: string[];
  created_at?: string;
};
