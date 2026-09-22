// Proves the scope check in gateway/tools.ts actually blocks a call, not
// just that a well-scoped call succeeds. Also proves propose_subtasks does
// exactly what it's supposed to: writes a PENDING SubtaskProposal and a
// PENDING_APPROVAL audit entry, and creates no Card.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { callTool, type ToolContext } from "../src/gateway/tools.js";

const runId = Date.now().toString(36);
let workspaceId: string;
let actorId: string;
let cardId: string;

beforeAll(async () => {
  const actor = await prisma.actor.create({
    data: { type: "AGENT", displayName: `Tools Test Agent ${runId}` },
  });
  actorId = actor.id;

  const workspace = await prisma.workspace.create({
    data: {
      name: "Tools Test Workspace",
      slug: `tools-test-${runId}`,
      members: { create: { actorId, role: "MEMBER" } },
    },
  });
  workspaceId = workspace.id;

  const board = await prisma.board.create({
    data: { title: "Board", workspaceId },
  });
  const list = await prisma.list.create({
    data: { title: "List", boardId: board.id, workspaceId, rank: 1 },
  });
  const card = await prisma.card.create({
    data: { title: "Fix the thing", listId: list.id, workspaceId, rank: 1 },
  });
  cardId = card.id;
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.actor.deleteMany({ where: { id: actorId } });
});

function ctx(scopes: string[]): ToolContext {
  return { workspaceId, agentId: "agent-1", actorId, scopes };
}

describe("callTool", () => {
  it("rejects an unknown tool name", async () => {
    await expect(callTool("delete_the_database", {}, ctx(["card:read"]))).rejects.toThrow(
      /unknown tool/i,
    );
  });

  it("rejects a call when the grant is missing the required scope", async () => {
    await expect(
      callTool("get_ticket", { cardId }, ctx(["board:read"])), // no card:read
    ).rejects.toThrow(/does not include required scope/i);
  });

  it("allows the call when the grant has the required scope", async () => {
    const result = (await callTool("get_ticket", { cardId }, ctx(["card:read"]))) as {
      id: string;
      title: string;
    };
    expect(result.id).toBe(cardId);
    expect(result.title).toBe("Fix the thing");
  });

  it("propose_subtasks creates a PENDING proposal and a PENDING_APPROVAL audit entry, no Card", async () => {
    const cardCountBefore = await prisma.card.count({ where: { workspaceId } });

    const result = (await callTool(
      "propose_subtasks",
      {
        cardId,
        subtasks: ["Write the failing test", "Fix the bug", "Verify the fix"],
        reasoningSummary: "Breaking this down into a red-green-verify sequence.",
      },
      ctx(["card:write"]),
    )) as { proposalId: string; status: string };

    expect(result.status).toBe("PENDING");

    const proposal = await prisma.subtaskProposal.findUnique({
      where: { id: result.proposalId },
    });
    expect(proposal?.subtasks).toEqual([
      { title: "Write the failing test" },
      { title: "Fix the bug" },
      { title: "Verify the fix" },
    ]);

    const auditEntry = await prisma.auditEntry.findFirst({
      where: { workspaceId, action: "AGENT.PROPOSE_SUBTASKS" },
    });
    expect(auditEntry?.result).toBe("PENDING_APPROVAL");
    expect(auditEntry?.resource).toBe(result.proposalId);

    const cardCountAfter = await prisma.card.count({ where: { workspaceId } });
    expect(cardCountAfter).toBe(cardCountBefore); // no card created yet
  });
});
