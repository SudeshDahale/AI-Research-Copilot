import { apiFetch, ApiError } from "@/lib/api";

export type Session = { mode: "user" | "guest"; name: string; email?: string };

type UserOut = { id: string; email: string; name: string; created_at: string };

const GUEST_KEY = "arc.guest";

/**
 * Resolves the current session.
 * 1. Checks if the user is authenticated on the server (/auth/me). Real accounts take precedence.
 * 2. If no authenticated user, checks if a guest session exists in storage.
 * 3. Returns null if neither.
 */
export async function getSession(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  try {
    const user = await apiFetch<UserOut>("/auth/me");
    // Clear any leftover guest flag since we are logged in as a real user
    window.localStorage.removeItem(GUEST_KEY);
    window.sessionStorage.removeItem(GUEST_KEY);
    return { mode: "user", name: user.name, email: user.email };
  } catch {
    // Not logged in on server — check for guest flag
    const guestRaw =
      window.localStorage.getItem(GUEST_KEY) || window.sessionStorage.getItem(GUEST_KEY);
    if (guestRaw) {
      try {
        return JSON.parse(guestRaw) as Session;
      } catch {
        window.localStorage.removeItem(GUEST_KEY);
        window.sessionStorage.removeItem(GUEST_KEY);
      }
    }
    return null;
  }
}

export function enterAsGuest(): Session {
  const session: Session = { mode: "guest", name: "Guest" };
  window.localStorage.setItem(GUEST_KEY, JSON.stringify(session));
  window.sessionStorage.setItem(GUEST_KEY, JSON.stringify(session));
  return session;
}

/**
 * Logs in with email and password via /auth/login.
 * Clears guest markers on success.
 */
export async function login(email: string, password: string): Promise<Session> {
  const user = await apiFetch<UserOut>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(GUEST_KEY);
    window.sessionStorage.removeItem(GUEST_KEY);
  }
  return { mode: "user", name: user.name, email: user.email };
}

export async function clearSession(): Promise<void> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(GUEST_KEY);
    window.sessionStorage.removeItem(GUEST_KEY);
  }
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // Best-effort — the cookie may already be gone/expired.
  }
}
