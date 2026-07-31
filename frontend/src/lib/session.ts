const KEY = "arc.session";

export type Session = { mode: "user" | "guest"; name: string; email?: string };

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session) {
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  window.localStorage.removeItem(KEY);
}