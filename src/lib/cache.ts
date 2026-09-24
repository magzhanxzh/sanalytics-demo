import "server-only";

// Кеш результатов метрик + лог обновлений. В памяти процесса (в globalThis, чтобы
// переживать HMR в dev). В продакшене кеш дополнительно персистится в файл на сервере,
// чтобы переживать рестарт; в демо данные синтетические и считаются заново за миллисекунды.
// Почему не общий кеш в Supabase: прогрев идёт без пользовательской сессии, а общий кеш,
// читаемый любым залогиненным, обошёл бы гео-ограничения ролей.

export const TTL_MS = 10 * 60 * 1000; // свежесть кеша 10 минут

type Entry<T> = { data: T; at: number };

export type RunRecord = {
  at: number;
  label: string; // человекочитаемый срез
  kind: "cards" | "daily";
  ms: number; // длительность
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
