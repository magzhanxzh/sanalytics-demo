"use client";

import { useEffect, useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { COUNTRIES } from "@/lib/queries/cards";
import { ROLE_LABELS, ASSIGNABLE_ROLES, isGeoRestricted, type Role, type UserProfile } from "@/lib/auth/roles";

const REAL_COUNTRIES = COUNTRIES.filter((c) => c.code !== "all");

export function UsersManager() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/users").then((x) => x.json()).catch(() => ({ users: [] }));
    setUsers(r.users ?? []);
  }
  useEffect(() => { load(); }, []);

  function patch(id: string, p: Partial<UserProfile>) {
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, ...p } : u)));
  }
  async function save(u: UserProfile) {
    setSavingId(u.id);
    await fetch("/api/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, role: u.role, countries: u.countries }) }).catch(() => {});
    setSavingId(null);
    setSavedId(u.id);
    setTimeout(() => setSavedId((x) => (x === u.id ? null : x)), 1500);
  }
  function toggleCountry(u: UserProfile, code: string) {
    const has = u.countries.includes(code);
    patch(u.id, { countries: has ? u.countries.filter((c) => c !== code) : [...u.countries, code] });
  }

  const pending = users.filter((u) => u.role === "pending");

  return (
    <div className="border border-line bg-surface rounded-xl overflow-hidden">
      <div className="border-b border-line" style={{ padding: "14px 18px" }}>
        <h2 className="font-semibold" style={{ fontSize: 14.5 }}>Пользователи и доступы</h2>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>Только владелец назначает роли и страны. Маркетолог/Наблюдатель видят только свои страны.</p>
      </div>

      {pending.length > 0 && (
        <div className="flex items-center gap-2" style={{ padding: "10px 18px", background: "var(--accent-soft)", borderBottom: "1px solid var(--line)" }}>
          <UserPlus size={15} className="text-accent" />
          <span style={{ fontSize: 12.5, color: "var(--accent)" }}>
            {pending.length} {pending.length === 1 ? "новый пользователь" : "новых пользователей"} ждут назначения доступа
          </span>
        </div>
      )}

      {users.length === 0 && <div className="text-muted" style={{ padding: "18px", fontSize: 13 }}>Пользователей пока нет.</div>}

      {users.map((u) => {
        const restricted = isGeoRestricted(u.role);
        const isPending = u.role === "pending";
        const isOwnerRow = u.role === "owner";
        return (
          <div key={u.id} className="border-b border-line last:border-0" style={{ padding: "14px 18px", background: isPending ? "var(--sunk)" : undefined }}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="mono flex items-center justify-center bg-sunk border border-line shrink-0" style={{ width: 30, height: 30, borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{u.email[0]?.toUpperCase()}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>{u.email}{isPending && <span className="text-accent" style={{ fontSize: 11.5 }}> · новый</span>}</div>
                <div className="text-muted" style={{ fontSize: 11.5 }}>{ROLE_LABELS[u.role]}</div>
              </div>

              {isOwnerRow ? (
                <span className="mono text-muted" style={{ fontSize: 12 }}>Владелец (вы)</span>
              ) : (
                <>
                  <select value={ASSIGNABLE_ROLES.includes(u.role) ? u.role : "viewer"} onChange={(e) => patch(u.id, { role: e.target.value as Role })} className="border border-line bg-surface rounded-[7px]" style={{ padding: "6px 9px", fontSize: 12.5 }}>
                    {isPending && <option value="pending" disabled>– выберите роль –</option>}
                    {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <button onClick={() => save(u)} disabled={savingId === u.id} className="text-[color:var(--accent-ink)] disabled:opacity-60" style={{ background: "var(--accent)", borderRadius: 7, padding: "6px 12px", fontSize: 12.5, fontWeight: 500 }}>
                    {savedId === u.id ? <Check size={14} /> : "Сохранить"}
                  </button>
                </>
              )}
            </div>

            {!isOwnerRow && restricted && (
              <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 10, paddingLeft: 42 }}>
                <span className="text-muted" style={{ fontSize: 11.5 }}>Доступ к странам:</span>
                {REAL_COUNTRIES.map((c) => {
                  const on = u.countries.includes(c.code);
                  return (
                    <button key={c.code} onClick={() => toggleCountry(u, c.code)} className="border transition-colors" style={{ borderRadius: 7, padding: "4px 9px", fontSize: 12, borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent)" : "var(--muted)" }}>
                      {c.label}
                    </button>
                  );
                })}
                {u.countries.length === 0 && <span className="text-neg" style={{ fontSize: 11.5 }}>не выбрано – доступа нет</span>}
              </div>
            )}
            {!isOwnerRow && !restricted && u.role !== "pending" && (
              <div className="text-muted" style={{ fontSize: 11.5, marginTop: 8, paddingLeft: 42 }}>Полный доступ ко всем странам.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
