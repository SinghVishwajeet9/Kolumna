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
import { CornerMarks } from "@/components/ui/CornerMarks";
import { GooeyButton } from "@/components/marketing/GooeyButton";

type Workspace = { id: string; name: string; slug: string };
type Board = { id: string; title: string };

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

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-6 py-14 lg:py-20">
        <div className="mb-12 flex items-end justify-between gap-4">
          <div>
            <h1
              className="text-[clamp(2rem,4vw,3rem)] font-medium tracking-[-0.02em]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Your <span className="text-accent">boards</span>
            </h1>
            {workspace && (
              <p className="mt-2 text-[15px] text-muted">{workspace.name}</p>
            )}
          </div>

          {workspace && (
          <GooeyButton
            onClick={() => {
              setCreateError(null);
              setIsModalOpen(true);
            }}
            className="group flex shrink-0 items-center gap-2 bg-[#ffffff] px-6 py-3.5 text-[15px] font-medium text-bg"
            style={{ borderRadius: "8px", fontFamily: "var(--font-mono)" }}
          >
            + New board
          </GooeyButton>
          )}
        </div>

        {loading && <PageLoader />}

        {!loading && error && (
          <div className="flex items-center gap-4 text-[15px] text-muted">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                void load();
              }}
              className="text-accent hover:underline"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              retry
            </button>
          </div>
        )}

        {!loading && !error && !workspace && (
          <div
            className="relative border border-dashed border-line px-8 py-16 text-center"
            style={{ borderRadius: "14px" }}
          >
            <CornerMarks />
            <p className="text-[17px] text-muted">You&apos;re not in a workspace yet.</p>
            <p className="mt-1 text-[14px] text-faint">
              Create your own, or open an invite link from a teammate to join theirs.
            </p>
            <button
              type="button"
              onClick={() => void createOwnWorkspace()}
              disabled={makingWorkspace}
              className="mt-6 bg-[#ffffff] px-6 py-3 text-[14px] font-medium text-bg disabled:opacity-60"
              style={{ borderRadius: "8px", fontFamily: "var(--font-mono)" }}
            >
              {makingWorkspace ? "Creating…" : "Create a workspace"}
            </button>
          </div>
        )}

        {!loading && !error && workspace && boards.length === 0 && (
          <div
            className="relative border border-dashed border-line px-8 py-16 text-center"
            style={{ borderRadius: "14px" }}
          >
            <CornerMarks />
            <p className="text-[17px] text-muted">No boards yet.</p>
            <p className="mt-1 text-[14px] text-faint">
              Create your first board to start putting work in columns.
            </p>
          </div>
        )}

        {!loading && !error && boards.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board, i) => {
              const color = CARD_COLORS[i % CARD_COLORS.length];
              return (
                <li key={board.id}>
                  <Link
                    href={`/b/${board.id}`}
                    className="group relative block border p-6 transition-transform duration-200 hover:-translate-y-1"
                    style={{
                      borderRadius: "12px",
                      borderColor: `${color}55`,
                      backgroundColor: `${color}10`,
                    }}
                  >
                    <span
                      className="mb-6 flex items-center justify-center"
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "9px",
                        backgroundColor: `${color}1f`,
                      }}
                    >
                      <LogoMark style={{ width: "20px", color }} />
                    </span>
                    <p className="text-[17px] font-medium leading-snug text-fg">
                      {board.title}
                    </p>
                    <span
                      className="mt-3 inline-block text-[13px] text-faint transition-transform group-hover:translate-x-0.5"
                      style={{ fontFamily: "var(--font-mono)", color }}
                    >
                      open →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* The modal: a fixed overlay, conditionally rendered. No library —
          `isModalOpen` decides whether any of this exists. */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="animate-rise relative w-full max-w-[420px] border border-line bg-surface p-7"
            style={{
              borderRadius: "16px",
              boxShadow: "0 40px 90px -24px rgba(0,0,0,0.9)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <CornerMarks />
            <h2
              className="mb-6 text-[22px] font-medium tracking-[-0.01em]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              New board
            </h2>
            <form onSubmit={handleCreateBoard}>
              <Field
                label="Board title"
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Q4 Product Roadmap"
                required
              />
              {createError && <p className="mt-4 text-[14px] text-[#fca5a5]">{createError}</p>}
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-[14px] text-muted transition-colors hover:text-fg"
                >
                  Cancel
                </button>
                <GooeyButton
                  type="submit"
                  disabled={creating}
                  className="group flex items-center bg-[#ffffff] px-6 py-2.5 text-[14px] font-medium text-bg disabled:opacity-60"
                  style={{ borderRadius: "8px", fontFamily: "var(--font-mono)" }}
                >
                  {creating ? "Creating…" : "Create board"}
                </GooeyButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
