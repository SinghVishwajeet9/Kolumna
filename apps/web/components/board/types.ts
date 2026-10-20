// Shapes returned by the API for the board page.

export type ActorRef = { id: string; displayName: string; type: "HUMAN" | "AGENT" };

export type Priority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type EpicRef = { id: string; title: string; color: string };
export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED";

export type BoardCard = {
  id: string;
  listId: string;
  title: string;
  rank: number;
  number: number;
  priority: Priority;
  storyPoints: number | null;
  epic: EpicRef | null;
  assignee: ActorRef | null;
  checklistItems: { done: boolean }[];
  _count: { comments: number };
};

export type BoardList = { id: string; title: string; rank: number; cards: BoardCard[] };

export type ActiveSprint = {
  id: string;
  name: string;
  goal: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export type Board = {
  id: string;
  title: string;
  key: string;
  workspaceId: string;
  lists: BoardList[];
  activeSprint: ActiveSprint | null;
};

// Backlog page shapes (GET /boards/:id/backlog).
export type BacklogCard = {
  id: string;
  title: string;
  number: number;
  priority: Priority;
  storyPoints: number | null;
  sprintId: string | null;
  epic: EpicRef | null;
  assignee: ActorRef | null;
  list: { id: string; title: string };
};

export type BacklogSprint = {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startsAt: string | null;
  endsAt: string | null;
  cards: BacklogCard[];
  costUsd: string | null; // Phase 5: agent spend in this sprint
};

export type Backlog = {
  board: { id: string; workspaceId: string; key: string; title: string };
  lists: { id: string; title: string }[];
  doneListId: string | null;
  sprints: BacklogSprint[];
  backlog: BacklogCard[];
};

export type Epic = EpicRef & { description: string | null; cardCount: number; doneCount: number; costUsd: string | null };
export type SprintSummary = { id: string; name: string; status: SprintStatus };

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
  number: number;
  priority: Priority;
  storyPoints: number | null;
  board: { key: string };
  epic: EpicRef | null;
  sprint: SprintSummary | null;
  reviewThreshold: number | null;
  cost: { costUsd: string | null; tokens: number; events: number };
  reviews: {
    id: string;
    toolName: string;
    summary: string;
    confidence: number | null;
    reasoning: string | null;
    reason: "AUTONOMY_LEVEL" | "LOW_CONFIDENCE";
    status: "PENDING" | "APPROVED" | "REJECTED" | "FAILED";
    note: string | null;
    error: string | null;
    createdAt: string;
    decidedAt: string | null;
    agentId: string;
    agent: { actor: { displayName: string } };
  }[];
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

export const PRIORITIES: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"];

export function daysLeft(endsAt: string | null) {
  if (!endsAt) return null;
  return Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000);
}
