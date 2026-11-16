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
import { Plus, Lightning, ListChecks, ChartLine, PencilSimple, Trash } from "@phosphor-icons/react";
import { ActionMenu, ConfirmDialog, InlineEdit } from "@/components/ui/Menu";
import { refreshSidebar } from "@/components/Sidebar";
import { AmbientBackground, AmbientPicker } from "@/components/AmbientBackground";
import { PageLoader } from "@/components/ui/Loader";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Column } from "@/components/board/Column";
import { CardTile } from "@/components/board/CardTile";
import { CardPanel } from "@/components/board/CardPanel";
import type { Board, BoardCard, BoardList, Member } from "@/components/board/types";
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
  const [renamingBoard, setRenamingBoard] = useState(false);
  const [deletingBoard, setDeletingBoard] = useState(false);
  const [deletingList, setDeletingList] = useState<BoardList | null>(null);

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

  // Renames show at once and are put right by the next refresh if saving failed.
  async function renameColumn(listId: string, title: string) {
    setBoard((b) => b && { ...b, lists: b.lists.map((l) => (l.id === listId ? { ...l, title } : l)) });
    try {
      await api.patch(`/lists/${listId}`, { title });
    } catch {
      setError("Couldn't rename that column.");
    }
    await load();
  }

  async function renameBoard(title: string) {
    setBoard((b) => b && { ...b, title });
    try {
      await api.patch(`/boards/${boardId}`, { title });
      refreshSidebar();
    } catch {
      setError("Couldn't rename this board.");
    }
    await load();
  }

  const failed = (what: string) => (err: unknown) => {
    throw new Error(err instanceof ApiError ? err.message : `Couldn't delete ${what}. Try again.`);
  };

  return (
    <main className="relative min-h-screen bg-bg">
      <AmbientBackground strength="soft" />
      <div className="relative z-20 px-5 pb-5 pt-8 sm:px-8 sm:pt-10 lg:px-10">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-faint">
          <Link href="/boards" className="transition-colors hover:text-fg">
            Boards
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-muted">{board?.title ?? "…"}</span>
        </nav>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1
                className="flex min-w-0 items-center gap-2.5 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-fg"
                onDoubleClick={() => board && setRenamingBoard(true)}
              >
                {board ? (
                  <InlineEdit
                    value={board.title}
                    editing={renamingBoard}
                    onDone={() => setRenamingBoard(false)}
                    onSave={(t) => void renameBoard(t)}
                    maxLength={80}
                    ariaLabel="Board name"
                    className="min-w-0 truncate"
                    inputClassName="font-semibold tracking-[-0.02em]"
                  />
                ) : (
                  " "
                )}
                {board && !renamingBoard && (
                  <span
                    className="shrink-0 px-1.5 py-[2px] text-[11.5px] font-normal tracking-normal text-[#d0d6e0]"
                    style={{ borderRadius: 5, backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {board.key}
                  </span>
                )}
              </h1>
              {board && !renamingBoard && (
                <ActionMenu
                  label="Board actions"
                  align="left"
                  items={[
                    { label: "Rename board", icon: <PencilSimple size={14} />, onSelect: () => setRenamingBoard(true) },
                    { label: "Delete board", icon: <Trash size={14} />, danger: true, onSelect: () => setDeletingBoard(true) },
                  ]}
                />
              )}
            </div>
            {board && <SprintLine board={board} />}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="mr-1 flex items-center gap-1.5 text-[12px] text-faint" title="Updates every few seconds">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Live
            </span>
            <Link
              href={`/b/${boardId}/backlog`}
              className="glass pressable flex h-9 items-center gap-1.5 px-3 text-[13px] text-muted hover:text-fg"
              style={{ borderRadius: 9 }}
            >
              <ListChecks size={15} /> Backlog
            </Link>
            <Link
              href={`/b/${boardId}/reports`}
              className="glass pressable flex h-9 items-center gap-1.5 px-3 text-[13px] text-muted hover:text-fg"
              style={{ borderRadius: 9 }}
            >
              <ChartLine size={15} /> Reports
            </Link>
            <AmbientPicker />
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
          {/* min-height: room for a column's menu to open even when every column is empty. */}
          <div className="relative z-10 flex min-h-[calc(100vh-240px)] items-start gap-3 overflow-x-auto px-5 pb-10 pt-1 sm:px-8 lg:px-10">
            {board.lists.map((list, i) => (
              <Column
                key={list.id}
                index={i}
                list={list}
                boardKey={board.key}
                onOpenCard={setOpenCardId}
                onAddCard={addCard}
                onRename={(id, t) => void renameColumn(id, t)}
                onDelete={setDeletingList}
              />
            ))}

            <div className="w-[288px] shrink-0">
              {addingColumn ? (
                <form onSubmit={addColumn}>
                  <input
                    autoFocus
                    value={columnTitle}
                    onChange={(e) => setColumnTitle(e.target.value)}
                    onBlur={() => !columnTitle && setAddingColumn(false)}
                    placeholder="Column name — Enter to add"
                    className="glass w-full px-3 py-2.5 text-[14px] text-fg outline-none placeholder:text-faint focus:border-white/40"
                    style={{ borderRadius: 14 }}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingColumn(true)}
                  className="pressable flex h-11 w-full items-center gap-2 border border-dashed border-white/[0.14] bg-[rgba(13,13,13,0.5)] px-3.5 text-[13px] text-faint backdrop-blur-[10px] hover:border-white/30 hover:bg-[rgba(30,30,33,0.55)] hover:text-fg"
                  style={{ borderRadius: 14 }}
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

      {deletingList && (
        <ConfirmDialog
          title={`Delete "${deletingList.title}"?`}
          body={
            deletingList.cards.length
              ? `This also deletes the ${deletingList.cards.length} ${deletingList.cards.length === 1 ? "task" : "tasks"} in it. This can't be undone.`
              : "The column is empty. This can't be undone."
          }
          confirmLabel="Delete column"
          onClose={() => setDeletingList(null)}
          onConfirm={() => api.delete(`/lists/${deletingList.id}`).then(load, failed("that column"))}
        />
      )}

      {deletingBoard && board && (
        <ConfirmDialog
          title={`Delete "${board.title}"?`}
          body="This deletes the board with all its columns, tasks, sprints and epics. This can't be undone."
          confirmLabel="Delete board"
          onClose={() => setDeletingBoard(false)}
          onConfirm={() =>
            api.delete(`/boards/${boardId}`).then(() => {
              refreshSidebar();
              router.push("/boards");
            }, failed("this board"))
          }
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
        No sprint running, so every task is shown.{" "}
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
