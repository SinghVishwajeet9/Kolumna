// The sprint's burndown as plain SVG — four lines on one scale: the ideal
// pace, points remaining, and the burn-up of points done by humans and by
// agents. Future days have null values and simply aren't drawn.

export type Day = { date: string; ideal: number; remaining: number | null; doneHuman: number | null; doneAgent: number | null };

const W = 760;
const H = 240;
const PAD = { top: 12, right: 12, bottom: 26, left: 34 };

export function Burndown({ days, scope }: { days: Day[]; scope: number }) {
  if (days.length === 0) return null;
  const max = Math.max(1, scope);
  const x = (i: number) => PAD.left + (i / Math.max(1, days.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const path = (get: (d: Day) => number | null) =>
    days
      .map((d, i) => [i, get(d)] as const)
      .filter(([, v]) => v !== null)
      .map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v!).toFixed(1)}`)
      .join(" ");
  const ticks = [0, Math.round(max / 2), max];
  const labelEvery = Math.max(1, Math.ceil(days.length / 7));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Sprint burndown">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.07)" />
          <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#9a9a9a" fontFamily="var(--font-mono)">
            {t}
          </text>
        </g>
      ))}
      {days.map((d, i) =>
        i % labelEvery === 0 || i === days.length - 1 ? (
          <text key={d.date} x={x(i)} y={H - 6} textAnchor={i === days.length - 1 ? "end" : i === 0 ? "start" : "middle"} fontSize="11" fill="#9a9a9a" fontFamily="var(--font-mono)">
            {d.date.slice(5)}
          </text>
        ) : null,
      )}
      <path d={path((d) => d.ideal)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeDasharray="5 5" />
      <path d={path((d) => d.doneHuman)} fill="none" stroke="#7dd3fc" strokeWidth="2" />
      <path d={path((d) => d.doneAgent)} fill="none" stroke="#5af7b3" strokeWidth="2" />
      <path d={path((d) => d.remaining)} fill="none" stroke="#ffffff" strokeWidth="2.25" />
      {/* A dot on each line's latest point — on day one a line is just that dot. */}
      {(
        [
          ["doneHuman", "#7dd3fc"],
          ["doneAgent", "#5af7b3"],
          ["remaining", "#ffffff"],
        ] as const
      ).map(([key, color]) => {
        const i = days.findLastIndex((d) => d[key] !== null);
        return i === -1 ? null : <circle key={key} cx={x(i)} cy={y(days[i]![key]!)} r="3.5" fill={color} />;
      })}
    </svg>
  );
}
