"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { switchWorkspace } from "@/lib/workspace";
import { Logo } from "@/components/Logo";
import { CornerMarks } from "@/components/ui/CornerMarks";
import { PageLoader } from "@/components/ui/Loader";

const mono = { fontFamily: "var(--font-mono)" };

type Invite = {
  workspace: string;
  invitedBy: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  state: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
};

const ENDED: Record<Exclude<Invite["state"], "PENDING">, string> = {
  ACCEPTED: "This invite has already been used.",
  REVOKED: "This invite was withdrawn — ask for a new link.",
  EXPIRED: "This invite has expired — invites last 7 days. Ask for a new link.",
};

// Where an invite link lands. Shows what you're joining before you sign in;
// sign up / log in bring you back here, then one click joins.
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api.get<Invite>(`/invites/${token}`).then(setInvite, () => setError("This invite link isn't valid."));
  }, [token]);

  async function accept() {
    setJoining(true);
    try {
      const r = await api.post<{ workspaceId: string }>(`/invites/${token}/accept`);
      switchWorkspace(r.workspaceId); // land in the workspace you just joined
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't accept the invite.");
      setJoining(false);
    }
  }

  const here = `/invite/${token}`;
  const q = (email: string) => `?next=${encodeURIComponent(here)}&email=${encodeURIComponent(email)}`;
  const mismatch = invite && user && user.email.toLowerCase() !== invite.email;

  return (
    <div className="relative w-full max-w-[440px] border border-line bg-surface p-8" style={{ borderRadius: 18 }}>
      <CornerMarks />
      <Link href="/" className="mb-8 inline-block text-fg">
        <Logo />
      </Link>

      {!invite && !error && <PageLoader />}
      {error && !invite && <p className="text-[15px] text-[#fca5a5]">{error}</p>}

      {invite && (
        <>
          <p className="text-[12px] uppercase tracking-[0.12em] text-faint" style={mono}>
            You&apos;re invited
          </p>
          <h1 className="mt-2 text-[24px] font-medium leading-snug text-fg">
            Join <span className="text-accent">{invite.workspace}</span>
          </h1>
          <p className="mt-2 text-[14px] text-muted">
            {invite.invitedBy} invited <span className="text-fg">{invite.email}</span> as{" "}
            {invite.role === "ADMIN" ? "an admin" : "a member"}.
          </p>

          {error && <p className="mt-5 text-[14px] text-[#fca5a5]">{error}</p>}

          <div className="mt-7">
            {invite.state !== "PENDING" ? (
              <p className="text-[14px] text-faint">{ENDED[invite.state]}</p>
            ) : loading ? null : !user ? (
              <div className="flex flex-col gap-3">
                <Link
                  href={`/signup${q(invite.email)}`}
                  className="bg-[#ffffff] px-5 py-3 text-center text-[14px] font-medium text-bg"
                  style={{ borderRadius: 8, ...mono }}
                >
                  Create an account to join
                </Link>
                <Link href={`/login${q(invite.email)}`} className="text-center text-[13px] text-muted hover:text-fg">
                  I already have an account — log in
                </Link>
              </div>
            ) : mismatch ? (
              <div>
                <p className="text-[14px] text-muted">
                  You&apos;re signed in as <span className="text-fg">{user.email}</span>, but this invite is for{" "}
                  <span className="text-fg">{invite.email}</span>.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    router.push(`/login${q(invite.email)}`);
                  }}
                  className="mt-4 text-[13px] text-accent hover:underline"
                  style={mono}
                >
                  Log out and switch account →
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void accept()}
                disabled={joining}
                className="w-full bg-[#ffffff] px-5 py-3 text-[14px] font-medium text-bg disabled:opacity-60"
                style={{ borderRadius: 8, ...mono }}
              >
                {joining ? "Joining…" : `Join ${invite.workspace}`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
