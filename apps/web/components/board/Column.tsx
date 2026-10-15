"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "@phosphor-icons/react";
import type { BoardList } from "./types";
import { CardTile } from "./CardTile";

export function Column({
  list,
  onOpenCard,
  onAddCard,
}: {
  list: BoardList;
  onOpenCard: (cardId: string) => void;
  onAddCard: (listId: string, title: string) => Promise<void>;
}) {
  // The column itself is a drop target, so a card can land in an EMPTY column
  // (there's no card in it to drop "next to").
  const { setNodeRef, isOver } = useDroppable({ id: list.id, data: { type: "list" } });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await onAddCard(list.id, title.trim());
    setTitle("");
  }

  return (
    <section
      className="flex w-[280px] shrink-0 flex-col bg-[#1a1a1c] p-1.5 outline outline-1 transition-[outline-color]"
      style={{
        borderRadius: "12px",
        // A thin white outline while a card is dragged over — no colour wash.
        outlineColor: isOver ? "rgba(255,255,255,0.35)" : "transparent",
        maxHeight: "calc(100vh - 150px)",
      }}
    >
      <header className="flex items-center gap-2 px-2.5 pt-2 pb-2.5">
        <h2 className="text-[13px] font-medium text-muted">{list.title}</h2>
        <span className="text-[13px] text-faint">{list.cards.length}</span>
      </header>

      <div ref={setNodeRef} className="flex min-h-[8px] flex-1 flex-col gap-1.5 overflow-y-auto">
        <SortableContext items={list.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {list.cards.map((card) => (
            <CardTile key={card.id} card={card} onOpen={() => onOpenCard(card.id)} />
          ))}
        </SortableContext>
      </div>

      <div className={list.cards.length ? "pt-1.5" : ""}>
        {adding ? (
          <form onSubmit={submit}>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !title && setAdding(false)}
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
              placeholder="What needs to be done? — Enter"
              className="w-full bg-[#262628] px-3 py-2.5 text-[14px] text-fg outline outline-1 outline-white/30 placeholder:text-faint focus:outline-white/50"
              style={{ borderRadius: "8px" }}
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            title="Add card"
            className="flex h-7 w-full items-center justify-center border border-dashed border-line-bright/70 text-faint transition-colors hover:border-white/40 hover:bg-white/[0.03] hover:text-fg"
            style={{ borderRadius: "8px" }}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </section>
  );
}
