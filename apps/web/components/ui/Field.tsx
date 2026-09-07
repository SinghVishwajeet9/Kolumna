// On-brand text field: Departure Mono label over a dark surface input with
// an accent focus ring. Matches the marketing design language so the auth
// and app forms read as the same product as the landing page.
export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span
        className="mb-2 block text-[12px] uppercase tracking-[0.12em] text-faint"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </span>
      <input
        {...props}
        className="w-full border border-line bg-surface-2 px-4 py-3 text-[15px] text-fg placeholder:text-faint transition-colors focus:border-accent focus:outline-none"
        style={{ borderRadius: "8px", ...props.style }}
      />
    </label>
  );
}
