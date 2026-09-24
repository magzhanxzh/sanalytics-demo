// Запускается один раз при старте сервера Next.js.
// Поднимает фоновый прогрев кеша и проверку алертов по расписанию.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { warm } = await import("@/lib/warm");
  // Карта MMP (user_id -> канал) строится раз в сутки; экран AF-анализа отвечает из неё.
  const { maybeRefreshDailyAfMap } = await import("@/lib/appsflyer/regmap");
  // Доставка алертов: оцениваем правила и шлём сработавшие в Telegram (с антиспамом).
  const { runAlerts } = await import("@/lib/alerts/deliver");

  const INTERVAL_MS = 15 * 60 * 1000; // каждые 15 минут
  const ALERTS_MS = 30 * 60 * 1000;   // алерты раз в 30 минут

  // первый прогрев через 5 секунд после старта (даём серверу подняться)
  setTimeout(() => {
    void warm();
    void maybeRefreshDailyAfMap();
  }, 5_000);
  // первую проверку алертов – через минуту, когда кеш метрик уже тёплый
  setTimeout(() => { void runAlerts(); }, 60_000);

  setInterval(() => {
    void warm();
    void maybeRefreshDailyAfMap();
  }, INTERVAL_MS);
  setInterval(() => { void runAlerts(); }, ALERTS_MS);
}
