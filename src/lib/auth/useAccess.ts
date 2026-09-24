"use client";

import { useEffect, useState } from "react";
import { COUNTRIES } from "@/lib/queries/cards";

// allowed === null -> все страны (владелец/админ).
// allowed === [...] -> только эти страны (маркетолог/наблюдатель). [] -> доступа нет.
export type Access = { loading: boolean; allowed: string[] | null; role: string | null; canManage: boolean };

export function useAccess(): Access {
  const [state, setState] = useState<Access>({ loading: true, allowed: null, role: null, canManage: false });
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        const role = (d.role ?? null) as string | null;
        const restricted = role === "marketer" || role === "viewer";
        const canManage = role === "owner" || role === "admin";
        setState({ loading: false, allowed: restricted ? (d.countries ?? []) : null, role, canManage });
      })
      .catch(() => setState({ loading: false, allowed: null, role: null, canManage: false }));
  }, []);
  return state;
}

// Опции стран для выпадашки с учётом прав. Ограниченному – только его страны (без «Все»).
export function countryOptions(allowed: string[] | null): [string, string][] {
  if (allowed === null) return COUNTRIES.map((c) => [c.code, c.label]);
  return COUNTRIES.filter((c) => c.code !== "all" && allowed.includes(c.code)).map((c) => [c.code, c.label]);
}
