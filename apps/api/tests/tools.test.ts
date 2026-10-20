// Step 3c — the enforcement pipeline in gateway/tools.ts and the hosted-run
// grant in gateway/runs.ts. Each test targets one roadmap gap (G1–G5) and
// checks the AUDIT side effect, not just the return value — an unaudited
// denial would pass a return-value-only test.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { callTool, describeTools, ToolError, type ToolErrorCode } from "../src/gateway/tools.js";
import { createGrant } from "../src/gateway/agentGrant.repo.js";
import { startRun, RunRefusedError } from "../src/gateway/runs.js";

const runTag = Date.now().toString(36);
const created = { actorIds: [] as string[], workspaceIds: [] as string[] };

let workspaceId: string;
let humanActorId: string;
let agentId: string;
let agentActorId: string;
let cardId: string;
let otherTenantCardId: string;

async function makeAgent(opts: { allowedScopes: string[]; status?: "ACTIVE" | "SUSPENDED" }) {
  const actor = await prisma.actor.create({ data: { type: "AGENT", displayName: `Agent ${runTag}` } });
  created.actorIds.push(actor.id);
  await prisma.membership.create({ data: { actorId: actor.id, workspaceId, role: "MEMBER" } });
  return prisma.agent.create({
    data: {
      actorId: actor.id,
      workspaceId,
      ownerActorId: humanActorId,
      modelProvider: "anthropic",
      capabilities: {},
      allowedScopes: opts.allowedScopes,
      autonomyLevel: "ACT_AUTONOMOUS", // these tests are about the pipeline before Phase 4's gate
      status: opts.status ?? "ACTIVE",
      clientId: `test_${runTag}_${Math.random().toString(36).slice(2)}`,
      hashedClientSecret: "x",
    },
  });
}

async function grantFor(id: string, scopes: string[], ttlSeconds = 600) {
  const { grant } = await createGrant({
    agentId: id,
    workspaceId,
    scopes,
    ttlSeconds,
    issuedByActorId: humanActorId,
  });
  return grant;
}

async function expectToolError(promise: Promise<unknown>, code: ToolErrorCode) {
  const err = await promise.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(ToolError);
  expect((err as ToolError).code).toBe(code);
}

async function lastAudit() {
  return prisma.auditEntry.findFirst({ where: { workspaceId }, orderBy: { seq: "desc" } });
}

beforeAll(async () => {
  const human = await prisma.actor.create({ data: { type: "HUMAN", displayName: `Human ${runTag}` } });
  humanActorId = human.id;
  created.actorIds.push(human.id);

  const ws = await prisma.workspace.create({
    data: {
      name: "Tools Test",
      slug: `tools-test-${runTag}`,
      members: { create: { actorId: human.id, role: "OWNER" } },
    },
  });
  workspaceId = ws.id;
  created.workspaceIds.push(ws.id);

  const board = await prisma.board.create({ data: { title: "B", key: "B", nextCardNumber: 2, workspaceId } });
  const list = await prisma.list.create({ data: { title: "L", boardId: board.id, workspaceId, rank: 1 } });
  cardId = (
    await prisma.card.create({
      data: { title: "Fix the thing", listId: list.id, boardId: board.id, number: 1, workspaceId, rank: 1 },
    })
  ).id;

  const agent = await makeAgent({ allowedScopes: ["card:read", "card:write"] });
  agentId = agent.id;
  agentActorId = agent.actorId;
  // card:write only covers cards assigned to the agent.
  await prisma.card.update({ where: { id: cardId }, data: { assigneeId: agentActorId } });

  // A second tenant whose card the agent must never reach.
  const other = await prisma.workspace.create({ data: { name: "Other", slug: `tools-other-${runTag}` } });
  created.workspaceIds.push(other.id);
  const ob = await prisma.board.create({ data: { title: "OB", key: "OB", nextCardNumber: 2, workspaceId: other.id } });
  const ol = await prisma.list.create({ data: { title: "OL", boardId: ob.id, workspaceId: other.id, rank: 1 } });
  otherTenantCardId = (
    await prisma.card.create({
      data: { title: "Secret", listId: ol.id, boardId: ob.id, number: 1, workspaceId: other.id, rank: 1 },
    })
  ).id;
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: created.workspaceIds } } });
  await prisma.actor.deleteMany({ where: { id: { in: created.actorIds } } });
});

describe("callTool enforcement pipeline", () => {
  it("allows a scoped call and audits it with toolInvoked (G5)", async () => {
    const grant = await grantFor(agentId, ["card:read"]);
    const out = (await callTool("get_ticket", { cardId }, { grantId: grant.id })) as { title: string };
    expect(out.title).toBe("Fix the thing");

    const entry = await lastAudit();
    expect(entry?.action).toBe("AGENT.GET_TICKET");
    expect(entry?.toolInvoked).toBe("get_ticket");
    expect(entry?.result).toBe("SUCCESS");
    expect(entry?.actorId).toBe(agentActorId);
  });

  it("denies a call outside the grant's scopes and audits the denial (G5)", async () => {
    const grant = await grantFor(agentId, ["card:read"]); // no card:write
    await expectToolError(
      callTool("propose_subtasks", { cardId, subtasks: ["a"], reasoningSummary: "r" }, { grantId: grant.id }),
      "FORBIDDEN",
    );
    const entry = await lastAudit();
    expect(entry?.result).toBe("DENIED");
    expect(entry?.toolInvoked).toBe("propose_subtasks");
  });

  it("rejects and audits an unknown tool", async () => {
    const grant = await grantFor(agentId, ["card:read"]);
    await expectToolError(callTool("delete_everything", {}, { grantId: grant.id }), "UNKNOWN_TOOL");
    expect((await lastAudit())?.result).toBe("ERROR");
  });

  it("rejects malformed input before the handler runs (G1)", async () => {
    const grant = await grantFor(agentId, ["card:write"]);
    const before = await prisma.subtaskProposal.count({ where: { workspaceId } });
    await expectToolError(
      // subtasks as a string — the old handler would have crashed on .map
      callTool("propose_subtasks", { cardId, subtasks: "fix it", reasoningSummary: "r" }, { grantId: grant.id }),
      "INVALID_INPUT",
    );
    expect(await prisma.subtaskProposal.count({ where: { workspaceId } })).toBe(before);
    expect((await lastAudit())?.result).toBe("ERROR");
  });

  it("rejects a revoked grant", async () => {
    const grant = await grantFor(agentId, ["card:read"]);
    await prisma.agentGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
    await expectToolError(callTool("get_ticket", { cardId }, { grantId: grant.id }), "GRANT_INVALID");
  });

  it("rejects a live grant once its agent is suspended (G6 re-check)", async () => {
    const agent = await makeAgent({ allowedScopes: ["card:read"] });
    const grant = await grantFor(agent.id, ["card:read"]);
    await prisma.agent.update({ where: { id: agent.id }, data: { status: "SUSPENDED" } });
    await expectToolError(callTool("get_ticket", { cardId }, { grantId: grant.id }), "AGENT_INACTIVE");
    expect((await lastAudit())?.result).toBe("DENIED");
  });

  it("cannot reach another tenant's card, even with the right scope", async () => {
    const grant = await grantFor(agentId, ["card:read"]);
    await expectToolError(
      callTool("get_ticket", { cardId: otherTenantCardId }, { grantId: grant.id }),
      "NOT_FOUND",
    );
  });

  it("only advertises tools the grant's scopes allow", () => {
    expect(describeTools(["card:read"]).map((t) => t.name)).toEqual(["list_my_tasks", "get_ticket", "report_usage"]);
    const [propose] = describeTools(["card:write"]);
    expect(propose!.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
  });
});

describe("workspace-wide tools", () => {
  it("assign_task refuses to hand work to a suspended agent", async () => {
    const assigner = await makeAgent({ allowedScopes: ["card:assign"] });
    const sleeping = await makeAgent({ allowedScopes: ["card:read"], status: "SUSPENDED" });
    const grant = await grantFor(assigner.id, ["card:assign"]);
    await expectToolError(
      callTool("assign_task", { cardId, assigneeActorId: sleeping.actorId }, { grantId: grant.id }),
      "FORBIDDEN",
    );
    expect((await lastAudit())?.result).toBe("DENIED");
  });

  it("create_task adds a card to a named column", async () => {
    const creator = await makeAgent({ allowedScopes: ["card:create"] });
    const grant = await grantFor(creator.id, ["card:create"]);
    const board = await prisma.board.findFirst({ where: { workspaceId } });
    const out = (await callTool(
      "create_task",
      { boardId: board!.id, column: "l", title: "New task" }, // column match is case-insensitive
      { grantId: grant.id },
    )) as { cardId: string; column: string };
    expect(out.column).toBe("L");
    expect((await prisma.card.findUnique({ where: { id: out.cardId } }))?.title).toBe("New task");
  });

  it("complete_checklist_item rejects evidence that isn't a URL", async () => {
    const grant = await grantFor(agentId, ["card:write"]);
    const added = (await callTool(
      "add_checklist_items",
      { cardId, items: ["step"] },
      { grantId: grant.id },
    )) as { items: { itemId: string }[] };
    await expectToolError(
      callTool(
        "complete_checklist_item",
        { itemId: added.items[0]!.itemId, evidenceUrl: "trust me it's done" },
        { grantId: grant.id },
      ),
      "INVALID_INPUT",
    );
  });
});

describe("hosted runs", () => {
  it("startRun refuses an agent that isn't ACTIVE (G6)", async () => {
    const agent = await makeAgent({ allowedScopes: ["card:read"], status: "SUSPENDED" });
    await expect(
      startRun({ workspaceId, agentId: agent.id, requestedByActorId: humanActorId, runId: `r-${runTag}-x` }),
    ).rejects.toBeInstanceOf(RunRefusedError);
  });

  it("propose_subtasks in a run: PENDING proposal, delegated + atomic audit, no card (G3)", async () => {
    const runId = `run-${runTag}-1`;
    const call = await startRun({ workspaceId, agentId, requestedByActorId: humanActorId, runId });
    const cardsBefore = await prisma.card.count({ where: { workspaceId } });

    const out = (await callTool(
      "propose_subtasks",
      { cardId, subtasks: ["Write the failing test", "Fix it"], reasoningSummary: "red, then green" },
      call,
    )) as { proposalId: string; status: string };

    expect(out.status).toBe("PENDING");
    const proposal = await prisma.subtaskProposal.findUnique({ where: { id: out.proposalId } });
    expect(proposal?.runId).toBe(runId);

    const entry = await lastAudit();
    expect(entry?.action).toBe("AGENT.PROPOSE_SUBTASKS");
    expect(entry?.result).toBe("PENDING_APPROVAL");
    expect(entry?.resource).toBe(out.proposalId);
    expect(entry?.actorId).toBe(agentActorId);
    expect(entry?.onBehalfOfActorId).toBe(humanActorId); // delegation, finally real

    expect(await prisma.card.count({ where: { workspaceId } })).toBe(cardsBefore);
  });

  it("a retried run returns the same proposal instead of duplicating it (G4)", async () => {
    const runId = `run-${runTag}-retry`;
    const input = { cardId, subtasks: ["a", "b"], reasoningSummary: "r" };

    const first = await startRun({ workspaceId, agentId, requestedByActorId: humanActorId, runId });
    const a = (await callTool("propose_subtasks", input, first)) as { proposalId: string };
    const auditCount = await prisma.auditEntry.count({ where: { workspaceId } });

    // The retry: a fresh job attempt gets a fresh grant but the same runId.
    const retry = await startRun({ workspaceId, agentId, requestedByActorId: humanActorId, runId });
    const b = (await callTool("propose_subtasks", input, retry)) as { proposalId: string };

    expect(b.proposalId).toBe(a.proposalId);
    expect(await prisma.subtaskProposal.count({ where: { runId } })).toBe(1);
    expect(await prisma.auditEntry.count({ where: { workspaceId } })).toBe(auditCount);
  });
});
