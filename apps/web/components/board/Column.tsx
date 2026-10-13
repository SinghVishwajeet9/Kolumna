"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
      className="flex w-[300px] shrink-0 flex-col border bg-surface"
      style={{
        borderRadius: "14px",
        borderColor: isOver ? "rgba(90,247,179,0.45)" : "var(--color-line)",
        maxHeight: "calc(100vh - 210px)",
      }}
    >
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-[13px] uppercase tracking-[0.12em] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
          {list.title}
        </h2>
        <span className="text-[12px] text-faint" style={{ fontFamily: "var(--font-mono)" }}>
          {list.cards.length}
        </span>
      </header>

      <div ref={setNodeRef} className="flex min-h-[40px] flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3">
        <SortableContext items={list.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {list.cards.map((card) => (
            <CardTile key={card.id} card={card} onOpen={() => onOpenCard(card.id)} />
          ))}
        </SortableContext>
      </div>

      <div className="px-3 pb-3">
        {adding ? (
          <form onSubmit={submit}>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !title && setAdding(false)}
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
              placeholder="Card title — Enter to add"
              className="w-full border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-faint focus:border-accent focus:outline-none"
              style={{ borderRadius: "8px" }}
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full px-3 py-2 text-left text-[13px] text-faint transition-colors hover:text-fg"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            + add card
          </button>
        )}
      </div>
    </section>
  );
}
