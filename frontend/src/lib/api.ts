/**
 * Thin fetch wrapper for the backend API (proxied at /api in vite.config.ts,
 * so no base URL needs to be hardcoded — see infra notes in Sprint 0).
 *
 * `credentials: "include"` is the important bit: auth works via an httpOnly
 * cookie the backend sets on login/register (see lib/session.ts), not a
 * token this file has to read, store, or attach itself.
 */

const BASE_URL = "/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = res.statusText || `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // Response had no JSON body — keep the statusText fallback.
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}