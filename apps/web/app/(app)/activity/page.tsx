"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldWarning } from "@phosphor-icons/react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const mono = { fontFamily: "var(--font-mono)" };

type Entry = {
  id: string;
  seq: number;
  actor: { id: string; displayName: string; type: "HUMAN" | "AGENT" };
  onBehalfOf: { displayName: string } | null;
  action: string;
  targetType: string;
  result: string;
  createdAt: string;
};
type Verification = { valid: true; entriesChecked: number } | { valid: false; brokenAtSeq: number; reason: string };
type Filter = "all" | "agents" | "problems";

const RESULT_COLOR: Record<string, string> = {
  SUCCESS: "#9a9a9a",
  PENDING_APPROVAL: "#fcd34d",
  DENIED: "#fdba74",
  ERROR: "#fca5a5",
};

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ActivityPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<Verification | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const tick = () =>
      api
        .get<{ id: string }[]>("/workspaces")
        .then(async (ws) => {
          const id = ws[0]?.id;
          if (!id) return;
          const log = await api.get<Entry[]>(`/workspaces/${id}/audit`);
          if (cancelled) return;
          setWorkspaceId(id);
          setEntries(log.reverse()); // newest first
          setLoaded(true);
        })
        .catch(() => !cancelled && setLoaded(true));
    tick();
    const t = setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user]);

  // The server recomputes every hash in the chain — this is the proof, not a
  // flag stored somewhere that says "valid".
  async function verify() {
    if (!workspaceId) return;
    setVerifying(true);
    try {
      setVerification(await api.get<Verification>(`/workspaces/${workspaceId}/audit/verify`));
    } finally {
      setVerifying(false);
    }
  }

  const shown = entries.filter((e) =>
    filter === "agents" ? e.actor.type === "AGENT" : filter === "problems" ? e.result === "DENIED" || e.result === "ERROR" : true,
  );

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-6 py-14 lg:py-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-medium tracking-[-0.02em]" style={mono}>
              <span className="text-accent">Activity</span>
            </h1>
            <p className="mt-2 max-w-xl text-[15px] text-muted">
              Every action by a human or an agent, in a tamper-evident chain: each entry&apos;s hash covers the one before it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void verify()}
            disabled={verifying || !workspaceId}
            className="flex items-center gap-2 border border-line px-4 py-2.5 text-[13px] text-fg transition-colors hover:border-line-bright disabled:opacity-50"
            style={{ borderRadius: 8, ...mono }}
          >
            <ShieldCheck size={16} />
            {verifying ? "Verifying…" : "Verify chain"}
          </button>
        </div>

        {verification && (
          <div
            className="mb-6 flex items-center gap-3 border px-4 py-3 text-[14px]"
            style={{
              borderRadius: 10,
              borderColor: verification.valid ? "rgba(90,247,179,0.4)" : "rgba(252,165,165,0.5)",
              backgroundColor: verification.valid ? "rgba(90,247,179,0.06)" : "rgba(252,165,165,0.06)",
              color: verification.valid ? "#5af7b3" : "#fca5a5",
            }}
          >
            {verification.valid ? <ShieldCheck size={18} weight="fill" /> : <ShieldWarning size={18} weight="fill" />}
            {verification.valid
              ? `Chain intact — ${verification.entriesChecked === 1 ? "the 1 entry" : `all ${verification.entriesChecked} entries`} re-hashed and verified.`
              : `Chain broken at entry #${verification.brokenAtSeq} (${verification.reason}). Something in the log was changed.`}
          </div>
        )}

        <div className="mb-4 flex gap-2">
          {(
            [
              ["all", "Everything"],
              ["agents", "Agents only"],
              ["problems", "Denied & errors"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`border px-3 py-1.5 text-[12px] ${filter === id ? "border-accent text-accent" : "border-line text-faint hover:text-fg"}`}
              style={{ borderRadius: 999, ...mono }}
            >
              {label}
            </button>
          ))}
        </div>

        {!loaded && <p className="text-[15px] text-faint" style={mono}>Loading…</p>}
        {loaded && shown.length === 0 && <p className="text-[15px] text-faint">Nothing here yet.</p>}

        <ol className="border border-line bg-surface" style={{ borderRadius: 14 }}>
          {shown.map((e) => (
            <li key={e.id} className="flex items-baseline gap-4 border-b border-line-soft px-5 py-3 text-[13px] last:border-b-0" style={mono}>
              <span className="w-10 shrink-0 text-right text-faint">#{e.seq}</span>
              <span className="w-36 shrink-0 whitespace-nowrap text-faint">{when(e.createdAt)}</span>
              <span className="min-w-0 flex-1 truncate text-muted">
                <span className={e.actor.type === "AGENT" ? "text-accent" : "text-fg"}>
                  {e.actor.type === "AGENT" ? "AI · " : ""}
                  {e.actor.displayName}
                </span>{" "}
                {e.action.toLowerCase().replace(/_/g, " ").replace(/\./g, " · ")}
                <span className="text-faint"> {e.targetType.toLowerCase()}</span>
                {e.onBehalfOf && <span className="text-faint"> · for {e.onBehalfOf.displayName}</span>}
              </span>
              <span className="shrink-0 text-[11px]" style={{ color: RESULT_COLOR[e.result] ?? "#9a9a9a" }}>
                {e.result.toLowerCase().replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
