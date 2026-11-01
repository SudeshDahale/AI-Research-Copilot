import { apiFetch, ApiError } from "@/lib/api";

export type Session = {
  mode: "user" | "guest";
  name: string;
  email?: string;
  profession?: string;
};

type UserOut = {
  id: string;
  email: string;
  name: string;
  profession?: string;
  created_at: string;
};

const GUEST_KEY = "arc.guest";
const USER_KEY = "arc.user";
const REGISTERED_USERS_KEY = "arc.registered_users";

interface StoredUser {
  username: string;
  name: string;
  email: string;
  password: string;
  profession: string;
}

const DEFAULT_DEMO_USERS: StoredUser[] = [
  {
    username: "shlok",
    name: "Shlok",
    email: "shlok@mail.com",
    password: "test@123",
    profession: "Academic Researcher",
  },
];

function getStoredUsers(): StoredUser[] {
  if (typeof window === "undefined") return DEFAULT_DEMO_USERS;
  try {
    const raw = window.localStorage.getItem(REGISTERED_USERS_KEY);
    if (!raw) {
      window.localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(DEFAULT_DEMO_USERS));
      return DEFAULT_DEMO_USERS;
    }
    return JSON.parse(raw) as StoredUser[];
  } catch {
    return DEFAULT_DEMO_USERS;
  }
}

function saveStoredUser(user: StoredUser): void {
  if (typeof window === "undefined") return;
  const list = getStoredUsers();
  // Filter out any existing matching user by email or username
  const filtered = list.filter(
    (u) =>
      u.email.toLowerCase() !== user.email.toLowerCase() &&
      u.username.toLowerCase() !== user.username.toLowerCase(),
  );
  filtered.push(user);
  window.localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(filtered));
}

/**
 * Resolves the current session.
 * 1. Checks if the user is authenticated on the server (/auth/me). Real accounts take precedence.
 * 2. If no server response, checks if a cached user session exists in storage.
 * 3. Checks if a guest session exists in storage.
 * 4. Returns null if neither.
 */
export async function getSession(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  try {
    const user = await apiFetch<UserOut>("/auth/me");
    window.localStorage.removeItem(GUEST_KEY);
    window.sessionStorage.removeItem(GUEST_KEY);
    const session: Session = {
      mode: "user",
      name: user.name,
      email: user.email,
      profession: user.profession || "Academic Researcher",
    };
    window.localStorage.setItem(USER_KEY, JSON.stringify(session));
    return session;
  } catch (err) {
    // If server responded with 401 Unauthorized, the cookie is invalid
    if (err instanceof ApiError && err.status === 401) {
      window.localStorage.removeItem(USER_KEY);
    } else {
      // Check cached user session for offline resilience
      const userRaw = window.localStorage.getItem(USER_KEY);
      if (userRaw) {
        try {
          return JSON.parse(userRaw) as Session;
        } catch {
          window.localStorage.removeItem(USER_KEY);
        }
      }
    }

    // Check for guest flag
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
  window.localStorage.removeItem(USER_KEY);
  return session;
}

/**
 * Logs in with identifier (email or username) and password.
 */
export async function login(identifier: string, password: string): Promise<Session> {
  const cleanId = identifier.trim();
  try {
    const user = await apiFetch<UserOut>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: cleanId,
        email: cleanId,
        username: cleanId,
        password,
      }),
    });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(GUEST_KEY);
      window.sessionStorage.removeItem(GUEST_KEY);
    }
    const session: Session = {
      mode: "user",
      name: user.name,
      email: user.email,
      profession: user.profession || "Academic Researcher",
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_KEY, JSON.stringify(session));
    }
    return session;
  } catch (err) {
    // If server is unreachable or offline, fallback to locally registered users
    const isNetworkOrConnectionError =
      !(err instanceof ApiError) || err.status === 502 || err.status === 503 || err.status === 504;

    if (isNetworkOrConnectionError) {
      const users = getStoredUsers();
      const match = users.find(
        (u) =>
          (u.email.toLowerCase() === cleanId.toLowerCase() ||
            u.username.toLowerCase() === cleanId.toLowerCase()) &&
          u.password === password,
      );
      if (match) {
        const session: Session = {
          mode: "user",
          name: match.name,
          email: match.email,
          profession: match.profession || "Academic Researcher",
        };
        window.localStorage.removeItem(GUEST_KEY);
        window.sessionStorage.removeItem(GUEST_KEY);
        window.localStorage.setItem(USER_KEY, JSON.stringify(session));
        return session;
      }
    }

    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(401, "Incorrect username/email or password.");
  }
}

/**
 * Registers a new user with username, email, password, and working profession.
 */
export async function register(params: {
  username: string;
  email: string;
  password: string;
  profession: string;
}): Promise<Session> {
  const cleanUsername = params.username.trim();
  const cleanEmail = params.email.trim();
  const cleanProfession = params.profession.trim() || "Academic Researcher";

  // Cache user locally for offline/demo resilience
  saveStoredUser({
    username: cleanUsername,
    name: cleanUsername,
    email: cleanEmail,
    password: params.password,
    profession: cleanProfession,
  });

  try {
    const user = await apiFetch<UserOut>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: cleanUsername,
        name: cleanUsername,
        email: cleanEmail,
        password: params.password,
        profession: cleanProfession,
      }),
    });

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(GUEST_KEY);
      window.sessionStorage.removeItem(GUEST_KEY);
    }

    const session: Session = {
      mode: "user",
      name: user.name,
      email: user.email,
      profession: user.profession || cleanProfession,
    };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_KEY, JSON.stringify(session));
    }
    return session;
  } catch (err) {
    const isNetworkOrConnectionError =
      !(err instanceof ApiError) || err.status === 502 || err.status === 503 || err.status === 504;

    if (isNetworkOrConnectionError) {
      const session: Session = {
        mode: "user",
        name: cleanUsername,
        email: cleanEmail,
        profession: cleanProfession,
      };
      window.localStorage.removeItem(GUEST_KEY);
      window.sessionStorage.removeItem(GUEST_KEY);
      window.localStorage.setItem(USER_KEY, JSON.stringify(session));
      return session;
    }

    throw err;
  }
}

export async function clearSession(): Promise<void> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(GUEST_KEY);
    window.sessionStorage.removeItem(GUEST_KEY);
    window.localStorage.removeItem(USER_KEY);
  }
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // Best-effort — the cookie may already be gone/expired.
  }
}
