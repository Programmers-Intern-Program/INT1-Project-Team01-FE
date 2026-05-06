import {
  apiFetch,
  clearAuth,
  getAccessToken,
  getRefreshToken,
  setStoredUser,
  setTokens,
  type AuthUser,
} from "./api-client";

interface GoogleLoginResponse extends AuthUser {
  accessToken: string;
  refreshToken: string;
}

export async function loginWithGoogle(idToken: string): Promise<AuthUser> {
  const res = await apiFetch<GoogleLoginResponse>("/api/v1/auth/google/login", {
    method: "POST",
    body: JSON.stringify({ idToken }),
    skipAuth: true,
    skipRefreshRetry: true,
  });
  const { accessToken, refreshToken, ...user } = res;
  setTokens({ accessToken, refreshToken });
  setStoredUser(user);
  return user;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await apiFetch("/api/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        skipRefreshRetry: true,
      });
    } catch {
      // 서버 실패해도 로컬 토큰은 비운다.
    }
  }
  clearAuth();
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}
