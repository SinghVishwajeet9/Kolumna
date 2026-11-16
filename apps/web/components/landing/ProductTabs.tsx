"use client";

// The hero's product panel: five tabs, each switching a screen built from the
// app's real components (CardTile, ReviewItem, ActorBadge, Burndown) with
// sample data. Wrapped in .app-ui so they render exactly as in the product.

import { useEffect, useRef, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import {
  ChartBar,
  CheckCircle,
  Kanban,
  ListChecks,
  Robot,
  ShieldCheck,
  Plus,
  SealCheck,
} from "@phosphor-icons/react";
import { CardTile } from "@/components/board/CardTile";
import { ActorBadge } from "@/components/board/ActorBadge";
import { ReviewItem, type Review } from "@/components/approvals/ReviewItem";
import { Burndown, type Day } from "@/components/reports/Burndown";
import { LogoMark } from "@/components/Logo";
import { grain } from "./grain";
import type { ActorRef, BoardCard } from "@/components/board/types";

const TABS = [
  { id: "board", title: "Board", line: "Humans and agents on one board." },
  { id: "agents", title: "Agents", line: "Each with its own identity and limits." },
  { id: "approvals", title: "Approvals", line: "Unsure changes wait for a person." },
  { id: "budgets", title: "Budgets", line: "A monthly cap per agent." },
  { id: "audit", title: "Audit trail", line: "Every action, chained and checkable." },
] as const;
type TabId = (typeof TABS)[number]["id"];

const claude: ActorRef = { id: "a1", displayName: "Claude Code", type: "AGENT" };
const cursor: ActorRef = { id: "a2", displayName: "Cursor", type: "AGENT" };
const ana: ActorRef = { id: "h1", displayName: "Ana Ruiz", type: "HUMAN" };
const dev: ActorRef = { id: "h2", displayName: "Dev Patel", type: "HUMAN" };
const onboarding = { id: "e1", title: "Onboarding", color: "#7dd3fc" };
const billing = { id: "e2", title: "Billing", color: "#c4b5fd" };

function card(id: string, list: string, title: string, number: number, extra: Partial<BoardCard> = {}): BoardCard {
  return {
    id, listId: list, title, rank: number, number, priority: "NONE", storyPoints: null,
    epic: null, assignee: null, checklistItems: [], _count: { comments: 0 }, ...extra,
  };
}

const COLUMNS: { id: string; title: string; cards: BoardCard[] }[] = [
  {
    id: "todo", title: "To Do", cards: [
      card("t1", "todo", "Retry failed invoice webhooks", 21, { priority: "HIGH", epic: billing, assignee: cursor }),
      card("t2", "todo", "Copy for the welcome email", 19, { assignee: ana }),
    ],
  },
  {
    id: "doing", title: "In Progress", cards: [
      card("d1", "doing", "Ship onboarding emails", 14, {
        priority: "HIGH", epic: onboarding, assignee: claude,
        checklistItems: [{ done: true }, { done: true }, { done: false }],
      }),
      card("d2", "doing", "Invite link expiry", 9, { priority: "MEDIUM", assignee: dev }),
    ],
  },
  {
    id: "review", title: "In Review", cards: [
      card("r1", "review", "Proration for plan changes", 17, { epic: billing, assignee: claude, _count: { comments: 3 } }),
    ],
  },
  {
    id: "done", title: "Done", cards: [
      card("x1", "done", "Workspace switcher", 6, { assignee: ana }),
      card("x2", "done", "Login rate limit", 11, { priority: "URGENT", assignee: claude }),
    ],
  },
];

// ---------------------------------------------------------------------------

const TAB_MS = 6000; // how long each tab shows before moving on

export function ProductTabs() {
  const [tab, setTab] = useState<TabId>("board");
  // Bumped on every switch so the progress line restarts from empty.
  const [cycle, setCycle] = useState(0);
  const [inView, setInView] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Auto-advance only for people who haven't asked for less motion, and only
  // while the panel is on screen.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = root.current;
    if (reduce || !el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setInView(!!e?.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    const id = setTimeout(() => setAutoplay(true), 0);
    return () => {
      io.disconnect();
      clearTimeout(id);
    };
  }, []);

  const select = (id: TabId) => {
    setTab(id);
    setCycle((c) => c + 1);
  };
  const next = () => {
    const i = TABS.findIndex((t) => t.id === tab);
    select(TABS[(i + 1) % TABS.length]!.id);
  };
  // The progress line is a CSS animation; the switch happens when it ends.
  // It keeps running on hover (the user's call); it only pauses off screen.
  const running = autoplay && inView;

  return (
    <div ref={root}>
      {/* The tab row: cells split by hairlines; a white line fills under the active one. */}
      <div role="tablist" className="grid grid-cols-2 border-y border-[var(--l-line)] md:grid-cols-5">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => select(t.id)}
            className={`relative px-5 py-4 text-left transition-colors md:px-6 md:py-5 ${
              i > 0 ? "md:border-l" : ""
            } ${i % 2 === 1 ? "max-md:border-l" : ""} ${i > 1 ? "max-md:border-t" : ""} border-[var(--l-line)] ${
              tab === t.id ? "bg-white/[0.02]" : "hover:bg-white/[0.015]"
            }`}
          >
            <span className={`block text-[14px] font-medium ${tab === t.id ? "text-[var(--l-fg)]" : "text-[var(--l-muted)]"}`}>
              {t.title}
            </span>
            <span className="mt-1 hidden text-[13px] leading-5 text-[var(--l-faint)] md:block">{t.line}</span>
            {tab === t.id &&
              (autoplay ? (
                <span
                  key={cycle}
                  className="absolute bottom-0 left-0 h-[2px] bg-[#fafafa]"
                  style={{
                    animation: `tabProgress ${TAB_MS}ms linear forwards`,
                    animationPlayState: running ? "running" : "paused",
                  }}
                  onAnimationEnd={next}
                />
              ) : (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#fafafa]" />
              ))}
          </button>
        ))}
      </div>

      {/* The panel: a soft frame with the app window inside. */}
      <div className="p-2 md:p-3">
        <div
          className="relative overflow-hidden border border-[var(--l-line)] px-3 pt-6 md:px-14 md:pt-12"
          style={{ borderRadius: 8, background: PANEL_BG }}
        >
          <PanelBackdrop />
          <div className="relative">
            <AppWindow tab={tab} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Dark grey behind the product window (tried: #18181b, a touch lighter; #060607, near-black).
const PANEL_BG = "#131315";

const PANEL_GRAIN = grain(240, 1.25, 16, -10.6);

// Behind the app window: a soft glow from the top so the window floats, and
// fine random white grain, densest at the bottom and fading upward (the same grain
// motif as the hero picture and the footer). They show in the margins
// around the window.
function PanelBackdrop() {
  const dots = { backgroundImage: PANEL_GRAIN };
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 65% 55% at 50% 0%, rgba(255,255,255,0.07), transparent 72%)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          ...dots,
          opacity: 0.55,
          maskImage: "linear-gradient(to top, black 0%, rgba(0,0,0,0.5) 30%, transparent 75%)",
          WebkitMaskImage: "linear-gradient(to top, black 0%, rgba(0,0,0,0.5) 30%, transparent 75%)",
        }}
      />
    </div>
  );
}

const NAV: { id: TabId | "none"; label: string; icon: typeof Kanban; badge?: string }[] = [
  { id: "board", label: "Boards", icon: Kanban },
  { id: "agents", label: "Agents", icon: Robot },
  { id: "approvals", label: "Approvals", icon: ListChecks, badge: "2" },
  { id: "budgets", label: "Usage", icon: ChartBar },
  { id: "audit", label: "Activity", icon: ShieldCheck },
];

function AppWindow({ tab }: { tab: TabId }) {
  return (
    <div
      className="app-ui flex h-[420px] overflow-hidden border border-b-0 border-white/10 bg-bg text-left md:h-[500px]"
      style={{ borderRadius: "10px 10px 0 0", boxShadow: "0 30px 80px -30px rgba(0,0,0,0.9)" }}
    >
      {/* Sidebar, as in the app. */}
      <aside className="hidden w-[190px] shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-12 items-center gap-2 border-b border-line px-4">
          <LogoMark className="h-3.5 w-[22px] text-fg" />
          <span className="text-[13px] font-medium text-fg">Acme Product</span>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {NAV.map((n) => {
            const active = n.id === tab;
            const Icon = n.icon;
            return (
              <span
                key={n.label}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] ${active ? "bg-white/[0.06] text-fg" : "text-muted"}`}
                style={{ borderRadius: 6 }}
              >
                <Icon size={16} weight={active ? "fill" : "regular"} />
                {n.label}
                {n.badge && <span className="ml-auto bg-surface-2 px-1.5 text-[11px] text-muted">{n.badge}</span>}
              </span>
            );
          })}
        </nav>
      </aside>

      <div key={tab} className="min-w-0 flex-1 animate-[fadeIn_150ms_ease-out] overflow-hidden">
        {tab === "board" && <BoardScreen />}
        {tab === "agents" && <AgentsScreen />}
        {tab === "approvals" && <ApprovalsScreen />}
        {tab === "budgets" && <BudgetsScreen />}
        {tab === "audit" && <AuditScreen />}
      </div>
    </div>
  );
}

function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex h-12 items-center gap-3 border-b border-line px-5">
      <span className="text-[14px] font-medium text-fg">{title}</span>
      <span className="ml-auto">{right}</span>
    </div>
  );
}

// --- Board ------------------------------------------------------------------

function BoardScreen() {
  return (
    <div className="h-full">
      <ScreenHeader
        title="Product Roadmap"
        right={<span className="text-[12px] text-faint">Sprint 4 · 6d left</span>}
      />
      <DndContext id="landing-board" sensors={[]}>
        <div className="flex gap-2.5 overflow-x-auto p-4 md:overflow-hidden">
          {COLUMNS.map((col) => (
            <section key={col.id} className="w-[230px] shrink-0 bg-[#1a1a1c] p-1.5" style={{ borderRadius: 12 }}>
              <header className="flex items-center gap-2 px-2.5 pt-2 pb-2.5">
                <h4 className="text-[13px] font-semibold text-fg">{col.title}</h4>
                <span className="text-[13px] text-faint">{col.cards.length}</span>
              </header>
              <SortableContext items={col.cards.map((c) => c.id)}>
                <div className="flex flex-col gap-1.5">
                  {col.cards.map((c) => (
                    <CardTile key={c.id} card={c} boardKey="ACM" />
                  ))}
                </div>
              </SortableContext>
              <div className="mt-1.5 flex h-7 items-center gap-1.5 px-2.5 text-[12px] text-faint">
                <Plus size={13} /> Create
              </div>
            </section>
          ))}
        </div>
      </DndContext>
    </div>
  );
}

// --- Agents -----------------------------------------------------------------

const AGENTS = [
  { actor: claude, level: "Acts with approval", threshold: "80%", access: "Until Sprint 4 ends", success: "94%" },
  { actor: cursor, level: "Suggest only", threshold: "—", access: "Until Dec 31", success: "88%" },
];

function AgentsScreen() {
  return (
    <div className="h-full">
      <ScreenHeader title="Agents" right={<span className="text-[12px] text-faint">2 connected over MCP</span>} />
      <div className="p-4">
        <div className="grid grid-cols-[1.3fr_1.2fr_0.7fr] gap-3 px-3 pb-2 text-[12px] text-faint md:grid-cols-[1.4fr_1.2fr_1fr_0.8fr]">
          <span>Agent</span>
          <span>Autonomy</span>
          <span className="hidden md:block">Access</span>
          <span className="text-right">Track record</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {AGENTS.map((a) => (
            <div
              key={a.actor.id}
              className="grid grid-cols-[1.3fr_1.2fr_0.7fr] items-center gap-3 border border-line bg-surface px-3 py-3 text-[13px] md:grid-cols-[1.4fr_1.2fr_1fr_0.8fr]"
              style={{ borderRadius: 8 }}
            >
              <span className="whitespace-nowrap"><ActorBadge actor={a.actor} size="md" /></span>
              <span className="text-fg">
                {a.level}
                {a.threshold !== "—" && <span className="text-faint"> · {a.threshold}</span>}
              </span>
              <span className="hidden text-muted md:block">{a.access}</span>
              <span className="text-right text-fg">{a.success}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-surface-2 p-3" style={{ borderRadius: 8 }}>
          <p className="mb-1.5 text-[12px] text-faint">Connect another agent: run in any terminal</p>
          <pre className="text-[12px] leading-relaxed whitespace-pre-wrap text-fg [overflow-wrap:anywhere]">
            {"claude mcp add --transport http kolumna https://kolumna.vercel.app/mcp"}
          </pre>
        </div>
      </div>
    </div>
  );
}

// --- Approvals --------------------------------------------------------------

function ApprovalsScreen() {
  const [reviews, setReviews] = useState<Review[]>(() => {
    const base = Date.now();
    return [
      {
        id: "rv1", toolName: "move_card", summary: "Move ACM-14 “Ship onboarding emails” to Done",
        confidence: 0.62, reasoning: "Tests pass, but nobody has reviewed the email copy yet.",
        reason: "LOW_CONFIDENCE", status: "PENDING", note: null, error: null,
        createdAt: new Date(base - 3 * 60_000).toISOString(), decidedAt: null,
        agent: { id: "a1", displayName: "Claude Code" }, card: { id: "d1", key: "ACM-14", title: "Ship onboarding emails" },
      },
      {
        id: "rv2", toolName: "update_ticket", summary: "Raise ACM-21 to Urgent",
        confidence: null, reasoning: "Webhook failures are growing week on week.",
        reason: "AUTONOMY_LEVEL", status: "PENDING", note: null, error: null,
        createdAt: new Date(base - 11 * 60_000).toISOString(), decidedAt: null,
        agent: { id: "a2", displayName: "Cursor" }, card: { id: "t1", key: "ACM-21", title: "Retry failed invoice webhooks" },
      },
    ];
  });
  const decide = (id: string) => async () => setReviews((rs) => rs.filter((r) => r.id !== id));
  return (
    <div className="h-full">
      <ScreenHeader title="Approvals" right={<span className="text-[12px] text-faint">{reviews.length} waiting</span>} />
      <div className="p-4">
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <CheckCircle size={26} weight="fill" className="text-accent" />
            <p className="text-[14px] text-fg">All caught up.</p>
            <p className="text-[13px] text-faint">Decisions were applied and written to the audit log.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {reviews.map((r) => (
              <ReviewItem key={r.id} review={r} onApprove={decide(r.id)} onReject={decide(r.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// --- Budgets ----------------------------------------------------------------

const DAYS: Day[] = Array.from({ length: 10 }, (_, i) => {
  const human = [0, 1, 3, 4, 6, 8, 9, 11, null, null][i] ?? null;
  const agent = [0, 2, 3, 6, 8, 9, 12, 14, null, null][i] ?? null;
  return {
    date: `2026-11-${String(i + 3).padStart(2, "0")}`,
    ideal: 34 - (34 / 9) * i,
    remaining: human === null || agent === null ? null : 34 - human - agent,
    doneHuman: human,
    doneAgent: agent,
  };
});

function BudgetsScreen() {
  const rows = [
    { actor: claude, spent: 31.4, cap: 50 },
    { actor: cursor, spent: 46.9, cap: 50 },
  ];
  return (
    <div className="h-full">
      <ScreenHeader title="Usage · November" right={<span className="text-[12px] text-faint">$78.30 reported</span>} />
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.15fr]">
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => {
            const pct = Math.round((r.spent / r.cap) * 100);
            const warn = pct >= 90;
            return (
              <div key={r.actor.id} className="border border-line bg-surface p-3.5" style={{ borderRadius: 8 }}>
                <div className="flex items-center gap-2">
                  <ActorBadge actor={r.actor} />
                  <span className="ml-auto text-[13px] text-fg">
                    ${r.spent.toFixed(2)} <span className="text-faint">/ ${r.cap}</span>
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden bg-white/10" style={{ borderRadius: 99 }}>
                  <div className={`h-full ${warn ? "bg-[#fcd34d]" : "bg-white/70"}`} style={{ width: `${pct}%`, borderRadius: 99 }} />
                </div>
                <p className="mt-2 text-[12px] text-faint">
                  {warn ? "Over 90%: at the cap, its changes go to a person." : `${pct}% of the monthly cap`}
                </p>
              </div>
            );
          })}
        </div>
        <div className="border border-line bg-surface p-3.5" style={{ borderRadius: 8 }}>
          <p className="mb-2 text-[13px] text-fg">Sprint 4 burndown · humans and agents</p>
          <Burndown days={DAYS} scope={34} />
        </div>
      </div>
    </div>
  );
}

// --- Audit trail --------------------------------------------------------------

const LOG = [
  { seq: 1042, who: claude, what: "Moved ACM-17 to In Review", note: "approved by Ana Ruiz", hash: "9f2c…a71e" },
  { seq: 1041, who: ana, what: "Approved a change from Claude Code", note: "confidence 62%", hash: "4b80…12dd" },
  { seq: 1040, who: cursor, what: "Proposed raising ACM-21 to Urgent", note: "suggest-only board", hash: "e317…0c5b" },
  { seq: 1039, who: claude, what: "Reported $0.84 of usage on ACM-14", note: "self-reported", hash: "71aa…d902" },
  { seq: 1038, who: dev, what: "Invited sam@acme.dev as Member", note: "", hash: "0c4e…5f13" },
];

function AuditScreen() {
  return (
    <div className="h-full">
      <ScreenHeader
        title="Activity"
        right={
          <span className="flex items-center gap-1.5 text-[12px] text-[#d0d6e0]">
            <SealCheck size={14} weight="fill" className="text-accent" /> Chain verified
            <span className="text-faint">· 1,042 entries</span>
          </span>
        }
      />
      <ol className="p-4">
        {LOG.map((e) => (
          <li key={e.seq} className="grid grid-cols-[48px_1fr] items-center gap-3 border-b border-line py-2.5 text-[13px] last:border-0 sm:grid-cols-[56px_1fr_auto]">
            <span className="text-faint">#{e.seq}</span>
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <ActorBadge actor={e.who} />
              <span className="text-fg">{e.what}</span>
              {e.note && <span className="text-faint">· {e.note}</span>}
            </span>
            <code className="hidden text-[11px] text-faint sm:block">{e.hash}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}
