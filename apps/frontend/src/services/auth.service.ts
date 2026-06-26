import { getJson, patchJson, postJson } from "./api.client";
import type { AuthSession, AuthUser } from "../store/auth.store";

type AuthResponse = AuthSession & { user: AuthUser };

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export const login = async (email: string, password: string) => {
  return postJson<AuthResponse>("/auth/login", { email, password });
};

export const register = async (payload: RegisterInput) => {
  return postJson<AuthResponse>("/auth/register", payload);
};

export const loginWithGoogle = async (credential: string) => {
  return postJson<AuthResponse>("/auth/google", { credential });
};

export const fetchGoogleConfig = async () => {
  return getJson<{ clientId: string | null }>("/auth/google-config");
};

export const logout = async (refreshToken: string) => {
  return postJson<{ revoked: boolean }>("/auth/logout", { refreshToken });
};

export const fetchMe = async () => {
  return getJson<{ data: AuthUser | null }>("/users/me");
};

export const updateProfile = async (payload: {
  name?: string;
  avatarUrl?: string | null;
}) => {
  return patchJson<{ data: AuthUser }>("/users/me", payload);
};

export const updateBiometrics = async (password: string, biometricDescriptor: number[]) => {
  return postJson<{ success: boolean; message: string; data: AuthUser }>("/users/me/biometrics", {
    password,
    biometricDescriptor
  });
};

export const verifyBiometrics = async (biometricDescriptor: number[]) => {
  return postJson<{ valid: boolean; distance: number }>("/users/me/verify-biometrics", {
    biometricDescriptor
  });
};

export const verifyPassword = async (password: string) => {
  return postJson<{ valid: boolean }>("/auth/verify-password", { password });
};
