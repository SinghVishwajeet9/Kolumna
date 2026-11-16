"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageLoader } from "@/components/ui/Loader";
import { api, ApiError } from "@/lib/api-client";
import { Select } from "@/components/ui/Select";
import type { CardDetails, Epic, Member, SprintSummary } from "./types";
import { PRIORITIES } from "./types";
import { PRIORITY_META, PriorityIcon } from "./Planning";
import { ReviewItem } from "@/components/approvals/ReviewItem";
import { refreshSidebar } from "@/components/Sidebar";
import { PencilSimple, Trash, X } from "@phosphor-icons/react";
import { ActionMenu, ConfirmDialog, InlineEdit } from "@/components/ui/Menu";
import { useAuth } from "@/lib/auth-context";

// Phase 4: below this stated confidence, agent changes to the card wait for
// a human — whatever the agent's autonomy level.
const REVIEW_THRESHOLDS = [
  { value: null, label: "Agent's own setting" },
  { value: "0.5", label: "Below 50% confidence" },
  { value: "0.7", label: "Below 70% confidence" },
  { value: "0.9", label: "Below 90% confidence" },
  { value: "1", label: "Always (every agent change)" },
];
import { ActorBadge } from "./ActorBadge";
import { ProgressBar } from "./ProgressBar";
import { AssigneeSelect } from "./AssigneeSelect";

const mono = { fontFamily: "var(--font-mono)" };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[14px] font-semibold text-fg" style={mono}>
      {children}
    </h3>
  );
}

function withCurrent<T extends { id: string }>(all: T[], current: T | null) {
  return current && !all.some((x) => x.id === current.id) ? [current, ...all] : all;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] text-faint">{children}</span>;
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function CardPanel({
  cardId,
  members,
  onClose,
  onChanged,
}: {
  cardId: string;
  members: Member[];
  onClose: () => void;
  onChanged: () => void; // tell the board to refresh its card faces
}) {
  const [card, setCard] = useState<CardDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [descDirty, setDescDirtyState] = useState(false);
  // Polling reads this, so a background refresh never clobbers a description
  // the user is in the middle of typing.
  const descDirtyRef = useRef(false);
  const setDescDirty = (v: boolean) => {
    descDirtyRef.current = v;
    setDescDirtyState(v);
  };
  const [note, setNote] = useState("");
  const [points, setPoints] = useState("");
  const pointsDirtyRef = useRef(false);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [sprints, setSprints] = useState<SprintSummary[]>([]);
  const [newItem, setNewItem] = useState("");
  // What is being edited in place: "title", a checklist step's id, or a note's id.
  const [editing, setEditing] = useState<string | null>(null);
  const [deletingCard, setDeletingCard] = useState(false);
  // Who is looking, so notes show the right actions: your own can be edited and
  // deleted; an owner or admin can delete anyone's.
  const { user } = useAuth();
  const me = members.find((m) => m.type === "HUMAN" && m.email && m.email === user?.email);
  const isAdmin = me?.role === "OWNER" || me?.role === "ADMIN";

  const load = useCallback(async () => {
    try {
      const data = await api.get<CardDetails>(`/cards/${cardId}/details`);
      setCard(data);
      setError(null);
      if (!descDirtyRef.current) setDescription(data.description ?? "");
      if (!pointsDirtyRef.current) setPoints(data.storyPoints?.toString() ?? "");
    } catch {
      setError("Couldn't load this card.");
    }
  }, [cardId]);

  // Poll while open: an agent working on this card shows up live.
  useEffect(() => {
    let cancelled = false;
    const tick = () =>
      api.get<CardDetails>(`/cards/${cardId}/details`).then(
        (data) => {
          if (cancelled) return;
          setCard(data);
          setError(null);
          if (!descDirtyRef.current) setDescription(data.description ?? "");
          if (!pointsDirtyRef.current) setPoints(data.storyPoints?.toString() ?? "");
        },
        () => !cancelled && setError("Couldn't load this card."),
      );
    tick();
    const t = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [cardId]);

  // The board's epics and sprints, for the pickers. Fetched once per board —
  // they change far less often than the card does.
  const boardId = card?.list.boardId;
  useEffect(() => {
    if (!boardId) return;
    api.get<Epic[]>(`/boards/${boardId}/epics`).then(setEpics).catch(() => {});
    api.get<SprintSummary[]>(`/boards/${boardId}/sprints`).then(setSprints).catch(() => {});
  }, [boardId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
    await load();
    onChanged();
    refreshSidebar(); // approvals and counts may have changed
  }

  const patch = (data: Record<string, unknown>) => act(() => api.patch(`/cards/${cardId}`, data));

  const savePoints = () => {
    if (!pointsDirtyRef.current) return;
    pointsDirtyRef.current = false;
    const n = points.trim() === "" ? null : Number(points);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 100)) {
      setError("Story points must be a whole number from 0 to 100.");
      return;
    }
    void patch({ storyPoints: n });
  };

  const saveDescription = () =>
    descDirty &&
    act(async () => {
      await api.patch(`/cards/${cardId}`, { description });
      setDescDirty(false);
    });

  return (
    <div className="animate-fade fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-[3px]" onClick={onClose}>
      <aside
        className="animate-panel flex h-full w-full max-w-[560px] flex-col overflow-y-auto border-l border-white/[0.08] bg-[#111112] shadow-[-24px_0_60px_-30px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {!card ? (
          error ? (
            <p className="p-8 text-[14px] text-faint" style={mono}>
              {error}
            </p>
          ) : (
            <PageLoader />
          )
        ) : (
          <div className="flex flex-col gap-8 p-5 sm:p-7">
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-[14px] font-semibold text-fg" style={mono}>
                  <span className="text-muted">
                    {card.board.key}-{card.number}
                  </span>{" "}
                  · {card.list.title}
                </p>
                {/* Click the title to edit it. */}
                <h2
                  className={`text-[22px] font-medium leading-snug text-fg ${editing === "title" ? "" : "cursor-text hover:bg-white/[0.04]"}`}
                  style={{ borderRadius: 6 }}
                  onClick={() => setEditing("title")}
                  title={editing === "title" ? undefined : "Click to edit"}
                >
                  <InlineEdit
                    value={card.title}
                    editing={editing === "title"}
                    onDone={() => setEditing(null)}
                    onSave={(title) => void patch({ title })}
                    multiline
                    maxLength={300}
                    ariaLabel="Task title"
                    inputClassName="text-[22px] font-medium leading-snug resize-none"
                  />
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ActionMenu
                  label="Task actions"
                  items={[
                    { label: "Edit title", icon: <PencilSimple size={14} />, onSelect: () => setEditing("title") },
                    { label: "Delete task", icon: <Trash size={14} />, danger: true, onSelect: () => setDeletingCard(true) },
                  ]}
                />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  title="Close (Esc)"
                  className="flex h-7 w-7 items-center justify-center text-faint transition-colors hover:bg-white/[0.08] hover:text-fg"
                  style={{ borderRadius: 7 }}
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {error && (
              <p
                className="border px-3 py-2 text-[13px]"
                style={{ borderRadius: 8, borderColor: "rgba(252,165,165,0.4)", color: "#fca5a5" }}
              >
                {error}
              </p>
            )}

            <section className="grid grid-cols-[110px_1fr] items-center gap-x-4 gap-y-2.5">
              <FieldLabel>Assignee</FieldLabel>
              <AssigneeSelect
                compact
                members={members}
                value={card.assignee?.id ?? null}
                onChange={(assigneeId) => patch({ assigneeId })}
              />

              <FieldLabel>Priority</FieldLabel>
              <Select
                compact
                value={card.priority}
                onChange={(priority) => patch({ priority })}
                options={PRIORITIES.map((p) => ({
                  value: p,
                  label: PRIORITY_META[p].label,
                  icon: <PriorityIcon priority={p} />,
                }))}
              />

              <FieldLabel>Story points</FieldLabel>
              <input
                inputMode="numeric"
                value={points}
                onChange={(e) => {
                  setPoints(e.target.value.replace(/[^0-9]/g, ""));
                  pointsDirtyRef.current = true;
                }}
                onBlur={savePoints}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                placeholder="—"
                className="w-full bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] outline-none placeholder:text-faint hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)] focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
                style={{ borderRadius: 8, ...mono }}
              />

              <FieldLabel>Epic</FieldLabel>
              <Select
                compact
                value={card.epic?.id ?? null}
                onChange={(epicId) => patch({ epicId })}
                options={[
                  { value: null, label: "No epic" },
                  // The card's own epic counts even before the board's list
                  // arrives, so the field never flashes "No epic".
                  ...withCurrent(epics, card.epic).map((e) => ({
                    value: e.id,
                    label: e.title,
                    icon: <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: e.color }} />,
                  })),
                ]}
              />

              <FieldLabel>Agent cost</FieldLabel>
              <span className="text-[13px] text-muted" style={mono}>
                {card.cost.events === 0
                  ? "nothing reported"
                  : `${card.cost.costUsd ? `$${card.cost.costUsd}` : "$?"} · ${card.cost.tokens.toLocaleString()} tokens`}
                {card.cost.events > 0 && <span className="text-faint"> · {card.cost.events} reports</span>}
              </span>

              <FieldLabel>Agent review</FieldLabel>
              <Select
                compact
                value={card.reviewThreshold === null ? null : String(card.reviewThreshold)}
                onChange={(v) => patch({ reviewThreshold: v === null ? null : Number(v) })}
                options={
                  card.reviewThreshold !== null && !REVIEW_THRESHOLDS.some((t) => t.value === String(card.reviewThreshold))
                    ? [...REVIEW_THRESHOLDS, { value: String(card.reviewThreshold), label: `Below ${Math.round(card.reviewThreshold * 100)}%` }]
                    : REVIEW_THRESHOLDS
                }
              />

              <FieldLabel>Sprint</FieldLabel>
              <Select
                compact
                value={card.sprint?.id ?? null}
                onChange={(sprintId) => patch({ sprintId })}
                options={[
                  { value: null, label: "Backlog" },
                  // Finished sprints can't take new work; one only appears
                  // here when it's where this card already lives.
                  ...withCurrent(sprints, card.sprint)
                    .filter((s) => s.status !== "COMPLETED" || s.id === card.sprint?.id)
                    .map((s) => ({
                      value: s.id,
                      label: s.name,
                      note: s.status === "ACTIVE" ? "active" : s.status === "COMPLETED" ? "completed" : undefined,
                      disabled: s.status === "COMPLETED",
                    })),
                ]}
              />
            </section>

            <section>
              <SectionTitle>Description</SectionTitle>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDescDirty(true);
                }}
                onBlur={saveDescription}
                rows={4}
                placeholder="What needs doing, where, and how to tell it's done — agents read this."
                className="w-full resize-y border border-line bg-surface-2 px-3 py-2.5 text-[14px] leading-relaxed text-fg placeholder:text-faint focus:border-white/40 focus:outline-none"
                style={{ borderRadius: 8 }}
              />
            </section>

            {card.reviews.some((r) => r.status === "PENDING") && (
              <section>
                <SectionTitle>Agent changes awaiting approval</SectionTitle>
                <ul className="flex flex-col gap-3">
                  {card.reviews
                    .filter((r) => r.status === "PENDING")
                    .map((r) => (
                      <ReviewItem
                        key={r.id}
                        compact
                        review={{ ...r, agent: { id: r.agentId, displayName: r.agent.actor.displayName }, card: null }}
                        onApprove={() => act(() => api.post(`/reviews/${r.id}/approve`))}
                        onReject={(note) => act(() => api.post(`/reviews/${r.id}/reject`, note ? { note } : {}))}
                      />
                    ))}
                </ul>
              </section>
            )}

            {card.subtaskProposals.length > 0 && (
              <section>
                <SectionTitle>Plan awaiting your approval</SectionTitle>
                {card.subtaskProposals.map((p) => (
                  <div
                    key={p.id}
                    className="border p-4"
                    style={{ borderRadius: 10, borderColor: "rgba(252,211,77,0.4)", backgroundColor: "rgba(252,211,77,0.05)" }}
                  >
                    <ol className="mb-3 list-decimal space-y-1 pl-5 text-[14px] text-fg">
                      {p.subtasks.map((s, i) => (
                        <li key={i}>{s.title}</li>
                      ))}
                    </ol>
                    {p.reasoningSummary && <p className="mb-4 text-[13px] text-muted">{p.reasoningSummary}</p>}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => act(() => api.post(`/proposals/${p.id}/approve`))}
                        className="bg-[#ffffff] px-4 py-2 text-[13px] font-medium text-bg"
                        style={{ borderRadius: 8, ...mono }}
                      >
                        Approve → checklist
                      </button>
                      <button
                        type="button"
                        onClick={() => act(() => api.post(`/proposals/${p.id}/reject`))}
                        className="px-4 py-2 text-[13px] text-muted hover:text-fg"
                        style={mono}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section>
              <SectionTitle>Checklist</SectionTitle>
              {card.checklistItems.length > 0 && (
                <div className="mb-4">
                  <ProgressBar items={card.checklistItems} />
                </div>
              )}
              <ul className="space-y-2">
                {card.checklistItems.map((item) => (
                  <li key={item.id} className="group/item flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(e) =>
                        act(() => api.patch(`/checklist-items/${item.id}`, { done: e.target.checked }))
                      }
                      className="mt-1 accent-[#e5e5e5]"
                    />
                    <div className="min-w-0 flex-1">
                      <InlineEdit
                        value={item.title}
                        editing={editing === item.id}
                        onDone={() => setEditing(null)}
                        onSave={(title) => void act(() => api.patch(`/checklist-items/${item.id}`, { title }))}
                        maxLength={200}
                        ariaLabel="Step"
                        className={`text-[14px] ${item.done ? "text-faint line-through" : "text-fg"}`}
                        inputClassName="text-[14px]"
                      />
                      {item.evidenceUrl && (
                        <a
                          href={item.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-[12px] text-accent hover:underline"
                          style={mono}
                        >
                          evidence ↗ {item.evidenceUrl}
                        </a>
                      )}
                    </div>
                    {editing !== item.id && (
                      <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/item:opacity-100 max-md:opacity-100">
                        <RowButton label="Edit step" onClick={() => setEditing(item.id)}>
                          <PencilSimple size={14} />
                        </RowButton>
                        <RowButton label="Delete step" onClick={() => void act(() => api.delete(`/checklist-items/${item.id}`))}>
                          <Trash size={14} />
                        </RowButton>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <form
                className="mt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newItem.trim()) return;
                  void act(async () => {
                    await api.post(`/cards/${cardId}/checklist`, { title: newItem.trim() });
                    setNewItem("");
                  });
                }}
              >
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="+ add a step"
                  className="w-full border-b border-line bg-transparent py-2 text-[14px] text-fg placeholder:text-faint focus:border-white/40 focus:outline-none"
                />
              </form>
            </section>

            <section>
              <SectionTitle>Notes</SectionTitle>
              <ul className="space-y-4">
                {card.comments.map((c) => (
                  <li key={c.id} className="group/note">
                    <div className="mb-1 flex min-h-[28px] items-center gap-2">
                      <ActorBadge actor={c.author} size="md" />
                      <span className="text-[11px] text-faint" style={mono}>
                        {timeAgo(c.createdAt)}
                        {c.editedAt && " · edited"}
                      </span>
                      {(c.author.id === me?.actorId || isAdmin) && editing !== c.id && (
                        <span className="ml-auto flex opacity-0 transition-opacity focus-within:opacity-100 group-hover/note:opacity-100 max-md:opacity-100">
                          {c.author.id === me?.actorId && (
                            <RowButton label="Edit note" onClick={() => setEditing(c.id)}>
                              <PencilSimple size={14} />
                            </RowButton>
                          )}
                          <RowButton label="Delete note" onClick={() => void act(() => api.delete(`/comments/${c.id}`))}>
                            <Trash size={14} />
                          </RowButton>
                        </span>
                      )}
                    </div>
                    <InlineEdit
                      value={c.body}
                      editing={editing === c.id}
                      onDone={() => setEditing(null)}
                      onSave={(body) => void act(() => api.patch(`/comments/${c.id}`, { body }))}
                      multiline
                      maxLength={4000}
                      ariaLabel="Note"
                      className="block whitespace-pre-wrap text-[14px] leading-relaxed text-muted"
                      inputClassName="text-[14px] leading-relaxed"
                    />
                  </li>
                ))}
              </ul>
              <form
                className="mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!note.trim()) return;
                  void act(async () => {
                    await api.post(`/cards/${cardId}/comments`, { body: note.trim() });
                    setNote("");
                  });
                }}
              >
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Write a note — Enter to post"
                  className="w-full border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-faint focus:border-white/40 focus:outline-none"
                  style={{ borderRadius: 8 }}
                />
              </form>
            </section>

            <section>
              <SectionTitle>Activity · audit trail</SectionTitle>
              <ol className="space-y-2">
                {[...card.activity].reverse().map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 text-[12px]" style={mono}>
                    <span className="text-muted">
                      <span className={a.actor.type === "AGENT" ? "text-accent" : "text-fg"}>
                        {a.actor.displayName}
                      </span>{" "}
                      {a.action.toLowerCase().replace(/_/g, " ").replace(/\./g, " · ")}
                      {a.result !== "SUCCESS" && <span className="text-[#fcd34d]"> [{a.result}]</span>}
                      {a.onBehalfOf && <span className="text-faint"> for {a.onBehalfOf.displayName}</span>}
                    </span>
                    <span className="shrink-0 text-faint">{timeAgo(a.createdAt)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </aside>

      {deletingCard && card && (
        // Clicks here must not reach the backdrop behind, which closes the panel.
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog
            title="Delete this task?"
            body={
              <>
                <span className="text-fg">{card.title}</span> and its checklist and notes will be deleted. This can&apos;t be
                undone.
              </>
            }
            confirmLabel="Delete task"
            onClose={() => setDeletingCard(false)}
            onConfirm={async () => {
              try {
                await api.delete(`/cards/${cardId}`);
              } catch (err) {
                throw new Error(err instanceof ApiError ? err.message : "Couldn't delete this task. Try again.");
              }
              onChanged();
              refreshSidebar();
              onClose();
            }}
          />
        </div>
      )}
    </div>
  );
}

/** A small icon button at the end of a checklist step or note. */
function RowButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center text-faint transition-colors hover:bg-white/[0.08] hover:text-fg"
      style={{ borderRadius: 6 }}
    >
      {children}
    </button>
  );
}
