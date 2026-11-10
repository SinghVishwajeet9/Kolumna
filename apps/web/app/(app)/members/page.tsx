"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Robot } from "@phosphor-icons/react";
import { PageLoader } from "@/components/ui/Loader";
import { Select } from "@/components/ui/Select";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { currentWorkspace, switchWorkspace, type WorkspaceRef } from "@/lib/workspace";

const mono = { fontFamily: "var(--font-mono)" };

type Role = "OWNER" | "ADMIN" | "MEMBER";
type Member = { actorId: string; name: string; type: "HUMAN" | "AGENT"; role: Role; email: string | null; agentStatus: string | null };
type Invite = { id: string; email: string; role: Role; expiresAt: string };

const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" };

export default function MembersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [ws, setWs] = useState<WorkspaceRef | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; url: string } | null>(null);

  const me = members?.find((m) => m.email && user && m.email.toLowerCase() === user.email.toLowerCase());
  const isAdmin = me?.role === "OWNER" || me?.role === "ADMIN";

  const load = useCallback(async () => {
    try {
      const w = await currentWorkspace();
      if (!w) return;
      const m = await api.get<Member[]>(`/workspaces/${w.id}/members`);
      setWs(w);
      setMembers(m);
      // Only admins can see pending invites; for everyone else this 403s.
      setInvites(await api.get<Invite[]>(`/workspaces/${w.id}/invites`).catch(() => []));
    } catch {
      setError("Couldn't load members.");
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

  const humans = members?.filter((m) => m.type === "HUMAN") ?? [];
  const agents = members?.filter((m) => m.type === "AGENT") ?? [];

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-3xl px-6 py-14 lg:py-20">
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-medium tracking-[-0.02em]" style={mono}>
          Members
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          The people in <span className="text-fg">{ws?.name ?? "this workspace"}</span>. Agents are managed on the Agents
          page.
        </p>
        {error && <p className="mt-4 text-[14px] text-[#fca5a5]">{error}</p>}
        {!members && !error && <PageLoader />}

        {members && ws && (
          <>
            {isAdmin && <InviteForm onInvite={(email, role) => act(async () => setCreated({ email, url: (await api.post<{ url: string }>(`/workspaces/${ws.id}/invites`, { email, role })).url }))} />}

            {created && (
              <div className="mt-4 border px-4 py-3" style={{ borderRadius: 12, borderColor: "rgba(90,247,179,0.35)", backgroundColor: "rgba(90,247,179,0.05)" }}>
                <p className="text-[13px] text-muted">
                  Send this link to <span className="text-fg">{created.email}</span>. It works once, for 7 days, and only
                  for that address — and it can&apos;t be shown again.
                </p>
                <CopyLink url={created.url} />
              </div>
            )}

            <Section title={`People · ${humans.length}`}>
              <ul className="flex flex-col divide-y divide-line border-y border-line">
                {humans.map((m) => {
                  const isMe = m.actorId === me?.actorId;
                  return (
                    <li key={m.actorId} className="flex flex-wrap items-center gap-3 py-3">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-bright bg-[#3a3a3d] text-[11px] leading-none text-fg"
                      >
                        {m.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] text-fg">
                          {m.name} {isMe && <span className="text-faint">(you)</span>}
                        </p>
                        <p className="truncate text-[12px] text-faint">{m.email}</p>
                      </div>
                      {isAdmin && !isMe ? (
                        <div className="w-[130px]">
                          <Select
                            compact
                            value={m.role}
                            onChange={(role) => role && act(() => api.patch(`/workspaces/${ws.id}/members/${m.actorId}`, { role }))}
                            options={(me?.role === "OWNER" ? (["OWNER", "ADMIN", "MEMBER"] as Role[]) : (["ADMIN", "MEMBER"] as Role[])).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                          />
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted" style={mono}>
                          {ROLE_LABEL[m.role]}
                        </span>
                      )}
                      {(isMe || (isAdmin && (m.role !== "OWNER" || me?.role === "OWNER"))) && (
                        <button
                          type="button"
                          className="text-[12px] text-faint hover:text-[#fca5a5]"
                          style={mono}
                          onClick={() => {
                            const ok = isMe
                              ? confirm(`Leave ${ws.name}? You'll lose access to its boards.`)
                              : confirm(`Remove ${m.name}? Their cards here will be unassigned.`);
                            if (!ok) return;
                            void act(async () => {
                              await api.delete(`/workspaces/${ws.id}/members/${m.actorId}`);
                              if (isMe) {
                                localStorage.removeItem("kolumna:workspace");
                                switchWorkspace("", "/boards");
                              }
                            });
                          }}
                        >
                          {isMe ? "leave" : "remove"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>

            {isAdmin && invites.length > 0 && (
              <Section title={`Pending invites · ${invites.length}`}>
                <ul className="flex flex-col divide-y divide-line border-y border-line">
                  {invites.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                      <span className="min-w-0 flex-1 truncate text-fg">{i.email}</span>
                      <span className="text-muted" style={mono}>
                        {ROLE_LABEL[i.role]}
                      </span>
                      <span className="text-faint" style={mono}>
                        expires {new Date(i.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </span>
                      <button type="button" className="text-faint hover:text-[#fca5a5]" style={mono} onClick={() => act(() => api.delete(`/workspaces/${ws.id}/invites/${i.id}`))}>
                        revoke
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {agents.length > 0 && (
              <Section title={`Agents · ${agents.length}`}>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                  {agents.map((a) => (
                    <span key={a.actorId} className="flex items-center gap-1.5">
                      <Robot size={13} weight="fill" /> {a.name}
                      <span className="text-faint">({a.agentStatus?.toLowerCase()})</span>
                    </span>
                  ))}
                </p>
              </Section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[14px] font-semibold text-fg" style={mono}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function InviteForm({ onInvite }: { onInvite: (email: string, role: Role) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-8 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setBusy(true);
        void onInvite(email.trim(), role).finally(() => {
          setBusy(false);
          setEmail("");
        });
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="teammate@company.com"
        className="min-w-0 flex-1 bg-surface-2 px-3 py-2 text-[14px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] outline-none placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
        style={{ borderRadius: 8 }}
      />
      <div className="w-[130px]">
        <Select
          value={role}
          onChange={(v) => v && setRole(v as Role)}
          options={[
            { value: "MEMBER", label: "Member" },
            { value: "ADMIN", label: "Admin" },
          ]}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="bg-[#ffffff] px-4 py-2 text-[13px] font-medium text-bg disabled:opacity-60"
        style={{ borderRadius: 8, ...mono }}
      >
        {busy ? "Creating…" : "Invite"}
      </button>
    </form>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate bg-surface-2 px-2.5 py-1.5 text-[12px] text-fg" style={{ borderRadius: 7 }}>
        {url}
      </code>
      <button
        type="button"
        onClick={() =>
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
        }
        className="flex items-center gap-1.5 bg-white/[0.08] px-3 py-1.5 text-[12px] text-fg hover:bg-white/[0.14]"
        style={{ borderRadius: 7, ...mono }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
