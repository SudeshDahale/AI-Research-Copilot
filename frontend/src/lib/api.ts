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

/**
 * SSE-over-fetch helper for the agent endpoint. EventSource doesn't support
 * POST bodies or custom headers, so this reads the streamed response body
 * manually and parses out {event, data} pairs as they arrive.
 *
 * IMPORTANT: the backend (sse-starlette) sends events separated by "\r\n\r\n",
 * not a plain "\n\n". Splitting on a fixed "\n\n" string never matches that
 * sequence at all (each \n is followed by \r, never by another \n), so every
 * event previously got stuck in the buffer forever and onEvent() never fired
 * for anything — token, fast_completed, refined_completed, completed, none
 * of it. That silently broke every awaiting caller (e.g. the workspace chat's
 * runAgent Promise), even though the backend itself finished correctly every
 * time — hence "backend logs look fast, but the UI just hangs."
 */
export async function apiStream(
  path: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    let detail = res.statusText || `Request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (typeof errBody?.detail === "string") detail = errBody.detail;
    } catch {
      // no JSON body
    }
    throw new ApiError(res.status, detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processChunk = (chunk: string) => {
    let eventName = "message";
    let dataLine = "";
    for (const line of chunk.split("\n")) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) dataLine += line.slice(5).trim();
    }
    if (!dataLine) return;
    try {
      onEvent(eventName, JSON.parse(dataLine));
    } catch {
      onEvent(eventName, dataLine);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Fixed: match "\n\n" OR "\r\n\r\n" as the event separator, not just "\n\n".
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      processChunk(chunk);
    }
  }

  // Process whatever's left in the buffer after the stream closes — the
  // final event sometimes arrives without a trailing separator, so without
  // this, the very last event (often "completed") could be silently dropped.
  if (buffer.trim()) {
    processChunk(buffer);
  }
}
