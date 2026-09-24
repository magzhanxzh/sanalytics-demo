// Хранилище в памяти процесса для демо (вместо data/*.json и Supabase).
// Живёт в globalThis, поэтому переживает HMR в dev; после рестарта сервера
// возвращается к демо-содержимому из seed.
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
