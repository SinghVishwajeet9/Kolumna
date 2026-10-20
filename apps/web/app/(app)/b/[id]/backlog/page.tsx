"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CaretRight, Lightning, Plus } from "@phosphor-icons/react";
import { PageLoader } from "@/components/ui/Loader";
import { Select } from "@/components/ui/Select";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { CardPanel } from "@/components/board/CardPanel";
import { Avatar } from "@/components/board/Avatar";
import { CardKey, EpicChip, PointsChip, PriorityIcon } from "@/components/board/Planning";
import type { Backlog, BacklogCard, BacklogSprint, Epic, Member } from "@/components/board/types";
import { daysLeft } from "@/components/board/types";

const mono = { fontFamily: "var(--font-mono)" };
const POLL_MS = 5000;
const BACKLOG = "backlog"; // droppable id for "no sprint"
const EPIC_COLORS = ["#c4b5fd", "#7dd3fc", "#5af7b3", "#fcd34d", "#f9a8d4", "#fb923c", "#67e8f9", "#d9f99d"];

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
}

const points = (cards: BacklogCard[]) => cards.reduce((n, c) => n + (c.storyPoints ?? 0), 0);

export default function BacklogPage() {
  const { id: boardId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState<Backlog | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [epicFilter, setEpicFilter] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [dragCard, setDragCard] = useState<BacklogCard | null>(null);
  const [starting, setStarting] = useState<BacklogSprint | null>(null);
  const [completing, setCompleting] = useState<BacklogSprint | null>(null);
  const dragging = useRef(false);

  const load = useCallback(async () => {
    if (dragging.current) return;
    try {
      const [b, e] = await Promise.all([
        api.get<Backlog>(`/boards/${boardId}/backlog`),
        api.get<Epic[]>(`/boards/${boardId}/epics`),
      ]);
      if (dragging.current) return;
      setData(b);
      setEpics(e);
      setError(null);
    } catch {
      setError("Couldn't load the backlog.");
    }
  }, [boardId]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [user, load]);

  useEffect(() => {
    if (data?.board.workspaceId) {
      api.get<Member[]>(`/workspaces/${data.board.workspaceId}/members`).then(setMembers).catch(() => {});
    }
  }, [data?.board.workspaceId]);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
    await load();
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Drop a card on a sprint (or the backlog) → that's its sprint now. Moved
  // locally first so the row doesn't snap back while the request is in flight.
  async function onDragEnd(e: DragEndEvent) {
    const card = dragCard;
    setDragCard(null);
    const to = e.over?.id;
    if (!data || !card || !to || to === (card.sprintId ?? BACKLOG)) {
      dragging.current = false;
      return;
    }
    const sprintId = to === BACKLOG ? null : String(to);
    const moved = { ...card, sprintId };
    setData({
      ...data,
      backlog: sprintId === null ? [...data.backlog, moved] : data.backlog.filter((c) => c.id !== card.id),
      sprints: data.sprints.map((s) => ({
        ...s,
        cards: s.id === sprintId ? [...s.cards, moved] : s.cards.filter((c) => c.id !== card.id),
      })),
    });
    dragging.current = false;
    await act(() => api.patch(`/cards/${card.id}`, { sprintId }));
  }

  // Dialogs keep the sprint they were opened for, but polling may have
  // refreshed it since (e.g. an agent finished a card) — read the live copy.
  const fresh = (s: BacklogSprint) => data?.sprints.find((x) => x.id === s.id) ?? s;
  const hasActive = data?.sprints.some((s) => s.status === "ACTIVE") ?? false;
  const visible = (cards: BacklogCard[]) => (epicFilter ? cards.filter((c) => c.epic?.id === epicFilter) : cards);

  return (
    <main className="min-h-screen bg-bg">
      <div className="px-6 pt-10 pb-6 lg:px-10">
        <Link href={`/b/${boardId}`} className="text-[13px] text-faint hover:text-fg" style={mono}>
          ← board
        </Link>
        <h1
          className="mt-3 flex items-baseline gap-3 text-[clamp(1.6rem,3vw,2.4rem)] font-medium tracking-[-0.02em]"
          style={mono}
        >
          Backlog
          {data && (
            <span className="text-[14px] font-normal tracking-normal text-faint">
              {data.board.title} · {data.board.key}
            </span>
          )}
        </h1>
        {error && <p className="mt-3 text-[13px] text-[#fca5a5]">{error}</p>}
      </div>

      {!data && !error && <PageLoader />}

      {data && (
        <div className="flex flex-col gap-5 px-6 pb-16 lg:px-10">
          <EpicStrip
            boardId={boardId}
            epics={epics}
            filter={epicFilter}
            onFilter={setEpicFilter}
            onCreated={() => void load()}
          />

          <DndContext
            sensors={sensors}
            onDragStart={(e) => {
              dragging.current = true;
              const all = [...data.backlog, ...data.sprints.flatMap((s) => s.cards)];
              setDragCard(all.find((c) => c.id === e.active.id) ?? null);
            }}
            onDragEnd={onDragEnd}
            onDragCancel={() => {
              dragging.current = false;
              setDragCard(null);
            }}
          >
            {data.sprints.map((s) => (
              <Section
                key={s.id}
                dropId={s.id}
                title={
                  <>
                    {s.status === "ACTIVE" && <Lightning size={14} weight="fill" className="text-fg" />}
                    <span className="text-fg">{s.name}</span>
                    {s.status === "ACTIVE" && (
                      <span
                        className="px-1.5 py-[1px] text-[10px] uppercase tracking-[0.1em] text-accent"
                        style={{ borderRadius: 4, backgroundColor: "rgba(90,247,179,0.12)", ...mono }}
                      >
                        active
                      </span>
                    )}
                    {s.startsAt && (
                      <span className="text-[12px] text-faint" style={mono}>
                        {fmtDate(s.startsAt)} – {fmtDate(s.endsAt)}
                      </span>
                    )}
                  </>
                }
                subtitle={s.goal}
                cards={s.cards}
                actions={
                  s.status === "ACTIVE" ? (
                    <SectionButton onClick={() => setCompleting(s)}>Complete sprint</SectionButton>
                  ) : (
                    <SectionButton
                      disabled={hasActive || s.cards.length === 0}
                      title={
                        hasActive
                          ? "Complete the active sprint first"
                          : s.cards.length === 0
                            ? "Drag some cards in first"
                            : undefined
                      }
                      onClick={() => setStarting(s)}
                    >
                      Start sprint
                    </SectionButton>
                  )
                }
              >
                <Rows
                  cards={visible(s.cards)}
                  data={data}
                  onOpen={setOpenCardId}
                  empty="Drag cards here from the backlog to plan this sprint."
                />
              </Section>
            ))}

            <Section
              dropId={BACKLOG}
              title={<span className="text-fg">Backlog</span>}
              cards={data.backlog}
              actions={
                <SectionButton onClick={() => act(() => api.post(`/boards/${boardId}/sprints`, {}))}>
                  Create sprint
                </SectionButton>
              }
            >
              <Rows cards={visible(data.backlog)} data={data} onOpen={setOpenCardId} empty="The backlog is empty." />
              <NewCardRow
                disabled={data.lists.length === 0}
                onCreate={(title) =>
                  // Explicitly into the backlog — not the running sprint.
                  act(() => api.post(`/lists/${data.lists[0]!.id}/cards`, { title, sprintId: null }))
                }
              />
            </Section>

            <DragOverlay>
              {dragCard && <Row card={dragCard} data={data} overlay />}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {starting && (
        <StartDialog
          sprint={fresh(starting)}
          onClose={() => setStarting(null)}
          onStart={(body) =>
            act(async () => {
              await api.post(`/sprints/${starting.id}/start`, body);
              setStarting(null);
            })
          }
        />
      )}

      {completing && data && (
        <CompleteDialog
          sprint={fresh(completing)}
          data={data}
          onClose={() => setCompleting(null)}
          onComplete={(moveOpenCardsTo) =>
            act(async () => {
              await api.post(`/sprints/${completing.id}/complete`, { moveOpenCardsTo });
              setCompleting(null);
            })
          }
        />
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

// --- Sections and rows ---------------------------------------------------------

function Section({
  dropId,
  title,
  subtitle,
  cards,
  actions,
  children,
}: {
  dropId: string;
  title: React.ReactNode;
  subtitle?: string | null;
  cards: BacklogCard[];
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  const [open, setOpen] = useState(true);
  return (
    <section
      ref={setNodeRef}
      className="bg-[#1a1a1c] p-1.5 transition-shadow"
      style={{ borderRadius: 12, boxShadow: isOver ? "inset 0 0 0 1px rgba(255,255,255,0.35)" : "none" }}
    >
      <header className="flex items-center gap-3 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 items-center gap-2 text-[14px] font-medium"
        >
          <CaretRight size={12} className={`shrink-0 text-faint transition-transform ${open ? "rotate-90" : ""}`} />
          {title}
        </button>
        <span className="text-[12px] text-faint" style={mono}>
          {cards.length} {cards.length === 1 ? "card" : "cards"}
          {points(cards) > 0 && ` · ${points(cards)} pts`}
        </span>
        <span className="ml-auto">{actions}</span>
      </header>
      {subtitle && open && <p className="px-2.5 pb-2 pl-[30px] text-[13px] text-faint">{subtitle}</p>}
      {open && <div className="flex flex-col gap-[2px]">{children}</div>}
    </section>
  );
}

function SectionButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="bg-white/[0.06] px-3 py-1.5 text-[12px] text-fg transition-colors hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.06]"
      style={{ borderRadius: 7, ...mono }}
    >
      {children}
    </button>
  );
}

function Rows({
  cards,
  data,
  onOpen,
  empty,
}: {
  cards: BacklogCard[];
  data: Backlog;
  onOpen: (id: string) => void;
  empty: string;
}) {
  if (cards.length === 0) {
    return (
      <p
        className="mx-1 my-1 border border-dashed border-line-bright/60 px-3 py-3 text-center text-[13px] text-faint"
        style={{ borderRadius: 8 }}
      >
        {empty}
      </p>
    );
  }
  return cards.map((c) => <Row key={c.id} card={c} data={data} onOpen={() => onOpen(c.id)} />);
}

function Row({
  card,
  data,
  onOpen,
  overlay = false,
}: {
  card: BacklogCard;
  data: Backlog;
  onOpen?: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled: overlay });
  const done = card.list.id === data.doneListId;
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={onOpen}
      className="flex h-10 cursor-pointer items-center gap-3 bg-[#262628] px-3 outline-none transition-[background-color,box-shadow] hover:bg-[#2b2b2e] focus-visible:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
      style={{
        borderRadius: 7,
        opacity: isDragging && !overlay ? 0.35 : 1,
        boxShadow: overlay ? "inset 0 0 0 1px rgba(255,255,255,0.35), 0 16px 32px -10px rgba(0,0,0,0.8)" : undefined,
      }}
    >
      <PriorityIcon priority={card.priority} />
      <CardKey boardKey={data.board.key} number={card.number} />
      <span className={`min-w-0 flex-1 truncate text-[14px] ${done ? "text-faint line-through" : "text-fg"}`}>
        {card.title}
      </span>
      <EpicChip epic={card.epic} />
      <span
        className="hidden shrink-0 bg-white/[0.06] px-1.5 py-[1px] text-[11px] text-muted sm:inline"
        style={{ borderRadius: 4, ...mono }}
      >
        {card.list.title}
      </span>
      <PointsChip points={card.storyPoints} />
      <Avatar actor={card.assignee} />
    </div>
  );
}

function NewCardRow({ onCreate, disabled }: { onCreate: (title: string) => Promise<void>; disabled: boolean }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  if (disabled) {
    return <p className="px-3 py-2 text-[13px] text-faint">Add a column on the board first.</p>;
  }
  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex h-9 items-center gap-2 px-3 text-[13px] text-faint transition-colors hover:text-fg"
      >
        <Plus size={14} /> Create card
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        await onCreate(title.trim());
        setTitle("");
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title && setAdding(false)}
        onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
        placeholder="What needs to be done? — Enter"
        className="h-10 w-full bg-[#262628] px-3 text-[14px] text-fg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)] outline-none placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]"
        style={{ borderRadius: 7 }}
      />
    </form>
  );
}

// --- Epics -----------------------------------------------------------------------

function EpicStrip({
  boardId,
  epics,
  filter,
  onFilter,
  onCreated,
}: {
  boardId: string;
  epics: Epic[];
  filter: string | null;
  onFilter: (id: string | null) => void;
  onCreated: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post(`/boards/${boardId}/epics`, {
      title: title.trim(),
      color: EPIC_COLORS[epics.length % EPIC_COLORS.length],
    });
    setTitle("");
    setAdding(false);
    onCreated();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[12px] uppercase tracking-[0.12em] text-faint" style={mono}>
        Epics
      </span>
      {epics.map((e) => {
        const active = filter === e.id;
        const pct = e.cardCount ? Math.round((e.doneCount / e.cardCount) * 100) : 0;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onFilter(active ? null : e.id)}
            title={`${e.doneCount} of ${e.cardCount} done — click to ${active ? "show all" : "filter"}`}
            className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] transition-shadow"
            style={{
              borderRadius: 8,
              backgroundColor: `${e.color}14`,
              color: e.color,
              boxShadow: active ? `inset 0 0 0 1px ${e.color}` : "none",
            }}
          >
            {e.title}
            <span className="h-[3px] w-10 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: e.color }} />
            </span>
            <span className="text-[11px] opacity-80" style={mono}>
              {e.doneCount}/{e.cardCount}
            </span>
          </button>
        );
      })}
      {adding ? (
        <form onSubmit={create}>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => !title && setAdding(false)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            placeholder="Epic name — Enter"
            className="h-8 w-48 bg-surface-2 px-2.5 text-[13px] text-fg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)] outline-none placeholder:text-faint"
            style={{ borderRadius: 8 }}
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-8 items-center gap-1.5 border border-dashed border-line-bright/70 px-2.5 text-[12px] text-faint transition-colors hover:border-white/40 hover:text-fg"
          style={{ borderRadius: 8 }}
        >
          <Plus size={12} /> epic
        </button>
      )}
    </div>
  );
}

// --- Dialogs ---------------------------------------------------------------------

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="animate-rise w-full max-w-[440px] border border-line bg-surface p-6"
        style={{ borderRadius: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-[18px] font-medium text-fg">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function DialogActions({
  onClose,
  label,
  onConfirm,
}: {
  onClose: () => void;
  label: string;
  onConfirm: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] text-muted hover:text-fg" style={mono}>
        Cancel
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          // On failure the dialog stays open (the error shows on the page),
          // so the button must come back.
          void onConfirm().finally(() => setBusy(false));
        }}
        className="bg-[#ffffff] px-4 py-2 text-[13px] font-medium text-bg disabled:opacity-60"
        style={{ borderRadius: 8, ...mono }}
      >
        {busy ? "Working…" : label}
      </button>
    </div>
  );
}

const DURATIONS = [1, 2, 3, 4].map((w) => ({ value: String(w), label: `${w} week${w > 1 ? "s" : ""}` }));

function StartDialog({
  sprint,
  onClose,
  onStart,
}: {
  sprint: BacklogSprint;
  onClose: () => void;
  onStart: (body: { goal?: string; endsAt: string }) => Promise<unknown>;
}) {
  const [goal, setGoal] = useState(sprint.goal ?? "");
  const [weeks, setWeeks] = useState("2");
  return (
    <Dialog title={`Start ${sprint.name}`} onClose={onClose}>
      <p className="mb-4 text-[13px] text-muted">
        {sprint.cards.length} cards · {points(sprint.cards)} points. The board will show only this sprint&apos;s cards
        until it&apos;s completed.
      </p>
      <label className="mb-1.5 block text-[13px] text-faint">Duration</label>
      <Select options={DURATIONS} value={weeks} onChange={(v) => setWeeks(v ?? "2")} />
      <label className="mt-4 mb-1.5 block text-[13px] text-faint">Sprint goal</label>
      <input
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="What this sprint is for"
        className="w-full bg-surface-2 px-3 py-2 text-[14px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] outline-none placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
        style={{ borderRadius: 8 }}
      />
      <DialogActions
        onClose={onClose}
        label="Start sprint"
        onConfirm={() =>
          onStart({
            ...(goal.trim() ? { goal: goal.trim() } : {}),
            endsAt: new Date(Date.now() + Number(weeks) * 7 * 86_400_000).toISOString(),
          })
        }
      />
    </Dialog>
  );
}

function CompleteDialog({
  sprint,
  data,
  onClose,
  onComplete,
}: {
  sprint: BacklogSprint;
  data: Backlog;
  onClose: () => void;
  onComplete: (moveOpenCardsTo: string | null) => Promise<unknown>;
}) {
  const open = sprint.cards.filter((c) => c.list.id !== data.doneListId);
  const planned = data.sprints.filter((s) => s.status === "PLANNED");
  const [target, setTarget] = useState<string | null>(null);
  const left = daysLeft(sprint.endsAt);
  const doneTitle = data.lists.at(-1)?.title ?? "the last column";
  return (
    <Dialog title={`Complete ${sprint.name}`} onClose={onClose}>
      <p className="text-[13px] text-muted">
        {sprint.cards.length - open.length} done · {open.length} unfinished
        {left !== null && left > 0 && <span className="text-faint"> · {left}d still left</span>}
      </p>
      <p className="mt-1 mb-4 text-[12px] text-faint">Cards in “{doneTitle}” count as done and stay with this sprint.</p>
      {open.length > 0 && (
        <>
          <label className="mb-1.5 block text-[13px] text-faint">Move the {open.length} unfinished cards to</label>
          <Select
            value={target}
            onChange={setTarget}
            options={[
              { value: null, label: "Backlog" },
              ...planned.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </>
      )}
      <DialogActions onClose={onClose} label="Complete sprint" onConfirm={() => onComplete(target)} />
    </Dialog>
  );
}
