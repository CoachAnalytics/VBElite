/** Tiny win-% trend on a fixed 0–100% scale so rows are comparable. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const w = 64;
  const h = 20;
  const pad = 3;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (values.length - 1);
  const y = (v: number) => h - pad - v * (h - 2 * pad);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg width={w} height={h} role="img" aria-label={label} className="inline-block align-middle">
      <title>{label}</title>
      <polyline points={points} fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={2.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1} />
    </svg>
  );
}
