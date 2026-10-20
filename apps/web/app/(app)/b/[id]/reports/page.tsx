"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageLoader } from "@/components/ui/Loader";
import { Select } from "@/components/ui/Select";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Burndown, type Day } from "@/components/reports/Burndown";

const mono = { fontFamily: "var(--font-mono)" };

type SprintRef = { id: string; name: string; status: "PLANNED" | "ACTIVE" | "COMPLETED"; createdAt: string };
type Report = {
  sprint: { id: string; name: string; goal: string | null; status: string; startsAt: string | null; endsAt: string | null; completedAt: string | null; board: { key: string; title: string } };
  points: { scope: number; done: number; doneByHumans: number; doneByAgents: number; carriedOver: number; committedToHumans: number; committedToAgents: number; unassigned: number };
  capacity: { humanHours: number | null; agentBudgetUsd: string | null; agentSpentUsd: string };
  cost: { usd: string; tokens: number; usdPerPoint: string | null };
  days: Day[];
  agents: { name: string; cardsDone: number; pointsDone: number; reopened: number; reviewsDecided: number; approvalRate: number | null; reopenRate: number | null; avgConfidence: number | null; costUsd: string | null }[];
};

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

// Phase 6: one burndown for humans and agents together, with each side's
// capacity next to it — hours for people, budget for agents.
export default function ReportsPage() {
  // useSearchParams needs a Suspense boundary for production builds.
  return (
    <Suspense fallback={<PageLoader />}>
      <SprintReport />
    </Suspense>
  );
}

function SprintReport() {
  const { id: boardId } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sprints, setSprints] = useState<SprintRef[] | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = search.get("sprint");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    api.get<SprintRef[]>(`/boards/${boardId}/sprints`).then(setSprints, () => setError("Couldn't load sprints."));
  }, [user, boardId]);

  // Default: the running sprint, else the most recently completed one.
  const sprintId =
    chosen ??
    sprints?.find((s) => s.status === "ACTIVE")?.id ??
    [...(sprints ?? [])].reverse().find((s) => s.status === "COMPLETED")?.id ??
    null;

  const load = useCallback(async () => {
    if (!sprintId) return;
    try {
      setReport(await api.get<Report>(`/sprints/${sprintId}/report`));
      setError(null);
    } catch {
      setError("Couldn't load this report.");
    }
  }, [sprintId]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const started = sprints?.filter((s) => s.status !== "PLANNED") ?? [];
  const p = report?.points;

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-16 lg:px-10">
        <Link href={`/b/${boardId}/backlog`} className="text-[13px] text-faint hover:text-fg" style={mono}>
          ← backlog
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-[clamp(1.6rem,3vw,2.4rem)] font-medium tracking-[-0.02em]" style={mono}>
            Sprint report
          </h1>
          {started.length > 0 && (
            <div className="w-[260px]">
              <Select
                value={sprintId}
                onChange={(v) => v && router.replace(`/b/${boardId}/reports?sprint=${v}`)}
                options={started.map((s) => ({ value: s.id, label: s.name, note: s.status === "ACTIVE" ? "active" : "completed" }))}
              />
            </div>
          )}
        </div>
        {error && <p className="mt-3 text-[13px] text-[#fca5a5]">{error}</p>}
        {sprints && started.length === 0 && (
          <p className="mt-8 text-[14px] text-faint">No sprint has started on this board yet — reports appear once one does.</p>
        )}
        {!report && !error && started.length > 0 && <PageLoader />}

        {report && p && (
          <>
            <p className="mt-2 text-[14px] text-muted">
              {report.sprint.name}
              {report.sprint.goal && <span className="text-faint"> · {report.sprint.goal}</span>}
              <span className="text-faint" style={mono}>
                {" "}
                · {report.sprint.status.toLowerCase()}
              </span>
            </p>

            <section className="mt-8 border border-line bg-surface p-5" style={{ borderRadius: 14 }}>
              <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-faint" style={mono}>
                <Legend color="rgba(255,255,255,0.35)" dashed>
                  ideal
                </Legend>
                <Legend color="#ffffff">remaining</Legend>
                <Legend color="#7dd3fc">done by humans</Legend>
                <Legend color="#5af7b3">done by agents</Legend>
              </div>
              <Burndown days={report.days} scope={p.scope} />
            </section>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Card title="Scope">
                <Big>
                  {p.done}
                  <span className="text-faint"> / {p.scope} pts</span>
                </Big>
                <Line>{p.carriedOver > 0 ? `${p.carriedOver} pts carried over` : "nothing carried over"}</Line>
                {p.unassigned > 0 && <Line>{p.unassigned} pts unassigned</Line>}
              </Card>
              <Card title="Humans" accent="#7dd3fc">
                <Big>
                  {p.doneByHumans}
                  <span className="text-faint"> / {p.committedToHumans} pts</span>
                </Big>
                <Line>
                  {report.capacity.humanHours !== null ? `${report.capacity.humanHours} h capacity` : "no hours set"}
                  {report.capacity.humanHours ? ` · ${(p.doneByHumans / report.capacity.humanHours).toFixed(2)} pts/h` : ""}
                </Line>
              </Card>
              <Card title="Agents" accent="#5af7b3">
                <Big>
                  {p.doneByAgents}
                  <span className="text-faint"> / {p.committedToAgents} pts</span>
                </Big>
                <Line>
                  ${report.capacity.agentSpentUsd}
                  {report.capacity.agentBudgetUsd ? ` of $${report.capacity.agentBudgetUsd} budget` : " spent · no budget"}
                </Line>
                {report.cost.usdPerPoint && <Line>${report.cost.usdPerPoint} per point done</Line>}
              </Card>
            </div>

            <section className="mt-10">
              <h2 className="mb-3 text-[12px] uppercase tracking-[0.12em] text-faint" style={mono}>
                Agents this sprint
              </h2>
              {report.agents.length === 0 ? (
                <p className="text-[13px] text-faint">
                  {report.sprint.status === "COMPLETED"
                    ? "No agent worked on this sprint."
                    : "Each agent's record is snapshotted when the sprint completes. Live numbers are on the Agents page."}
                </p>
              ) : (
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="text-faint">
                      {["Agent", "Done", "Approved", "Reopened", "Stated confidence", "Cost"].map((h) => (
                        <th key={h} className="pb-2 font-normal">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody style={mono}>
                    {report.agents.map((a) => (
                      <tr key={a.name} className="border-t border-line text-muted">
                        <td className="py-2 text-fg" style={{ fontFamily: "inherit" }}>
                          {a.name}
                        </td>
                        <td>
                          {a.cardsDone} cards · {a.pointsDone} pts
                        </td>
                        <td>
                          {pct(a.approvalRate)} <span className="text-faint">of {a.reviewsDecided}</span>
                        </td>
                        <td>
                          {a.reopened} <span className="text-faint">({pct(a.reopenRate)})</span>
                        </td>
                        <td>{pct(a.avgConfidence)}</td>
                        <td>{a.costUsd ? `$${a.costUsd}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Legend({ color, dashed, children }: { color: string; dashed?: boolean; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-4" style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }} />
      {children}
    </span>
  );
}

function Card({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div className="border border-line bg-surface px-4 py-3" style={{ borderRadius: 12 }}>
      <p className="flex items-center gap-2 text-[12px] text-faint">
        {accent && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />}
        {title}
      </p>
      {children}
    </div>
  );
}

const Big = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-1 text-[22px] text-fg" style={mono}>
    {children}
  </p>
);
const Line = ({ children }: { children: React.ReactNode }) => <p className="mt-0.5 text-[12px] text-muted">{children}</p>;
