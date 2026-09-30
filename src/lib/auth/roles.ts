export type Role = "owner" | "admin" | "marketer" | "viewer" | "pending";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  marketer: "Marketer",
  viewer: "Viewer",
  pending: "Awaiting access",
};

// Roles the owner can assign (owner itself is not granted through the UI).
export const ASSIGNABLE_ROLES: Role[] = ["admin", "marketer", "viewer"];

// Geo-restricted (countries required). owner/admin see everything.
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
