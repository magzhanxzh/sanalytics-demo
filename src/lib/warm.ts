import { getCards, getDaily } from "@/lib/metrics";
import { defaultFilters } from "@/lib/queries/cards";

let running = false;
let lastWarmAt = 0;

export function getLastWarmAt(): number {
  return lastWarmAt;
}

// Прогреваем дефолтный срез (KZ, последние 7 дней) - самый частый и самый тяжёлый.
// Считаем со сравнением периодов и кладём в кеш, чтобы заход был мгновенным.
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
    // ошибки уже залогированы в getCards/getDaily
  } finally {
    running = false;
  }
}
