"use client"; // this page uses hooks (useState) — those only run in the browser

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  // 1. useState for email, password, name — all strings, starting as ""
  // 2. useState for error — string | null, starting as null
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stops the browser's default full-page-reload form submit
    setError(null);
    try {
      const response = await api.post("/auth/signup", {
        email,
        password,
        name,
      });
      router.push("/");
      // 3. call api.post("/auth/signup", { email, password, name })
      // 4. on success: router.push("/") — redirect (real /boards page comes Day 9)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      // 5. if (err instanceof ApiError) setError(err.message); else set a generic message
    }
  }

  return (
    <main>
      <h1>Sign up</h1>
      {error && <p>{error}</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Sign up</button>
      </form>
    </main>
  );
}
