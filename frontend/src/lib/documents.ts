import { useCallback, useEffect, useState } from "react";

const KEY = "arc.documents";

export type Doc = {
  id: string;
  workspaceId: string;
  title: string;
  kind: "Report" | "Literature review" | "Summary" | "Outline" | "Brief";
  prompt: string;
  content: string;
  createdAt: number;
  words: number;
};

function read(): Doc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Doc[]) : [];
  } catch {
    return [];
  }
}

function write(docs: Doc[]) {
  window.localStorage.setItem(KEY, JSON.stringify(docs));
  window.dispatchEvent(new CustomEvent("arc:documents"));
}

export function useDocuments(workspaceId?: string) {
  const [all, setAll] = useState<Doc[]>([]);

  useEffect(() => {
    setAll(read());
    const sync = () => setAll(read());
    window.addEventListener("arc:documents", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("arc:documents", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const docs = workspaceId ? all.filter((d) => d.workspaceId === workspaceId) : all;

  const create = useCallback(
    (doc: Omit<Doc, "id" | "createdAt" | "words">): Doc => {
      const full: Doc = {
        ...doc,
        id: crypto.randomUUID().slice(0, 8),
        createdAt: Date.now(),
        words: doc.content.trim().split(/\s+/).length,
      };
      write([full, ...read()]);
      return full;
    },
    [],
  );

  const remove = useCallback((id: string) => {
    write(read().filter((d) => d.id !== id));
  }, []);

  return { docs, create, remove };
}
