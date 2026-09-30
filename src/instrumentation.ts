// Runs once when the Next.js server starts.
// Starts background cache warm-up and scheduled alert checks.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { warm } = await import("@/lib/warm");
  // The MMP map (user_id -> channel) is built once a day; the Attribution screen answers from it.
  const { maybeRefreshDailyAfMap } = await import("@/lib/appsflyer/regmap");
  // Alert delivery: evaluate rules and send the fired ones to Telegram (with anti-spam).
  const { runAlerts } = await import("@/lib/alerts/deliver");

  const INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes
  const ALERTS_MS = 30 * 60 * 1000;   // alerts every 30 minutes

  // first warm-up 5 seconds after start (let the server come up)
  setTimeout(() => {
    void warm();
    void maybeRefreshDailyAfMap();
  }, 5_000);
  // first alert check after a minute, when the metrics cache is already warm
  setTimeout(() => { void runAlerts(); }, 60_000);

  setInterval(() => {
    void warm();
    void maybeRefreshDailyAfMap();
  }, INTERVAL_MS);
  setInterval(() => { void runAlerts(); }, ALERTS_MS);
}
