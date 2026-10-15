"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckSquare, ChatCircle } from "@phosphor-icons/react";
import type { BoardCard } from "./types";
import { progressOf } from "./types";
import { Avatar } from "./Avatar";

// Compact card in the Jira-style layout: title, then one footer row —
// checklist progress and note count on the left, assignee on the right.
export function CardTile({
  card,
  onOpen,
  overlay = false,
}: {
  card: BoardCard;
  onOpen?: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", listId: card.listId },
  });
  const p = progressOf(card.checklistItems);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={onOpen}
      className="group cursor-pointer bg-[#262628] px-3 py-2.5 outline outline-1 outline-transparent transition-[outline-color,background-color] hover:bg-[#2b2b2e] hover:outline-white/25"
      style={{
        borderRadius: "8px",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging && !overlay ? 0.35 : 1,
        boxShadow: overlay ? "0 16px 32px -10px rgba(0,0,0,0.8)" : "0 1px 0 rgba(0,0,0,0.25)",
        outlineColor: overlay ? "rgba(255,255,255,0.35)" : undefined,
      }}
    >
      <p className="text-[14px] leading-snug text-fg">{card.title}</p>

      <div className="mt-2.5 flex items-center gap-3">
        {p.total > 0 && (
          <span
            className={`flex items-center gap-1 text-[12px] ${p.done === p.total ? "text-fg" : "text-faint"}`}
            title={`${p.done} of ${p.total} steps done`}
          >
            <CheckSquare size={14} weight={p.done === p.total ? "fill" : "regular"} />
            {p.done}/{p.total}
          </span>
        )}
        {card._count.comments > 0 && (
          <span className="flex items-center gap-1 text-[12px] text-faint" title={`${card._count.comments} notes`}>
            <ChatCircle size={14} />
            {card._count.comments}
          </span>
        )}
        <span className="ml-auto">
          <Avatar actor={card.assignee} />
        </span>
      </div>

      {p.total > 0 && (
        <div className="mt-2 h-[2px] overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white/70 transition-[width] duration-500" style={{ width: `${p.percent}%` }} />
        </div>
      )}
    </div>
  );
}
