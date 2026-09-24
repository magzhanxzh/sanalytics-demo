// Знак Sanalytics: четыре столбца-бара (последний короткий – «данные ещё идут»).
// Рамка и короткие столбцы – --ink, два высоких – --accent. Меняется с темой.
// Геометрия из brand/logo-mark-mono.svg.
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label="Sanalytics" role="img" style={{ display: "block" }}>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="7" stroke="var(--ink)" strokeWidth="1.5" />
      <rect x="9" y="22" width="3" height="9" rx="1.5" fill="var(--ink)" />
      <rect x="15" y="17" width="3" height="14" rx="1.5" fill="var(--ink)" />
      <rect x="21" y="11" width="3" height="20" rx="1.5" fill="var(--accent)" />
      <rect x="27" y="9" width="3" height="4" rx="1.5" fill="var(--accent)" />
    </svg>
  );
}
