import { apiFetch, ApiError } from "@/lib/api";

export type Session = { mode: "user" | "guest"; name: string; email?: string };

type UserOut = { id: string; email: string; name: string; created_at: string };

// Guest is a local-only concept (no account, nothing on the server) — it
// still needs *some* persistence so a refresh doesn't kick a guest back to
// the landing page, so it keeps using storage, just sessionStorage (cleared
// when the tab closes) instead of localStorage.
const GUEST_KEY = "arc.guest";

/**
 * Resolves the current session by asking the server who the httpOnly cookie
 * belongs to — the JWT itself is never touched or stored on the client.
 * Falls back to a locally-flagged guest session if there's no real account.
 */
export async function getSession(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  const guestRaw =
    window.localStorage.getItem(GUEST_KEY) ||
    window.sessionStorage.getItem(GUEST_KEY);
  if (guestRaw) {
    try {
      return JSON.parse(guestRaw) as Session;
    } catch {
      window.localStorage.removeItem(GUEST_KEY);
      window.sessionStorage.removeItem(GUEST_KEY);
    }
  }

  try {
    const user = await apiFetch<UserOut>("/auth/me");
    return { mode: "user", name: user.name, email: user.email };
  } catch {
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
 * Tries to log in; if there's no account with that email yet, registers one.
 * Matches the old landing page's single "Get started" action while using
 * real auth underneath.
 */
export async function loginOrRegister(
  email: string,
  password: string,
  name: string,
): Promise<Session> {
  try {
    const user = await apiFetch<UserOut>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return { mode: "user", name: user.name, email: user.email };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const user = await apiFetch<UserOut>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      });
      return { mode: "user", name: user.name, email: user.email };
    }
    throw err;
  }
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