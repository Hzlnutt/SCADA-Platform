import { deleteJson, getJson, patchJson, postJson } from "./api.client";
import type { AuthSession, AuthUser } from "../store/auth.store";

type AuthResponse = AuthSession & { user: AuthUser };

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export const login = async (username: string, password: string) => {
  return postJson<AuthResponse>("/auth/login", { username, email: username, password });
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

export const updateBiometrics = async (password: string, images: string[]) => {
  return postJson<{ success: boolean; message: string; data: AuthUser }>("/users/me/biometrics", {
    password,
    images
  });
};

export const verifyBiometrics = async (image: string) => {
  return postJson<{ valid: boolean; distance: number }>("/users/me/verify-biometrics", {
    image
  });
};

export const verifyPassword = async (password: string) => {
  return postJson<{ valid: boolean }>("/auth/verify-password", { password });
};

export type PasswordChangeRequest = {
  id: number;
  userId: string;
  username: string;
  userName: string;
  userRole: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
};

export const requestPasswordChange = async (payload: {
  currentPassword: string;
  newPassword: string;
}) => {
  return postJson<{ id: number; status: string; message: string }>("/users/me/password-request", payload);
};

export const fetchMyPasswordRequest = async () => {
  return getJson<{ data: PasswordChangeRequest | null }>("/users/me/password-request");
};

export const cancelMyPasswordRequest = async (id?: number) => {
  return deleteJson<{ success: boolean }>(id ? `/users/me/password-request/${id}` : "/users/me/password-request");
};

export const fetchPasswordApprovals = async (status: string = "all") => {
  return getJson<{ data: PasswordChangeRequest[] }>(`/approvals/password-requests?status=${status}`);
};

export const reviewPasswordApproval = async (id: number, action: "approve" | "reject", notes?: string) => {
  return patchJson<{ success: boolean; status: string; message: string }>(`/approvals/password-requests/${id}`, {
    action,
    notes
  });
};

