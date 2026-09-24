// Демо-режим. По умолчанию приложение не делает ни одного внешнего запроса:
// рекламные кабинеты, MMP и Telegram отвечают синтетикой.
// SANALYTICS_LIVE_CONNECTORS=1 включает настоящие API-клиенты
// (src/lib/connectors/providers.ts, src/lib/appsflyer/pull.ts) для кредов, введённых в UI.
export function liveConnectors(): boolean {
  return process.env.SANALYTICS_LIVE_CONNECTORS === "1";
}
