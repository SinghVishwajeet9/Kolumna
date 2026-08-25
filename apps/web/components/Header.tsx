"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Header() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
      <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
        Kolumna
      </Link>

      {!loading && (
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="text-zinc-600 dark:text-zinc-400">{user.name}</span>
              <button
                onClick={() => logout()}
                className="rounded-md border border-zinc-300 px-3 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-zinc-600 dark:text-zinc-400">
                Log in
              </Link>
              <Link href="/signup" className="text-zinc-600 dark:text-zinc-400">
                Sign up
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
