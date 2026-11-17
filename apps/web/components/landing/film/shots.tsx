// The four scenes of the product film (see apps/web/DESIGN-FILM.md).
// Each is a dense slice of the real app, drawn with mock data, so the camera
// always has detail around the subject instead of empty space. Most of a scene
// is simply there (and blurred by the film's depth of field); only two or
// three things arrive while the camera moves, wrapped in <In d={…}>
// ("filmEl" in globals.css). Scenes are laid out at 3x (zoom) so they're drawn
// sharp, never enlarged.

import type { CSSProperties, ReactNode } from "react";
import {
  CaretUpDown,
  ChartBar,
  ChatCircle,
  CheckSquare,
  Kanban,
  ListChecks,
  MagnifyingGlass,
  NotePencil,
  Pulse,
  Robot,
  SealCheck,
  Tray,
  UsersThree,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";
import { LogoMark } from "@/components/Logo";

// The film's palette: dim, with colour only as small accents.
const TEXT = "rgba(255,255,255,0.26)";
const SUBJECT = "rgba(255,255,255,0.52)";
const FAINT = "rgba(255,255,255,0.13)";
const LINE = "rgba(255,255,255,0.06)";
const CARD = { backgroundColor: "rgba(255,255,255,0.03)", border: `1px solid ${LINE}` };
const AMBER = "rgba(233,185,73,0.62)";
const MINT = "rgba(95,199,154,0.6)";
const SKY = "rgba(125,211,252,0.5)";
const LAVENDER = "rgba(166,150,240,0.55)";
const ROSE = "rgba(248,113,113,0.55)";

/** One piece that arrives `d` seconds into its shot. */
function In({ d, className = "", style, children }: { d: number; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className={`film-el ${className}`} style={{ ...style, "--d": `${d}s` } as CSSProperties}>
      {children}
    </div>
  );
}

/** A row that reveals itself left to right, word by word, `d` seconds into its shot. */
function Wipe({ d, className = "", style, children }: { d: number; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className={`film-wipe ${className}`} style={{ ...style, "--d": `${d}s` } as CSSProperties}>
      {children}
    </div>
  );
}

/** A scene, laid out at 3x. `x`/`y` move it so its subject sits where the camera looks. */
function Scene({ width, x = 0, y = 0, children }: { width: number; x?: number; y?: number; children: ReactNode }) {
  return (
    <div style={{ zoom: 3, width, transform: `translate(${x}px, ${y}px)`, fontSize: 13, lineHeight: 1.3, color: TEXT }}>
      {children}
    </div>
  );
}

// --- small pieces, as in the app ---------------------------------------------------

/** Status circle: empty to do, half in progress, three-quarters in review, full done. */
function Status({ s, color = TEXT }: { s: "todo" | "doing" | "review" | "done"; color?: string }) {
  const arc = { doing: "M5 1.5a3.5 3.5 0 0 1 0 7z", review: "M5 1.5a3.5 3.5 0 1 1-3.5 3.5H5z", done: "", todo: "" }[s];
  return (
    <svg width="11" height="11" viewBox="0 0 10 10" className="shrink-0" aria-hidden="true">
      <circle cx="5" cy="5" r="4.2" fill="none" stroke={color} strokeWidth="1.1" strokeDasharray={s === "todo" ? "1.6 1.4" : undefined} />
      {arc && <path d={arc} fill={color} />}
      {s === "done" && <circle cx="5" cy="5" r="3" fill={color} />}
    </svg>
  );
}

/** Priority, as Linear draws it: three rising bars, or an urgent mark. */
function Priority({ level }: { level: 1 | 2 | 3 | "urgent" }) {
  if (level === "urgent") {
    return (
      <span className="flex h-[13px] w-[13px] items-center justify-center text-[9px] font-semibold" style={{ borderRadius: 3, backgroundColor: ROSE, color: "#0b0b0c" }}>
        !
      </span>
    );
  }
  return (
    <svg width="13" height="11" viewBox="0 0 13 11" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={i * 4.5} y={7 - i * 3} width="3" height={4 + i * 3} rx="0.8" fill={i < level ? TEXT : FAINT} />
      ))}
    </svg>
  );
}

const Label = ({ name, color }: { name: string; color: string }) => (
  <span className="inline-flex h-[18px] items-center gap-1.5 px-2 text-[11px]" style={{ borderRadius: 99, border: `1px solid ${LINE}` }}>
    <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: color }} />
    {name}
  </span>
);

const Avatar = ({ who }: { who: string }) => (
  <span className="flex h-[20px] w-[20px] items-center justify-center text-[9px]" style={{ borderRadius: 99, border: `1px solid ${LINE}`, backgroundColor: "rgba(255,255,255,0.05)" }}>
    {who}
  </span>
);

const AgentAvatar = () => (
  <span className="flex h-[20px] w-[20px] items-center justify-center" style={{ borderRadius: 99, border: `1px solid ${LINE}`, color: MINT }}>
    <Robot size={11} weight="fill" />
  </span>
);

const Points = ({ n }: { n: number }) => (
  <span className="flex h-[16px] min-w-[16px] items-center justify-center px-1 text-[10px]" style={{ borderRadius: 99, backgroundColor: "rgba(255,255,255,0.06)" }}>
    {n}
  </span>
);

function Ticket({
  k,
  title,
  label,
  meta,
  who,
  subject = false,
  children,
}: {
  k: string;
  title: string;
  label?: ReactNode;
  meta?: ReactNode;
  who: ReactNode;
  subject?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2 p-3"
      style={{
        ...CARD,
        borderRadius: 9,
        ...(subject ? { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: SUBJECT } : {}),
      }}
    >
      <span className={subject ? "font-medium" : ""}>{title}</span>
      {label && <div className="flex">{label}</div>}
      <div className="flex items-center gap-2.5 text-[11px]">
        <span>{k}</span>
        {meta}
        <span className="ml-auto flex items-center gap-2">{who}</span>
      </div>
      {children}
    </div>
  );
}

// 1. An agent at work: the board, In Progress and In Review side by side.
//    Subject: ACM-14, which an agent picks up while the camera moves up.
function BoardShot() {
  const head = "flex items-center gap-2 px-1 pb-2.5 text-[12px] font-medium";
  return (
    <Scene width={620} x={95} y={-10}>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2 p-2" style={{ ...CARD, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.018)" }}>
          <div className={head}>
            <Status s="doing" /> In Progress <span className="font-normal">3</span>
          </div>
          <Ticket k="ACM-21" title="Retry failed invoice webhooks" label={<Label name="Billing" color={LAVENDER} />} meta={<Priority level={3} />} who={<><Points n={3} /><Avatar who="AR" /></>} />
          <Ticket
            k="ACM-14"
            title="Ship onboarding emails"
            label={<Label name="Onboarding" color={SKY} />}
            meta={
              <span className="flex items-center gap-1">
                <CheckSquare size={11} /> 2/3
              </span>
            }
            who={
              <>
                <Points n={5} />
                <In d={2.2}>
                  <AgentAvatar />
                </In>
              </>
            }
            subject
          >
            <span className="block h-[2px] w-full overflow-hidden" style={{ borderRadius: 99, backgroundColor: FAINT }}>
              <span className="film-fill block h-full w-[66%]" style={{ borderRadius: 99, backgroundColor: SUBJECT, "--d": "2.9s" } as CSSProperties} />
            </span>
          </Ticket>
          <Ticket k="ACM-9" title="Fix invite link expiry" meta={<Priority level={2} />} who={<><Points n={2} /><Avatar who="DP" /></>} />
        </div>
        <div className="flex flex-col gap-2 p-2" style={{ ...CARD, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.018)" }}>
          <div className={head}>
            <Status s="review" /> In Review <span className="font-normal">2</span>
          </div>
          <Ticket
            k="ACM-17"
            title="Proration for plan changes"
            label={<Label name="Billing" color={LAVENDER} />}
            meta={
              <span className="flex items-center gap-1">
                <ChatCircle size={11} /> 3
              </span>
            }
            who={<><Priority level="urgent" /><AgentAvatar /></>}
          />
          <Ticket k="ACM-6" title="Workspace switcher" label={<Label name="Platform" color={MINT} />} who={<><Points n={5} /><Avatar who="AR" /></>} />
          {/* A card lands in review first: the camera starts low and moves up. */}
          <In d={0.8}>
            <Ticket k="ACM-11" title="Login rate limit" meta={<Priority level={3} />} who={<><Points n={3} /><AgentAvatar /></>} />
          </In>
        </div>
      </div>
    </Scene>
  );
}

// 2. The workspace: the sidebar, full of real items. Subject: Agents and Approvals.
//    The camera moves down it and the rows appear one by one, top to bottom, each
//    revealing its icon and words left to right.
function WorkspaceShot() {
  const row = "flex h-[30px] items-center gap-2.5 px-2.5";
  const section = "px-2.5 pb-1.5 pt-4 text-[11px]";
  const step = 0.32; // seconds between rows
  let n = 0;
  const next = () => 0.2 + step * n++;
  return (
    <Scene width={250} y={-28}>
      <div className="flex flex-col py-2" style={{ ...CARD, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.02)" }}>
        <Wipe d={next()} className="flex items-center gap-2 px-2.5 pb-2">
          <LogoMark style={{ width: 15, color: TEXT }} />
          <span className="font-medium">Acme Product</span>
          <CaretUpDown size={11} />
          <span className="ml-auto flex items-center gap-2.5">
            <MagnifyingGlass size={13} />
            <NotePencil size={13} />
          </span>
        </Wipe>
        <Wipe d={next()} className={row}>
          <Tray size={14} /> Inbox <span className="ml-auto text-[11px]">4</span>
        </Wipe>
        <Wipe d={next()} className={row}>
          <ListChecks size={14} /> My tasks
        </Wipe>
        <Wipe d={next()} className={row}>
          <Kanban size={14} /> Boards
        </Wipe>
        <Wipe d={next()} className={row} style={{ color: SUBJECT }}>
          <Robot size={14} weight="fill" /> <span className="font-medium">Agents</span>
          <span className="ml-auto flex items-center gap-1.5 text-[11px]">
            <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: MINT }} /> 2 active
          </span>
        </Wipe>
        <Wipe d={next()} className={row} style={{ color: SUBJECT, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 6 }}>
          <SealCheck size={14} /> <span className="font-medium">Approvals</span>
          <span className="ml-auto flex h-[16px] min-w-[16px] items-center justify-center px-1 text-[10px]" style={{ borderRadius: 99, backgroundColor: AMBER, color: "#0b0b0c" }}>
            2
          </span>
        </Wipe>
        <Wipe d={next()} className={row}>
          <UsersThree size={14} /> Members
        </Wipe>
        <Wipe d={next()} className={row}>
          <ChartBar size={14} /> Usage
        </Wipe>
        <Wipe d={next()} className={row}>
          <Pulse size={14} /> Activity
        </Wipe>
        <Wipe d={next()} className={section}>
          Your boards
        </Wipe>
        {[
          ["Product Roadmap", LAVENDER],
          ["Marketing site", SKY],
          ["Mobile app", MINT],
        ].map(([name, color]) => (
          <Wipe key={name} d={next()} className={row}>
            <span className="h-[9px] w-[9px] shrink-0" style={{ borderRadius: 3, border: `1.5px solid ${color}` }} /> {name}
          </Wipe>
        ))}
      </div>
    </Scene>
  );
}

// 3. A person decides: an approval with its details. Subject: confidence and Approve.
function ApprovalShot() {
  const field = "grid grid-cols-[88px_1fr] items-center gap-2 py-1.5 text-[12px]";
  return (
    <Scene width={440} x={70} y={30}>
      <div className="flex flex-col gap-3">
        <div className="p-4" style={{ ...CARD, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.035)" }}>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: AMBER }} />
            <Robot size={13} weight="fill" style={{ color: MINT }} />
            <span className="font-medium">Claude Code</span>
            <span>· 3m ago</span>
            <span className="ml-auto">move_card</span>
          </div>
          <p className="mt-3 text-[16px] font-medium leading-snug" style={{ color: SUBJECT }}>
            Move ACM-14 to Done
          </p>
          <div className="mt-2" style={{ borderTop: `1px solid ${LINE}` }}>
            <div className={field}>
              <span>Status</span>
              <span className="flex items-center gap-1.5">
                <Status s="doing" /> In Progress <ArrowRight size={11} /> <Status s="done" color={MINT} /> Done
              </span>
            </div>
            <div className={field}>
              <span>Task</span>
              <span>ACM-14 Ship onboarding emails</span>
            </div>
            <div className={field}>
              <span>Confidence</span>
              <span className="flex items-center gap-2.5" style={{ color: SUBJECT }}>
                {/* Fills, and stops short of the threshold line. */}
                <span className="relative h-[5px] w-[160px]" style={{ borderRadius: 99, backgroundColor: FAINT }}>
                  <span className="film-fill absolute inset-y-0 left-0 w-[62%]" style={{ borderRadius: 99, backgroundColor: SUBJECT, "--d": "1.2s" } as CSSProperties} />
                  <span className="absolute -inset-y-[4px] left-[80%] w-px" style={{ backgroundColor: "rgba(255,255,255,0.35)" }} />
                </span>
                62% · needs 80%
              </span>
            </div>
          </div>
          <p className="mt-2 text-[12px] italic">“Tests pass, but nobody has reviewed the email copy yet.”</p>
          <div className="mt-4 flex items-center gap-2 text-[12px]">
            <In d={2.3} className="flex h-[30px] items-center px-3.5 font-medium" style={{ borderRadius: 8, backgroundColor: "rgba(255,255,255,0.32)", color: "#0b0b0c" }}>
              Approve
            </In>
            <In d={2.7} className="px-2.5">
              Reject
            </In>
          </div>
        </div>
        {/* The next one waiting, already there. */}
        <div className="p-4" style={{ ...CARD, borderRadius: 12 }}>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: AMBER }} />
            <Robot size={13} weight="fill" style={{ color: MINT }} />
            <span className="font-medium">Cursor</span>
            <span>· 12m ago</span>
          </div>
          <p className="mt-2.5 text-[14px]">Raise ACM-21 to Urgent</p>
        </div>
      </div>
    </Scene>
  );
}

// 4. It is on the record: the audit chain, each entry linked to the one before.
function AuditShot() {
  const entries = [
    { seq: 1042, who: "Claude Code", agent: true, what: "moved ACM-17 to In Review", hash: "9f2c…a71e", prev: "4b80…12dd", t: "2m" },
    { seq: 1041, who: "Ana Ruiz", agent: false, what: "approved a change from Claude Code", hash: "4b80…12dd", prev: "e317…0c5b", t: "6m" },
    { seq: 1040, who: "Cursor", agent: true, what: "proposed raising ACM-21 to Urgent", hash: "e317…0c5b", prev: "71aa…d902", t: "12m" },
    { seq: 1039, who: "Dana Park", agent: false, what: "started Sprint 4", hash: "71aa…d902", prev: "0b9e…44f1", t: "1h" },
  ];
  return (
    <Scene width={520} x={115} y={60}>
      <div className="flex items-center gap-2 pb-3 text-[12px]">
        <span className="font-medium">Activity</span>
        <span>· 1,042 entries</span>
        <In d={2.6} className="ml-auto flex items-center gap-1.5" style={{ color: SUBJECT }}>
          <SealCheck size={14} weight="fill" style={{ color: MINT }} /> Chain verified
        </In>
      </div>
      <div className="relative flex flex-col gap-2 pl-6">
        {/* The chain: a dashed line with a diamond at each entry. */}
        <span className="absolute bottom-5 left-[7px] top-5 w-px" style={{ backgroundImage: `linear-gradient(${FAINT} 50%, transparent 50%)`, backgroundSize: "1px 6px" }} />
        {entries.map((e, i) => {
          const row = (
            <div
              className="relative flex flex-col gap-1.5 px-3.5 py-2.5"
              style={{ ...CARD, borderRadius: 9, ...(i === 0 ? { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: SUBJECT } : {}) }}
            >
              <span
                className="absolute -left-[22px] top-1/2 h-[8px] w-[8px] -translate-y-1/2 rotate-45"
                style={{ border: `1.2px solid ${i === 0 ? SUBJECT : TEXT}`, backgroundColor: "#0b0b0c" }}
              />
              <span className="flex items-center gap-2 text-[12px]">
                <span className="tabular-nums">#{e.seq}</span>
                {e.agent && <Robot size={12} weight="fill" style={{ color: MINT }} />}
                <span className={i === 0 ? "font-medium" : ""}>
                  {e.who} {e.what}
                </span>
                <span className="ml-auto">{e.t}</span>
              </span>
              <span className="flex gap-3 font-mono text-[10.5px]" style={{ color: i === 0 ? TEXT : FAINT }}>
                <span>hash {e.hash}</span>
                <span>prev {e.prev}</span>
              </span>
            </div>
          );
          // The newest entry arrives; the history is already there.
          return i === 0 ? (
            <In key={e.seq} d={1.0}>
              {row}
            </In>
          ) : (
            <div key={e.seq}>{row}</div>
          );
        })}
      </div>
    </Scene>
  );
}

/** In film order; index matches SHOTS in camera.ts. */
export const SCENES = [BoardShot, WorkspaceShot, ApprovalShot, AuditShot];
/** The shot shown as a still when motion is reduced. */
export const STILL_SHOT = 2;
