import "server-only";

// Metric results cache + refresh log. In process memory (on globalThis so it
// survives HMR in dev). In production the cache is also persisted to a file on the server
// to survive restarts; in the demo data is synthetic and recomputes in milliseconds.
// Why not a shared Supabase cache: warm-up runs without a user session, and a shared cache
// readable by any signed-in user would bypass role geo restrictions.

export const TTL_MS = 10 * 60 * 1000; // cache freshness 10 minutes

type Entry<T> = { data: T; at: number };

export type RunRecord = {
  at: number;
  label: string; // human-readable slice
  kind: "cards" | "daily";
  ms: number; // duration
  ok: boolean;
  source: "request" | "schedule";
};

const g = globalThis as unknown as { __sanalyticsCache?: { store: Map<string, Entry<unknown>>; runs: RunRecord[] } };
g.__sanalyticsCache ??= { store: new Map(), runs: [] };
const store = g.__sanalyticsCache.store;
const runs = g.__sanalyticsCache.runs;

export function cacheGet<T>(key: string): Entry<T> | undefined {
  return store.get(key) as Entry<T> | undefined;
}
export function cacheSet<T>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
}
export function isFresh(at: number): boolean {
  return Date.now() - at < TTL_MS;
}
export function cacheEntries(): { key: string; at: number }[] {
  return [...store.entries()].map(([key, e]) => ({ key, at: e.at }));
}

export function logRun(r: RunRecord): void {
  runs.unshift(r);
  if (runs.length > 200) runs.pop();
}
export function getRuns(limit = 50): RunRecord[] {
  return runs.slice(0, limit);
}
