import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getSession, login as sessionLogin, clearSession, type Session } from "@/lib/session";
import { useQueryClient } from "@tanstack/react-query";

export type AuthModalOptions = {
  title?: string;
  message?: string;
  onSuccess?: () => void;
};

interface AuthContextType {
  session: Session | null;
  isGuest: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  isAuthModalOpen: boolean;
  modalOptions: AuthModalOptions;
  openLoginModal: (options?: AuthModalOptions) => void;
  closeLoginModal: () => void;
  loginUser: (email: string, password: string) => Promise<Session>;
  logoutUser: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [modalOptions, setModalOptions] = useState<AuthModalOptions>({});
  const queryClient = useQueryClient();

  const refreshSession = useCallback(async () => {
    try {
      const s = await getSession();
      setSession(s);
      return s;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const openLoginModal = useCallback((options: AuthModalOptions = {}) => {
    setModalOptions(options);
    setIsAuthModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const loginUser = useCallback(
    async (email: string, password: string): Promise<Session> => {
      const newSession = await sessionLogin(email, password);
      setSession(newSession);
      // Invalidate queries so that server workspaces, reviews, etc. update immediately
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      return newSession;
    },
    [queryClient],
  );

  const logoutUser = useCallback(async () => {
    await clearSession();
    setSession(null);
    queryClient.invalidateQueries({ queryKey: ["workspaces"] });
  }, [queryClient]);

  const isGuest = session?.mode === "guest";
  const isAuthenticated = session?.mode === "user";

  return (
    <AuthContext.Provider
      value={{
        session,
        isGuest,
        isAuthenticated,
        loading,
        isAuthModalOpen,
        modalOptions,
        openLoginModal,
        closeLoginModal,
        loginUser,
        logoutUser,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
