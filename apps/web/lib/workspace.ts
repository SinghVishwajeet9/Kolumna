// Which workspace the app is showing. A person can belong to several (their
// own, plus any they were invited to), so every page asks this instead of
// taking the first one. The choice is remembered per browser; if it's
// missing or stale (e.g. they were removed), it falls back to the first.

import { api } from "./api-client";

export type WorkspaceRef = { id: string; name: string };

const KEY = "kolumna:workspace";

export function pickWorkspace<T extends WorkspaceRef>(list: T[]): T | null {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {}
  return list.find((w) => w.id === saved) ?? list[0] ?? null;
}

export async function currentWorkspace<T extends WorkspaceRef = WorkspaceRef>(): Promise<T | null> {
  return pickWorkspace(await api.get<T[]>("/workspaces"));
}

/** Switch and reload into it — every page refetches for the new workspace. */
export function switchWorkspace(id: string, to = "/boards") {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  window.location.assign(to);
}
