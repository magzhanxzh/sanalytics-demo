// Demo mode. By default the app makes no external requests:
// ad accounts, the MMP and Telegram return synthetic data.
// SANALYTICS_LIVE_CONNECTORS=1 enables the real API clients
// (src/lib/connectors/providers.ts, src/lib/appsflyer/pull.ts) for credentials entered in the UI.
export function liveConnectors(): boolean {
  return process.env.SANALYTICS_LIVE_CONNECTORS === "1";
}
