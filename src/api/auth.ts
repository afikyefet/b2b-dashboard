const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

type AuthConfigResponse = {
  auth_disabled?: boolean;
  allowed_domain?: string;
};

type VerifyResponse = {
  token: string;
  expires_at: string;
  email: string;
};

async function parseError(res: Response) {
  const text = await res.text();
  if (!text) return res.statusText || 'Request failed';
  try {
    const data = JSON.parse(text) as { error?: string };
    return data.error || text;
  } catch {
    return text;
  }
}

export async function getAuthConfig(): Promise<AuthConfigResponse> {
  const res = await fetch(`${API_BASE}/api/auth/config`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function requestAuthCode(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function verifyAuthCode(email: string, code: string): Promise<VerifyResponse> {
  const res = await fetch(`${API_BASE}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
