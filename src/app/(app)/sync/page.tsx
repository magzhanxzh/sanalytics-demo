import { AppHeader } from "@/components/AppHeader";
import { getRuns, cacheEntries, TTL_MS } from "@/lib/cache";
import { getLastWarmAt } from "@/lib/warm";

export const dynamic = "force-dynamic";

function timeStr(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s} sec`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.round(m / 60)} h`;
}

export default function Page() {
  const runs = getRuns(50);
  const entries = cacheEntries();
  const lastWarm = getLastWarmAt();
  const day = runs.filter((r) => Date.now() - r.at < 86_400_000);
  const ok = day.filter((r) => r.ok).length;
  const err = day.filter((r) => !r.ok).length;

  const stats = [
    { l: "Last load", v: lastWarm ? ago(lastWarm) : "–" },
    { l: "Successful, 24h", v: String(ok) },
    { l: "Errors", v: String(err) },
    { l: "Warm slices", v: String(entries.length) },
  ];

  return (
    <>
      <AppHeader title="Sync" subtitle={`warm-up every 15 min · cache ${Math.round(TTL_MS / 60000)} min`} />
      <div style={{ padding: "22px 28px 60px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Stats strip */}
        <div className="border border-line bg-surface rounded-xl overflow-hidden">
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {stats.map((s, i) => (
              <div key={s.l} style={{ padding: "16px 18px 14px", borderLeft: i === 0 ? undefined : "1px solid var(--line)" }}>
                <div className="text-muted" style={{ fontSize: 12 }}>{s.l}</div>
                <div className="mono" style={{ fontSize: 22, marginTop: 7 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Job log */}
        <div className="border border-line bg-surface rounded-xl overflow-hidden">
          <div className="border-b border-line" style={{ padding: "14px 18px" }}>
            <h2 className="font-semibold" style={{ fontSize: 14.5 }}>Job log</h2>
          </div>
          <div className="grid text-muted" style={{ gridTemplateColumns: "minmax(0,0.6fr) minmax(0,1.8fr) minmax(0,0.7fr) minmax(0,0.6fr) minmax(0,0.7fr)", padding: "10px 18px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <span>Time</span><span>Slice</span><span>Type</span><span>Duration</span><span className="justify-self-end">Status</span>
          </div>
          {runs.length === 0 && <div className="text-muted" style={{ padding: "14px 18px", fontSize: 13 }}>Nothing yet. Open Marketing and jobs will appear.</div>}
          {runs.map((r, i) => (
            <div key={i} className="grid items-center border-t border-line" style={{ gridTemplateColumns: "minmax(0,0.6fr) minmax(0,1.8fr) minmax(0,0.7fr) minmax(0,0.6fr) minmax(0,0.7fr)", padding: "12px 18px" }}>
              <span className="mono text-muted" style={{ fontSize: 12.5 }}>{timeStr(r.at)}</span>
              <span className="text-ink-2 truncate" style={{ fontSize: 12.5 }}>{r.label}</span>
              <span className="mono text-muted" style={{ fontSize: 12.5 }}>{r.kind === "cards" ? "cards" : "chart"}</span>
              <span className="mono text-muted" style={{ fontSize: 12.5 }}>{(r.ms / 1000).toFixed(1)} s</span>
              <span className="mono justify-self-end" style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 99, background: r.ok ? "var(--accent-soft)" : "oklch(0.93 0.05 28)", color: r.ok ? "var(--accent)" : "var(--neg)" }}>
                {r.ok ? "done" : "error"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
