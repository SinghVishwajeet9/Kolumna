"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckSquare, ChatCircle } from "@phosphor-icons/react";
import type { BoardCard } from "./types";
import { progressOf } from "./types";
import { Avatar } from "./Avatar";
import { CardKey, EpicChip, PointsChip, PriorityIcon } from "./Planning";

// Compact card in the Jira-style layout: title, its epic, then one footer
// row — key, checklist progress and note count on the left; points,
// priority and assignee on the right.
export function CardTile({
  card,
  boardKey,
  onOpen,
  overlay = false,
}: {
  card: BoardCard;
  boardKey: string;
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
      // Lines are INSET shadows, not outlines: an outline draws outside the
      // box and the column's scroll area clips it.
      className="group cursor-pointer bg-[#262628] outline-none focus-visible:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] px-3 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.25)] transition-[box-shadow,background-color] hover:bg-[#2b2b2e] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]"
      style={{
        borderRadius: "8px",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging && !overlay ? 0.35 : 1,
        boxShadow: overlay
          ? "inset 0 0 0 1px rgba(255,255,255,0.35), 0 16px 32px -10px rgba(0,0,0,0.8)"
          : undefined,
      }}
    >
      <p className="text-[14px] leading-snug text-fg">{card.title}</p>
      {card.epic && (
        <div className="mt-2 flex">
          <EpicChip epic={card.epic} />
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-3">
        <CardKey boardKey={boardKey} number={card.number} />
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
        <span className="ml-auto flex items-center gap-2">
          <PointsChip points={card.storyPoints} />
          {card.priority !== "NONE" && <PriorityIcon priority={card.priority} />}
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
