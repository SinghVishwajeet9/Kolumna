"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Column } from "@/components/board/Column";
import { CardTile } from "@/components/board/CardTile";
import { CardPanel } from "@/components/board/CardPanel";
import type { Board, BoardCard, Member } from "@/components/board/types";

const mono = { fontFamily: "var(--font-mono)" };
const POLL_MS = 5000;

export default function BoardPage() {
  const { id: boardId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [board, setBoard] = useState<Board | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnTitle, setColumnTitle] = useState("");

  // Polling must never overwrite the board mid-drag, or the card would jump
  // back under the user's cursor.
  const dragging = useRef(false);

  const load = useCallback(async () => {
    if (dragging.current) return;
    try {
      const data = await api.get<Board>(`/boards/${boardId}`);
      if (!dragging.current) setBoard(data);
      setError(null);
    } catch {
      setError("Couldn't load this board.");
    }
  }, [boardId]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  // Initial load + polling. State is only set inside the promise callback —
  // the effect subscribes to the server, it doesn't compute state itself.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const tick = () => {
      if (dragging.current) return;
      api.get<Board>(`/boards/${boardId}`).then(
        (data) => {
          if (cancelled || dragging.current) return;
          setBoard(data);
          setError(null);
        },
        () => !cancelled && setError("Couldn't load this board."),
      );
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user, boardId]);

  useEffect(() => {
    if (board?.workspaceId) {
      api.get<Member[]>(`/workspaces/${board.workspaceId}/members`).then(setMembers).catch(() => {});
    }
  }, [board?.workspaceId]);

  // A small movement threshold so a plain click still opens the card.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function listOf(cardId: string) {
    return board?.lists.find((l) => l.cards.some((c) => c.id === cardId));
  }

  function onDragStart(e: DragStartEvent) {
    dragging.current = true;
    setActiveCard(listOf(String(e.active.id))?.cards.find((c) => c.id === e.active.id) ?? null);
  }

  // While dragging across columns, move the card in local state so the
  // target column opens a gap for it.
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!board || !over) return;
    const from = listOf(String(active.id));
    const to =
      over.data.current?.type === "list"
        ? board.lists.find((l) => l.id === over.id)
        : listOf(String(over.id));
    if (!from || !to || from.id === to.id) return;

    setBoard({
      ...board,
      lists: board.lists.map((l) => {
        if (l.id === from.id) return { ...l, cards: l.cards.filter((c) => c.id !== active.id) };
        if (l.id === to.id) {
          const card = from.cards.find((c) => c.id === active.id)!;
          const overIndex = l.cards.findIndex((c) => c.id === over.id);
          const at = overIndex === -1 ? l.cards.length : overIndex;
          const cards = [...l.cards];
          cards.splice(at, 0, { ...card, listId: to.id });
          return { ...l, cards };
        }
        return l;
      }),
    });
  }

  // On drop: settle the order locally, then tell the server WHERE it landed
  // (its new neighbours). The server — not the client — computes the rank.
  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveCard(null);
    if (!board || !over) {
      dragging.current = false;
      return;
    }
    const list = listOf(String(active.id))!;
    let cards = list.cards;
    const oldIndex = cards.findIndex((c) => c.id === active.id);
    const overIndex = cards.findIndex((c) => c.id === over.id);
    if (overIndex !== -1 && overIndex !== oldIndex) cards = arrayMove(cards, oldIndex, overIndex);
    setBoard({ ...board, lists: board.lists.map((l) => (l.id === list.id ? { ...l, cards } : l)) });

    const at = cards.findIndex((c) => c.id === active.id);
    try {
      await api.patch(`/cards/${active.id}/move`, {
        listId: list.id,
        beforeId: cards[at - 1]?.id ?? null,
        afterId: cards[at + 1]?.id ?? null,
      });
    } catch {
      setError("Couldn't move that card — reloaded the board.");
    } finally {
      dragging.current = false;
      void load();
    }
  }

  async function addCard(listId: string, title: string) {
    await api.post(`/lists/${listId}/cards`, { title });
    await load();
  }

  async function addColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!columnTitle.trim()) return;
    await api.post(`/boards/${boardId}/lists`, { title: columnTitle.trim() });
    setColumnTitle("");
    setAddingColumn(false);
    await load();
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-bg">
      <div className="px-6 pt-10 pb-6 lg:px-10">
        <Link href="/boards" className="text-[13px] text-faint hover:text-fg" style={mono}>
          ← boards
        </Link>
        <div className="mt-3 flex items-end justify-between gap-4">
          <h1 className="text-[clamp(1.6rem,3vw,2.4rem)] font-medium tracking-[-0.02em]" style={mono}>
            {board?.title ?? " "}
          </h1>
          <span className="flex items-center gap-2 text-[12px] text-faint" style={mono}>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            live · agents&apos; updates appear here
          </span>
        </div>
        {error && <p className="mt-3 text-[13px] text-[#fca5a5]">{error}</p>}
      </div>

      {board && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            dragging.current = false;
            setActiveCard(null);
            void load();
          }}
        >
          <div className="flex items-start gap-4 overflow-x-auto px-6 pb-10 lg:px-10">
            {board.lists.map((list) => (
              <Column key={list.id} list={list} onOpenCard={setOpenCardId} onAddCard={addCard} />
            ))}

            <div className="w-[300px] shrink-0">
              {addingColumn ? (
                <form onSubmit={addColumn}>
                  <input
                    autoFocus
                    value={columnTitle}
                    onChange={(e) => setColumnTitle(e.target.value)}
                    onBlur={() => !columnTitle && setAddingColumn(false)}
                    placeholder="Column name — Enter to add"
                    className="w-full border border-line bg-surface px-4 py-3 text-[14px] text-fg placeholder:text-faint focus:border-accent focus:outline-none"
                    style={{ borderRadius: 14 }}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingColumn(true)}
                  className="w-full border border-dashed border-line px-4 py-4 text-left text-[13px] text-faint transition-colors hover:border-line-bright hover:text-fg"
                  style={{ borderRadius: 14, ...mono }}
                >
                  + add column
                </button>
              )}
            </div>
          </div>

          <DragOverlay>{activeCard && <CardTile card={activeCard} overlay />}</DragOverlay>
        </DndContext>
      )}

      {openCardId && (
        <CardPanel
          cardId={openCardId}
          members={members}
          onClose={() => setOpenCardId(null)}
          onChanged={() => void load()}
        />
      )}
    </main>
  );
}
