// Same shape as the reference's "Designed for / Work horizon / Built for"
// row — a small uppercase label over a value, split by thin dividers.
// Grounded in what Kolumna actually does, not invented metrics.
const stats = [
  { label: "Designed for", value: "Small, fast teams" },
  { label: "Task style", value: "Epics → subtasks" },
  { label: "Built for", value: "Multi-tenant boards" },
];

export function HeroStats() {
  return (
    <div className="mt-14 flex flex-wrap items-start justify-center gap-x-10 gap-y-6">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={i > 0 ? "border-line pl-10 text-left sm:border-l" : "text-left"}
        >
          <p
            className="text-[13px] uppercase text-faint"
            style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}
          >
            {stat.label}
          </p>
          <p className="mt-1.5 text-[17px] text-fg">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
