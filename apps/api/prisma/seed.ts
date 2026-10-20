// Seeds two completely separate tenants — Acme (Alice) and Globex (Bob).
// Two, deliberately: Day 3's tenant-isolation test needs a second workspace
// to prove Alice can't see Bob's data, and vice versa. See ARCHITECTURE.md §6.
//
// Run with: bunx prisma db seed  (or: bun prisma/seed.ts)

import { prisma } from "../src/lib/prisma.js";

// Cards need their board and a per-board number (PR-1, PR-2…).
function numbered<T>(boardId: string, cards: T[]) {
  return cards.map((c, i) => ({ ...c, boardId, number: i + 1 }));
}

async function main() {
  // Wipe existing data first so this script is safe to re-run.
  // Order matters: children before parents, or foreign keys reject the delete.
  await prisma.cardLabel.deleteMany();
  await prisma.card.deleteMany();
  await prisma.list.deleteMany();
  await prisma.label.deleteMany();
  await prisma.board.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.actor.deleteMany();

  // --- Tenant 1: Acme, owned by Alice --------------------------------

  const aliceActor = await prisma.actor.create({
    data: { type: "HUMAN", displayName: "Alice" },
  });
  const alice = await prisma.user.create({
    data: {
      actorId: aliceActor.id,
      email: "alice@kolumna.dev",
      // Real hashing arrives Day 4 (Argon2/bcrypt via Lucia). This is a
      // placeholder — nothing in this seed data is ever meant to log in.
      hashedPassword: "placeholder",
      name: "Alice",
    },
  });

  const acme = await prisma.workspace.create({
    data: {
      name: "Acme",
      slug: "acme",
      members: {
        create: { actorId: aliceActor.id, role: "OWNER" },
      },
    },
  });

  const acmeBoard = await prisma.board.create({
    data: { title: "Product Roadmap", key: "PR", nextCardNumber: 5, workspaceId: acme.id },
  });

  const acmeLists = await Promise.all(
    [
      { title: "To Do", rank: 1.0 },
      { title: "In Progress", rank: 2.0 },
      { title: "Done", rank: 3.0 },
    ].map((list) =>
      prisma.list.create({
        data: { ...list, boardId: acmeBoard.id, workspaceId: acme.id },
      }),
    ),
  );

  await prisma.card.createMany({
    data: numbered(acmeBoard.id, [
      {
        title: "Design the onboarding flow",
        rank: 1.0,
        listId: acmeLists[0]!.id,
        workspaceId: acme.id,
      },
      {
        title: "Write the pricing page copy",
        rank: 2.0,
        listId: acmeLists[0]!.id,
        workspaceId: acme.id,
      },
      {
        title: "Build the drag-and-drop board",
        rank: 1.0,
        listId: acmeLists[1]!.id,
        workspaceId: acme.id,
      },
      {
        title: "Set up the Neon database",
        rank: 1.0,
        listId: acmeLists[2]!.id,
        workspaceId: acme.id,
      },
    ]),
  });

  // --- Tenant 2: Globex, owned by Bob ---------------------------------
  // Structurally identical to Acme, deliberately — the isolation test
  // shouldn't need special-cased data to prove separation.

  const bobActor = await prisma.actor.create({
    data: { type: "HUMAN", displayName: "Bob" },
  });
  const bob = await prisma.user.create({
    data: {
      actorId: bobActor.id,
      email: "bob@kolumna.dev",
      hashedPassword: "placeholder",
      name: "Bob",
    },
  });

  const globex = await prisma.workspace.create({
    data: {
      name: "Globex",
      slug: "globex",
      members: {
        create: { actorId: bobActor.id, role: "OWNER" },
      },
    },
  });

  const globexBoard = await prisma.board.create({
    data: { title: "Q3 Launch", key: "QL", nextCardNumber: 3, workspaceId: globex.id },
  });

  const globexLists = await Promise.all(
    [
      { title: "Backlog", rank: 1.0 },
      { title: "Doing", rank: 2.0 },
      { title: "Shipped", rank: 3.0 },
    ].map((list) =>
      prisma.list.create({
        data: { ...list, boardId: globexBoard.id, workspaceId: globex.id },
      }),
    ),
  );

  await prisma.card.createMany({
    data: numbered(globexBoard.id, [
      {
        title: "Draft the launch announcement",
        rank: 1.0,
        listId: globexLists[0]!.id,
        workspaceId: globex.id,
      },
      {
        title: "Load-test the checkout flow",
        rank: 1.0,
        listId: globexLists[1]!.id,
        workspaceId: globex.id,
      },
    ]),
  });

  console.log("Seeded:");
  console.log(`  Acme  (${acme.id}) — owner ${alice.email}`);
  console.log(`  Globex (${globex.id}) — owner ${bob.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
