"use client";

// The "⋯" menu used on boards, columns, cards, comments and sprints, plus the
// "are you sure?" dialog for anything that can't be undone.

import { useEffect, useRef, useState } from "react";
import { DotsThree } from "@phosphor-icons/react";

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean; icon?: React.ReactNode };

export function ActionMenu({
  items,
  label = "More actions",
  align = "right",
  className = "",
}: {
  items: MenuItem[];
  /** Accessible name, e.g. "Column actions". */
  label?: string;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation(); // close the menu, not the panel behind it
      setOpen(false);
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc, true);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc, true);
    };
  }, [open]);

  return (
    <span ref={root} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`flex h-7 w-7 items-center justify-center text-faint transition-colors hover:bg-white/[0.08] hover:text-fg ${
          open ? "bg-white/[0.08] text-fg" : ""
        }`}
        style={{ borderRadius: 7 }}
      >
        <DotsThree size={18} weight="bold" />
      </button>
      {open && (
        <ul
          role="menu"
          className={`animate-rise absolute top-[calc(100%+4px)] z-30 min-w-[168px] bg-[#1c1c1e] p-1 shadow-[inset_0_0_0_1px_var(--color-line),0_16px_40px_-12px_rgba(0,0,0,0.9)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{ borderRadius: 10 }}
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2 whitespace-nowrap px-2.5 py-2 text-left text-[13px] hover:bg-white/[0.06] ${
                  item.danger ? "text-[#fca5a5]" : "text-fg"
                }`}
                style={{ borderRadius: 7 }}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

/** Asks before something permanent. Stays open, showing the error, if it fails. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="animate-rise w-full max-w-[420px] border border-line bg-surface p-6"
        style={{ borderRadius: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-medium text-fg">{title}</h2>
        <div className="mt-2 text-[14px] leading-relaxed text-muted">{body}</div>
        {error && <p className="mt-3 text-[13px] text-[#fca5a5]">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-muted hover:text-fg"
            style={{ borderRadius: 8 }}
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              onConfirm().then(onClose, (err: unknown) => {
                setError(err instanceof Error ? err.message : "That didn't work. Try again.");
                setBusy(false);
              });
            }}
            className="bg-[#ef4444] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ borderRadius: 8 }}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Text that turns into an input when asked to. Enter or blur saves; Esc cancels. */
export function InlineEdit({
  value,
  editing,
  onDone,
  onSave,
  className = "",
  inputClassName = "",
  multiline = false,
  maxLength,
  ariaLabel,
}: {
  value: string;
  editing: boolean;
  /** Called when editing ends, saved or not. */
  onDone: () => void;
  onSave: (next: string) => void;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  maxLength?: number;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  useEffect(() => {
    if (editing) {
      setDraft(value);
      cancelled.current = false;
    }
  }, [editing, value]);

  if (!editing) return <span className={className}>{value}</span>;

  const finish = () => {
    const next = draft.trim();
    if (!cancelled.current && next && next !== value) onSave(next);
    onDone();
  };
  const props = {
    autoFocus: true,
    value: draft,
    maxLength,
    "aria-label": ariaLabel,
    onBlur: finish,
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.target.select(),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        cancelled.current = true;
        e.currentTarget.blur();
      }
      if (e.key === "Enter" && !(multiline && e.shiftKey)) {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
    className: `w-full min-w-0 bg-white/[0.06] px-1.5 py-0.5 text-fg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)] outline-none ${inputClassName}`,
    style: { borderRadius: 6 },
  };
  return multiline ? (
    <textarea {...props} rows={3} onChange={(e) => setDraft(e.target.value)} />
  ) : (
    <input {...props} onChange={(e) => setDraft(e.target.value)} />
  );
}
