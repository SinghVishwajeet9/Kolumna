"use client";

// The six scenes for the landing page's feature cards (design: DESIGN-CARDS.md).
// Each is one short story told with a bubble (what was asked), a status line
// (what's happening) and a short list or one small graph. They play once, when
// the card scrolls into view, and then rest.
//   How it works:   PlanScene, AgentScene, ApproveScene (this one you can click)
//   Spend and trust: SpendScene, RecordScene, BurndownScene

import { useState } from "react";
import { ChartBar, ChartLine, CheckCircle, Kanban, Robot, ArrowRight } from "@phosphor-icons/react";
import { Context, DotGrid, Issue, Item, LandingCard, Prompt, Reply, Section, Status, Tag, Task, Thinking, at } from "./Card";

// The palette inside cards: two soft data colours, everything else white at a strength.
const MINT = "#5fc79a";
const LAVENDER = "#a696f0";
const SKY = "#7dc4e4";
const AMBER = "#e9b949";
const SECONDARY = "#8a8f98";

const Key = ({ children }: { children: string }) => (
  <span className="w-[52px] shrink-0 tabular-nums text-[#8a8f98]">{children}</span>
);

/** A status circle like the app's: empty for to do, half for in progress, full for done. */
function StateDot({ state }: { state: "todo" | "doing" | "done" }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" className="shrink-0" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5.5" fill="none" stroke={state === "done" ? MINT : "rgba(255,255,255,0.35)"} strokeWidth="1.3" />
      {state === "doing" && <path d="M6.5 3a3.5 3.5 0 0 1 0 7z" fill="rgba(255,255,255,0.55)" />}
      {state === "done" && <circle cx="6.5" cy="6.5" r="3.5" fill={MINT} />}
    </svg>
  );
}

const Label = ({ children, d }: { children: React.ReactNode; d: number }) => (
  <p className="lc-in mb-2 mt-4 text-[12px] text-[#8a8f98]" style={at(d)}>
    {children}
  </p>
);

// --- How it works -----------------------------------------------------------------

export function PlanChatScene() {
  return (
    <LandingCard icon={<Kanban size={10} />} name="Product Roadmap" chip="To Do">
      <Prompt>Ship onboarding emails, and put it with the other onboarding work</Prompt>
      <Context id="KOL-14" note="added to To Do" icon={<StateDot state="todo" />} d={300} />
      <Thinking done="Placed in 1 sec" d={500} after={1100} />
      <Reply d={1100}>
        Added <Issue id="KOL-14" title="Ship onboarding emails" status={<StateDot state="todo" />} /> to To Do, next to
        the other two onboarding tasks.
      </Reply>
      <div className="lc-in mt-3 overflow-hidden" style={{ ...at(1500), borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
        {[
          ["KOL-14", "Ship onboarding emails", "todo"],
          ["KOL-9", "Fix invite link expiry", "doing"],
          ["KOL-21", "Retry failed invoice webhooks", "todo"],
        ].map(([key, title, s], i) => (
          <div key={key} className="flex h-9 items-center gap-2.5 px-3 text-[13px]" style={i ? { borderTop: "1px solid rgba(255,255,255,0.06)" } : undefined}>
            <StateDot state={s as "todo" | "doing"} />
            <span className="w-[46px] shrink-0 font-mono text-[12px] text-[#8a8f98]">{key}</span>
            <span className={`truncate ${i ? "text-[#8a8f98]" : "text-[#f7f8f8]"}`}>{title}</span>
          </div>
        ))}
      </div>
    </LandingCard>
  );
}

export function AgentChatScene() {
  return (
    <LandingCard icon={<Robot size={10} weight="fill" style={{ color: MINT }} />} name="Claude Code" chip="acts with approval">
      <Prompt>pick up the onboarding emails task on the Kolumna board</Prompt>
      <Context id="KOL-14" note="added to context" icon={<StateDot state="doing" />} d={300} />
      <Thinking done="Worked for 6 sec" d={500} after={1400} />
      <Reply d={1300}>
        Started working on <Issue id="KOL-14" title="Ship onboarding emails" status={<StateDot state="doing" />} /> and
        moved it to In Progress.
      </Reply>
      <Task label="Drafting the welcome email copy…" d={1800} from={4} />
    </LandingCard>
  );
}

/** The one card you can use: approve or reject the agent's change. */
export function ApproveChatScene() {
  const [decided, setDecided] = useState<null | "approved" | "rejected">(null);
  const button = "flex h-8 items-center px-3 text-[13px] transition-colors";
  return (
    <LandingCard
      icon={<span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: decided ? MINT : AMBER }} />}
      name="Approvals"
      chip={decided ? "nothing waiting" : "1 waiting"}
    >
      <Prompt>move the onboarding emails task to Done</Prompt>
      <Context id="Claude Code" note="· confidence 62%, needs 80%" icon={<Robot size={12} weight="fill" style={{ color: MINT }} />} d={300} />
      <Thinking done="Held for review" d={500} after={1200} />
      <Reply d={1100}>
        Wants to move <Issue id="KOL-14" title="Ship onboarding emails" status={<StateDot state="doing" />} /> to Done.
        <span className="mt-1 block text-[#8a8f98]">“Tests pass, but nobody has reviewed the email copy yet.”</span>
      </Reply>
      <div className="lc-in mt-3 flex items-center gap-2" style={at(1600)}>
        {decided ? (
          <>
            <span className="flex items-center gap-1.5 text-[13px] text-[#d0d6e0]">
              <CheckCircle size={15} weight="fill" style={{ color: decided === "approved" ? MINT : SECONDARY }} />
              {decided === "approved" ? "Approved and written to the audit log" : "Rejected · nothing changed"}
            </span>
            <button type="button" onClick={() => setDecided(null)} className="ml-auto text-[12px] text-[#8a8f98] hover:text-[#f7f8f8]">
              Show it again
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setDecided("approved")}
              className={`${button} bg-[#f7f8f8] font-medium text-[#0f1011] hover:bg-white`}
              style={{ borderRadius: 7 }}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setDecided("rejected")}
              className={`${button} text-[#8a8f98] hover:bg-white/[0.06] hover:text-[#f7f8f8]`}
              style={{ borderRadius: 7 }}
            >
              Reject
            </button>
          </>
        )}
      </div>
    </LandingCard>
  );
}

// --- How it works, panel look (in use) ---------------------------------------------
// Property sheets in the style of linear.app's team and pull-request cards:
// section labels, icon rows getting dimmer down the sheet, a fade at the bottom.
// The conversation versions above (…ChatScene) are kept in case we go back.

const Dot = ({ color }: { color: string }) => <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: color }} />;

/** A short vertical tick joining two rows of a stack, as in Linear's PR stack. */
const Joint = () => <span className="ml-[7px] block h-2.5 w-px bg-white/[0.12]" />;

/** A square stack marker: filled green when done, dim when not. */
const Mark = ({ on }: { on: boolean }) => (
  <span className="flex h-4 w-4 items-center justify-center" style={{ borderRadius: 4, backgroundColor: on ? "rgba(95,199,154,0.16)" : "rgba(255,255,255,0.06)" }}>
    <span className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: on ? MINT : "#8a8f98" }} />
  </span>
);

export function PlanScene() {
  return (
    <LandingCard variant="panel" icon={<Kanban size={10} />} name="Product Roadmap" chip="KOL">
      <Section label="Statuses">
        <Item icon={<StateDot state="todo" />} tone={0} right={<Tag>3</Tag>}>
          To Do
        </Item>
        <Item icon={<StateDot state="doing" />} right={<Tag>2</Tag>}>
          In Progress
        </Item>
        <Item icon={<StateDot state="done" />} tone={2}>
          Done
        </Item>
      </Section>
      <Section label="Labels" d={250}>
        <Item icon={<Dot color={SKY} />}>Onboarding</Item>
        <Item icon={<Dot color={LAVENDER} />} tone={2}>
          Billing
        </Item>
      </Section>
      <Section label="Sprint" d={500}>
        <Item icon={<ArrowRight size={13} />} tone={2}>
          Sprint 4 · 6 days left
        </Item>
      </Section>
    </LandingCard>
  );
}

export function AgentScene() {
  return (
    <LandingCard variant="panel" icon={<Robot size={10} weight="fill" style={{ color: MINT }} />} name="Claude Code" chip="KOL-14">
      <Section label="Connection">
        <Item icon={<CheckCircle size={15} weight="fill" style={{ color: MINT }} />} tone={0}>
          Connected over MCP
        </Item>
      </Section>
      <Section label="Working on" d={250}>
        <div className="flex flex-col">
          <Item icon={<Mark on={false} />} tone={1} right={<Tag>Current</Tag>}>
            <span className="text-[#8a8f98]">3</span> Draft the welcome email copy
          </Item>
          <Joint />
          <Item icon={<Mark on />}>
            <span className="text-[#62666d]">2</span> Build the email template
          </Item>
          <Joint />
          <Item icon={<Mark on />} tone={2}>
            <span className="text-[#62666d]">1</span> Add the send-on-signup hook
          </Item>
        </div>
      </Section>
      <Section label="Autonomy" d={500}>
        <Item icon={<DotGrid />} tone={2}>
          Acts with approval
        </Item>
      </Section>
    </LandingCard>
  );
}

/** The one card you can use: approve or reject the agent's change. */
export function ApproveScene() {
  const [decided, setDecided] = useState<null | "approved" | "rejected">(null);
  const button = "flex h-8 items-center px-3 text-[13px] transition-colors";
  return (
    <LandingCard
      variant="panel"
      icon={<span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: decided ? MINT : AMBER }} />}
      name="Approval"
      chip={decided ? "decided" : "waiting"}
    >
      <Section label="Change">
        <Item icon={<Robot size={13} weight="fill" style={{ color: MINT }} />} tone={0}>
          Move KOL-14 to Done
        </Item>
      </Section>
      <Section label="Confidence" d={250}>
        <Item icon={<span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: AMBER }} />} right={<span className="text-[13px] text-[#8a8f98]">needs 80%</span>}>
          62%, below the threshold
        </Item>
      </Section>
      <div className="lc-in mt-5 flex items-center gap-2" style={at(500)}>
        {decided ? (
          <>
            <span className="flex items-center gap-1.5 text-[13px] text-[#d0d6e0]">
              <CheckCircle size={15} weight="fill" style={{ color: decided === "approved" ? MINT : SECONDARY }} />
              {decided === "approved" ? "Approved and logged" : "Rejected · nothing changed"}
            </span>
            <button type="button" onClick={() => setDecided(null)} className="ml-auto text-[12px] text-[#8a8f98] hover:text-[#f7f8f8]">
              Show it again
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setDecided("approved")}
              className={`${button} bg-[#f7f8f8] font-medium text-[#0f1011] hover:bg-white`}
              style={{ borderRadius: 7 }}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setDecided("rejected")}
              className={`${button} text-[#8a8f98] hover:bg-white/[0.06] hover:text-[#f7f8f8]`}
              style={{ borderRadius: 7 }}
            >
              Reject
            </button>
          </>
        )}
      </div>
      <Section label="Reason" d={750}>
        <Item tone={2}>“Nobody has reviewed the email copy yet.”</Item>
      </Section>
    </LandingCard>
  );
}

// --- Spend and trust ----------------------------------------------------------------

// Daily spend agents reported, Nov 1 to 14 (dollars).
const CLAUDE = [0.8, 1.3, 0.4, 2.4, 1.1, 0.6, 2.6, 1.5, 0.3, 1.9, 2.9, 0.7, 1.2, 2.2];
const CURSOR = [0.5, 0.4, 1.2, 1.9, 0.7, 0.3, 0.9, 0.6, 0.4, 1.1, 0.8, 1.5, 0.5, 0.9];

export function SpendScene() {
  const W = 300;
  const H = 120;
  const peak = 5;
  const step = W / CLAUDE.length;
  const bw = 9;
  return (
    <LandingCard icon={<ChartBar size={14} />} name="Agent spend" chip="$78 of $100">
      {/* The monthly cap, as one thin meter. */}
      <div className="lc-in" style={at(0)}>
        <div className="flex items-baseline justify-between text-[12px] text-[#8a8f98]">
          <span>This month</span>
          <span>78% of the cap</span>
        </div>
        <div className="mt-2 h-[3px] w-full overflow-hidden bg-white/[0.08]" style={{ borderRadius: 99 }}>
          <span className="lc-draw block h-full" style={{ width: "78%", borderRadius: 99, backgroundColor: "rgba(255,255,255,0.6)", ...at(200) }} />
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-7 block w-full overflow-visible" aria-label="Daily agent spend, Nov 1 to 14">
        {CLAUDE.map((c, i) => {
          const k = CURSOR[i]!;
          const x = i * step + (step - bw) / 2;
          const hc = (c / peak) * H;
          const hk = (k / peak) * H;
          return (
            <g key={i} className="lc-bar" style={at(300 + i * 30)}>
              <rect x={x} y={H - hc} width={bw} height={hc} rx={2.5} fill={MINT} opacity={0.85} />
              <rect x={x} y={H - hc - hk - 2} width={bw} height={hk} rx={2.5} fill={LAVENDER} opacity={0.85} />
            </g>
          );
        })}
      </svg>
      <div className="lc-in mt-2 flex justify-between text-[12px] text-[#8a8f98]" style={at(700)}>
        <span>Nov 1</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: MINT }} /> Claude Code
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LAVENDER }} /> Cursor
          </span>
        </span>
        <span>Nov 14</span>
      </div>
    </LandingCard>
  );
}

// The last 48 gated changes, oldest first.
const HISTORY = Array.from({ length: 48 }, (_, i) => (i === 12 || i === 33 ? "rejected" : i === 25 ? "reopened" : "approved"));

export function RecordScene() {
  return (
    <LandingCard icon={<Robot size={14} weight="fill" style={{ color: MINT }} />} name="Claude Code" chip="94% approved">
      <p className="lc-in text-[12px] text-[#8a8f98]" style={at(0)}>
        Last 48 gated changes
      </p>
      <div className="mt-3 grid grid-cols-[repeat(12,1fr)] gap-[5px]">
        {HISTORY.map((h, i) => (
          <span
            key={i}
            className="lc-cell aspect-square"
            style={
              {
                ...at(150 + i * 12),
                // Older changes are dimmer.
                "--o": h === "approved" ? 0.25 + 0.65 * (i / (HISTORY.length - 1)) : 1,
                borderRadius: 3,
                backgroundColor: h === "approved" ? MINT : h === "reopened" ? AMBER : "transparent",
                border: h === "rejected" ? "1px solid rgba(255,255,255,0.3)" : undefined,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="lc-in mt-2 flex justify-between text-[12px] text-[#8a8f98]" style={at(750)}>
        <span>Oldest</span>
        <span>Now</span>
      </div>
      <div className="mt-5">
        <Status
          before="Reading its track record"
          done={
            <span className="flex items-center gap-1.5 text-[#f7f8f8]">
              Suggested: let it act on its own <ArrowRight size={12} />
            </span>
          }
          d={950}
          after={1900}
        />
      </div>
    </LandingCard>
  );
}

// Sprint 4: points left, and points done by people and by agents, per day.
const DAYS = 10;
const TODAY = 7; // the last day with data
const PEOPLE = [0, 1, 3, 4, 6, 8, 9, 11];
const AGENTS = [0, 2, 3, 6, 8, 9, 12, 14];
const TOTAL = 34;

export function BurndownScene() {
  const W = 300;
  const H = 150;
  const x = (i: number) => (i / (DAYS - 1)) * (W - 70);
  const y = (v: number) => 6 + (1 - v / TOTAL) * (H - 12);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const remaining = PEOPLE.map((p, i) => TOTAL - p - AGENTS[i]!);
  const series = [
    { name: "Remaining", vals: remaining, color: "rgba(255,255,255,0.65)" },
    { name: "Agents", vals: AGENTS, color: MINT },
    { name: "People", vals: PEOPLE, color: LAVENDER },
  ];
  // Names at the line ends, nudged apart so they never overlap (at least 13px between).
  const labelY = new Map<string, number>();
  [...series]
    .sort((a, b) => y(a.vals[TODAY]!) - y(b.vals[TODAY]!))
    .reduce((prev, s) => {
      const want = y(s.vals[TODAY]!) + 4;
      const at = Math.max(want, prev + 13);
      labelY.set(s.name, at);
      return at;
    }, -Infinity);
  return (
    <LandingCard icon={<ChartLine size={14} />} name="Sprint 4" chip="6 days left">
      <p className="lc-in text-[12px] text-[#8a8f98]" style={at(0)}>
        Story points
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 block w-full overflow-visible" aria-label="Sprint burndown">
        {/* The ideal: the only reference line. */}
        <path
          className="lc-draw"
          style={at(150)}
          d={`M${x(0)},${y(TOTAL)} L${x(DAYS - 1)},${y(0)}`}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        {series.map((s, i) => (
          <g key={s.name}>
            <path
              className="lc-draw"
              style={at(250 + i * 120)}
              d={path(s.vals)}
              fill="none"
              stroke={s.color}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <g className="lc-cell" style={at(1150 + i * 80)}>
              <circle cx={x(TODAY)} cy={y(s.vals[TODAY]!)} r="3" fill={s.color} />
              {/* The line's name at its end, instead of a legend. */}
              <text
                x={x(TODAY) + 9}
                y={labelY.get(s.name)}
                fontSize="11"
                fill={SECONDARY}
              >
                {s.name}
              </text>
            </g>
          </g>
        ))}
      </svg>
      <div className="lc-in mt-2 flex justify-between pr-[70px] text-[12px] text-[#8a8f98]" style={at(900)}>
        <span>Nov 3</span>
        <span>Nov 12</span>
      </div>
    </LandingCard>
  );
}
