import { getValidToken } from '../utils/authToken';

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  const token = getValidToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
