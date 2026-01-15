const AUTH_TOKEN_KEY = 'b2b-dashboard-auth-token';

type JwtPayload = {
  exp?: number;
  email?: string;
};

export function getStoredToken(): string | null {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function parseJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    const json = window.atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= Date.now();
}

export function getValidToken(): string | null {
  const token = getStoredToken();
  if (!token) return null;
  if (isTokenExpired(token)) {
    clearStoredToken();
    return null;
  }
  return token;
}

export function getTokenEmail(token: string): string | null {
  const payload = parseJwt(token);
  return payload?.email ?? null;
}
