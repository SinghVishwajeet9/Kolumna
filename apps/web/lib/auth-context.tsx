// Makes the logged-in user readable from ANY component without passing it
// down through props manually. AuthProvider fetches /auth/me once when the
// app loads and puts the result in a "box" (the Context); useAuth() is how
// any component reaches into that box.
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "./api-client";

type User = { id: string; email: string; name: string };

type AuthContextValue = {
  user: User | null;
  loading: boolean; // true while we're still checking "/auth/me" on first load
  logout: () => Promise<void>;
  // Login/signup pages call the API directly (not through this context), so
  // after a successful login/signup they call this to tell the context
  // "go re-check who's logged in" — otherwise the Header would keep showing
  // "logged out" until a full page reload.
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const data = await api.get<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null); // 401 is expected when logged out — not an error to show
    }
  }

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// The hook every component actually uses. Throwing if it's used outside the
// provider turns a silent bug (user is always null, mysteriously) into a
// loud one at the exact place the mistake was made.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
