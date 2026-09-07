"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { Field } from "@/components/ui/Field";
import { CornerMarks } from "@/components/ui/CornerMarks";
import { GooeyButton } from "@/components/marketing/GooeyButton";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push("/boards");
    }
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/signup", { email, password, name });
      await refreshUser();
      router.push("/boards");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <div
      className="animate-rise relative w-full max-w-[440px] border border-line bg-surface p-8 lg:p-10"
      style={{
        borderRadius: "16px",
        boxShadow: "0 40px 90px -24px rgba(0,0,0,0.9)",
      }}
    >
      <CornerMarks />

      <Link href="/" className="mb-9 inline-block text-fg">
        <Logo />
      </Link>

      <h1
        className="mb-2 text-[clamp(1.9rem,4vw,2.5rem)] font-medium tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Create account
      </h1>
      <p className="mb-8 text-[15px] leading-relaxed text-muted">
        Free while you&rsquo;re getting started. No card, no sales call.
      </p>

      {error && (
        <div
          className="mb-6 border px-4 py-3 text-[14px]"
          style={{
            borderRadius: "8px",
            borderColor: "rgba(252,165,165,0.4)",
            backgroundColor: "rgba(252,165,165,0.08)",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field
          label="Name"
          type="text"
          placeholder="Ada Lovelace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
        <Field
          label="Email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <GooeyButton
          type="submit"
          disabled={submitting}
          className="group mt-1 flex w-full items-center justify-center bg-[#ffffff] px-8 py-4 text-[17px] font-medium text-bg disabled:opacity-60"
          style={{ borderRadius: "8px", fontFamily: "var(--font-mono)" }}
        >
          {submitting ? "Creating…" : "Create account"}
        </GooeyButton>
      </form>

      <p className="mt-7 text-[14px] text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-accent transition-opacity hover:opacity-80"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
