// Dev helper until the board page exists (roadmap 3i): gives a board the
// standard columns, adds a card, and optionally assigns it to an agent — all
// with the same audit entries the API writes.
//
//   bun scripts/setup-board.ts --email you@x.com --board "login bug" \
//     --card "Fix login bug" --assign "Claude Code"

import { prisma } from "../src/lib/prisma.js";
import { writeAuditEntry } from "../src/lib/audit.js";

const COLUMNS = ["To Do", "In Progress", "Done"];

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const email = arg("email");
  const boardTitle = arg("board");
  const cardTitle = arg("card");
  const assignTo = arg("assign");
  if (!email || !boardTitle) {
    throw new Error('Usage: --email <you> --board <board title> [--card <title>] [--assign <agent name>]');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No Kolumna user with email ${email}`);
  const workspaceIds = (await prisma.membership.findMany({ where: { actorId: user.actorId } })).map(
    (m) => m.workspaceId,
  );
  const board = await prisma.board.findFirst({
    where: { workspaceId: { in: workspaceIds }, title: { equals: boardTitle, mode: "insensitive" } },
  });
  if (!board) throw new Error(`No board titled "${boardTitle}"`);
  const audit = (action: string, targetType: string, targetId: string, resource?: string) =>
    writeAuditEntry({
      workspaceId: board.workspaceId,
      actorId: user.actorId,
      action,
      targetType,
      targetId,
      result: "SUCCESS",
      resource,
    });

  const existing = await prisma.list.findMany({ where: { boardId: board.id }, orderBy: { rank: "asc" } });
  let rank = existing.length ? existing[existing.length - 1]!.rank + 1 : 1;
  for (const title of COLUMNS) {
    if (existing.some((l) => l.title.toLowerCase() === title.toLowerCase())) continue;
    const list = await prisma.list.create({
      data: { title, boardId: board.id, workspaceId: board.workspaceId, rank: rank++ },
    });
    await audit("LIST.CREATE", "List", list.id);
    console.log(`Added column "${title}"`);
  }

  if (!cardTitle) return;
  const todo = await prisma.list.findFirst({
    where: { boardId: board.id, title: { equals: "To Do", mode: "insensitive" } },
  });
  const top = await prisma.card.findFirst({ where: { listId: todo!.id }, orderBy: { rank: "desc" } });
  const card = await prisma.card.create({
    data: { title: cardTitle, listId: todo!.id, workspaceId: board.workspaceId, rank: top ? top.rank + 1 : 1 },
  });
  await audit("CARD.CREATE", "Card", card.id);
  console.log(`Added card "${cardTitle}" to To Do`);

  if (!assignTo) return;
  const agent = await prisma.agent.findFirst({
    where: {
      workspaceId: board.workspaceId,
      status: "ACTIVE",
      actor: { displayName: { equals: assignTo, mode: "insensitive" } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!agent) throw new Error(`No ACTIVE agent named "${assignTo}"`);
  await prisma.card.update({ where: { id: card.id }, data: { assigneeId: agent.actorId } });
  await audit("CARD.ASSIGN", "Card", card.id, agent.actorId);
  console.log(`Assigned it to ${assignTo}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
