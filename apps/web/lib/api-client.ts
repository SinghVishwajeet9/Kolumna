// The ONLY place in the frontend that calls fetch() directly. Every
// component talks to the API through this file — same idea as the
// repository layer on the backend: one funnel, so things like error
// handling and credentials only need to be gotten right once.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    // Without this, the browser won't send the session cookie on
    // cross-origin requests (web is :3000, api is :4100) — see
    // CONCEPTS.md §2.7. This is the other half of the CORS setup; the API
    // side already has credentials: true in its cors() config.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(body.error ?? "Request failed", res.status);
  }

  if (res.status === 204) {
    return undefined as T; // DELETE responses have no body to parse
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
