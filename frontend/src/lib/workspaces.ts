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

// Query key for workspaces cache invalidation
const WORKSPACES_QUERY_KEY = ["workspaces"];

export function useWorkspaces() {
  const queryClient = useQueryClient();

  // Fetch workspaces query
  const { data: workspaces = [] } = useQuery<Workspace[]>({
    queryKey: WORKSPACES_QUERY_KEY,
    queryFn: async () => {
      const data = await apiFetch<BackendWorkspace[]>("/workspaces");
      return data.map(mapWorkspace);
    },
  });

  // Create workspace mutation
  const createMutation = useMutation({
    mutationFn: (variables: { name: string; paperIds?: string[]; papersData?: any[] }) =>
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
    mutationFn: (variables: { id: string; paperIds: string[]; papersData?: any[] }) =>
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

  const create = async (name: string, paperIds: string[] = [], papersData: any[] = []): Promise<Workspace> => {
    try {
      const res = await createMutation.mutateAsync({ name, paperIds, papersData });
      return mapWorkspace(res);
    } catch (err) {
      console.warn("Backend workspace creation unavailable, using local workspace fallback:", err);
      const localId = `ws-${Date.now()}`;
      const localWs: Workspace = {
        id: localId,
        name,
        paperIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return localWs;
    }
  };

  const rename = async (id: string, name: string): Promise<Workspace> => {
    const res = await renameMutation.mutateAsync({ id, name });
    return mapWorkspace(res);
  };

  const remove = async (id: string): Promise<void> => {
    return removeMutation.mutateAsync(id);
  };

  const addPapers = async (id: string, paperIds: string[], papersData: any[] = []): Promise<Workspace> => {
    const res = await addPapersMutation.mutateAsync({ id, paperIds, papersData });
    return mapWorkspace(res);
  };

  const removePaper = async (id: string, paperId: string): Promise<Workspace> => {
    const res = await removePaperMutation.mutateAsync({ id, paperId });
    return mapWorkspace(res);
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
