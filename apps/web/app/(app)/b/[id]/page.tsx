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
import { Plus, Lightning, ListChecks, ChartLine } from "@phosphor-icons/react";
import { PageLoader } from "@/components/ui/Loader";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Column } from "@/components/board/Column";
import { CardTile } from "@/components/board/CardTile";
import { CardPanel } from "@/components/board/CardPanel";
import type { Board, BoardCard, Member } from "@/components/board/types";
import { daysLeft } from "@/components/board/types";

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

  // Tasks typed into a column but not saved yet. They're shown straight away
  // and merged into every board refresh until the server has them, so a poll
  // landing mid-save can't make a new card flicker out.
  const pending = useRef(new Map<string, BoardCard>());
  const withPending = useCallback((data: Board): Board => {
    if (!pending.current.size) return data;
    const extra = [...pending.current.values()];
    return {
      ...data,
      lists: data.lists.map((l) => ({ ...l, cards: [...l.cards, ...extra.filter((c) => c.listId === l.id)] })),
    };
  }, []);

  const load = useCallback(async () => {
    if (dragging.current) return;
    try {
      const data = await api.get<Board>(`/boards/${boardId}`);
      if (!dragging.current) setBoard(withPending(data));
      setError(null);
    } catch {
      setError("Couldn't load this board.");
    }
  }, [boardId, withPending]);

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
          setBoard(withPending(data));
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
  }, [user, boardId, withPending]);

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
    const temp: BoardCard = {
      id: `temp-${crypto.randomUUID()}`,
      listId,
      title,
      rank: Number.MAX_SAFE_INTEGER,
      number: 0,
      priority: "NONE",
      storyPoints: null,
      epic: null,
      assignee: null,
      checklistItems: [],
      _count: { comments: 0 },
    };
    pending.current.set(temp.id, temp);
    setBoard((b) => b && withPending({ ...b, lists: b.lists.map((l) => ({ ...l, cards: l.cards.filter((c) => !c.id.startsWith("temp-")) })) }));
    try {
      await api.post(`/lists/${listId}/cards`, { title });
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : "Couldn't add that task. Is the API running?");
    } finally {
      pending.current.delete(temp.id);
      await load();
    }
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
    <main className="min-h-screen bg-bg">
      <div className="px-6 pt-10 pb-6 lg:px-10">
        <Link href="/boards" className="text-[13px] text-faint hover:text-fg" style={mono}>
          ← boards
        </Link>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-baseline gap-3 text-[clamp(1.6rem,3vw,2.4rem)] font-medium tracking-[-0.02em]" style={mono}>
              {board?.title ?? " "}
              {board && <span className="text-[14px] font-normal tracking-normal text-faint">{board.key}</span>}
            </h1>
            {board && <SprintLine board={board} />}
          </div>
          <div className="flex shrink-0 items-center gap-5">
            <Link
              href={`/b/${boardId}/backlog`}
              className="flex items-center gap-1.5 text-[13px] text-faint transition-colors hover:text-fg"
              style={mono}
            >
              <ListChecks size={15} /> backlog
            </Link>
            <Link
              href={`/b/${boardId}/reports`}
              className="flex items-center gap-1.5 text-[13px] text-faint transition-colors hover:text-fg"
              style={mono}
            >
              <ChartLine size={15} /> reports
            </Link>
            <span className="flex items-center gap-2 text-[12px] text-faint" style={mono}>
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              live
            </span>
          </div>
        </div>
        {error && <p className="mt-3 text-[13px] text-[#fca5a5]">{error}</p>}
      </div>

      {!board && !error && <PageLoader />}

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
          <div className="flex items-start gap-3 overflow-x-auto px-6 pb-10 lg:px-10">
            {board.lists.map((list) => (
              <Column key={list.id} list={list} boardKey={board.key} onOpenCard={setOpenCardId} onAddCard={addCard} />
            ))}

            <div className="w-[280px] shrink-0">
              {addingColumn ? (
                <form onSubmit={addColumn}>
                  <input
                    autoFocus
                    value={columnTitle}
                    onChange={(e) => setColumnTitle(e.target.value)}
                    onBlur={() => !columnTitle && setAddingColumn(false)}
                    placeholder="Column name — Enter to add"
                    className="w-full bg-[#1a1a1c] px-3 py-2.5 text-[14px] text-fg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)] outline-none placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]"
                    style={{ borderRadius: 12 }}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingColumn(true)}
                  className="flex h-10 w-full items-center gap-2 border border-dashed border-line-bright/70 px-3 text-[13px] text-faint transition-colors hover:border-white/40 hover:text-fg"
                  style={{ borderRadius: 12 }}
                >
                  <Plus size={14} /> Add column
                </button>
              )}
            </div>
          </div>

          <DragOverlay>{activeCard && <CardTile card={activeCard} boardKey={board.key} overlay />}</DragOverlay>
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

// Which slice of work the board is showing: the running sprint (and only its
// cards), or — with no sprint running — everything.
function SprintLine({ board }: { board: Board }) {
  const s = board.activeSprint;
  if (!s) {
    return (
      <p className="mt-2 text-[13px] text-faint">
        No sprint running — showing every card.{" "}
        <Link href={`/b/${board.id}/backlog`} className="text-muted underline-offset-4 hover:text-fg hover:underline">
          Plan one
        </Link>
      </p>
    );
  }
  const left = daysLeft(s.endsAt);
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
      <span className="flex items-center gap-1.5 text-fg">
        <Lightning size={14} weight="fill" /> {s.name}
      </span>
      {s.goal && <span className="text-faint">· {s.goal}</span>}
      {left !== null && (
        <span className={left < 0 ? "text-[#fca5a5]" : "text-faint"} style={mono}>
          · {left < 0 ? `${-left}d overdue` : `${left}d left`}
        </span>
      )}
    </p>
  );
}
