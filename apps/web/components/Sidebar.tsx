"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Kanban,
  Robot,
  Pulse,
  ListChecks,
  SealCheck,
  SidebarSimple,
  SignOut,
  type Icon,
} from "@phosphor-icons/react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const mono = { fontFamily: "var(--font-mono)" };
const COLLAPSE_KEY = "kolumna:sidebar-collapsed";
const SIDEBAR_REFRESH = "kolumna:refresh-sidebar";

/** Ask the sidebar to refetch its counts (boards, agents, approvals). */
export function refreshSidebar() {
  window.dispatchEvent(new Event(SIDEBAR_REFRESH));
}
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const PILL_TRANSITION = `transform 320ms ${EASE}, height 320ms ${EASE}, opacity 150ms`;

type Workspace = { id: string; name: string };
type Board = { id: string; title: string };
type Agent = { status: string };

// Same palette the boards page uses for its cards, so a board keeps its
// colour wherever it appears.
const BOARD_COLORS = ["#5af7b3", "#7dd3fc", "#c4b5fd", "#fcd34d", "#86efac", "#f9a8d4", "#67e8f9", "#d9f99d"];

function NavItem({
  href,
  label,
  icon: IconCmp,
  active,
  collapsed,
  count,
  disabled,
}: {
  href: string;
  label: string;
  icon: Icon;
  active: boolean;
  collapsed: boolean;
  count?: number;
  disabled?: boolean;
}) {
  // The selected item: white text and the FILLED glyph (the white pill is a
  // single sliding element in Sidebar). Everything else stays muted/outlined.
  const body = (
    <>
      <IconCmp size={18} weight={active ? "fill" : "regular"} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && count !== undefined && count > 0 && (
        <span
          className="ml-auto bg-surface-2 px-2 py-0.5 text-[11px] text-muted"
          style={{ borderRadius: 999, border: "1px solid var(--color-line)", ...mono }}
        >
          {count}
        </span>
      )}
      {!collapsed && disabled && (
        <span className="ml-auto text-[10px] uppercase tracking-[0.1em] text-faint" style={mono}>
          soon
        </span>
      )}
    </>
  );

  const cls = `relative flex h-9 items-center gap-3 px-4 text-[14px] transition-colors ${
    collapsed ? "justify-center" : ""
  } ${
    disabled
      ? "cursor-default text-faint/60"
      : active
        ? "text-fg"
        : "text-faint hover:bg-surface-2 hover:text-fg"
  }`;

  if (disabled) {
    return (
      <div className={cls} title={collapsed ? `${label} (soon)` : undefined}>
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className={cls} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined}>
      {body}
    </Link>
  );
}

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="mx-4 my-3 border-t border-line" />;
  return <p className="px-4 pt-5 pb-2 text-[12px] text-faint">{children}</p>;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeAgents, setActiveAgents] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  // Bumped by refreshSidebar() (e.g. after an approval) so counts update
  // without waiting for the next navigation.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const bump = () => setRefreshTick((t) => t + 1);
    window.addEventListener(SIDEBAR_REFRESH, bump);
    return () => window.removeEventListener(SIDEBAR_REFRESH, bump);
  }, []);

  // Restore the collapsed preference. Browser storage can be unavailable
  // (private mode, blocked site data), so it's best-effort only.
  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {}
    if (saved) queueMicrotask(() => setCollapsed(true));
  }, []);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  // Refetch on navigation so counts and the board list stay current after
  // creating a board or connecting an agent.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<Workspace[]>("/workspaces")
      .then(async (ws) => {
        const first = ws[0];
        if (!first || cancelled) return;
        const [b, a, r, p] = await Promise.all([
          api.get<Board[]>(`/workspaces/${first.id}/boards`),
          api.get<Agent[]>(`/workspaces/${first.id}/agents`),
          api.get<unknown[]>(`/workspaces/${first.id}/reviews?status=PENDING`),
          api.get<unknown[]>(`/workspaces/${first.id}/proposals?status=PENDING`),
        ]);
        if (cancelled) return;
        setWorkspace(first);
        setBoards(b);
        setActiveAgents(a.filter((x) => x.status === "ACTIVE").length);
        setPendingApprovals(r.length + p.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, pathname, refreshTick]);

  // Slide the pill to whichever link is aria-current. Writes straight to the
  // element's style — no React state, so moving it never re-renders the
  // sidebar. Re-measured when the route, the board list (which shifts item
  // positions) or the collapsed width changes.
  const currentBoardId = pathname.match(/^\/b\/([^/]+)/)?.[1];
  const planningBoard = boards.find((b) => b.id === currentBoardId) ?? boards[0];

  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const placedOnce = useRef(false);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const target = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!target) {
      pill.style.opacity = "0";
      return;
    }
    const inset = 8; // the pill is a little shorter than the row
    // First placement jumps into position instead of sliding in from the top.
    if (!placedOnce.current) pill.style.transition = "none";
    pill.style.transform = `translateY(${target.offsetTop + inset}px)`;
    pill.style.height = `${target.offsetHeight - inset * 2}px`;
    pill.style.opacity = "1";
    if (!placedOnce.current) {
      void pill.offsetHeight; // flush, so the next change animates
      // Restore the real value — "" would DELETE the inline transition and
      // every later move would be instant.
      pill.style.transition = PILL_TRANSITION;
      placedOnce.current = true;
    }
  }, [pathname, boards.length, collapsed, planningBoard?.id]);

  const initials = (user?.name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ${
        collapsed ? "w-[64px]" : "w-[248px]"
      }`}
    >
      {/* Workspace */}
      <div className={`flex h-[60px] items-center gap-2.5 border-b border-line ${collapsed ? "justify-center px-2" : "px-4"}`}>
        {!collapsed && (
          <>
            <span
              className="h-6 w-6 shrink-0 rounded-full"
              style={{ background: "radial-gradient(circle at 30% 30%, #b8ffe0, #5af7b3 45%, #1f7a55)" }}
              aria-hidden
            />
            <span className="truncate text-[14px] font-medium text-fg">{workspace?.name ?? "Workspace"}</span>
            <span
              className="shrink-0 px-2 py-0.5 text-[11px]"
              style={{ borderRadius: 999, backgroundColor: "rgba(90,247,179,0.12)", color: "#5af7b3", ...mono }}
            >
              free
            </span>
          </>
        )}
        <button
          type="button"
          onClick={toggle}
          className={`text-faint transition-colors hover:text-fg ${collapsed ? "" : "ml-auto"}`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <SidebarSimple size={18} />
        </button>
      </div>

      <nav ref={navRef} className="relative flex-1 overflow-y-auto py-3">
        {/* One pill for the whole nav that slides to the selected item, rather
            than one per item popping in and out. Positioned by the layout
            effect above. */}
        <span
          ref={pillRef}
          aria-hidden
          className="pointer-events-none absolute top-0 left-[6px] w-[2px] rounded-full bg-[#ffffff] opacity-0"
          style={{ transition: PILL_TRANSITION }}
        />
        <NavItem href="/boards" label="Boards" icon={Kanban} active={pathname === "/boards"} collapsed={collapsed} count={boards.length} />
        <NavItem href="/agents" label="Agents" icon={Robot} active={pathname.startsWith("/agents")} collapsed={collapsed} count={activeAgents} />
        <NavItem
          href="/approvals"
          label="Approvals"
          icon={SealCheck}
          active={pathname.startsWith("/approvals")}
          collapsed={collapsed}
          count={pendingApprovals}
        />
        <NavItem href="/activity" label="Activity" icon={Pulse} active={pathname.startsWith("/activity")} collapsed={collapsed} />

        {boards.length > 0 && (
          <>
            <SectionLabel collapsed={collapsed}>Your boards</SectionLabel>
            {boards.map((b, i) => {
              const active = pathname === `/b/${b.id}`;
              const color = BOARD_COLORS[i % BOARD_COLORS.length];
              return (
                <Link
                  key={b.id}
                  href={`/b/${b.id}`}
                  title={collapsed ? b.title : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-9 items-center gap-3 px-4 text-[14px] transition-colors ${
                    collapsed ? "justify-center" : ""
                  } ${active ? "text-fg" : "text-faint hover:bg-surface-2 hover:text-fg"}`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: active ? color : "transparent", border: `1.5px solid ${color}` }}
                    aria-hidden
                  />
                  {!collapsed && <span className="truncate">{b.title}</span>}
                </Link>
              );
            })}
          </>
        )}

        {planningBoard && (
          <>
            {/* Sprints and epics live on the backlog page, as in Jira. It
                follows the board you're on, else your first board. */}
            <SectionLabel collapsed={collapsed}>Planning · {planningBoard.title}</SectionLabel>
            <NavItem
              href={`/b/${planningBoard.id}/backlog`}
              label="Backlog & sprints"
              icon={ListChecks}
              active={pathname === `/b/${planningBoard.id}/backlog`}
              collapsed={collapsed}
            />
          </>
        )}
      </nav>

      {/* Account */}
      <div className={`flex h-[60px] items-center gap-3 border-t border-line ${collapsed ? "justify-center px-2" : "px-4"}`}>
        {!collapsed && (
          <>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center bg-surface-2 text-[11px] text-fg"
              style={{ borderRadius: 999, border: "1px solid var(--color-line-bright)" }}
            >
              {initials}
            </span>
            <span className="truncate text-[14px] text-fg">{user?.name}</span>
          </>
        )}
        <button
          type="button"
          onClick={async () => {
            await logout();
            router.push("/login");
          }}
          className={`text-[#f87171] transition-opacity hover:opacity-70 ${collapsed ? "" : "ml-auto"}`}
          title="Log out"
        >
          <SignOut size={18} />
        </button>
      </div>
    </aside>
  );
}
