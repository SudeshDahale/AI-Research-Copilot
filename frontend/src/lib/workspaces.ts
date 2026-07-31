import { useEffect, useState, useCallback } from "react";

const KEY = "arc.workspaces";

export type Workspace = {
  id: string;
  name: string;
  paperIds: string[];
  createdAt: number;
};

function read(): Workspace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Workspace[]) : [];
  } catch {
    return [];
  }
}

function write(ws: Workspace[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ws));
  window.dispatchEvent(new CustomEvent("arc:workspaces"));
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    setWorkspaces(read());
    const sync = () => setWorkspaces(read());
    window.addEventListener("arc:workspaces", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("arc:workspaces", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const create = useCallback((name: string, paperIds: string[] = []): Workspace => {
    const ws: Workspace = {
      id: crypto.randomUUID().slice(0, 8),
      name: name.trim() || "Untitled workspace",
      paperIds: [...new Set(paperIds)],
      createdAt: Date.now(),
    };
    write([ws, ...read()]);
    return ws;
  }, []);

  const rename = useCallback((id: string, name: string) => {
    write(read().map((w) => (w.id === id ? { ...w, name } : w)));
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((w) => w.id !== id));
  }, []);

  const addPapers = useCallback((id: string, ids: string[]) => {
    write(
      read().map((w) =>
        w.id === id ? { ...w, paperIds: [...new Set([...w.paperIds, ...ids])] } : w,
      ),
    );
  }, []);

  const removePaper = useCallback((id: string, paperId: string) => {
    write(
      read().map((w) =>
        w.id === id ? { ...w, paperIds: w.paperIds.filter((p) => p !== paperId) } : w,
      ),
    );
  }, []);

  return { workspaces, create, rename, remove, addPapers, removePaper };
}

export function getWorkspace(id: string): Workspace | undefined {
  return read().find((w) => w.id === id);
}
