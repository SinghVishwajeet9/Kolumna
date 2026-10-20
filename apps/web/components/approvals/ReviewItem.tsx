"use client";

import { useState } from "react";
import { Robot } from "@phosphor-icons/react";

const mono = { fontFamily: "var(--font-mono)" };

export type Review = {
  id: string;
  toolName: string;
  summary: string;
  confidence: number | null;
  reasoning: string | null;
  reason: "AUTONOMY_LEVEL" | "LOW_CONFIDENCE";
  status: "PENDING" | "APPROVED" | "REJECTED" | "FAILED";
  note: string | null;
  error: string | null;
  createdAt: string;
  decidedAt: string | null;
  agent: { id: string; displayName: string };
  card: { id: string; key: string; title: string } | null;
};

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

// One gated agent change awaiting a decision. Used by the Approvals page and
// the card panel.
export function ReviewItem({
  review: r,
  onApprove,
  onReject,
  compact = false,
}: {
  review: Review;
  onApprove: () => Promise<void>;
  onReject: (note: string) => Promise<void>;
  compact?: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    void fn().finally(() => setBusy(false));
  };
  return (
    <li
      className={`border bg-surface ${compact ? "p-4" : "p-5"}`}
      style={{ borderRadius: 12, borderColor: "rgba(252,211,77,0.35)" }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-faint" style={mono}>
        <Robot size={13} weight="fill" className="text-fg" />
        <span className="text-fg">{r.agent.displayName}</span>
        {r.card && !compact && (
          <span>
            · {r.card.key} {r.card.title}
          </span>
        )}
        <span>· {timeAgo(r.createdAt)}</span>
      </div>
      <p className="mt-2 text-[15px] leading-snug text-fg">{r.summary}</p>
      <p className="mt-1.5 text-[12px] text-faint">
        {r.reason === "AUTONOMY_LEVEL" ? "Suggest-only on this board" : "Below its confidence threshold"}
        {r.confidence !== null && (
          <span style={mono}> · confidence {Math.round(r.confidence * 100)}%</span>
        )}
      </p>
      {r.reasoning && <p className="mt-2 text-[13px] text-muted">“{r.reasoning}”</p>}

      {rejecting ? (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => onReject(note.trim()));
          }}
        >
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why not? The agent sees this (optional)"
            className="min-w-0 flex-1 bg-surface-2 px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] outline-none placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
            style={{ borderRadius: 8 }}
          />
          <DecisionButton disabled={busy}>Reject</DecisionButton>
          <DecisionButton onClick={() => setRejecting(false)}>Cancel</DecisionButton>
        </form>
      ) : (
        <div className="mt-4 flex gap-3">
          <DecisionButton primary disabled={busy} onClick={() => run(onApprove)}>
            {busy ? "Applying…" : "Approve"}
          </DecisionButton>
          <DecisionButton disabled={busy} onClick={() => setRejecting(true)}>
            Reject
          </DecisionButton>
        </div>
      )}
    </li>
  );
}

export function DecisionButton({
  children,
  onClick,
  primary = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 text-[13px] disabled:opacity-50 ${primary ? "bg-[#ffffff] font-medium text-bg" : "text-muted hover:text-fg"}`}
      style={{ borderRadius: 8, ...mono }}
    >
      {children}
    </button>
  );
}
