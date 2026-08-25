// Traced from kolumnalogowhite.png: five equal-height bars, alternating
// low / high / low / high / low. That alternation is the brand's core
// rhythm — it gets reused as a motif across the marketing page.

export function LogoMark({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 100 60"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <rect x="0" y="14" width="16" height="46" />
      <rect x="21" y="0" width="16" height="46" />
      <rect x="42" y="14" width="16" height="46" />
      <rect x="63" y="0" width="16" height="46" />
      <rect x="84" y="14" width="16" height="46" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-4 w-[26px]" />
      <span className="text-[16px] font-semibold tracking-[0.14em]">KOLUMNA</span>
    </span>
  );
}
