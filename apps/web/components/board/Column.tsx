"use client";

import { useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, ArrowElbowDownLeft } from "@phosphor-icons/react";
import type { BoardList } from "./types";
import { CardTile } from "./CardTile";

export function Column({
  list,
  boardKey,
  onOpenCard,
  onAddCard,
}: {
  list: BoardList;
  boardKey: string;
  onOpenCard: (cardId: string) => void;
  /** Adds the card (the board shows it straight away) and resolves once
   * saved; rejects with a message if saving failed. */
  onAddCard: (listId: string, title: string) => Promise<void>;
}) {
  // The column itself is a drop target, so a card can land in an EMPTY column
  // (there's no card in it to drop "next to").
  const { setNodeRef, isOver } = useDroppable({ id: list.id, data: { type: "list" } });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  function close() {
    setAdding(false);
    setTitle("");
    setError(null);
  }

  // Enter adds the task and keeps the box open for the next one, like Jira.
  // The board shows the new card immediately; if saving fails, the text comes
  // back so nothing typed is lost.
  function submit() {
    const t = title.trim();
    if (!t) return;
    setTitle("");
    setError(null);
    box.current?.focus();
    onAddCard(list.id, t).catch((err: unknown) => {
      setTitle(t);
      setError(err instanceof Error ? err.message : "Couldn't add that task.");
    });
  }

  return (
    <section
      className="flex w-[280px] shrink-0 flex-col bg-[#1a1a1c] p-1.5 transition-shadow"
      style={{
        borderRadius: "12px",
        // A thin white line while a card is dragged over — inset, so the
        // scrolling row can never clip it (an outline draws OUTSIDE the box).
        boxShadow: isOver ? "inset 0 0 0 1px rgba(255,255,255,0.35)" : "none",
        maxHeight: "calc(100vh - 150px)",
      }}
    >
      <header className="flex items-center gap-2 px-2.5 pt-2 pb-2.5">
        <h2 className="text-[13px] font-semibold text-fg">{list.title}</h2>
        <span className="text-[13px] text-faint">{list.cards.length}</span>
      </header>

      <div ref={setNodeRef} className="flex min-h-[8px] flex-1 flex-col gap-1.5 overflow-y-auto">
        <SortableContext items={list.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {list.cards.map((card) =>
            card.id.startsWith("temp-") ? (
              // Not saved yet: visible straight away, but not draggable or openable.
              <div key={card.id} className="pointer-events-none opacity-60">
                <CardTile card={card} boardKey={boardKey} overlay />
              </div>
            ) : (
              <CardTile key={card.id} card={card} boardKey={boardKey} onOpen={() => onOpenCard(card.id)} />
            ),
          )}
        </SortableContext>
      </div>

      <div className={list.cards.length ? "pt-1.5" : ""}>
        {adding ? (
          <div
            className="bg-[#262628] p-2.5 shadow-[inset_0_0_0_1px_rgba(125,180,255,0.7)]"
            style={{ borderRadius: "8px" }}
          >
            <textarea
              ref={box}
              autoFocus
              rows={2}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !title.trim() && close()}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="What needs to be done?"
              className="block w-full resize-none bg-transparent text-[14px] leading-snug text-fg outline-none placeholder:text-faint"
            />
            {error && <p className="mt-1.5 text-[12px] text-[#fca5a5]">{error}</p>}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-faint">Enter to add · Esc to close</span>
              <button
                type="button"
                // mousedown, not click: fires before the textarea's blur closes the box
                onMouseDown={(e) => {
                  e.preventDefault();
                  submit();
                }}
                disabled={!title.trim()}
                title="Add task"
                className="flex h-7 w-7 items-center justify-center bg-white/10 text-fg transition-colors hover:bg-white/20 disabled:opacity-40"
                style={{ borderRadius: "6px" }}
              >
                <ArrowElbowDownLeft size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-8 w-full items-center gap-1.5 px-2.5 text-[13px] text-faint transition-colors hover:bg-white/[0.05] hover:text-fg"
            style={{ borderRadius: "8px" }}
          >
            <Plus size={14} /> Create
          </button>
        )}
      </div>
    </section>
  );
}
