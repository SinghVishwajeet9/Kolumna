"use client";

// Every section below the hero (see apps/web/DESIGN.md "Page structure").
// Small visuals use the app's real components inside .app-ui.

import Image from "next/image";
import { SealCheck } from "@phosphor-icons/react";
import { ButtonLink, Cell, Cells, EdgeGrain, Panel, Rule, SectionHeader, Spacer, h2Class, pad } from "./Frame";
import { CrowdCanvas } from "./CrowdCanvas";
import { AutonomyHairline, ConfidenceHairline, IdentityHairline } from "./HairlineFigures";
import { RevealText } from "./RevealText";
import { AgentShot, ApprovalShot, ColumnShot } from "./ConsoleShots";
import {
  BudgetStage,
  BurndownStage,
  TrackRecordStage,
} from "./Stages";


// --- Works with ---------------------------------------------------------------

const CLIENTS = ["Claude Code", "Cursor", "Antigravity", "Any MCP client"];

export function WorksWith() {
  return (
    <>
      <div className={`py-5 ${pad}`}>
        <p className="text-[13px] text-[var(--l-faint)]">Connects to the agents your team already uses, over MCP</p>
      </div>
      {/* 2×2 on phones, one row of 4 from md up; cells split by hairlines. */}
      <div className="grid grid-cols-2 border-t border-[var(--l-line)] md:grid-cols-4">
        {CLIENTS.map((c, i) => (
          <div
            key={c}
            className={`flex h-16 items-center justify-center border-[var(--l-line)] text-center text-[14px] font-medium text-[var(--l-muted)] md:h-20 md:text-[15px] ${
              i % 2 === 1 ? "border-l" : ""
            } ${i >= 2 ? "max-md:border-t" : ""} ${i === 2 ? "md:border-l" : ""}`}
          >
            {c}
          </div>
        ))}
      </div>
    </>
  );
}

/** A strip of people walking across, framed by full-width hairlines. Decorative.
 * A huge "KOLUMNA" sits behind them, fading out downward, with the crowd
 * covering the lower part of the word. */
export function CrowdStrip() {
  return (
    <>
      <Rule />
      <div aria-hidden="true" className="relative h-[200px] overflow-hidden md:h-[300px]">
        <span
          className="pointer-events-none absolute inset-x-0 top-2 select-none text-center font-semibold uppercase leading-none tracking-[0.08em] md:top-3"
          style={{
            fontSize: "clamp(44px, 10vw, 128px)",
            backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.35) 45%, transparent 80%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Kolumna
        </span>
        {/* brightness() greys the white fills but keeps them opaque, so the word stays hidden behind people. */}
        <CrowdCanvas className="relative brightness-[0.75]" />
      </div>
      <Rule />
    </>
  );
}

// --- Agents as teammates -----------------------------------------------------

export function Teammates() {
  return (
    <section id="features">
      <SectionHeader
        title={<RevealText text="Agents as teammates, not black boxes." className={h2Class} />}
        aside="Every agent joins your workspace as a member you can see, limit and switch off. It works through the same board your team does."
      />
      <div className="border-t border-[var(--l-line)]">
        <Cells>
          <Cell
            visual={<IdentityHairline />}
            title="Its own identity"
            body="Each agent has its own credentials and scopes. Give it access until a date or until the sprint ends, and revoke it in one click."
          />
          <Cell
            visual={<AutonomyHairline />}
            title="Autonomy you set"
            body="Per agent, and per board if you like: only suggest, act when it's confident enough, or act on its own."
          />
          <Cell
            visual={<ConfidenceHairline />}
            title="Confidence gates"
            body="Agents say how sure they are. Below your threshold, the change is checked by a dry run and waits for a person."
          />
        </Cells>
      </div>
    </section>
  );
}

// --- How it works --------------------------------------------------------------

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-14">
      <SectionHeader
        title={<RevealText text="Plan it. Delegate it. Approve it." className={h2Class} />}
        aside="Three steps from an empty board to agents doing real work under your rules."
      />
      <div className="border-t border-[var(--l-line)]">
        <Cells>
          <Cell
            visual={<ColumnShot />}
            title="1. Plan the work"
            body="Boards start with To Do, In Progress, In Review and Done. Type a task, press Enter, drag it along."
          />
          <Cell
            visual={<AgentShot />}
            title="2. Bring your agents"
            body="Connect Claude Code, Cursor or any MCP client in one command. They see the board and pick up tickets."
          />
          <Cell
            visual={<ApprovalShot />}
            title="3. Approve what matters"
            body="Changes an agent isn't sure about wait in Approvals. Try it: approve or reject this one."
          />
        </Cells>
      </div>
    </section>
  );
}

// --- Spend and trust -----------------------------------------------------------

export function SpendAndTrust() {
  return (
    <section>
      <SectionHeader
        title={<RevealText text="Know what it costs, and who to trust." className={h2Class} />}
        aside="Cap what each agent can spend, see how often its work gets approved, and plan sprints with humans and agents on one chart."
      />
      <div className="border-t border-[var(--l-line)]">
        <Cells>
          <Cell
            visual={<BudgetStage />}
            title="Budgets per agent"
            body="A monthly cap on the spend agents report. Alerts at the line; past it, even an autonomous agent needs approval."
          />
          <Cell
            visual={<TrackRecordStage />}
            title="A track record"
            body="Kolumna keeps score from what actually happened, and suggests when to give an agent more autonomy, or less."
          />
          <Cell
            visual={<BurndownStage />}
            title="One burndown for everyone"
            body="Sprint charts count work done by people and by agents, against your team’s capacity."
          />
        </Cells>
      </div>
    </section>
  );
}

// --- Audit trail ---------------------------------------------------------------

const CHAIN = [
  { seq: 1042, text: "Claude Code moved ACM-17 to In Review", hash: "9f2c…a71e", prev: "4b80…12dd" },
  { seq: 1041, text: "Ana Ruiz approved a change from Claude Code", hash: "4b80…12dd", prev: "e317…0c5b" },
  { seq: 1040, text: "Cursor proposed raising ACM-21 to Urgent", hash: "e317…0c5b", prev: "71aa…d902" },
];

export function AuditSection() {
  return (
    <section id="audit" className="grid scroll-mt-14 md:grid-cols-2">
      <div className={`py-12 md:py-16 ${pad}`}>
        <RevealText text="Every action, on the record." className={h2Class} />
        <p className="mt-5 max-w-[46ch] text-[16px] leading-6 text-[var(--l-muted)]">
          Whatever an agent or a person does is written to an audit log. Each entry carries the hash of the
          one before, so editing history breaks the chain, and the break shows.
        </p>
        <ul className="mt-8 flex flex-col gap-3 text-[14px] text-[var(--l-muted)]">
          {[
            "Who acted, and on whose behalf",
            "What the agent was sure of, and why",
            "Who approved it, and when",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="h-1 w-1 rounded-full bg-[var(--l-fg)]" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="border-[var(--l-line)] p-3 max-md:border-t md:border-l md:p-8">
        <Panel className="app-ui p-4">
          <div className="mb-3 flex items-center gap-1.5 text-[12px] text-[#d0d6e0]">
            <SealCheck size={14} weight="fill" className="text-accent" /> Chain verified
          </div>
          <ol className="flex flex-col gap-2">
            {CHAIN.map((e) => (
              <li key={e.seq} className="border border-line bg-surface p-3" style={{ borderRadius: 8 }}>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-faint">#{e.seq}</span>
                  <span className="text-fg">{e.text}</span>
                </div>
                <div className="mt-1.5 flex gap-4 text-[11px] text-faint">
                  <code>hash {e.hash}</code>
                  <code>prev {e.prev}</code>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </section>
  );
}

// --- Statement + CTA -------------------------------------------------------------

export function Statement() {
  return (
    <section className={`relative py-20 text-center md:py-28 ${pad}`}>
      <EdgeGrain reach={22} />
      <p className="relative mx-auto max-w-[22ch] text-[clamp(28px,3.4vw,40px)] font-medium leading-[1.15] tracking-[-0.016em] text-[var(--l-fg)]">
        Agents do the work.
        <br />
        <span className="text-[var(--l-muted)]">People stay accountable.</span>
      </p>
    </section>
  );
}

export function CTA() {
  return (
    <section className={`relative overflow-hidden pt-20 pb-52 text-center md:py-32 ${pad}`}>
      <CtaPeaks />
      <div className="relative">
      <h2 className="mx-auto max-w-[16ch] text-[clamp(36px,4.6vw,56px)] font-medium leading-[1.1] tracking-[-0.022em] text-[var(--l-fg)]">
        Put your agents to work, safely.
      </h2>
      <p className="mx-auto mt-5 max-w-[44ch] text-[16px] leading-6 text-[var(--l-muted)]">
        Free during the beta. Set up a board, invite your team, and connect your first agent in a few minutes.
      </p>
      <div className="mt-8 flex justify-center gap-2.5">
        <ButtonLink href="/signup" primary large>
          Start free
        </ButtonLink>
        <ButtonLink href="/login" large>
          Sign in
        </ButtonLink>
      </div>
      </div>
    </section>
  );
}

// Two glowing peaks framing the closing call to action (public/cta-peaks.webp,
// 2000×979, free to use per the user, 2026-11-11). The middle of the picture is
// already black, which is where the text sits. The glow is toned down (70%) so
// it frames the text rather than competing with it, and the top and bottom
// melt into the page. On wider screens it's scaled to 95% from the bottom so
// the peaks sit lower and further from the heading. On phones a full-width crop would cut both peaks off,
// so there the whole picture sits small along the bottom, under the buttons.
// The picture's own edges are faded too: its black is a shade darker than the
// page's, which otherwise shows as a faint rectangle.
function CtaPeaks() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* Phones: the picture's own box, pinned to the bottom (so the edge fade
          lands on the picture). Wider screens: it fills the section. */}
      <Image
        src="/cta-peaks.webp"
        alt=""
        width={2000}
        height={979}
        sizes="(min-width: 1280px) 1280px, 100vw"
        className="absolute bottom-0 left-0 h-auto w-full opacity-70 md:inset-0 md:h-full md:origin-bottom md:scale-[0.95] md:object-cover md:object-[center_72%]"
        // Fade all four edges, so the picture never shows as a rectangle.
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, black 30%, black 85%, transparent), linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          maskComposite: "intersect",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 30%, black 85%, transparent), linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          WebkitMaskComposite: "source-in",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 34% 55% at 50% 48%, rgba(11,11,12,0.55), transparent 75%)",
            "linear-gradient(to bottom, var(--l-bg) 0%, transparent 28%, transparent 82%, var(--l-bg) 100%)",
          ].join(", "),
        }}
      />
    </div>
  );
}

export { Spacer };
