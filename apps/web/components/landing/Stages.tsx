"use client";

// The big visuals on top of the landing page's feature cards (the "stages").
// Modelled on medusajs.com's cards: a tall product scene filling the card,
// short text underneath. Each scene is built from the app's own pieces and
// tokens (.app-ui), with sample data, and tells one idea at a glance.

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { ActorBadge } from "@/components/board/ActorBadge";
import type { Day } from "@/components/reports/Burndown";
import type { ActorRef } from "@/components/board/types";

const claude: ActorRef = { id: "a1", displayName: "Claude Code", type: "AGENT" };

const MINT = "#5af7b3";
const LAVENDER = "#c4b5fd";
const AMBER = "#fcd34d";

// Whether the stage has scrolled into view. Children with the reveal-* classes
// (globals.css, "Stage reveal") animate in once it turns true; it never turns back.
const InView = createContext(false);

export function Stage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      data-in={inView}
      className={`app-ui relative h-[300px] overflow-hidden border border-[var(--l-line)] bg-[var(--l-panel)] md:h-[320px] ${className}`}
      style={{ borderRadius: 8 }}
    >
      <InView.Provider value={inView}>{children}</InView.Provider>
    </div>
  );
}

/** Counts from 0 up to `to` once the stage is in view (straight to `to` under reduced motion). */
function CountUp({ to, ms = 1200 }: { to: number; ms?: number }) {
  const inView = useContext(InView);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, ms]);
  return <>{n}</>;
}

/** Inline style for a reveal delay, in seconds. */
const delay = (s: number) => ({ "--d": `${s}s` }) as React.CSSProperties;

/** A small floating card, like a popover in the app. */
function Float({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`border border-line bg-surface ${className}`}
      style={{ borderRadius: 10, boxShadow: "0 18px 40px -16px rgba(0,0,0,0.85)", ...style }}
    >
      {children}
    </div>
  );
}

// --- Agents as teammates ----------------------------------------------------------

export function IdentityStage() {
  const scopes = ["board:read", "card:create", "card:write"];
  return (
    <Stage>
      <div className="flex h-full items-center justify-center px-5">
        <Float className="w-full max-w-[300px] p-4">
          <div className="flex items-center gap-2">
            <ActorBadge actor={claude} size="md" />
            <span className="ml-auto flex items-center gap-1.5 text-[12px] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Active
            </span>
          </div>
          <dl className="mt-4 flex flex-col gap-3 text-[12.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-faint">Client ID</dt>
              <dd className="font-mono text-muted">agt_7f3c…91ad</dd>
            </div>
            <div>
              <dt className="mb-1.5 text-faint">Scopes</dt>
              <dd className="flex flex-wrap gap-1.5">
                {scopes.map((s) => (
                  <span key={s} className="bg-white/[0.06] px-2 py-0.5 font-mono text-[11.5px] text-muted" style={{ borderRadius: 5 }}>
                    {s}
                  </span>
                ))}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-faint">Access</dt>
              <dd className="text-fg">Until Sprint 4 ends</dd>
            </div>
          </dl>
          <div className="mt-4 flex gap-2 border-t border-line pt-3">
            <span className="text-[12px] text-muted">Suspend</span>
            <span className="text-[12px] text-[#fca5a5]">Revoke</span>
          </div>
        </Float>
      </div>
    </Stage>
  );
}

export function AutonomyStage() {
  const options = [
    { title: "Suggest only", line: "Every change waits for a person" },
    { title: "Act with approval", line: "Acts when confident enough", on: true },
    { title: "Act on its own", line: "Acts, and everything is logged" },
  ];
  return (
    <Stage>
      <div className="flex h-full flex-col justify-center gap-2 px-5">
        {options.map((o) => (
          <div
            key={o.title}
            className={`flex items-center gap-3 border px-3.5 py-3 ${o.on ? "border-white/20 bg-white/[0.06]" : "border-line bg-surface"}`}
            style={{ borderRadius: 10 }}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${o.on ? "border-accent" : "border-white/25"}`}
            >
              {o.on && <span className="h-2 w-2 rounded-full bg-accent" />}
            </span>
            <span>
              <span className={`block text-[13.5px] ${o.on ? "text-fg" : "text-muted"}`}>{o.title}</span>
              <span className="block text-[12px] text-faint">{o.line}</span>
            </span>
            {o.on && <span className="ml-auto text-[12px] text-faint">80%</span>}
          </div>
        ))}
        <p className="mt-1 px-1 text-[12px] text-faint">
          Override on <span className="text-muted">Payments</span>: suggest only
        </p>
      </div>
    </Stage>
  );
}

export function ConfidenceStage() {
  const changes = [
    { what: "Move ACM-14 to Done", score: 62, sent: true },
    { what: "Comment on ACM-9", score: 91, sent: false },
  ];
  return (
    <Stage>
      <div className="flex h-full flex-col justify-center gap-3 px-5">
        {changes.map((c) => (
          <Float key={c.what} className="p-3.5">
            <div className="flex items-center gap-2 text-[13px]">
              <ActorBadge actor={claude} />
              <span className="truncate text-fg">{c.what}</span>
            </div>
            <div className="relative mt-3 h-1.5 bg-white/10" style={{ borderRadius: 99 }}>
              <div
                className="h-full"
                style={{ width: `${c.score}%`, borderRadius: 99, background: c.sent ? AMBER : MINT }}
              />
              <div className="absolute -top-1 h-3.5 w-px bg-white/80" style={{ left: "80%" }} />
            </div>
            <div className="mt-2 flex justify-between text-[12px]">
              <span className="text-faint">Confidence {c.score}% · needs 80%</span>
              <span style={{ color: c.sent ? AMBER : MINT }}>{c.sent ? "Sent to Approvals" : "Applied"}</span>
            </div>
          </Float>
        ))}
      </div>
    </Stage>
  );
}

// What makes a product shot read as real rather than generated (studied on
// medusajs.com's cards): chart scaffolding (axis labels, gridlines, a date
// under the first bar), real controls above the chart, uneven data with some
// tiny values, the chart taking only the lower part of the card so it can
// breathe, segments that are separate rounded pills with a soft top-to-bottom
// shade, upcoming days as ghosts of the real colours, a cursor on the hovered
// day, and muted colours instead of full-strength neon.

// Muted series colours: [top of the shade, bottom of the shade].
const C_CLAUDE = ["#86efc2", "#3fbf8a"] as const;
const C_CURSOR = ["#d6cbfe", "#9f8cf0"] as const;
const SKY = "#8fd3f4";
const shade = (c: readonly [string, string]) => `linear-gradient(to bottom, ${c[0]}, ${c[1]})`;

/** A select-like control, as in the app's toolbars. */
function Control({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`flex h-7 items-center gap-1.5 border border-line bg-surface px-2.5 text-[11.5px] text-fg ${className}`}
      style={{ borderRadius: 7, boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset" }}
    >
      {children}
    </span>
  );
}

const Caret = () => (
  <svg width="8" height="10" viewBox="0 0 8 10" fill="none" className="ml-auto text-faint" aria-hidden="true">
    <path d="M1.5 3.5 4 1l2.5 2.5M1.5 6.5 4 9l2.5-2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The pointer resting on the hovered day. */
const Cursor = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="13" height="17" viewBox="0 0 13 17" className={className} style={style} aria-hidden="true">
    <path d="M1 1v13.2l3.4-3.1 2.3 5 2.1-.9-2.3-5H11z" fill="#0b0b0c" stroke="#f4f4f5" strokeWidth="1.1" strokeLinejoin="round" />
  </svg>
);

// --- Spend and trust ------------------------------------------------------------

// Daily spend agents reported, Nov 1 to 14, then four days still to come.
const CLAUDE_SPEND = [0.8, 1.3, 0.4, 2.37, 1.1, 0.6, 2.6, 1.5, 0.3, 1.9, 2.9, 0.7, 1.2, 2.2];
const CURSOR_SPEND = [0.5, 0.4, 1.2, 1.88, 0.7, 0.3, 0.9, 0.6, 0.4, 1.1, 0.8, 1.5, 0.5, 0.9];
const GHOSTS = [[1.0, 0.6], [1.4, 0.8], [0.8, 0.5], [1.2, 0.7]];
const PEAK = 6;
const HIGHLIGHT = 3; // Nov 4
const BAR = 12;
const STEP = 18; // bar + gap
const AXIS = 28; // room for the $ labels

export function BudgetStage() {
  const seg = (v: number) => `calc(${(v / PEAK) * 100}% - 2px)`;
  return (
    <Stage>
      <div className="flex gap-2 px-5 pt-5">
        <Control className="w-[124px]">
          This month <Caret />
        </Control>
        <Control>All agents</Control>
      </div>
      <div className="mt-4 flex items-baseline justify-between px-5 text-[12.5px]">
        <span className="text-muted">Agent spend</span>
        <span className="tabular-nums text-fg">
          $78.30 <span className="text-faint">/ $100</span>
        </span>
      </div>

      {/* The chart: lower part of the card, bleeding off the right edge. */}
      <div className="absolute bottom-9 left-5 right-0 h-[132px]">
        {[6, 3, 0].map((v, i) => (
          <div key={v} className="absolute inset-x-0 flex items-center" style={{ top: `${i * 50}%`, transform: "translateY(-50%)" }}>
            <span className="w-[28px] text-[10.5px] tabular-nums text-faint">${v}</span>
            <span className="h-px flex-1 bg-white/[0.05]" />
          </div>
        ))}
        <div
          className="absolute inset-y-0 right-0 flex items-end gap-[6px]"
          style={{
            left: AXIS,
            maskImage: "linear-gradient(to right, black 70%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, black 70%, transparent)",
          }}
        >
          {CLAUDE_SPEND.map((c, i) => (
            <div key={i} className="relative h-full shrink-0" style={{ width: BAR }}>
              {i === HIGHLIGHT && (
                <span className="absolute -inset-x-[3px] -top-2 bottom-0 bg-white/[0.05]" style={{ borderRadius: 4 }} />
              )}
              <div className="reveal-bar relative flex h-full flex-col justify-end gap-[2px]" style={delay(i * 0.045)}>
                <div style={{ height: seg(CURSOR_SPEND[i]!), background: shade(C_CURSOR), borderRadius: 3 }} />
                <div style={{ height: seg(c), background: shade(C_CLAUDE), borderRadius: 3 }} />
              </div>
            </div>
          ))}
          {GHOSTS.map(([c, k], i) => (
            <div key={`g${i}`} className="reveal-bar flex h-full shrink-0 flex-col justify-end gap-[2px] opacity-[0.16]" style={{ width: BAR, ...delay((CLAUDE_SPEND.length + i) * 0.045) }}>
              <div style={{ height: seg(k!), background: shade(C_CURSOR), borderRadius: 3 }} />
              <div style={{ height: seg(c!), background: shade(C_CLAUDE), borderRadius: 3 }} />
            </div>
          ))}
        </div>
        <span className="absolute -bottom-5 text-[10.5px] text-faint" style={{ left: AXIS - 2 }}>
          Nov 1
        </span>
      </div>

      {/* The day under the pointer. */}
      <Cursor className="reveal-fade absolute" style={{ left: 20 + AXIS + HIGHLIGHT * STEP + 7, bottom: 36 + 80, ...delay(0.95) }} />
      <Float
        className="reveal-fade absolute w-[150px] p-2.5 text-[11.5px]"
        style={{ left: 20 + AXIS + HIGHLIGHT * STEP + 22, bottom: 36 + 100, ...delay(1.0) }}
      >
        <p className="mb-1.5 text-faint">Nov 4, 2026</p>
        <p className="flex items-center gap-2 text-fg">
          <span className="h-2 w-2 rounded-full" style={{ background: C_CLAUDE[1] }} /> Claude Code
          <span className="ml-auto tabular-nums">$2.37</span>
        </p>
        <p className="mt-1 flex items-center gap-2 text-fg">
          <span className="h-2 w-2 rounded-full" style={{ background: C_CURSOR[1] }} /> Cursor
          <span className="ml-auto tabular-nums">$1.88</span>
        </p>
      </Float>
    </Stage>
  );
}

// The last 48 gated changes, oldest first: approved, rejected, reopened.
const HISTORY = Array.from({ length: 48 }, (_, i) => (i === 12 || i === 33 ? "rejected" : i === 25 ? "reopened" : "approved"));

export function TrackRecordStage() {
  return (
    <Stage>
      <div className="flex h-full flex-col px-5 pt-5">
        <div className="flex items-start gap-2">
          <ActorBadge actor={claude} size="md" />
          <span className="ml-auto text-right">
            <span className="block text-[26px] font-medium leading-none tabular-nums text-fg">
              <CountUp to={94} />%
            </span>
            <span className="text-[11.5px] text-faint">approved</span>
          </span>
        </div>

        {/* Older changes are dimmer, recent ones brighter; rejections are hollow. */}
        <div className="mt-5 grid grid-cols-[repeat(16,1fr)] gap-[4px]">
          {HISTORY.map((h, i) => (
            <span
              key={i}
              className="reveal-pop h-[11px]"
              style={{
                ...delay(i * 0.02),
                borderRadius: 3,
                background:
                  h === "approved"
                    ? shade(C_CLAUDE)
                    : h === "reopened"
                      ? "linear-gradient(to bottom, #fde68a, #e9b949)"
                      : "transparent",
                border: h === "rejected" ? "1px solid rgba(255,255,255,0.28)" : undefined,
                opacity: h === "approved" ? 0.3 + 0.7 * (i / (HISTORY.length - 1)) : 1,
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10.5px] text-faint">
          <span>48 changes ago</span>
          <span>Now</span>
        </div>
        <div className="mt-3 flex gap-3 text-[11px] text-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2" style={{ background: C_CLAUDE[1], borderRadius: 2 }} /> Approved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 border border-white/30" style={{ borderRadius: 2 }} /> Rejected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2" style={{ background: "#e9b949", borderRadius: 2 }} /> Reopened
          </span>
        </div>

        <Float className="reveal-fade mt-auto mb-5 flex items-center gap-3 p-3" style={delay(1.1)}>
          <span className="text-[12.5px] text-fg">Let it act on its own?</span>
          <span className="ml-auto flex items-center gap-1 bg-[#fafafa] px-2.5 py-1 text-[12px] font-medium text-[#09090b]" style={{ borderRadius: 6 }}>
            Apply <ArrowRight size={11} weight="bold" />
          </span>
          <span className="text-[12px] text-faint">Not now</span>
        </Float>
      </div>
    </Stage>
  );
}

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

export function BurndownStage() {
  const legend = [
    { label: "Remaining", color: "#f4f4f5" },
    { label: "People", color: SKY },
    { label: "Agents", color: C_CLAUDE[1] },
  ];
  return (
    <Stage>
      <div className="flex gap-2 px-5 pt-5">
        <Control className="w-[110px]">
          Sprint 4 <Caret />
        </Control>
        <Control>
          <span className="text-faint">Story points</span>
        </Control>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 px-5 text-[11px] text-faint">
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className="h-[2px] w-3 rounded-full" style={{ background: l.color }} /> {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t border-dashed border-white/40" /> Ideal
        </span>
      </div>
      <div className="absolute inset-x-5 bottom-4 top-[108px]">
        <CardBurndown />
      </div>
    </Stage>
  );
}

// Drawn for the card's proportions, with the reports page's lines and colours,
// plus the scaffolding that makes it read as a real chart: point labels on the
// left, dates along the bottom, a "today" marker, and a soft fill under the
// agents' line.
function CardBurndown() {
  const id = useId().replace(/:/g, "");
  const clip = `bd-${id}`;
  const fillId = `bf-${id}`;
  const W = 300;
  const H = 180;
  const P = { t: 6, r: 6, b: 18, l: 22 };
  const max = 34;
  const x = (i: number) => P.l + (i / (DAYS.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const pts = (get: (d: Day) => number | null) =>
    DAYS.map((d, i) => [i, get(d)] as const).filter(([, v]) => v !== null) as [number, number][];
  const line = (get: (d: Day) => number | null) =>
    pts(get).map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = (get: (d: Day) => number | null) => {
    const p = pts(get);
    return `${line(get)} L${x(p[p.length - 1]![0]).toFixed(1)},${y(0)} L${x(p[0]![0]).toFixed(1)},${y(0)} Z`;
  };
  const today = DAYS.findLastIndex((d) => d.remaining !== null);
  const series = [
    { get: (d: Day) => d.doneHuman, color: SKY },
    { get: (d: Day) => d.doneAgent, color: C_CLAUDE[0] },
    { get: (d: Day) => d.remaining, color: "#f4f4f5" },
  ];
  const label = { fill: "rgba(255,255,255,0.32)", fontSize: 9.5 } as const;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full overflow-visible" role="img" aria-label="Sprint burndown">
      <defs>
        <clipPath id={clip}>
          <rect className="reveal-draw" x="0" y="-10" width={W} height={H + 20} />
        </clipPath>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C_CLAUDE[1]} stopOpacity="0.22" />
          <stop offset="1" stopColor={C_CLAUDE[1]} stopOpacity="0" />
        </linearGradient>
      </defs>

      {[max, max / 2, 0].map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" />
          <text x={0} y={y(v) + 3.2} {...label}>{v}</text>
        </g>
      ))}
      {[0, 4, 9].map((i) => (
        <text key={i} x={x(i)} y={H - 3} textAnchor={i === 0 ? "start" : i === 9 ? "end" : "middle"} {...label}>
          Nov {i + 3}
        </text>
      ))}
      {/* Today */}
      <line x1={x(today)} x2={x(today)} y1={P.t} y2={y(0)} stroke="rgba(255,255,255,0.14)" strokeDasharray="2 3" />

      {/* The lines are revealed left to right by a clip that widens from nothing. */}
      <g clipPath={`url(#${clip})`}>
        <path d={area((d) => d.doneAgent)} fill={`url(#${fillId})`} />
        <path d={line((d) => d.ideal)} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.25" strokeDasharray="4 4" />
        {series.map((s) => (
          <path key={s.color} d={line(s.get)} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </g>
      {series.map((s) => {
        const p = pts(s.get).at(-1)!;
        return (
          <g key={s.color} className="reveal-fade" style={delay(1.15)}>
            <circle cx={x(p[0])} cy={y(p[1])} r="6" fill={s.color} opacity="0.18" />
            <circle cx={x(p[0])} cy={y(p[1])} r="2.75" fill={s.color} stroke="#121214" strokeWidth="1" />
          </g>
        );
      })}
    </svg>
  );
}
