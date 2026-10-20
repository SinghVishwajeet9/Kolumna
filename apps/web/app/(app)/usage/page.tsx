"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "@phosphor-icons/react";
import { PageLoader } from "@/components/ui/Loader";
import { Select } from "@/components/ui/Select";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const mono = { fontFamily: "var(--font-mono)" };

type Workspace = { id: string; name: string };
type Usage = {
  month: { from: string; costUsd: string; tokens: number; events: number; selfReportedUsd: string };
  byAgent: { agentId: string | null; name: string; costUsd: string; tokens: number; events: number }[];
  bySprint: { sprintId: string; name: string; board: string; status: string | null; costUsd: string; tokens: number; points: number; usdPerPoint: string | null }[];
  byEpic: { epicId: string; title: string; color: string; costUsd: string; tokens: number }[];
  recent: { id: string; at: string; agent: string; source: string; card: string | null; model: string | null; tokens: number; costUsd: string | null; note: string | null }[];
};
type Budget = {
  id: string;
  sprintId: string | null;
  agentId: string | null;
  scope: "SPRINT" | "AGENT_MONTH" | "WORKSPACE_MONTH";
  costCapUsd: string | null;
  tokenCap: number | null;
  alertAt: number;
  spentUsd: string;
  spentTokens: number;
  fraction: number;
  state: "OK" | "ALERT" | "EXCEEDED";
};
type Price = { id: string; model: string; inputPerMTokUsd: string; outputPerMTokUsd: string };
type AgentRef = { id: string; displayName: string };
type SprintRef = { id: string; name: string; board: { title: string } };

const fmtTokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
const STATE_COLOR = { OK: "#5af7b3", ALERT: "#fcd34d", EXCEEDED: "#f87171" } as const;

export default function UsagePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [agents, setAgents] = useState<AgentRef[]>([]);
  const [sprints, setSprints] = useState<SprintRef[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const w = (await api.get<Workspace[]>("/workspaces"))[0];
      if (!w) return;
      const [u, b, p, a, s] = await Promise.all([
        api.get<Usage>(`/workspaces/${w.id}/usage`),
        api.get<Budget[]>(`/workspaces/${w.id}/budgets`),
        api.get<Price[]>(`/workspaces/${w.id}/model-prices`),
        api.get<AgentRef[]>(`/workspaces/${w.id}/agents`),
        api.get<SprintRef[]>(`/workspaces/${w.id}/sprints`),
      ]);
      setWs(w);
      setUsage(u);
      setBudgets(b);
      setPrices(p);
      setAgents(a);
      setSprints(s);
    } catch {
      setError("Couldn't load usage.");
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [user, load]);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
    await load();
  }

  const budgetLabel = (b: Budget) =>
    b.scope === "SPRINT"
      ? (sprints.find((s) => s.id === b.sprintId)?.name ?? "A finished sprint")
      : b.scope === "AGENT_MONTH"
        ? `${agents.find((a) => a.id === b.agentId)?.displayName ?? "Agent"} · per month`
        : "Whole workspace · per month";

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-6 py-14 lg:py-20">
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-medium tracking-[-0.02em]" style={mono}>
          Usage
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          What agents spent, next to the work it bought. Connected agents report their own usage — Kolumna can&apos;t see
          inside their sessions — so those numbers are marked self-reported.
        </p>
        {error && <p className="mt-4 text-[14px] text-[#fca5a5]">{error}</p>}
        {!usage && !error && <PageLoader />}

        {usage && ws && (
          <>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="This month" value={`$${usage.month.costUsd}`} />
              <Kpi label="Tokens" value={fmtTokens(usage.month.tokens)} />
              <Kpi label="Reports" value={String(usage.month.events)} />
              <Kpi label="Self-reported" value={`$${usage.month.selfReportedUsd}`} hint="from the agents' own report_usage" />
            </div>

            <Section title="Budgets">
              {budgets.length === 0 && <Empty>No budgets. Over a budget, an agent&apos;s changes wait for a human.</Empty>}
              <ul className="flex flex-col gap-2">
                {budgets.map((b) => (
                  <BudgetRow key={b.id} budget={b} label={budgetLabel(b)} onCap={(cap) => act(() => api.patch(`/budgets/${b.id}`, { costCapUsd: cap }))} onDelete={() => act(() => api.delete(`/budgets/${b.id}`))} />
                ))}
              </ul>
              <NewBudget agents={agents} sprints={sprints} onCreate={(body) => act(() => api.post(`/workspaces/${ws.id}/budgets`, body))} />
            </Section>

            <div className="grid gap-x-8 lg:grid-cols-2">
              <Section title="By agent · this month">
                <Table
                  rows={usage.byAgent.map((a) => [a.name, `$${a.costUsd}`, fmtTokens(a.tokens)])}
                  head={["Agent", "Cost", "Tokens"]}
                  empty="Nothing reported yet."
                />
              </Section>
              <Section title="By sprint">
                <Table
                  rows={usage.bySprint.map((s) => [
                    <span key="n">
                      {s.name} <span className="text-faint">· {s.board}</span>
                    </span>,
                    `$${s.costUsd}`,
                    s.usdPerPoint ? `$${s.usdPerPoint}/pt` : `${s.points} pts`,
                  ])}
                  head={["Sprint", "Cost", "Per point"]}
                  empty="No sprint has spend yet."
                />
              </Section>
            </div>

            <Section title="By epic">
              <div className="flex flex-wrap gap-2">
                {usage.byEpic.length === 0 && <Empty>No epic has spend yet.</Empty>}
                {usage.byEpic.map((e) => (
                  <span key={e.epicId} className="px-2.5 py-1.5 text-[13px]" style={{ borderRadius: 8, color: e.color, backgroundColor: `${e.color}14` }}>
                    {e.title} <span style={mono}>· ${e.costUsd}</span>
                  </span>
                ))}
              </div>
            </Section>

            <Section title="Recent reports">
              <Table
                head={["When", "Who", "Card", "Tokens", "Cost"]}
                empty="Nothing reported yet."
                rows={usage.recent.map((r) => [
                  new Date(r.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
                  <span key="w">
                    {r.agent} <span className="text-[11px] text-faint">{r.source === "SELF_REPORTED" ? "self" : r.source.toLowerCase()}</span>
                  </span>,
                  r.card ?? "—",
                  fmtTokens(r.tokens),
                  r.costUsd ? `$${Number(r.costUsd).toFixed(4)}` : "?",
                ])}
              />
            </Section>

            <Section title="Model prices">
              <p className="mb-3 text-[13px] text-faint">Used to price token counts reported without a dollar figure. Per million tokens.</p>
              <Table
                head={["Model", "Input", "Output", ""]}
                empty="No prices set — token-only reports stay unpriced."
                rows={prices.map((p) => [
                  <span key="m" style={mono}>{p.model}</span>,
                  `$${p.inputPerMTokUsd}`,
                  `$${p.outputPerMTokUsd}`,
                  <button key="d" type="button" title="Remove" className="text-faint hover:text-[#fca5a5]" onClick={() => act(() => api.delete(`/workspaces/${ws.id}/model-prices/${p.id}`))}>
                    <Trash size={14} />
                  </button>,
                ])}
              />
              <NewPrice onSave={(body) => act(() => api.put(`/workspaces/${ws.id}/model-prices`, body))} />
            </Section>
          </>
        )}
      </div>
    </main>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-line bg-surface px-4 py-3" style={{ borderRadius: 12 }} title={hint}>
      <p className="text-[12px] text-faint">{label}</p>
      <p className="mt-1 text-[22px] text-fg" style={mono}>
        {value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[12px] uppercase tracking-[0.12em] text-faint" style={mono}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-faint">{children}</p>;
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-faint">
            {head.map((h, i) => (
              <th key={i} className="pb-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className={`py-2 pr-4 ${j === 0 ? "text-fg" : "text-muted"}`} style={j > 0 ? mono : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inputCls =
  "bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] outline-none placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]";

function BudgetRow({ budget: b, label, onCap, onDelete }: { budget: Budget; label: string; onCap: (cap: number) => Promise<void>; onDelete: () => Promise<void> }) {
  const [cap, setCap] = useState(b.costCapUsd ?? "");
  const pct = Math.min(100, Math.round(b.fraction * 100));
  return (
    <li className="border border-line bg-surface px-4 py-3" style={{ borderRadius: 12 }}>
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="text-fg">{label}</span>
        <span className="text-[11px] uppercase" style={{ color: STATE_COLOR[b.state], ...mono }}>
          {b.state === "EXCEEDED" ? "used up — changes need approval" : b.state.toLowerCase()}
        </span>
        <span className="ml-auto text-muted" style={mono}>
          ${b.spentUsd}
          {b.costCapUsd && ` / $`}
        </span>
        {b.costCapUsd !== null && (
          <input
            value={cap}
            onChange={(e) => setCap(e.target.value.replace(/[^0-9.]/g, ""))}
            onBlur={() => cap && Number(cap) > 0 && cap !== b.costCapUsd && void onCap(Number(cap))}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={`${inputCls} w-20`}
            style={{ borderRadius: 7, ...mono }}
            title="Raise the cap to let agents act on their own again"
          />
        )}
        {b.tokenCap !== null && (
          <span className="text-muted" style={mono}>
            {fmtTokens(b.spentTokens)} / {fmtTokens(b.tokenCap)} tokens
          </span>
        )}
        <button type="button" title="Delete budget" onClick={() => void onDelete()} className="text-faint hover:text-[#fca5a5]">
          <Trash size={14} />
        </button>
      </div>
      <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: STATE_COLOR[b.state] }} />
      </div>
    </li>
  );
}

function NewBudget({
  agents,
  sprints,
  onCreate,
}: {
  agents: AgentRef[];
  sprints: SprintRef[];
  onCreate: (body: { sprintId?: string; agentId?: string; costCapUsd: number }) => Promise<void>;
}) {
  const [scope, setScope] = useState<string | null>(null); // null = workspace, "s:<id>", "a:<id>"
  const [cap, setCap] = useState("");
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!(Number(cap) > 0)) return;
        void onCreate({
          costCapUsd: Number(cap),
          ...(scope?.startsWith("s:") ? { sprintId: scope.slice(2) } : {}),
          ...(scope?.startsWith("a:") ? { agentId: scope.slice(2) } : {}),
        }).then(() => setCap(""));
      }}
    >
      <div className="w-[260px]">
        <Select
          compact
          value={scope}
          onChange={setScope}
          options={[
            { value: null, label: "Whole workspace, per month" },
            ...agents.map((a) => ({ value: `a:${a.id}`, label: `${a.displayName}, per month` })),
            ...sprints.map((s) => ({ value: `s:${s.id}`, label: s.name, note: s.board.title })),
          ]}
        />
      </div>
      <span className="text-[13px] text-faint">$</span>
      <input value={cap} onChange={(e) => setCap(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="cap" className={`${inputCls} w-24`} style={{ borderRadius: 8, ...mono }} />
      <button type="submit" className="bg-white/[0.08] px-3 py-1.5 text-[13px] text-fg hover:bg-white/[0.14]" style={{ borderRadius: 8, ...mono }}>
        Add budget
      </button>
    </form>
  );
}

function NewPrice({ onSave }: { onSave: (body: { model: string; inputPerMTokUsd: number; outputPerMTokUsd: number }) => Promise<void> }) {
  const [model, setModel] = useState("");
  const [inp, setInp] = useState("");
  const [out, setOut] = useState("");
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!model.trim() || inp === "" || out === "") return;
        void onSave({ model: model.trim(), inputPerMTokUsd: Number(inp), outputPerMTokUsd: Number(out) }).then(() => {
          setModel("");
          setInp("");
          setOut("");
        });
      }}
    >
      <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="model id" className={`${inputCls} w-48`} style={{ borderRadius: 8, ...mono }} />
      <input value={inp} onChange={(e) => setInp(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="$ in / Mtok" className={`${inputCls} w-28`} style={{ borderRadius: 8, ...mono }} />
      <input value={out} onChange={(e) => setOut(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="$ out / Mtok" className={`${inputCls} w-28`} style={{ borderRadius: 8, ...mono }} />
      <button type="submit" className="bg-white/[0.08] px-3 py-1.5 text-[13px] text-fg hover:bg-white/[0.14]" style={{ borderRadius: 8, ...mono }}>
        Save price
      </button>
    </form>
  );
}
