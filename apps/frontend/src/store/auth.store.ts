import { create } from "zustand";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  hasBiometrics?: boolean;
};

type AuthSession = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
};

type AuthState = AuthSession & {
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  updateUser: (user: AuthUser) => void;
};

const STORAGE_KEY = "scada.auth";

const loadSession = (): AuthSession => {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, user: null };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { accessToken: null, refreshToken: null, user: null };
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      user: parsed.user ?? null
    };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
};

const persistSession = (session: AuthSession) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...loadSession(),
  setSession: (session) => {
    set(session);
    persistSession(session);
  },
  clearSession: () => {
    const next = { accessToken: null, refreshToken: null, user: null };
    set(next);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },
  updateUser: (user) => {
    const current = get();
    const next = {
      accessToken: current.accessToken,
      refreshToken: current.refreshToken,
      user
    };
    set({ user });
    persistSession(next);
  }
}));

export const getAccessToken = () => useAuthStore.getState().accessToken;

export const getRefreshToken = () => useAuthStore.getState().refreshToken;

export type { AuthUser, AuthSession };
