// Dev helper until assign-to-agent exists in the UI (roadmap 3i): assigns a
// card (found by title) to an agent (found by name), as the given user, with
// the same CARD.ASSIGN audit entry the API writes.
//
//   bun scripts/assign-card.ts --email you@x.com --card "Fix login bug" --agent "Claude Code"

import { prisma } from "../src/lib/prisma.js";
import { writeAuditEntry } from "../src/lib/audit.js";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const email = arg("email");
  const cardTitle = arg("card");
  const agentName = arg("agent") ?? "Claude Code";
  if (!email || !cardTitle) throw new Error("Usage: --email <you> --card <card title> [--agent <name>]");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No Kolumna user with email ${email}`);
  const workspaceIds = (
    await prisma.membership.findMany({ where: { actorId: user.actorId } })
  ).map((m) => m.workspaceId);

  const cards = await prisma.card.findMany({
    where: { workspaceId: { in: workspaceIds }, title: { equals: cardTitle, mode: "insensitive" } },
  });
  if (cards.length !== 1) {
    throw new Error(`Found ${cards.length} cards titled "${cardTitle}" — need exactly one`);
  }
  const card = cards[0]!;

  const agent = await prisma.agent.findFirst({
    where: {
      workspaceId: card.workspaceId,
      actor: { displayName: { equals: agentName, mode: "insensitive" } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!agent) throw new Error(`No agent named "${agentName}" in that workspace`);
  if (agent.status !== "ACTIVE") throw new Error(`Agent "${agentName}" is ${agent.status}`);

  await prisma.card.update({ where: { id: card.id }, data: { assigneeId: agent.actorId } });
  await writeAuditEntry({
    workspaceId: card.workspaceId,
    actorId: user.actorId,
    action: "CARD.ASSIGN",
    targetType: "Card",
    targetId: card.id,
    result: "SUCCESS",
    resource: agent.actorId,
  });
  console.log(`\nAssigned "${card.title}" to ${agentName}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
