import { getCards, getDaily } from "@/lib/metrics";
import { defaultFilters } from "@/lib/queries/cards";

let running = false;
let lastWarmAt = 0;

export function getLastWarmAt(): number {
  return lastWarmAt;
}

// Warm the default slice (KZ, last 7 days), the most frequent and heaviest one.
// Compute it with period comparison and cache it so the first visit is instant.
export async function warm(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const f = defaultFilters();
    await Promise.all([
      getCards(f, { force: true, source: "schedule" }),
      getDaily(f, { force: true, source: "schedule" }),
    ]);
    lastWarmAt = Date.now();
  } catch {
    // errors are already logged in getCards/getDaily
  } finally {
    running = false;
  }
}
