"use client";

import { useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, ArrowElbowDownLeft, PencilSimple, Trash } from "@phosphor-icons/react";
import type { BoardList } from "./types";
import { CardTile } from "./CardTile";
import { ActionMenu, InlineEdit } from "@/components/ui/Menu";

export function Column({
  list,
  boardKey,
  index = 0,
  onOpenCard,
  onAddCard,
  onRename,
  onDelete,
}: {
  list: BoardList;
  boardKey: string;
  /** Position on the board, so columns arrive one after another. */
  index?: number;
  onOpenCard: (cardId: string) => void;
  /** Adds the card (the board shows it straight away) and resolves once
   * saved; rejects with a message if saving failed. */
  onAddCard: (listId: string, title: string) => Promise<void>;
  onRename: (listId: string, title: string) => void;
  /** Asks the board to confirm and delete this column. */
  onDelete: (list: BoardList) => void;
}) {
  const [renaming, setRenaming] = useState(false);
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
      className={`glass animate-in flex w-[288px] shrink-0 flex-col p-2 transition-[border-color] duration-150 ${
        // A brighter edge while a card is dragged over.
        isOver ? "!border-white/[0.32]" : ""
      }`}
      style={{ borderRadius: 14, maxHeight: "calc(100vh - 170px)", "--i": index } as React.CSSProperties}
    >
      <header className="group/col flex min-h-[40px] items-center gap-2 pl-2.5 pr-1 pt-1 pb-1.5">
        {/* Double-click the name, or use the menu, to rename. */}
        <h2
          className="min-w-0 truncate text-[13px] font-semibold text-fg"
          onDoubleClick={() => setRenaming(true)}
          title={renaming ? undefined : list.title}
        >
          <InlineEdit
            value={list.title}
            editing={renaming}
            onDone={() => setRenaming(false)}
            onSave={(t) => onRename(list.id, t)}
            maxLength={60}
            ariaLabel="Column name"
            inputClassName="text-[13px] font-semibold"
          />
        </h2>
        {!renaming && (
          <span
            className="flex h-[18px] min-w-[18px] items-center justify-center bg-white/[0.07] px-1.5 text-[11px] tabular-nums text-faint"
            style={{ borderRadius: 999 }}
          >
            {list.cards.length}
          </span>
        )}
        <ActionMenu
          label={`Actions for ${list.title}`}
          className="ml-auto opacity-0 transition-opacity focus-within:opacity-100 group-hover/col:opacity-100 max-md:opacity-100"
          items={[
            { label: "Rename", icon: <PencilSimple size={14} />, onSelect: () => setRenaming(true) },
            { label: "Add task", icon: <Plus size={14} />, onSelect: () => setAdding(true) },
            { label: "Delete column", icon: <Trash size={14} />, danger: true, onSelect: () => onDelete(list) },
          ]}
        />
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
            className="animate-fade bg-white/[0.06] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
            style={{ borderRadius: 10 }}
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
            className="pressable flex h-9 w-full items-center gap-1.5 px-2.5 text-[13px] text-faint hover:bg-white/[0.05] hover:text-fg"
            style={{ borderRadius: 10 }}
          >
            <Plus size={14} /> Create
          </button>
        )}
      </div>
    </section>
  );
}
