import { getAccessToken, useAuthStore } from "../store/auth.store";

const rawBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const baseUrl = rawBaseUrl.replace(/\/$/, "");
const apiBase = baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;

const request = async (path: string, options?: RequestInit) => {
  const url = `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  const accessToken = getAccessToken();
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options?.headers ?? {})
    },
    ...options
  });

  if (!response.ok) {
    if (response.status === 401) {
      useAuthStore.getState().clearSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/login" && window.location.pathname !== "/register") {
        window.location.href = "/login";
      }
    }
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return response.json();
};

export const getJson = async <T>(path: string) => {
  return request(path) as Promise<T>;
};

export const postJson = async <T>(path: string, body: unknown) => {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body)
  }) as Promise<T>;
};

export const putJson = async <T>(path: string, body: unknown) => {
  return request(path, {
    method: "PUT",
    body: JSON.stringify(body)
  }) as Promise<T>;
};

export const patchJson = async <T>(path: string, body: unknown) => {
  return request(path, {
    method: "PATCH",
    body: JSON.stringify(body)
  }) as Promise<T>;
};

export const deleteJson = async <T>(path: string) => {
  return request(path, {
    method: "DELETE"
  }) as Promise<T>;
};
