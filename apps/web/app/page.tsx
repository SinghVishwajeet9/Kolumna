"use client";

import { useEffect, useState } from "react";
import type { HealthCheck } from "@kolumna/shared";

export default function Home() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:4100/health")
      .then((res) => res.json())
      .then((data: HealthCheck) => setHealth(data))
      .catch(() =>
        setError("Could not reach the API. Is it running (bun run dev:api)?"),
      );
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Kolumna
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Day 1: web ↔ api wiring check
      </p>

      {health && (
        <p className="rounded-md bg-green-100 px-3 py-1 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          API says: {JSON.stringify(health)}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-100 px-3 py-1 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {!health && !error && (
        <p className="text-sm text-zinc-400">Checking API…</p>
      )}
    </main>
  );
}
