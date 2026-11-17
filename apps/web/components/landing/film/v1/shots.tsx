// FALLBACK: the first version of the product film's four scenes
// (2026-11-17), kept unchanged in case we want to go back to it. Everything in
// a shot is there from the start; only the camera moves.

import {
  ChartBar,
  Kanban,
  Pulse,
  Robot,
  SealCheck,
  CaretUpDown,
} from "@phosphor-icons/react/dist/ssr";
import { LogoMark } from "@/components/Logo";

const DIM = "rgba(255,255,255,0.3)";
const SUBJECT = "rgba(255,255,255,0.62)";
const FAINT = "rgba(255,255,255,0.14)";
const PANEL = { backgroundColor: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.055)" };
const AMBER = "rgba(233,185,73,0.75)";
const MINT = "rgba(90,247,179,0.7)";

const bar = (w: number | string, color = FAINT, h = 6) => (
  <span className="block" style={{ width: w, height: h, borderRadius: 99, backgroundColor: color }} />
);

function Scene({ width, shiftY = 0, children }: { width: number; shiftY?: number; children: React.ReactNode }) {
  return (
    <div style={{ width, transform: `translateY(${shiftY}px)`, fontSize: 15, lineHeight: 1.2, color: DIM }}>{children}</div>
  );
}

function WorkspaceShot() {
  const row = "flex h-[46px] items-center gap-3.5 px-4";
  return (
    <Scene width={300} shiftY={-6}>
      <div className="overflow-hidden" style={{ ...PANEL, borderRadius: 16 }}>
        <div className="flex h-[56px] items-center gap-3 px-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <LogoMark style={{ width: 20, color: DIM }} />
          <span className="font-medium">Acme Product</span>
          <CaretUpDown size={14} className="ml-auto" />
        </div>
        <div className="py-2">
          <div className={row}>
            <Kanban size={19} /> Boards
          </div>
          <div className={row} style={{ color: SUBJECT }}>
            <Robot size={19} weight="fill" /> <span className="font-medium">Agents</span>
          </div>
          <div className={row} style={{ color: SUBJECT, backgroundColor: "rgba(255,255,255,0.035)" }}>
            <SealCheck size={19} /> <span className="font-medium">Approvals</span>
            <span className="ml-auto h-[9px] w-[9px] rounded-full" style={{ backgroundColor: AMBER }} />
          </div>
          <div className={row}>
            <ChartBar size={19} /> Usage
          </div>
          <div className={row}>
            <Pulse size={19} /> Activity
          </div>
        </div>
      </div>
    </Scene>
  );
}

function BoardShot() {
  const card = { ...PANEL, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.04)" };
  return (
    <Scene width={320} shiftY={-4}>
      <div className="p-3" style={{ ...PANEL, borderRadius: 18 }}>
        <div className="flex items-center gap-2.5 px-2 pb-3 pt-1.5 font-medium">
          In Progress
          <span className="h-[18px] w-[26px]" style={{ borderRadius: 99, backgroundColor: FAINT }} />
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-3 p-3.5" style={card}>
            Invite link expiry
            <div className="flex items-center justify-between">
              {bar(52)}
              <span className="h-6 w-6 rounded-full" style={{ border: `1px solid ${FAINT}` }} />
            </div>
          </div>
          <div
            className="flex flex-col gap-3 p-3.5"
            style={{ ...card, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(255,255,255,0.06)", color: SUBJECT }}
          >
            <span className="font-medium">Ship onboarding emails</span>
            <div className="flex items-center justify-between">
              {bar(58, "rgba(255,255,255,0.22)")}
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full"
                style={{ border: "1px solid rgba(255,255,255,0.2)", color: MINT }}
              >
                <Robot size={15} weight="fill" />
              </span>
            </div>
            <span className="block h-[3px] w-full overflow-hidden" style={{ borderRadius: 99, backgroundColor: FAINT }}>
              <span className="block h-full w-[64%]" style={{ borderRadius: 99, backgroundColor: SUBJECT }} />
            </span>
          </div>
          <div className="flex flex-col gap-3 p-3.5" style={card}>
            Proration for plan changes
            <div className="flex items-center justify-between">
              {bar(46)}
              <span className="h-6 w-6 rounded-full" style={{ border: `1px solid ${FAINT}` }} />
            </div>
          </div>
        </div>
      </div>
    </Scene>
  );
}

function ApprovalShot() {
  return (
    <Scene width={360} shiftY={-22}>
      <div className="p-5" style={{ ...PANEL, borderRadius: 18 }}>
        <div className="flex items-center gap-2.5">
          <span className="h-[9px] w-[9px] rounded-full" style={{ backgroundColor: AMBER }} />
          <Robot size={17} weight="fill" />
          <span className="font-medium">Claude Code</span>
          <span className="ml-auto">{bar(44)}</span>
        </div>
        <p className="mt-4 text-[19px] font-medium leading-snug" style={{ color: SUBJECT }}>
          Move ACM-14 to Done
        </p>
        <div className="relative mt-5 h-[7px]" style={{ borderRadius: 99, backgroundColor: FAINT }}>
          <span className="absolute inset-y-0 left-0 w-[58%]" style={{ borderRadius: 99, backgroundColor: SUBJECT }} />
          <span className="absolute -inset-y-[5px] left-[80%] w-px" style={{ backgroundColor: "rgba(255,255,255,0.4)" }} />
        </div>
        <p className="mt-3">Below its confidence threshold</p>
        <div className="mt-5 flex items-center gap-3">
          <span
            className="flex h-[42px] items-center px-5 font-medium"
            style={{ borderRadius: 11, backgroundColor: "rgba(255,255,255,0.4)", color: "#0b0b0c" }}
          >
            Approve
          </span>
          <span className="px-3">Reject</span>
        </div>
      </div>
    </Scene>
  );
}

function AuditShot() {
  const entries = ["Claude Code moved ACM-17", "Dana approved the change", "Cursor commented on ACM-9"];
  return (
    <Scene width={360} shiftY={34}>
      <div className="flex items-center gap-2.5 pb-4 pl-1 text-[17px] font-medium" style={{ color: SUBJECT }}>
        <SealCheck size={22} weight="fill" style={{ color: MINT }} />
        Chain verified
      </div>
      <div className="relative flex flex-col gap-2.5 pl-7">
        <span className="absolute bottom-6 left-[9px] top-6 w-px" style={{ backgroundColor: "rgba(255,255,255,0.12)" }} />
        {entries.map((text, i) => (
          <div
            key={text}
            className="relative px-4 py-3.5"
            style={{
              ...PANEL,
              borderRadius: 13,
              ...(i === 0 ? { borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.05)", color: SUBJECT } : {}),
            }}
          >
            <span
              className="absolute -left-[23px] top-1/2 h-[9px] w-[9px] -translate-y-1/2 rounded-full"
              style={{ backgroundColor: i === 0 ? SUBJECT : "rgba(255,255,255,0.2)" }}
            />
            <span className={i === 0 ? "font-medium" : ""}>{text}</span>
            <span className="mt-2.5 flex gap-2">
              {bar(74)}
              {bar(54)}
            </span>
          </div>
        ))}
      </div>
    </Scene>
  );
}

export const SCENES = [WorkspaceShot, BoardShot, ApprovalShot, AuditShot];
export const STILL_SHOT = 2;
