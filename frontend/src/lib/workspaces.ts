import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type Workspace = {
  id: string;
  name: string;
  paperIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type BackendWorkspace = {
  id: string;
  name: string;
  paper_ids: string[];
  created_at: string;
  updated_at: string;
};

function mapWorkspace(bw: BackendWorkspace): Workspace {
  return {
    id: bw.id,
    name: bw.name,
    paperIds: bw.paper_ids || [],
    createdAt: bw.created_at,
    updatedAt: bw.updated_at,
  };
}

const LOCAL_WS_KEY = "arclight-local-workspaces";

function getLocalWorkspaces(): Workspace[] {
  try {
    const raw = localStorage.getItem(LOCAL_WS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalWorkspaces(list: Workspace[]) {
  try {
    localStorage.setItem(LOCAL_WS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

const WORKSPACES_QUERY_KEY = ["workspaces"];

export function useWorkspaces() {
  const queryClient = useQueryClient();

  // Fetch workspaces query
  const { data: workspaces = [] } = useQuery<Workspace[]>({
    queryKey: WORKSPACES_QUERY_KEY,
    queryFn: async () => {
      let serverWorkspaces: Workspace[] = [];
      try {
        const data = await apiFetch<BackendWorkspace[]>("/workspaces");
        serverWorkspaces = data.map(mapWorkspace);
      } catch {
        // Guest user or unauthenticated
      }
      const local = getLocalWorkspaces();
      const seen = new Set(serverWorkspaces.map((w) => w.id));
      const combined = [...serverWorkspaces];
      for (const l of local) {
        if (!seen.has(l.id)) {
          seen.add(l.id);
          combined.push(l);
        }
      }
      return combined;
    },
  });

  // Create workspace mutation
  const createMutation = useMutation({
    mutationFn: (variables: {
      name: string;
      paperIds?: string[];
      papersData?: Record<string, unknown>[];
    }) =>
      apiFetch<BackendWorkspace>("/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: variables.name,
          paper_ids: variables.paperIds || [],
          papers_data: variables.papersData || [],
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    },
  });

  // Rename workspace mutation
  const renameMutation = useMutation({
    mutationFn: (variables: { id: string; name: string }) =>
      apiFetch<BackendWorkspace>(`/workspaces/${variables.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: variables.name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    },
  });

  // Remove workspace mutation
  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/workspaces/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    },
  });

  // Add papers mutation
  const addPapersMutation = useMutation({
    mutationFn: (variables: {
      id: string;
      paperIds: string[];
      papersData?: Record<string, unknown>[];
    }) =>
      apiFetch<BackendWorkspace>(`/workspaces/${variables.id}/papers`, {
        method: "POST",
        body: JSON.stringify({
          paper_ids: variables.paperIds,
          papers_data: variables.papersData || [],
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    },
  });

  // Remove paper mutation
  const removePaperMutation = useMutation({
    mutationFn: (variables: { id: string; paperId: string }) =>
      apiFetch<BackendWorkspace>(`/workspaces/${variables.id}/papers/${variables.paperId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    },
  });

  const create = async (
    name: string,
    paperIds: string[] = [],
    papersData: Record<string, unknown>[] = [],
  ): Promise<Workspace> => {
    try {
      const res = await createMutation.mutateAsync({ name, paperIds, papersData });
      const mapped = mapWorkspace(res);
      queryClient.setQueryData<Workspace[]>(WORKSPACES_QUERY_KEY, (prev = []) => [mapped, ...prev]);
      return mapped;
    } catch (err) {
      console.warn("Backend workspace creation unavailable, saving locally:", err);
      const localId = `ws-${Date.now()}`;
      const localWs: Workspace = {
        id: localId,
        name,
        paperIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const next = [localWs, ...getLocalWorkspaces().filter((w) => w.id !== localId)];
      saveLocalWorkspaces(next);
      queryClient.setQueryData<Workspace[]>(WORKSPACES_QUERY_KEY, (prev = []) => [localWs, ...prev]);
      return localWs;
    }
  };

  const rename = async (id: string, name: string): Promise<Workspace> => {
    try {
      const res = await renameMutation.mutateAsync({ id, name });
      return mapWorkspace(res);
    } catch {
      const locals = getLocalWorkspaces();
      const match = locals.find((w) => w.id === id);
      if (match) {
        match.name = name;
        match.updatedAt = new Date().toISOString();
        saveLocalWorkspaces(locals);
      }
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
      return match || { id, name, paperIds: [], createdAt: "", updatedAt: "" };
    }
  };

  const remove = async (id: string): Promise<void> => {
    try {
      await removeMutation.mutateAsync(id);
    } catch {
      const next = getLocalWorkspaces().filter((w) => w.id !== id);
      saveLocalWorkspaces(next);
      queryClient.setQueryData<Workspace[]>(WORKSPACES_QUERY_KEY, (prev = []) =>
        prev.filter((w) => w.id !== id)
      );
    }
  };

  const addPapers = async (
    id: string,
    paperIds: string[],
    papersData: Record<string, unknown>[] = [],
  ): Promise<Workspace> => {
    try {
      const res = await addPapersMutation.mutateAsync({ id, paperIds, papersData });
      return mapWorkspace(res);
    } catch {
      const locals = getLocalWorkspaces();
      const match = locals.find((w) => w.id === id);
      if (match) {
        const existing = new Set(match.paperIds);
        for (const pid of paperIds) existing.add(pid);
        match.paperIds = Array.from(existing);
        match.updatedAt = new Date().toISOString();
        saveLocalWorkspaces(locals);
      }
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
      return match || { id, name: "", paperIds, createdAt: "", updatedAt: "" };
    }
  };

  const removePaper = async (id: string, paperId: string): Promise<Workspace> => {
    try {
      const res = await removePaperMutation.mutateAsync({ id, paperId });
      return mapWorkspace(res);
    } catch {
      const locals = getLocalWorkspaces();
      const match = locals.find((w) => w.id === id);
      if (match) {
        match.paperIds = match.paperIds.filter((p) => p !== paperId);
        match.updatedAt = new Date().toISOString();
        saveLocalWorkspaces(locals);
      }
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
      return match || { id, name: "", paperIds: [], createdAt: "", updatedAt: "" };
    }
  };

  return {
    workspaces,
    create,
    rename,
    remove,
    addPapers,
    removePaper,
  };
}

export function getWorkspace(id: string): Workspace | undefined {
  return undefined;
}
