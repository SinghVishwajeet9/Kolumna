import { findCardAnyWorkspace } from "../repositories/card.repo.js";
import { prisma } from "../lib/prisma.js";
import { writeAuditEntry } from "../lib/audit.js";

export type ToolContext = {
  workspaceId: string;
  agentId: string;
  actorId: string;
  scopes: string[];
};

export type Tool<TInput = any> = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  requiredScope: string;
  handler: (input: TInput, ctx: ToolContext) => Promise<unknown>;
};

export const getTicketTool: Tool<{ cardId: string }> = {
  name: "get_ticket",
  description: "Fetch a card's current title, description, and status by id.",
  inputSchema: {
    type: "object",
    properties: {
      cardId: { type: "string", description: "The card's id" },
    },
    required: ["cardId"],
  },
  requiredScope: "card:read",
  handler: async (input, ctx) => {
    const card = await findCardAnyWorkspace(ctx.actorId, input.cardId);
    if (!card || card.workspaceId !== ctx.workspaceId) {
      throw new Error("Card not found");
    }
    return {
      id: card.id,
      title: card.title,
      description: card.description,
      assigneeId: card.assigneeId,
    };
  },
};

type ProposeSubtasksInput = {
  cardId: string;
  subtasks: string[];
  reasoningSummary: string;
};

// Deliberately does NOT create any Card rows. This only records a proposal
// (PENDING) and audits that it happened (result: PENDING_APPROVAL) — the
// board doesn't change until a human approves it via the review endpoint.
// See SubtaskProposal in schema.prisma for why this needs its own table
// instead of living only in AuditEntry.
export const proposeSubtasksTool: Tool<ProposeSubtasksInput> = {
  name: "propose_subtasks",
  description:
    "Propose a breakdown of a ticket into subtasks. Does not create cards directly — a human must approve the proposal first.",
  inputSchema: {
    type: "object",
    properties: {
      cardId: { type: "string", description: "The parent ticket's id" },
      subtasks: {
        type: "array",
        items: { type: "string" },
        description: "Proposed subtask titles, in order",
      },
      reasoningSummary: {
        type: "string",
        description: "Why this breakdown — shown to the human reviewer",
      },
    },
    required: ["cardId", "subtasks", "reasoningSummary"],
  },
  requiredScope: "card:write",
  handler: async (input, ctx) => {
    const card = await findCardAnyWorkspace(ctx.actorId, input.cardId);
    if (!card || card.workspaceId !== ctx.workspaceId) {
      throw new Error("Card not found");
    }

    const proposal = await prisma.subtaskProposal.create({
      data: {
        workspaceId: ctx.workspaceId,
        cardId: input.cardId,
        proposedByActorId: ctx.actorId,
        subtasks: input.subtasks.map((title) => ({ title })),
        reasoningSummary: input.reasoningSummary,
      },
    });

    await writeAuditEntry({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      action: "AGENT.PROPOSE_SUBTASKS",
      targetType: "Card",
      targetId: input.cardId,
      result: "PENDING_APPROVAL",
      reasoningSummary: input.reasoningSummary,
      resource: proposal.id,
    });

    return { proposalId: proposal.id, status: proposal.status };
  },
};

// The full set of tools an agent can call. Adding a new tool means adding it
// here — nothing else needs to know the list grew.
export const tools: Tool<any>[] = [getTicketTool, proposeSubtasksTool];

// Two distinct failure modes on purpose: "this tool doesn't exist" (the
// model hallucinated a name, or a stale MCP client is asking for a tool we
// removed) is a different problem than "this tool exists but the agent's
// grant doesn't cover it" (an authorization failure — the interesting one,
// since it's the actual enforcement of Phase 1's scopes). Callers (the
// worker's agent loop) can tell them apart by message if they ever need to.
export async function callTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: "${name}"`);
  }

  if (!ctx.scopes.includes(tool.requiredScope)) {
    throw new Error(
      `Agent's grant does not include required scope "${tool.requiredScope}" for tool "${name}"`,
    );
  }

  return tool.handler(input, ctx);
}
