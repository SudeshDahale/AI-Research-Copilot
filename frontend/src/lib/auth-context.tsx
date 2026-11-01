import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  getSession,
  login as sessionLogin,
  register as sessionRegister,
  enterAsGuest,
  clearSession,
  type Session,
} from "@/lib/session";
import { useQueryClient } from "@tanstack/react-query";

export type AuthModalOptions = {
  title?: string;
  message?: string;
  defaultTab?: "login" | "signup";
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
  loginUser: (identifier: string, password: string) => Promise<Session>;
  registerUser: (params: {
    username: string;
    email: string;
    password: string;
    profession: string;
  }) => Promise<Session>;
  loginAsGuest: () => Session;
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
    async (identifier: string, password: string): Promise<Session> => {
      const newSession = await sessionLogin(identifier, password);
      setSession(newSession);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      return newSession;
    },
    [queryClient],
  );

  const registerUser = useCallback(
    async (params: {
      username: string;
      email: string;
      password: string;
      profession: string;
    }): Promise<Session> => {
      const newSession = await sessionRegister(params);
      setSession(newSession);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      return newSession;
    },
    [queryClient],
  );

  const loginAsGuest = useCallback(() => {
    const s = enterAsGuest();
    setSession(s);
    return s;
  }, []);

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
        registerUser,
        loginAsGuest,
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
