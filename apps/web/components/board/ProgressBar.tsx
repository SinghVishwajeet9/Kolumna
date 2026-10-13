import { progressOf } from "./types";

// % complete is computed from checklist ticks — never a number anyone types in.
export function ProgressBar({ items }: { items: { done: boolean }[] }) {
  const p = progressOf(items);
  if (p.total === 0) return null;
  const complete = p.done === p.total;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden bg-surface-2" style={{ borderRadius: 999 }}>
        <div
          className="h-full transition-[width] duration-500"
          style={{
            width: `${p.percent}%`,
            borderRadius: 999,
            backgroundColor: complete ? "#5af7b3" : "#7dd3fc",
          }}
        />
      </div>
      <span className="text-[11px] text-faint" style={{ fontFamily: "var(--font-mono)" }}>
        {p.done}/{p.total}
      </span>
    </div>
  );
}
