"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardCard } from "./types";
import { ActorBadge } from "./ActorBadge";
import { ProgressBar } from "./ProgressBar";

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

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={onOpen}
      className="group cursor-pointer border border-line bg-surface-2 p-3.5 transition-colors hover:border-line-bright"
      style={{
        borderRadius: "10px",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging && !overlay ? 0.35 : 1,
        boxShadow: overlay ? "0 20px 40px -12px rgba(0,0,0,0.8)" : undefined,
      }}
    >
      <p className="text-[14px] leading-snug text-fg">{card.title}</p>
      {card.checklistItems.length > 0 && (
        <div className="mt-3">
          <ProgressBar items={card.checklistItems} />
        </div>
      )}
      {(card.assignee || card._count.comments > 0) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {card.assignee ? <ActorBadge actor={card.assignee} /> : <span />}
          {card._count.comments > 0 && (
            <span className="text-[11px] text-faint" style={{ fontFamily: "var(--font-mono)" }}>
              {card._count.comments} note{card._count.comments === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
