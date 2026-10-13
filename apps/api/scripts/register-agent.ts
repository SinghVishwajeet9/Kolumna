// Dev helper until the agents page exists (roadmap 3i): registers an agent in
// a user's workspace the same way the API does (audited, with a scope
// ceiling), activates it, and prints the command to connect Claude Code.
//
//   bun scripts/register-agent.ts --email you@x.com --name "Claude Code" \
//     --scopes board:read,card:read,card:write

import { prisma } from "../src/lib/prisma.js";
import { createAgent } from "../src/gateway/agent.repo.js";
import { writeAuditEntry } from "../src/lib/audit.js";
import { scopeListSchema } from "../src/gateway/scopes.js";
import { env } from "../src/lib/env.js";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const email = arg("email");
  const name = arg("name") ?? "Claude Code";
  const scopes = scopeListSchema.parse(
    (arg("scopes") ?? "board:read,card:read,card:write").split(","),
  );
  if (!email) throw new Error("--email is required (the Kolumna account that owns the agent)");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No Kolumna user with email ${email} — sign up in the app first`);
  const membership = await prisma.membership.findFirst({
    where: { actorId: user.actorId },
    orderBy: { createdAt: "asc" },
    include: { workspace: true },
  });
  if (!membership) throw new Error("That user has no workspace");

  const ctx = { workspaceId: membership.workspaceId, actorId: user.actorId };
  const { agent, clientId, clientSecret } = await createAgent(ctx, {
    displayName: name,
    modelProvider: "external",
    capabilities: {},
    allowedScopes: scopes,
  });
  await prisma.agent.update({ where: { id: agent.id }, data: { status: "ACTIVE" } });
  await writeAuditEntry({
    ...ctx,
    action: "AGENT.ACTIVATE",
    targetType: "Agent",
    targetId: agent.id,
    result: "SUCCESS",
  });

  const url = `http://localhost:${env.port}/mcp`;
  console.log(`\nRegistered "${name}" in workspace "${membership.workspace.name}" with scopes: ${scopes.join(", ")}`);
  console.log("The secret below is shown ONCE. Connect Claude Code with:\n");
  console.log(
    `claude mcp add --transport http kolumna ${url} --header "X-Agent-Client-Id: ${clientId}" --header "X-Agent-Client-Secret: ${clientSecret}"\n`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
