// Shapes returned by the API for the board page.

export type ActorRef = { id: string; displayName: string; type: "HUMAN" | "AGENT" };

export type BoardCard = {
  id: string;
  listId: string;
  title: string;
  rank: number;
  assignee: ActorRef | null;
  checklistItems: { done: boolean }[];
  _count: { comments: number };
};

export type BoardList = { id: string; title: string; rank: number; cards: BoardCard[] };

export type Board = { id: string; title: string; workspaceId: string; lists: BoardList[] };

export type Member = {
  actorId: string;
  name: string;
  type: "HUMAN" | "AGENT";
  agentStatus: string | null;
};

export type ChecklistItem = {
  id: string;
  title: string;
  done: boolean;
  evidenceUrl: string | null;
};

export type CardDetails = {
  id: string;
  title: string;
  description: string | null;
  list: { id: string; title: string; boardId: string };
  assignee: ActorRef | null;
  checklistItems: ChecklistItem[];
  comments: { id: string; body: string; createdAt: string; author: ActorRef }[];
  subtaskProposals: {
    id: string;
    subtasks: { title: string }[];
    reasoningSummary: string | null;
    createdAt: string;
  }[];
  activity: {
    id: string;
    action: string;
    result: string;
    actor: { displayName: string; type: string };
    onBehalfOf: { displayName: string } | null;
    createdAt: string;
  }[];
};

export function progressOf(items: { done: boolean }[]) {
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}
