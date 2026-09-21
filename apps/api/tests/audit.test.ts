// Proves the audit log's core claim: it's not just "entries get written," it's
// "tampering with a past entry is DETECTABLE." A test that only checks the
// happy path (entries exist) can't fail in a way that would catch a broken
// hash chain — so this test deliberately corrupts a row afterward and asserts
// verification actually notices. See lib/audit.ts and PHASE_2.md.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { getLineageForTarget, verifyChain, writeAuditEntry, GENESIS_HASH } from "../src/lib/audit.js";

const runId = Date.now().toString(36);
let workspaceId: string;
let actorId: string;

beforeAll(async () => {
  const actor = await prisma.actor.create({
    data: { type: "HUMAN", displayName: `Audit Test Actor ${runId}` },
  });
  actorId = actor.id;

  const workspace = await prisma.workspace.create({
    data: {
      name: "Audit Test Workspace",
      slug: `audit-test-${runId}`,
      members: { create: { actorId, role: "OWNER" } },
    },
  });
  workspaceId = workspace.id;
});

afterAll(async () => {
  await prisma.auditEntry.deleteMany({ where: { workspaceId } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.actor.deleteMany({ where: { id: actorId } });
});

describe("audit chain", () => {
  it("the first entry in a workspace chains to the genesis hash", async () => {
    const entry = await writeAuditEntry({
      workspaceId,
      actorId,
      action: "CARD.CREATE",
      targetType: "Card",
      targetId: "card-1",
      result: "SUCCESS",
    });
    expect(entry.seq).toBe(1);
    expect(entry.prevHash).toBe(GENESIS_HASH);
  });

  it("each subsequent entry chains to the previous entry's hash", async () => {
    const prev = await prisma.auditEntry.findFirst({
      where: { workspaceId },
      orderBy: { seq: "desc" },
    });

    const entry = await writeAuditEntry({
      workspaceId,
      actorId,
      action: "CARD.ASSIGN",
      targetType: "Card",
      targetId: "card-1",
      result: "SUCCESS",
    });

    expect(entry.seq).toBe(2);
    expect(entry.prevHash).toBe(prev!.hash);
  });

  it("verifyChain reports valid for an untouched chain", async () => {
    await writeAuditEntry({
      workspaceId,
      actorId,
      action: "CARD.MOVE",
      targetType: "Card",
      targetId: "card-1",
      result: "SUCCESS",
    });

    const result = await verifyChain(workspaceId);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.entriesChecked).toBe(3);
  });

  it("getLineageForTarget returns only entries for that target, oldest first", async () => {
    await writeAuditEntry({
      workspaceId,
      actorId,
      action: "AGENT.REGISTER",
      targetType: "Agent",
      targetId: "agent-1",
      result: "SUCCESS",
    });

    const lineage = await getLineageForTarget(workspaceId, "Card", "card-1");
    expect(lineage).toHaveLength(3);
    expect(lineage.map((e) => e.action)).toEqual(["CARD.CREATE", "CARD.ASSIGN", "CARD.MOVE"]);
  });

  // The actual proof this is tamper-EVIDENT, not just tamper-resistant in
  // theory: directly edit a past row (bypassing the writer, the way an
  // attacker with raw DB access would) and confirm verification catches it.
  it("detects a tampered historical entry", async () => {
    const target = await prisma.auditEntry.findFirst({
      where: { workspaceId, action: "CARD.CREATE" },
    });

    await prisma.auditEntry.update({
      where: { id: target!.id },
      data: { action: "CARD.DELETE" }, // rewriting history, undetected by anyone NOT re-verifying
    });

    const result = await verifyChain(workspaceId);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.brokenAtSeq).toBe(target!.seq);
      expect(result.reason).toBe("hash mismatch");
    }
  });
});
