"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type Workspace = { id: string; name: string; slug: string };
type Board = { id: string; title: string };

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

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user) {
      api.get<Workspace[]>("/workspaces").then((workspaces) => {
        if (workspaces.length > 0) {
          setWorkspace(workspaces[0]);
        }
      });
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (workspace) {
      api.get<Board[]>(`/workspaces/${workspace.id}/boards`).then((data) => {
        setBoards(data);
        setLoading(false);
      });
    }
  }, [workspace]);

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !newTitle.trim()) return;

    setCreating(true);
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
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Boards</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          + Create board
        </button>
      </div>

      {loading && <p className="text-zinc-500">Loading…</p>}

      {!loading && boards.length === 0 && (
        <p className="text-zinc-500">No boards yet.</p>
      )}

      {!loading && boards.length > 0 && (
        <ul className="flex flex-col gap-2">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/b/${board.id}`}
                className="block rounded-md border border-zinc-200 px-4 py-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                {board.title}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* The modal: just a fixed-position overlay, conditionally rendered.
          No library — `isModalOpen` decides whether any of this exists. */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-lg bg-white p-4 dark:bg-zinc-900">
            <h2 className="mb-3 font-medium text-zinc-900 dark:text-zinc-50">
              New board
            </h2>
            <form onSubmit={handleCreateBoard}>
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Board title"
                className="mb-3 w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
