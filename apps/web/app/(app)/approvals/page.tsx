"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/Loader";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { refreshSidebar } from "@/components/Sidebar";
import { DecisionButton, ReviewItem, timeAgo, type Review } from "@/components/approvals/ReviewItem";

const mono = { fontFamily: "var(--font-mono)" };
const POLL_MS = 5000;

type Workspace = { id: string; name: string };

type Proposal = {
  id: string;
  status: string;
  subtasks: { title: string }[];
  reasoningSummary: string | null;
  createdAt: string;
  card: { id: string; title: string };
};


const STATUS_COLOR: Record<Review["status"], string> = {
  PENDING: "#fcd34d",
  APPROVED: "#5af7b3",
  REJECTED: "#fca5a5",
  FAILED: "#fdba74",
};

// The governance inbox: everything agents asked a human to decide.
export default function ApprovalsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const ws = (await api.get<Workspace[]>("/workspaces"))[0];
      if (!ws) return;
      const [r, p] = await Promise.all([
        api.get<Review[]>(`/workspaces/${ws.id}/reviews`),
        api.get<Proposal[]>(`/workspaces/${ws.id}/proposals?status=PENDING`),
      ]);
      setWorkspace(ws);
      setReviews(r);
      setProposals(p);
    } catch {
      setError("Couldn't load approvals.");
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [user, load]);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
    await load();
    refreshSidebar();
  }

  const pending = reviews?.filter((r) => r.status === "PENDING") ?? [];
  const decided = reviews?.filter((r) => r.status !== "PENDING").slice(0, 20) ?? [];

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl px-6 py-14 lg:py-20">
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-medium tracking-[-0.02em]" style={mono}>
          Approvals
        </h1>
        <p className="mt-2 max-w-xl text-[15px] text-muted">
          Changes your agents asked a human to make the call on — because their autonomy is limited on that board, or
          they weren&apos;t confident enough. Approving runs the change as the agent, on your authority.
        </p>
        {error && <p className="mt-4 text-[14px] text-[#fca5a5]">{error}</p>}

        {!reviews && !error && <PageLoader />}

        {reviews && (
          <>
            <h2 className="mt-10 mb-3 text-[12px] uppercase tracking-[0.12em] text-faint" style={mono}>
              Waiting on you · {pending.length + proposals.length}
            </h2>
            {pending.length + proposals.length === 0 && (
              <p
                className="border border-dashed border-line px-6 py-10 text-center text-[14px] text-faint"
                style={{ borderRadius: 12 }}
              >
                Nothing to decide. Agents are either autonomous here or haven&apos;t asked yet.
              </p>
            )}
            <ul className="flex flex-col gap-3">
              {pending.map((r) => (
                <ReviewItem
                  key={r.id}
                  review={r}
                  onApprove={() => act(() => api.post(`/reviews/${r.id}/approve`))}
                  onReject={(note) => act(() => api.post(`/reviews/${r.id}/reject`, note ? { note } : {}))}
                />
              ))}
              {proposals.map((p) => (
                <li key={p.id} className="border border-line bg-surface p-5" style={{ borderRadius: 12 }}>
                  <p className="text-[12px] text-faint" style={mono}>
                    plan for “{p.card.title}” · {timeAgo(p.createdAt)}
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] text-fg">
                    {p.subtasks.map((s, i) => (
                      <li key={i}>{s.title}</li>
                    ))}
                  </ol>
                  {p.reasoningSummary && <p className="mt-2 text-[13px] text-muted">{p.reasoningSummary}</p>}
                  <div className="mt-4 flex gap-3">
                    <DecisionButton primary onClick={() => act(() => api.post(`/proposals/${p.id}/approve`))}>
                      Approve → checklist
                    </DecisionButton>
                    <DecisionButton onClick={() => act(() => api.post(`/proposals/${p.id}/reject`))}>Reject</DecisionButton>
                  </div>
                </li>
              ))}
            </ul>

            {decided.length > 0 && (
              <>
                <h2 className="mt-12 mb-3 text-[12px] uppercase tracking-[0.12em] text-faint" style={mono}>
                  Recently decided
                </h2>
                <ul className="flex flex-col divide-y divide-line border-y border-line">
                  {decided.map((r) => (
                    <li key={r.id} className="flex items-baseline gap-3 py-2.5 text-[13px]">
                      <span className="w-20 shrink-0 text-[11px] uppercase" style={{ color: STATUS_COLOR[r.status], ...mono }}>
                        {r.status.toLowerCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted">
                        <span className="text-fg">{r.agent.displayName}</span> · {r.summary}
                        {r.note && <span className="text-faint"> — “{r.note}”</span>}
                        {r.error && <span className="text-[#fdba74]"> — {r.error}</span>}
                      </span>
                      <span className="shrink-0 text-faint" style={mono}>
                        {r.decidedAt ? timeAgo(r.decidedAt) : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        {workspace === null && reviews && <p className="mt-6 text-faint">No workspace.</p>}
      </div>
    </main>
  );
}
