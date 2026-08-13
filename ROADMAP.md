# Kolumna — 3 Week Build Roadmap

> Day-by-day plan. You write every line; this tells you **what to build, in what order,
> what you'll learn, and how to know you're done.**

---

## Reality check — read this first

**The timeline is tight but real.** It assumes roughly **4–5 focused hours per day**. If
you get 2 hours a day, this is a 5–6 week plan, and that is completely fine — the *order*
matters far more than the dates.

**Two rules that decide whether you finish:**

1. **Do not add features that aren't on this list.** Not comments, not activity feeds,
   not dark mode, not notifications. Write the idea in `IDEAS.md` and keep going. Scope
   creep is the only thing that will actually kill this project.
2. **Days 7 and 14 are buffer days.** You *will* need them. If you don't, you're ahead —
   don't fill them with new features, use them to polish.

**Checkpoints:**

| Day | You should have |
|---|---|
| 7 | A working API you can drive entirely from Postman/Thunder Client |
| 14 | **A usable Trello clone in the browser.** This is the real MVP. |
| 21 | AI feature + deployed + documented |

If everything after day 14 collapsed, you'd still have a genuinely good project. That's
intentional — the plan front-loads the thing that matters.

---

# WEEK 1 — Foundation & Backend

Goal: a complete, tested API. No UI at all this week. This feels slow. It isn't — you're
building the thing every other day depends on.

---

## Day 1 — Project setup

**Goal:** Both apps run and print hello world. Nothing more.

- [ ] `git init`, create `.gitignore` (node_modules, .env, .next, dist)
- [ ] Set up the monorepo folders from `ARCHITECTURE.md` §4
- [ ] Root `package.json` with Bun workspaces (`apps/*`, `packages/*`)
- [ ] `apps/api` — Express + TypeScript, one `GET /health` route returning `{ ok: true }`
- [ ] `apps/web` — `bun create next-app` with TypeScript + Tailwind + App Router
- [ ] `packages/shared` — empty TS package, exports one dummy type, imported by both
- [ ] `tsx` or `nodemon` so the API restarts on save
- [ ] First commit

**You'll learn:** monorepo workspaces, TypeScript config, how a Node server actually starts.

**Done when:** two terminals, `bun dev` in each, both respond in the browser.

**Watch out:** don't perfect the tsconfig. Get it compiling, move on.

---

## Day 2 — Database & schema

**Goal:** The full data model exists in a real Postgres database.

- [ ] Create a free Neon project, copy the connection string into `apps/api/.env`
- [ ] Also write `.env.example` with the keys but no values — commit that one
- [ ] `bun add prisma @prisma/client`, `bunx prisma init`
- [ ] Write `schema.prisma`: User, Session, Workspace, WorkspaceMember, Board, List, Card,
      Label, CardLabel (see `ARCHITECTURE.md` §5)
- [ ] `workspaceId` on Board, List, Card, Label — **do not skip this**
- [ ] `rank Float` on List and Card
- [ ] Indexes on `workspaceId`, `boardId`, `listId`
- [ ] `bunx prisma migrate dev --name init`
- [ ] `bunx prisma studio` — click around, confirm the tables are real
- [ ] Write `prisma/seed.ts`: 2 users, 2 workspaces, a board with 3 lists and ~6 cards

**You'll learn:** relational modeling, foreign keys, migrations, indexes.

**Done when:** Prisma Studio shows seeded data across two separate workspaces.

**Watch out:** the two seeded workspaces exist specifically so tomorrow's isolation test
has something to prove. Make sure they belong to *different* users.

---

## Day 3 — Repository layer & the isolation test

**Goal:** Make cross-tenant data access structurally impossible. This is the most
important day of week 1.

- [ ] `src/lib/prisma.ts` — one shared PrismaClient instance
- [ ] Define `TenantContext = { workspaceId: string; userId: string }`
- [ ] `src/repositories/board.repo.ts` — every function takes `ctx: TenantContext` as its
      **first parameter** and filters on `ctx.workspaceId`
- [ ] Same for `list.repo.ts`, `card.repo.ts`
- [ ] Install Vitest, configure it for the API
- [ ] **Write the isolation test:** seed workspace A and B, then assert that calling every
      repo function with A's context returns nothing belonging to B
- [ ] Add `bun test` to your daily habit

**You'll learn:** layered architecture, dependency boundaries, why tests exist.

**Done when:** the isolation test passes, and you've confirmed it *fails* when you
deliberately delete a `workspaceId` filter. **Verify the test can fail** — a test that
can't fail is worse than no test.

**Watch out:** nothing outside `repositories/` may import Prisma. Enforce it now while
there are only three files.

---

## Day 4 — Auth: signup & login

**Goal:** Users can create accounts and log in.

- [ ] Install Lucia + its Prisma adapter
- [ ] Argon2 or bcrypt for password hashing
- [ ] `POST /auth/signup` — validate with Zod, hash password, create user, create a
      personal workspace, create session, set cookie
- [ ] `POST /auth/login` — verify password, create session, set cookie
- [ ] `POST /auth/logout` — invalidate session, clear cookie
- [ ] `GET /auth/me` — return current user
- [ ] Cookies: `httpOnly`, `sameSite=lax`, `secure` in production

**You'll learn:** password hashing, session management, cookies, input validation.

**Done when:** you can sign up, log in, and hit `/auth/me` in Postman and get your user
back.

**Watch out:** on signup, create the user's first workspace in the **same transaction**.
A user with no workspace is a broken state you'll be debugging on day 9.

---

## Day 5 — Auth middleware & permissions

**Goal:** Routes are protected and tenant context is populated automatically.

- [ ] `requireAuth` middleware — reads session cookie, attaches `req.user`, else 401
- [ ] `requireWorkspaceMember` middleware — checks `WorkspaceMember`, attaches
      `req.ctx: TenantContext`, else 403
- [ ] Centralized error handler — one place that turns thrown errors into JSON responses
- [ ] Custom error classes: `NotFoundError`, `ForbiddenError`, `ValidationError`
- [ ] `GET /workspaces`, `POST /workspaces`
- [ ] Tests: 401 without a session, 403 for a workspace you don't belong to

**You'll learn:** Express middleware chains, authorization vs authentication, error handling.

**Done when:** every protected route returns 401/403 correctly, and route handlers can
just read `req.ctx` without thinking about it.

---

## Day 6 — Boards & Lists API

**Goal:** Full CRUD for boards and lists.

- [ ] `GET /workspaces/:wsId/boards`, `POST /workspaces/:wsId/boards`
- [ ] `GET /boards/:id` — **fully hydrated**: board + its lists + each list's cards,
      ordered by `rank`
- [ ] `PATCH /boards/:id`, `DELETE /boards/:id`
- [ ] `POST /boards/:id/lists` — new list gets `rank = (max rank) + 1`
- [ ] `PATCH /lists/:id` (rename), `DELETE /lists/:id` (cascade its cards)
- [ ] Zod schemas for every request body

**You'll learn:** REST design, nested resources, cascading deletes, N+1 queries.

**Done when:** you can build an entire board through Postman and `GET /boards/:id` returns
it in the right shape and order.

**Watch out:** hydrate the board in **one** Prisma query using `include`, not a loop over
lists. That loop is the N+1 problem, and it's a good thing to have felt once.

---

## Day 7 — Cards API + ranking + BUFFER

**Goal:** Cards work, and moving them works correctly.

- [ ] `POST /lists/:id/cards`, `GET /cards/:id`, `PATCH /cards/:id`, `DELETE /cards/:id`
- [ ] `src/services/ranking.ts`:
  - `calculateRank(beforeRank: number | null, afterRank: number | null): number`
  - Both null → `1.0` · Only before → `before + 1` · Only after → `after / 2` ·
    Both → midpoint
- [ ] `PATCH /cards/:id/move` — accepts `{ listId, beforeId, afterId }`, looks up neighbor
      ranks **server-side**, computes and saves the new rank
- [ ] `PATCH /lists/:id/move` — same idea for columns
- [ ] Unit tests for `calculateRank` covering all four cases
- [ ] **Use remaining time to catch up.**

**You'll learn:** the ordering problem, why the server must own ranking, pure functions
being trivially testable.

**Done when:** you can move a card to any position in any list via Postman, and
`GET /boards/:id` reflects it.

**Watch out:** the client sends *neighbor IDs*, never a rank. If the client can send a
rank, the client can corrupt your ordering.

### ✅ Checkpoint — end of week 1
A complete, tested API. You can run your whole product from Postman. No UI yet, and that's
correct.

---

# WEEK 2 — Frontend

Goal: by day 14 you have a real, usable app in the browser.

---

## Day 8 — Frontend foundation & auth pages

**Goal:** You can log in through the browser.

- [ ] `lib/api-client.ts` — one wrapper around `fetch` with the base URL,
      `credentials: 'include'`, and JSON error handling. **All** API calls go through it.
- [ ] CORS on the API: allow the web origin, `credentials: true`
- [ ] `/login` and `/signup` pages with forms
- [ ] Store the logged-in user in React context or a small Zustand store
- [ ] Redirect to `/boards` on success; redirect unauthenticated users to `/login`
- [ ] Basic app shell: header, user avatar, logout button

**You'll learn:** client/server communication, CORS, cookies cross-origin, protected routes.

**Done when:** signup → auto-login → land on an empty boards page → refresh keeps you
logged in.

**Watch out:** CORS + cookies will fight you for an hour. You need `credentials: 'include'`
on the client **and** `credentials: true` plus an explicit origin on the server. Wildcard
`*` origin does not work with cookies.

---

## Day 9 — Workspace & board list

**Goal:** See and create boards.

- [ ] `/boards` — grid of the current workspace's boards
- [ ] "Create board" modal
- [ ] Workspace switcher in the header (even if you only have one)
- [ ] Loading skeletons and an empty state
- [ ] Consider TanStack Query for fetching/caching — worth the 30 minutes

**You'll learn:** data fetching patterns, loading/error/empty states, modals.

**Done when:** create a board, see it appear, click into it (404 page is fine for now).

---

## Day 10 — Board view (static)

**Goal:** The board renders. No dragging yet.

- [ ] `/b/[boardId]` — fetch the hydrated board
- [ ] Horizontally scrolling column layout
- [ ] `<List>` component: title, cards, "add card" button
- [ ] `<Card>` component: title, labels, due date, assignee avatar
- [ ] Add list / add card / rename list inline
- [ ] Delete with a confirmation

**You'll learn:** component composition, list rendering with keys, CSS layout for
horizontal scroll.

**Done when:** it *looks* like Trello. You just can't drag anything.

**Watch out:** get the layout right before adding drag-and-drop. Debugging both at once
is miserable.

---

## Day 11 — Drag & drop

**Goal:** Cards move, and the moves persist.

- [ ] `bun add @dnd-kit/core @dnd-kit/sortable`
- [ ] `DndContext` around the board, `SortableContext` per list
- [ ] Make cards draggable and lists droppable
- [ ] `onDragEnd`: work out the neighbor IDs, call `PATCH /cards/:id/move`
- [ ] `DragOverlay` so the dragged card follows the cursor nicely

**You'll learn:** the dnd-kit model (sensors, collision detection, sortable contexts),
complex event handling.

**Done when:** drag a card within a list and between lists, refresh, and it stayed put.

**Watch out:** this is the hardest day of the project. Read the dnd-kit sortable docs
properly before writing code. Get *within-list* reordering fully working before attempting
*between-list* moves.

---

## Day 12 — Optimistic updates & list reordering

**Goal:** It feels instant.

- [ ] Update local state immediately on drop, before the API responds
- [ ] Roll back local state and show a toast if the request fails
- [ ] Make lists draggable too (reorder columns)
- [ ] Prevent double-submits during in-flight moves

**You'll learn:** optimistic UI, rollback strategies, perceived vs actual performance.

**Done when:** dragging feels instant with no flicker, and killing the API server produces
a clean rollback instead of a broken board.

---

## Day 13 — Card detail panel

**Goal:** Cards hold real information.

- [ ] Click a card → side panel or modal
- [ ] Edit title and description (textarea; markdown rendering optional)
- [ ] Due date picker
- [ ] Assignee dropdown from workspace members
- [ ] Label create/apply/remove with colors
- [ ] Delete card
- [ ] Close on Escape and on backdrop click

**You'll learn:** forms, controlled inputs, many-to-many relations in the UI, keyboard
accessibility.

**Done when:** you can fully edit a card and see the changes on the board behind the panel.

---

## Day 14 — Polish & BUFFER

**Goal:** Make it feel finished.

- [ ] Consistent spacing, colors, hover and focus states
- [ ] Every loading state, every empty state, every error state
- [ ] Toast notifications for failures
- [ ] Mobile: at minimum, don't be broken
- [ ] Click through every flow and fix what annoys you
- [ ] **Use remaining time to catch up.**

### ✅ Checkpoint — end of week 2
**This is the MVP.** A working, multi-tenant Trello clone. If you stopped here you'd have a
real project. Commit it, tag it, take a screenshot.

---

# WEEK 3 — AI, Testing & Deployment

---

## Day 15 — Python AI service

**Goal:** A working endpoint that turns a card into subtasks.

- [ ] `services/ai/` — FastAPI, virtualenv, `requirements.txt`
- [ ] Pydantic models: `DecomposeRequest`, `Subtask`, `DecomposeResponse`
- [ ] Get a Gemini API key
- [ ] Prompt: given a card title + description, return 3–7 concrete subtasks
- [ ] Force structured JSON output and validate it with Pydantic
- [ ] Handle failure properly: timeout, retry once, return a clean error
- [ ] `GET /health` on this service too

**You'll learn:** FastAPI, Pydantic validation, prompt engineering, structured LLM output,
service-to-service calls.

**Done when:** `curl` the endpoint with a fake card and get back clean, validated JSON.

> **If you're behind schedule:** skip Python entirely and call Gemini directly from Node
> with a Zod schema instead of Pydantic. Same feature, ~2 hours, one less service. Note the
> change in `ARCHITECTURE.md` and move on. **A shipped Node version beats an unfinished
> Python one.**

---

## Day 16 — Wire AI into the product

**Goal:** The feature exists in the UI.

- [ ] `POST /ai/decompose` on the Express API → calls the Python service
- [ ] Rate limit it (LLM calls cost money and this endpoint is trivially abusable)
- [ ] "Break into subtasks" button in the card detail panel
- [ ] Loading state — this takes several seconds, so say so
- [ ] Show suggestions in a modal: user picks which to accept
- [ ] Accepted subtasks become real cards in the same list

**You'll learn:** service orchestration, long-running request UX, human-in-the-loop AI.

**Done when:** click the button on a vague card, get useful subtasks, accept three, see
three new cards.

**Watch out:** never auto-insert AI output straight into the database. The user approves
first. This is both better UX and better engineering.

---

## Day 17 — Testing & bug fixing

**Goal:** Confidence that it works.

- [ ] Playwright installed and configured
- [ ] E2E test 1: signup → create board → create list → create card
- [ ] E2E test 2: **drag a card to another list, reload, assert it persisted**
- [ ] Re-run the tenant isolation test
- [ ] Fix every bug you've been ignoring
- [ ] Check the browser console — clear all warnings

**You'll learn:** E2E testing, test selectors, debugging real failures.

**Done when:** `bun test` and `bunx playwright test` both green.

**Watch out:** two good E2E tests beat twenty bad ones. Don't try to cover everything.

---

## Day 18 — Deployment

**Goal:** A public URL.

- [ ] Neon already hosts production Postgres — create a separate prod branch/database
- [ ] Deploy `apps/api` to Railway; set all env vars
- [ ] Deploy `services/ai` to Railway too
- [ ] Deploy `apps/web` to Vercel; point it at the production API URL
- [ ] Update CORS to the real frontend origin
- [ ] Cookies: `secure: true`, correct `sameSite` for cross-domain
- [ ] Run `prisma migrate deploy` against production
- [ ] Click through the entire app on the live URL

**You'll learn:** environment configuration, prod vs dev, deployment pipelines, secrets.

**Done when:** you can send someone the link and they can sign up and use it.

**Watch out:** cross-domain cookies in production are the classic day-18 trap. If sessions
break live but work locally, that's your problem — check `sameSite` and `secure`.

---

## Day 19 — Documentation & presentation

**Goal:** It looks like a real project from the outside.

- [ ] `README.md`: what it is, screenshots or a GIF, features, stack, local setup, live link
- [ ] Architecture diagram in the README (the mermaid one from `ARCHITECTURE.md`)
- [ ] Seed a demo workspace with realistic data — not "test test test"
- [ ] Demo account credentials in the README so people can look without signing up
- [ ] Clean up: dead code, `console.log`s, TODOs
- [ ] Verify no secrets in git history

**You'll learn:** technical writing, the difference between a repo and a project.

**Done when:** a stranger can understand and run it from the README alone.

**Watch out:** the README is the *most read file in your project*. Spend the full day.

---

## Days 20–21 — Buffer / stretch

**If you're behind:** use both days to finish. That's what they're for. This is the
expected case, not a failure.

**If you're ahead**, pick exactly one:

| Stretch | Effort | Value |
|---|---|---|
| **Real-time with Socket.io** | High | Highest — two browsers, one board, live updates |
| GitHub Actions CI | Low | Good — runs your tests on every push |
| Card comments | Medium | Medium |
| Board activity log | Medium | Medium |
| Keyboard shortcuts | Low | Nice polish |
| Docker Compose for local dev | Low | Sets up Phase 4 |

**Recommended:** Socket.io if you have both days, GitHub Actions if you have one.

---

## The cut list

If you're running behind, cut in this order. Cut early and without guilt.

1. Labels (day 13) — cards work fine without them
2. Workspace switcher (day 9) — one workspace per user is fine for a demo
3. List reordering (day 12) — card dragging is the impressive part
4. The Python service (day 15) — do the AI in Node instead
5. The AI feature entirely — the board is the product
6. Mobile responsiveness

**Never cut:** tenant isolation, the isolation test, fractional ranking, deployment,
the README.

---

## Daily habits

- Commit at the end of every day, with a real message
- Run `bun test` before each commit
- Keep a `NOTES.md`: what broke, how you fixed it — this is where the actual learning
  gets stored
- Stuck for 45 minutes? Ask, look it up, or move to another task and come back
- Anything not on the plan goes in `IDEAS.md`, not into the code
