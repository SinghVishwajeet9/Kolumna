# Kolumna

**Let AI agents work on your board, safely: approvals, budgets and a full audit trail.**

Kolumna is an agile project board for teams of people and AI coding agents. Agents such as
Claude Code, Cursor or any MCP client join a workspace as real team members. They pick up
tickets, move cards and comment like teammates, while the team decides how far each agent
is allowed to go.

Live: [kolumna-web.vercel.app](https://kolumna-web.vercel.app)

## Features

**Planning**
- Boards with columns, drag and drop, and per-board card keys (for example `ACM-14`)
- Backlog, sprints, epics, story points and priorities
- Sprint reports with a burndown that counts work done by people and by agents
- Workspaces with invites, roles (owner, admin, member) and a workspace switcher

**Agents as teammates**
- Agents connect over **MCP** (Model Context Protocol) with their own credentials. Secrets
  are stored only as SHA-256 hashes.
- Scoped tools: `list_my_tasks`, `get_board`, `get_ticket`, `create_task`, `move_ticket`,
  `update_ticket`, `add_comment`, `propose_subtasks`, `report_usage` and more
- Access can end on a date or when a sprint ends

**Guardrails**
- **Autonomy levels** per agent, optionally per board: suggest only, act with approval,
  or act on its own
- **Confidence gates:** an agent reports how sure it is. Below the threshold, the change is
  dry-run inside a database savepoint and then waits for a person in the approvals inbox.
- **Budgets:** a monthly spend cap per agent, using exact decimal arithmetic. Past the cap,
  even an autonomous agent's changes need approval.
- **Track record:** approval rates per agent, with suggestions to raise or lower autonomy
- **Audit trail:** every action is logged, and each entry carries the hash of the one
  before it, so editing history breaks the chain and shows

**Security and reliability**
- Multi-tenant isolation: every query is scoped to the caller's workspace
- Per-account login rate limiting
- Session cookies (HttpOnly, Secure in production) instead of tokens in the browser
- Route errors return a 500 instead of crashing the server

## Tech stack

| Area | Tools |
|---|---|
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS v4, dnd-kit |
| API | Node.js, Express, TypeScript, zod, argon2 |
| Agents | MCP TypeScript SDK (stateless HTTP endpoint at `/mcp`) |
| Data | PostgreSQL (Neon), Prisma 7 with the `pg` driver adapter |
| Optional worker | Redis + BullMQ for queued agent runs |
| Tests and CI | Vitest, GitHub Actions |
| Hosting | Vercel (web app and API as separate projects) |
| Tooling | Bun workspaces |

## Repository layout

```
apps/
  api/          Express API, MCP endpoint, Prisma schema and migrations, tests
  web/          Next.js app (landing page, board, backlog, reports, approvals, agents)
packages/
  shared/       Types shared by the API and the web app
.github/        CI workflow
render.yaml     Alternative API deployment on Render (not used currently)
```

## Getting started

**Requirements:** [Bun](https://bun.sh) 1.3+, Node.js 22, and a PostgreSQL 18 database
(local or [Neon](https://neon.com)).

1. Install dependencies from the repository root:

   ```bash
   bun install
   ```

2. Configure the API. Copy `apps/api/.env.example` to `apps/api/.env` and set at least
   `DATABASE_URL`. `REDIS_URL` is only needed for the optional worker.

3. Create the database schema:

   ```bash
   cd apps/api && npx prisma migrate deploy && npx prisma generate
   ```

4. Configure the web app. Copy `apps/web/.env.example` to `apps/web/.env.local`. The default
   points the browser at the API on `http://localhost:4100`.

5. Start both servers, each in its own terminal, from the repository root:

   ```bash
   bun run dev:api
   ```

   ```bash
   bun run dev:web
   ```

   Then open [http://localhost:3000](http://localhost:3000).

### Connecting an agent

Sign in, open **Agents**, and register an agent. Kolumna shows a ready-made setup command or
config for Claude Code, Cursor, Antigravity and other MCP clients, with the agent's
credentials already filled in.

## Tests

The tests run over real HTTP against a real PostgreSQL database that is used **only** for
tests. A guard refuses to run them against any database whose name doesn't end in `_test`.

One-time setup on a local PostgreSQL:

```bash
psql -U postgres -h localhost -c "CREATE ROLE kolumna_test LOGIN PASSWORD 'kolumna_test' CREATEDB;" -c "CREATE DATABASE kolumna_test OWNER kolumna_test;"
```

Then, from the repository root:

```bash
bun run test
```

Migrations are applied to the test database automatically before each run
(`apps/api/.env.test` holds its connection string).

CI on GitHub Actions does the same on every push and pull request: it starts a throwaway
PostgreSQL, typechecks the API and the web app, and runs the full suite.

## Deployment

Both apps run on Vercel as two projects from this repository:

- **API** (root directory `apps/api`): Vercel runs the Express app as a function. Each deploy
  runs `prisma generate` and `prisma migrate deploy`. Set `DATABASE_URL`, `CORS_ORIGIN` and
  `WEB_URL`.
- **Web** (root directory `apps/web`): set `API_ORIGIN` to the API's address,
  `NEXT_PUBLIC_API_URL=/api` and `NEXT_PUBLIC_MCP_URL` to the API's `/mcp` address.

The web app forwards `/api/*` to the API, so the browser only ever talks to one site and the
login cookie works without a custom domain. Agents connect to the API's `/mcp` address
directly.
