"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageLoader } from "@/components/ui/Loader";
import { currentWorkspace } from "@/lib/workspace";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { LogoMark } from "@/components/Logo";
import { Field } from "@/components/ui/Field";
import { ArrowRight, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { ActionMenu, ConfirmDialog, InlineEdit } from "@/components/ui/Menu";
import { AmbientBackground, AmbientPicker } from "@/components/AmbientBackground";
import { refreshSidebar } from "@/components/Sidebar";

type Workspace = { id: string; name: string; slug: string };
type Board = { id: string; title: string; key?: string; _count?: { cards: number; lists: number } };

// Every new board starts with these columns, left to right. The last one is
// where finished work goes (Done = the board's last column), so it stays last.
const STARTER_COLUMNS = ["To Do", "In Progress", "In Review", "Done"];

// Same multicolour palette as the landing page's cards / colour-run, so a
// wall of boards reads as one family rather than flat grey.
const CARD_COLORS = [
  "#5af7b3",
  "#7dd3fc",
  "#c4b5fd",
  "#fcd34d",
  "#86efac",
  "#f9a8d4",
  "#67e8f9",
  "#d9f99d",
];

async function fetchBoards(): Promise<{ workspace: Workspace | null; boards: Board[] }> {
  const workspace = await currentWorkspace<Workspace>();
  if (!workspace) return { workspace: null, boards: [] };
  return { workspace, boards: await api.get<Board[]>(`/workspaces/${workspace.id}/boards`) };
}

export default function BoardsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state: just a boolean for open/closed, plus the input's own value.
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [makingWorkspace, setMakingWorkspace] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Board | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const [error, setError] = useState<string | null>(null);

  // Every outcome ends with loading=false — before, a failed request (API
  // restarting, DB unreachable) or a user with no workspace left the page on
  // "Loading…" forever. Fetching and applying are split so the effect only
  // sets state from inside the promise callbacks.
  function load() {
    return fetchBoards().then(
      ({ workspace, boards }) => {
        setWorkspace(workspace);
        setBoards(boards);
        setError(null); // no workspace isn't an error: the page offers to create one
        setLoading(false);
      },
      () => {
        setError("Couldn't load your boards. Is the API running?");
        setLoading(false);
      },
    );
  }

  useEffect(() => {
    if (!authLoading && user) void load();
  }, [authLoading, user]);

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !newTitle.trim()) return;

    setCreating(true);
    setCreateError(null);
    try {
      const board = await api.post<Board>(`/workspaces/${workspace.id}/boards`, {
        title: newTitle,
        columns: STARTER_COLUMNS,
      });
      // Add the new board straight into local state instead of re-fetching
      // the whole list — one fewer network round trip, and it appears
      // instantly instead of waiting on a second request.
      setBoards((prev) => [...prev, board]);
      setNewTitle("");
      setIsModalOpen(false);
    } catch (err) {
      // Never fail silently: say what went wrong inside the dialog.
      setCreateError(err instanceof ApiError ? err.message : "Couldn't create the board. Is the API running?");
    } finally {
      setCreating(false);
    }
  }

  async function renameBoard(id: string, title: string) {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, title } : b)));
    try {
      await api.patch(`/boards/${id}`, { title });
      refreshSidebar();
    } catch {
      setError("Couldn't rename that board.");
      void load();
    }
  }

  async function deleteBoard(board: Board) {
    try {
      await api.delete(`/boards/${board.id}`);
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : "Couldn't delete that board. Try again.");
    }
    setBoards((prev) => prev.filter((b) => b.id !== board.id));
    refreshSidebar();
  }

  // Someone with no workspace — they left or were removed from their last
  // one — would otherwise be stuck on a page where nothing works.
  async function createOwnWorkspace() {
    setMakingWorkspace(true);
    try {
      const name = user?.name ? `${user.name}'s Workspace` : "My Workspace";
      await api.post("/workspaces", { name });
      setLoading(true);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create a workspace.");
    } finally {
      setMakingWorkspace(false);
    }
  }

  const openNewBoard = () => {
    setCreateError(null);
    setIsModalOpen(true);
  };
  const primaryButton =
    "pressable flex h-9 shrink-0 items-center gap-1.5 bg-[#f4f4f5] px-3.5 text-[13.5px] font-medium text-[#0b0b0c] hover:bg-white disabled:opacity-60";

  return (
    <main className="relative min-h-screen bg-bg">
      <AmbientBackground />
      <div className="relative z-10 mx-auto w-full max-w-[1120px] px-5 pb-16 pt-8 sm:px-8 sm:pt-12 lg:px-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-4">
          <div className="min-w-0">
            {workspace && <p className="mb-1.5 truncate text-[13px] text-faint max-md:hidden">{workspace.name}</p>}
            <h1 className="flex items-baseline gap-2.5 text-[28px] font-semibold leading-none tracking-[-0.02em] text-fg">
              Boards
              {!loading && boards.length > 0 && (
                <span className="text-[14px] font-normal tracking-normal text-faint">{boards.length}</span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <AmbientPicker />
            {workspace && (
              <button type="button" onClick={openNewBoard} className={primaryButton} style={{ borderRadius: 9 }}>
                <Plus size={14} weight="bold" /> New board
              </button>
            )}
          </div>
        </header>

        {loading && <PageLoader />}

        {!loading && error && (
          <div className="glass animate-in flex items-center gap-4 px-5 py-4 text-[14px] text-muted" style={{ borderRadius: 14 }}>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                void load();
              }}
              className="ml-auto text-fg underline-offset-4 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && !workspace && (
          <div className="glass animate-in px-6 py-14 text-center sm:px-8" style={{ borderRadius: 16 }}>
            <p className="text-[18px] font-medium text-fg">You&apos;re not in a workspace yet</p>
            <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-relaxed text-muted">
              Create your own, or open an invite link from a teammate to join theirs.
            </p>
            <button
              type="button"
              onClick={() => void createOwnWorkspace()}
              disabled={makingWorkspace}
              className={`${primaryButton} mx-auto mt-6`}
              style={{ borderRadius: 9 }}
            >
              {makingWorkspace ? "Creating…" : "Create a workspace"}
            </button>
          </div>
        )}

        {!loading && !error && workspace && boards.length === 0 && (
          <div className="glass animate-in px-6 py-14 text-center sm:px-8 sm:py-16" style={{ borderRadius: 16 }}>
            <span
              className="mx-auto mb-5 flex h-11 w-11 items-center justify-center bg-white/[0.06]"
              style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <LogoMark style={{ width: 20, color: "#f4f4f5" }} />
            </span>
            <p className="text-[18px] font-medium text-fg">Create your first board</p>
            <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-relaxed text-muted">
              A board holds one project. It starts with four columns (To Do, In Progress, In Review, Done), and you can
              rename or add columns any time.
            </p>
            <button type="button" onClick={openNewBoard} className={`${primaryButton} mx-auto mt-6`} style={{ borderRadius: 9 }}>
              <Plus size={14} weight="bold" /> New board
            </button>
            <p className="mt-5 text-[13px] text-faint">
              Next:{" "}
              <Link href="/agents" className="text-muted underline-offset-4 hover:text-fg hover:underline">
                connect an AI agent
              </Link>{" "}
              or{" "}
              <Link href="/members" className="text-muted underline-offset-4 hover:text-fg hover:underline">
                invite your team
              </Link>
              .
            </p>
          </div>
        )}

        {!loading && !error && boards.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board, i) => {
              const color = CARD_COLORS[i % CARD_COLORS.length];
              const tasks = board._count?.cards;
              const columns = board._count?.lists;
              return (
                <li
                  key={board.id}
                  className="animate-in group relative"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  {/* Sits beside the link, not inside it, so opening the menu never opens the board. */}
                  <ActionMenu
                    label={`Actions for ${board.title}`}
                    className="!absolute right-3 top-3 z-10 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                    items={[
                      { label: "Rename", icon: <PencilSimple size={14} />, onSelect: () => setRenamingId(board.id) },
                      { label: "Delete board", icon: <Trash size={14} />, danger: true, onSelect: () => setDeleting(board) },
                    ]}
                  />
                  <Link
                    href={`/b/${board.id}`}
                    // While renaming, a click in the text box must not open the board.
                    onClick={(e) => renamingId === board.id && e.preventDefault()}
                    className="glass relative flex h-full min-h-[156px] flex-col overflow-hidden p-5 transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-[rgba(30,30,33,0.7)] focus-visible:border-white/40 focus-visible:outline-none"
                    style={{ borderRadius: 14 }}
                  >
                    {/* A wash of the board's colour from the corner, on hover. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{ background: `radial-gradient(260px circle at 0% 0%, ${color}1c, transparent 70%)` }}
                    />
                    <span
                      className="relative flex h-9 w-9 items-center justify-center"
                      style={{ borderRadius: 10, backgroundColor: `${color}1a`, border: `1px solid ${color}33` }}
                    >
                      <LogoMark style={{ width: 18, color }} />
                    </span>
                    <p className="relative mt-4 pr-6 text-[16px] font-medium leading-snug text-fg">
                      <InlineEdit
                        value={board.title}
                        editing={renamingId === board.id}
                        onDone={() => setRenamingId(null)}
                        onSave={(t) => void renameBoard(board.id, t)}
                        maxLength={80}
                        ariaLabel="Board name"
                        inputClassName="text-[16px] font-medium"
                      />
                    </p>
                    <p className="relative mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-faint">
                      {board.key && <span className="text-muted">{board.key}</span>}
                      {tasks !== undefined && (
                        <span>
                          · {tasks} {tasks === 1 ? "task" : "tasks"}
                        </span>
                      )}
                      {columns !== undefined && (
                        <span>
                          · {columns} {columns === 1 ? "column" : "columns"}
                        </span>
                      )}
                    </p>
                    <span className="relative mt-auto flex items-center gap-1.5 pt-5 text-[13px] text-faint transition-colors group-hover:text-fg">
                      Open board
                      <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              );
            })}
            <li className="animate-in" style={{ "--i": boards.length } as React.CSSProperties}>
              <button
                type="button"
                onClick={openNewBoard}
                className="pressable flex h-full min-h-[156px] w-full flex-col items-center justify-center gap-2 border border-dashed border-white/[0.14] bg-[rgba(13,13,13,0.5)] text-[13.5px] text-faint backdrop-blur-[10px] hover:border-white/30 hover:bg-[rgba(30,30,33,0.55)] hover:text-fg"
                style={{ borderRadius: 14 }}
              >
                <Plus size={18} />
                New board
              </button>
            </li>
          </ul>
        )}
      </div>

      {deleting && (
        <ConfirmDialog
          title={`Delete "${deleting.title}"?`}
          body="This deletes the board with all its columns, tasks, sprints and epics. This can't be undone."
          confirmLabel="Delete board"
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteBoard(deleting)}
        />
      )}

      {/* The modal: a fixed overlay, conditionally rendered. No library —
          `isModalOpen` decides whether any of this exists. */}
      {isModalOpen && (
        <div
          className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-[3px]"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="animate-in w-full max-w-[420px] border border-line bg-[#141415] p-6"
            style={{ borderRadius: 16, boxShadow: "0 40px 90px -24px rgba(0,0,0,0.9)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-fg">New board</h2>
            <p className="mb-5 mt-1 text-[13px] text-faint">
              Starts with {STARTER_COLUMNS.join(", ")}. You can change the columns later.
            </p>
            <form onSubmit={handleCreateBoard}>
              <Field
                label="Board name"
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Q4 product roadmap"
                required
              />
              {createError && <p className="mt-4 text-[13.5px] text-[#fca5a5]">{createError}</p>}
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="pressable h-9 px-3.5 text-[13.5px] text-muted hover:text-fg"
                  style={{ borderRadius: 9 }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={creating} className={primaryButton} style={{ borderRadius: 9 }}>
                  {creating ? "Creating…" : "Create board"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
