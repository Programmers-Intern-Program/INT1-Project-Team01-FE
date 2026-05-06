const ACCESS_KEY = "aio.accessToken";
const REFRESH_KEY = "aio.refreshToken";
const USER_KEY = "aio.user";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export interface AuthUser {
  memberId: number;
  name: string;
  email: string;
  role: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: AuthTokens | null) {
  if (typeof window === "undefined") return;
  if (tokens) {
    window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  } else {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  }
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}

export function clearAuth() {
  setTokens(null);
  setStoredUser(null);
}

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

interface FetchOptions extends RequestInit {
  /** Skip auth header injection (used for the refresh request itself). */
  skipAuth?: boolean;
  /** Skip the 401 → refresh → retry pipeline. */
  skipRefreshRetry?: boolean;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const tokens = await apiFetch<AuthTokens>("/api/v1/auth/token/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        skipAuth: true,
        skipRefreshRetry: true,
      });
      setTokens(tokens);
      return tokens.accessToken;
    } catch {
      clearAuth();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Calls the Spring Boot API and unwraps the `{ data, message }` envelope.
 * Throws ApiError on non-2xx. Auto-refreshes on 401 once.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { skipAuth, skipRefreshRetry, headers: hdr, ...rest } = options;
  const headers = new Headers(hdr);
  if (!headers.has("Content-Type") && rest.body) {
    headers.set("Content-Type", "application/json");
  }
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  } catch {
    throw <ApiError>{ status: 0, message: "네트워크 오류가 발생했습니다." };
  }

  if (res.status === 401 && !skipRefreshRetry && !skipAuth) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      const retryHeaders = new Headers(hdr);
      if (!retryHeaders.has("Content-Type") && rest.body) {
        retryHeaders.set("Content-Type", "application/json");
      }
      retryHeaders.set("Authorization", `Bearer ${newAccess}`);
      res = await fetch(`${API_BASE}${path}`, { ...rest, headers: retryHeaders });
    }
  }

  const text = await res.text();
  const body = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const message =
      (isRecord(body) && typeof body.message === "string" && body.message) ||
      defaultMessageFor(res.status);
    throw <ApiError>{ status: res.status, message, details: body };
  }

  if (isRecord(body) && "data" in body) return body.data as T;
  return body as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function defaultMessageFor(status: number): string {
  if (status === 401) return "로그인이 필요합니다.";
  if (status === 403) return "권한이 없습니다.";
  if (status === 404) return "요청한 리소스를 찾을 수 없습니다.";
  if (status >= 500) return "서버 오류가 발생했습니다.";
  return "요청을 처리하지 못했습니다.";
}
