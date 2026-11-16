"use client";

// Real pieces of the Kolumna console, shown on the landing page with sample
// data: the board's own CardTile, the approvals inbox's own ReviewItem, the
// agent badge from the Agents page. Wrapped in .app-ui so they use the app's
// fonts (not the landing page's pixel font) and look exactly as they do in
// the product. Nothing here talks to the API.

import { useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { CheckCircle, Plus } from "@phosphor-icons/react";
import { CardTile } from "@/components/board/CardTile";
import { ActorBadge } from "@/components/board/ActorBadge";
import { ReviewItem, type Review } from "@/components/approvals/ReviewItem";
import type { BoardCard } from "@/components/board/types";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-ui border border-[var(--l-line)] bg-[var(--l-panel)] p-3" style={{ borderRadius: 8 }}>
      {children}
    </div>
  );
}

const ana = { id: "h1", displayName: "Ana Ruiz", type: "HUMAN" as const };
const claude = { id: "a1", displayName: "Claude Code", type: "AGENT" as const };

const cards: BoardCard[] = [
  {
    id: "c1", listId: "l1", title: "Ship onboarding emails", rank: 1, number: 14, priority: "HIGH",
    storyPoints: null, epic: { id: "e1", title: "Onboarding", color: "#7dd3fc" }, assignee: claude,
    // Kept to what fits a narrow card: a checklist, no comment count.
    checklistItems: [{ done: true }, { done: true }, { done: false }], _count: { comments: 0 },
  },
  {
    id: "c2", listId: "l1", title: "Fix invite link expiry", rank: 2, number: 9, priority: "MEDIUM",
    storyPoints: 2, epic: null, assignee: ana, checklistItems: [], _count: { comments: 0 },
  },
];

/** Step 1: a board column, as it looks on a board. */
export function ColumnShot() {
  return (
    <Frame>
      <div className="bg-[#1a1a1c] p-1.5" style={{ borderRadius: "12px" }}>
        <header className="flex items-center gap-2 px-2.5 pt-2 pb-2.5">
          <span className="text-[13px] font-semibold text-fg">In Progress</span>
          <span className="text-[13px] text-faint">{cards.length}</span>
        </header>
        {/* No sensors: real cards, but nothing to drag on a landing page.
            A fixed id: dnd-kit otherwise numbers its accessibility ids per
            render, so the server's and browser's HTML disagree (hydration
            error). */}
        <DndContext id="landing-column" sensors={[]}>
          <SortableContext items={cards.map((c) => c.id)}>
            <div className="flex flex-col gap-1.5">
              {cards.map((c) => (
                <CardTile key={c.id} card={c} boardKey="KOL" />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="mt-1.5 flex h-8 items-center gap-1.5 px-2.5 text-[13px] text-faint">
          <Plus size={14} /> Create
        </div>
      </div>
    </Frame>
  );
}

/** Step 2: an agent connecting over MCP. */
export function AgentShot() {
  const mcp = process.env.NEXT_PUBLIC_MCP_URL ?? "https://kolumna.vercel.app/mcp";
  return (
    <Frame>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-3">
        <span className="whitespace-nowrap">
          <ActorBadge actor={claude} size="md" />
        </span>
        <span className="whitespace-nowrap text-[12px] text-faint">acts with approval · 80%</span>
      </div>
      <div className="bg-[#141414] p-3" style={{ borderRadius: "8px" }}>
        <p className="mb-2 text-[12px] text-faint">Run in any terminal:</p>
        {/* Broken at natural points; overflow-wrap only splits the URL if it must. */}
        <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-fg [overflow-wrap:anywhere]">
          {`claude mcp add \\\n  --transport http \\\n  kolumna ${mcp}`}
        </pre>
      </div>
    </Frame>
  );
}

/** Step 3: a gated agent change waiting in the approvals inbox. Click it. */
export function ApprovalShot() {
  const [decided, setDecided] = useState<null | "approved" | "rejected">(null);
  // Built once, so the "3m ago" doesn't re-tick while you look at it.
  const [review] = useState<Review>(() => ({
    id: "r1",
    toolName: "move_card",
    summary: "Move KOL-14 “Ship onboarding emails” to Done",
    confidence: 0.62,
    reasoning: "Tests pass, but nobody has reviewed the email copy yet.",
    reason: "LOW_CONFIDENCE",
    status: "PENDING",
    note: null,
    error: null,
    createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    decidedAt: null,
    agent: { id: "a1", displayName: "Claude Code" },
    card: { id: "c1", key: "KOL-14", title: "Ship onboarding emails" },
  }));

  return (
    <Frame>
      {decided ? (
        <div
          className="border bg-surface p-4"
          style={{
            borderRadius: 12,
            borderColor: "var(--color-line)",
          }}
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle
              size={20}
              weight="fill"
              className={`mt-px shrink-0 ${decided === "approved" ? "text-accent" : "text-faint"}`}
            />
            <div>
              <p className="text-[15px] text-fg">{decided === "approved" ? "Approved" : "Rejected"}</p>
              <p className="mt-1 text-[13px] leading-snug text-faint">
                {decided === "approved"
                  ? "The change was applied and written to the audit log."
                  : "Nothing changed. Claude Code sees your note."}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setDecided(null)} className="mt-4 text-[12px] text-faint hover:text-fg">
            ↺ show it again
          </button>
        </div>
      ) : (
        <ul>
          <ReviewItem
            review={review}
            compact
            onApprove={async () => setDecided("approved")}
            onReject={async () => setDecided("rejected")}
          />
        </ul>
      )}
    </Frame>
  );
}
