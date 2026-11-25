import { getAccessToken, useAuthStore } from "../store/auth.store";
import { getTerminalMacAddress } from "../utils/deviceNetwork";

const devFallback = "http://localhost:3001";
const prodFallback = typeof window !== "undefined" ? window.location.origin : "";
const rawBaseUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? devFallback : prodFallback);
const baseUrl = rawBaseUrl.replace(/\/$/, "");
const apiBase = baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;

const buildUrl = (path: string) => `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
export const buildApiUrl = buildUrl;

const buildAuthHeaders = (extra?: HeadersInit): HeadersInit => {
  const accessToken = getAccessToken();
  return {
    "X-Client-MAC": getTerminalMacAddress(),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(extra ?? {})
  };
};

const request = async (path: string, options?: RequestInit) => {
  const url = buildUrl(path);
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(options?.headers)
    }
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

export const getAudioBuffer = async (path: string): Promise<ArrayBuffer | null> => {
  try {
    const response = await fetch(buildUrl(path), {
      headers: buildAuthHeaders()
    });
    if (response.status !== 200) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("audio")) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
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

export const patchJson = async <T>(path: string, body: unknown, headers?: HeadersInit) => {
  return request(path, {
    method: "PATCH",
    body: JSON.stringify(body),
    ...(headers ? { headers } : {})
  }) as Promise<T>;
};

export const deleteJson = async <T>(path: string, headers?: HeadersInit) => {
  return request(path, {
    method: "DELETE",
    ...(headers ? { headers } : {})
  }) as Promise<T>;
};
