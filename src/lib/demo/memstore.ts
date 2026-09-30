// In-process memory store for the demo (instead of data/*.json and Supabase).
// Lives on globalThis so it survives HMR in dev; after a server restart
// it returns to the seeded demo content.
export function memStore<T>(key: string, seed: () => T): { get(): T; set(v: T): void } {
  const g = globalThis as unknown as Record<string, T | undefined>;
  const k = "__sanalytics_" + key;
  return {
    get() {
      if (g[k] === undefined) g[k] = seed();
      return g[k] as T;
    },
    set(v: T) {
      g[k] = v;
    },
  };
}
