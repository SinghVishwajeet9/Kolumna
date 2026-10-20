"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/Loader";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Field } from "@/components/ui/Field";
import { CornerMarks } from "@/components/ui/CornerMarks";
import { GooeyButton } from "@/components/marketing/GooeyButton";
import { CLIENTS, ConnectSnippets, type ClientId } from "@/components/agents/ConnectSnippets";
import { Select } from "@/components/ui/Select";

const mono = { fontFamily: "var(--font-mono)" };

type Workspace = { id: string; name: string };
type Status = "PROVISIONED" | "ACTIVE" | "SUSPENDED" | "REVOKED";
type Agent = {
  id: string;
  actorId: string;
  displayName: string;
  client: ClientId | null;
  allowedScopes: string[];
  status: Status;
  clientId: string;
  createdAt: string;
  lastActiveAt: string | null;
  assignedCards: number;
  accessUntil: string | null;
  accessSprint: { id: string; name: string; status: string } | null;
  accessEnded: boolean;
};

type OpenSprint = { id: string; name: string; status: string; board: { title: string } };

// What each scope lets an agent do, in plain words — the ceiling is a
// governance decision, so the person making it should see the consequence.
const SCOPES = [
  { id: "board:read", label: "See boards and members" },
  { id: "card:read", label: "Read cards and its own tasks" },
  { id: "card:write", label: "Move, comment on and tick steps of cards assigned to it" },
  { id: "card:create", label: "Create new cards" },
  { id: "card:assign", label: "Assign cards to anyone, incl. other agents" },
] as const;

const STATUS_STYLE: Record<Status, { color: string; label: string }> = {
  ACTIVE: { color: "#5af7b3", label: "active" },
  PROVISIONED: { color: "#fcd34d", label: "not activated" },
  SUSPENDED: { color: "#fdba74", label: "suspended" },
  REVOKED: { color: "#9a9a9a", label: "revoked" },
};

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

async function fetchAgents(): Promise<{ workspace: Workspace | null; agents: Agent[]; sprints: OpenSprint[] }> {
  const workspace = (await api.get<Workspace[]>("/workspaces"))[0] ?? null;
  if (!workspace) return { workspace: null, agents: [], sprints: [] };
  const [agents, sprints] = await Promise.all([
    api.get<Agent[]>(`/workspaces/${workspace.id}/agents`),
    api.get<OpenSprint[]>(`/workspaces/${workspace.id}/sprints`),
  ]);
  return { workspace, agents, sprints };
}

// "2026-11-03T00:00:00Z" → "2026-11-03" for a date input, and back as the END
// of that local day, so "until the 3rd" includes the 3rd.
const toDateInput = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");
const endOfDay = (d: string) => new Date(`${d}T23:59:59`).toISOString();

export default function AgentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sprints, setSprints] = useState<OpenSprint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [client, setClient] = useState<ClientId>("claude-code");
  const [scopes, setScopes] = useState<string[]>(["board:read", "card:read", "card:write"]);
  const [busy, setBusy] = useState(false);

  // The one-time secret screen, after register or rotate.
  const [secretFor, setSecretFor] = useState<{
    name: string;
    clientId: string;
    secret: string;
    client: ClientId;
  } | null>(null);

  function refresh() {
    return fetchAgents().then(
      ({ workspace, agents, sprints }) => {
        setWorkspace(workspace);
        setAgents(agents);
        setSprints(sprints);
        setLoaded(true);
      },
      () => {
        setError("Couldn't load agents. Is the API running?");
        setLoaded(true);
      },
    );
  }

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  // Poll so "last active" stays honest while an agent is working.
  useEffect(() => {
    if (!user) return;
    void refresh();
    const t = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(t);
  }, [user]);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
    await refresh();
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !name.trim() || scopes.length === 0) return;
    setBusy(true);
    try {
      const res = await api.post<{ agent: { id: string }; clientId: string; clientSecret: string }>(
        `/workspaces/${workspace.id}/agents`,
        {
          displayName: name.trim(),
          modelProvider: "external",
          capabilities: { client },
          allowedScopes: scopes,
        },
      );
      // Registering and activating are separate, audited decisions; doing
      // both here is the person explicitly choosing to let it connect now.
      await api.patch(`/workspaces/${workspace.id}/agents/${res.agent.id}/activate`);
      setSecretFor({ name: name.trim(), clientId: res.clientId, secret: res.clientSecret, client });
      setRegistering(false);
      setName("");
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't register the agent.");
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function rotate(agent: Agent) {
    if (!workspace) return;
    if (!confirm(`Rotate ${agent.displayName}'s secret? The current one stops working immediately.`)) return;
    await act(async () => {
      const res = await api.post<{ clientId: string; clientSecret: string }>(
        `/workspaces/${workspace.id}/agents/${agent.id}/rotate-secret`,
      );
      setSecretFor({
        name: agent.displayName,
        clientId: res.clientId,
        secret: res.clientSecret,
        client: agent.client ?? "claude-code",
      });
    });
  }

  const path = (a: Agent, verb: string) => `/workspaces/${workspace!.id}/agents/${a.id}/${verb}`;

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-6 py-14 lg:py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-medium tracking-[-0.02em]" style={mono}>
              Your <span className="text-accent">agents</span>
            </h1>
            <p className="mt-2 max-w-xl text-[15px] text-muted">
              AI tools that work on your boards — Claude Code, Antigravity, Cursor, or anything that speaks MCP.
              Each gets its own identity, a scope ceiling you choose, and a full audit trail.
            </p>
          </div>
          <GooeyButton
            onClick={() => setRegistering(true)}
            className="group flex shrink-0 items-center bg-[#ffffff] px-6 py-3.5 text-[15px] font-medium text-bg"
            style={{ borderRadius: "8px", ...mono }}
          >
            + Connect agent
          </GooeyButton>
        </div>

        {error && <p className="mb-6 text-[14px] text-[#fca5a5]">{error}</p>}

        {!loaded && <PageLoader />}

        {loaded && agents.length === 0 && !error && (
          <div className="relative border border-dashed border-line px-8 py-16 text-center" style={{ borderRadius: 14 }}>
            <CornerMarks />
            <p className="text-[17px] text-muted">No agents yet.</p>
            <p className="mt-1 text-[14px] text-faint">Connect Claude Code or Antigravity to give it tasks on your boards.</p>
          </div>
        )}

        <ul className="flex flex-col gap-4">
          {agents.map((a) => {
            const st = STATUS_STYLE[a.status];
            const clientLabel = CLIENTS.find((c) => c.id === a.client)?.label;
            return (
              <li key={a.id} className="border border-line bg-surface p-6" style={{ borderRadius: 14 }}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span
                        className="px-2 py-0.5 text-[11px]"
                        style={{ borderRadius: 6, backgroundColor: "rgba(90,247,179,0.12)", color: "#5af7b3", ...mono }}
                      >
                        AI
                      </span>
                      <h2 className="text-[18px] font-medium text-fg">{a.displayName}</h2>
                      <span className="flex items-center gap-1.5 text-[12px]" style={{ color: st.color, ...mono }}>
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.color }} />
                        {st.label}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] text-faint" style={mono}>
                      {clientLabel ? `${clientLabel} · ` : ""}last active {timeAgo(a.lastActiveAt)} · {a.assignedCards} card
                      {a.assignedCards === 1 ? "" : "s"} · {a.clientId}
                    </p>
                  </div>

                  {a.status !== "REVOKED" && (
                    <div className="flex flex-wrap items-center gap-4 text-[13px]" style={mono}>
                      {a.status !== "ACTIVE" && (
                        <button type="button" className="text-accent hover:underline" onClick={() => act(() => api.patch(path(a, "activate")))}>
                          activate
                        </button>
                      )}
                      {a.status === "ACTIVE" && (
                        <button type="button" className="text-muted hover:text-fg" onClick={() => act(() => api.patch(path(a, "suspend")))}>
                          suspend
                        </button>
                      )}
                      <button type="button" className="text-muted hover:text-fg" onClick={() => void rotate(a)}>
                        rotate secret
                      </button>
                      <button
                        type="button"
                        className="text-[#fca5a5] hover:underline"
                        onClick={() =>
                          confirm(`Revoke ${a.displayName}? This is permanent — it loses all access and its pending plans are rejected.`) &&
                          act(() => api.patch(path(a, "revoke")))
                        }
                      >
                        revoke
                      </button>
                    </div>
                  )}
                </div>

                {a.status !== "REVOKED" && (
                  <AccessRow
                    agent={a}
                    sprints={sprints}
                    onChange={(body) => act(() => api.patch(path(a, "access"), body))}
                  />
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {a.allowedScopes.map((s) => (
                    <span key={s} className="border border-line px-2.5 py-1 text-[11px] text-muted" style={{ borderRadius: 999, ...mono }}>
                      {s}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {registering && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm" onClick={() => setRegistering(false)}>
          <form
            onSubmit={register}
            onClick={(e) => e.stopPropagation()}
            className="animate-rise relative max-h-[90vh] w-full max-w-[520px] overflow-y-auto border border-line bg-surface p-7"
            style={{ borderRadius: 16, boxShadow: "0 40px 90px -24px rgba(0,0,0,0.9)" }}
          >
            <CornerMarks />
            <h2 className="mb-6 text-[22px] font-medium" style={mono}>Connect an agent</h2>
            <Field label="Name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Claude Code (my laptop)" required />

            <p className="mt-6 mb-2 text-[12px] uppercase tracking-[0.12em] text-faint" style={mono}>Which tool</p>
            <div className="flex flex-wrap gap-2">
              {CLIENTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClient(c.id)}
                  className={`border px-3 py-1.5 text-[13px] ${client === c.id ? "border-accent text-accent" : "border-line text-faint hover:text-fg"}`}
                  style={{ borderRadius: 999, ...mono }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <p className="mt-6 mb-2 text-[12px] uppercase tracking-[0.12em] text-faint" style={mono}>
              What it may ever do (its ceiling)
            </p>
            <div className="flex flex-col gap-2">
              {SCOPES.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-start gap-3 text-[14px]">
                  <input
                    type="checkbox"
                    className="mt-1 accent-[#5af7b3]"
                    checked={scopes.includes(s.id)}
                    onChange={(e) =>
                      setScopes((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)))
                    }
                  />
                  <span>
                    <span className="text-fg">{s.label}</span>{" "}
                    <span className="text-[12px] text-faint" style={mono}>{s.id}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-7 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setRegistering(false)} className="px-4 py-2.5 text-[14px] text-muted hover:text-fg">
                Cancel
              </button>
              <GooeyButton
                type="submit"
                disabled={busy || scopes.length === 0}
                className="group flex items-center bg-[#ffffff] px-6 py-2.5 text-[14px] font-medium text-bg disabled:opacity-60"
                style={{ borderRadius: "8px", ...mono }}
              >
                {busy ? "Connecting…" : "Create & activate"}
              </GooeyButton>
            </div>
          </form>
        </div>
      )}

      {secretFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div
            className="animate-rise relative max-h-[90vh] w-full max-w-[640px] overflow-y-auto border border-line bg-surface p-7"
            style={{ borderRadius: 16, boxShadow: "0 40px 90px -24px rgba(0,0,0,0.9)" }}
          >
            <CornerMarks />
            <h2 className="mb-2 text-[22px] font-medium" style={mono}>
              Connect {secretFor.name}
            </h2>
            <p className="mb-6 text-[14px] text-[#fcd34d]">
              The secret is shown only now — Kolumna stores just a hash. Copy the snippet before closing; if it&apos;s lost,
              rotate the secret.
            </p>
            <ConnectSnippets clientId={secretFor.clientId} secret={secretFor.secret} initialClient={secretFor.client} />
            <div className="mt-7 flex justify-end">
              <button
                type="button"
                onClick={() => setSecretFor(null)}
                className="bg-[#ffffff] px-6 py-2.5 text-[14px] font-medium text-bg"
                style={{ borderRadius: 8, ...mono }}
              >
                I&apos;ve copied it
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// G14: when this agent's engagement ends. Either a sprint ("until PRM Sprint 2
// is completed"), a date, or both (whichever comes first). After that it
// can't connect, and its live sessions are cut off.
function AccessRow({
  agent,
  sprints,
  onChange,
}: {
  agent: Agent;
  sprints: OpenSprint[];
  onChange: (body: { accessSprintId?: string | null; accessUntil?: string | null }) => Promise<void>;
}) {
  const options = [
    { value: null, label: "No sprint" },
    // Its current sprint stays listed even once completed, so the field shows the truth.
    ...(agent.accessSprint && !sprints.some((s) => s.id === agent.accessSprint!.id)
      ? [{ value: agent.accessSprint.id, label: agent.accessSprint.name, note: agent.accessSprint.status.toLowerCase(), disabled: true }]
      : []),
    ...sprints.map((s) => ({
      value: s.id,
      label: s.name,
      note: `${s.board.title}${s.status === "ACTIVE" ? " · active" : ""}`,
    })),
  ];
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4 text-[13px]">
      <span className="text-faint">Access ends</span>
      <div className="w-[240px]">
        <Select
          compact
          value={agent.accessSprint?.id ?? null}
          onChange={(accessSprintId) => void onChange({ accessSprintId })}
          options={options}
        />
      </div>
      <span className="text-faint">or on</span>
      <input
        type="date"
        value={toDateInput(agent.accessUntil)}
        onChange={(e) => void onChange({ accessUntil: e.target.value ? endOfDay(e.target.value) : null })}
        className="bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] outline-none [color-scheme:dark] focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
        style={{ borderRadius: 8, ...mono }}
      />
      {agent.accessEnded ? (
        <span className="text-[#fca5a5]">· access has ended; it can no longer connect</span>
      ) : agent.accessSprint || agent.accessUntil ? (
        <span className="text-faint">· whichever comes first</span>
      ) : (
        <span className="text-faint">· never (until you suspend or revoke it)</span>
      )}
    </div>
  );
}
