import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAuthConfig, requestAuthCode, verifyAuthCode } from '../api/auth';
import { clearStoredToken, getTokenEmail, getValidToken, parseJwt, setStoredToken } from '../utils/authToken';

type AuthStatus = 'checking' | 'ready';

type AuthContextValue = {
  status: AuthStatus;
  token: string | null;
  email: string | null;
  authDisabled: boolean;
  allowedDomain: string | null;
  isAuthenticated: boolean;
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [authDisabled, setAuthDisabled] = useState(false);
  const [allowedDomain, setAllowedDomain] = useState<string | null>(null);

  const signOut = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setEmail(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let config: { auth_disabled?: boolean; allowed_domain?: string } | null = null;
      try {
        config = await getAuthConfig();
      } catch (error) {
        console.error('[Auth] failed to load auth config', error);
      }

      const storedToken = getValidToken();
      const storedEmail = storedToken ? getTokenEmail(storedToken) : null;
      if (!storedToken) {
        clearStoredToken();
      }

      if (!cancelled) {
        setToken(storedToken);
        setEmail(storedEmail);
        setAuthDisabled(Boolean(config?.auth_disabled));
        setAllowedDomain(config?.allowed_domain?.trim() || null);
        setStatus('ready');
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    const payload = parseJwt(token);
    if (!payload?.exp) return;
    const timeoutMs = payload.exp * 1000 - Date.now();
    if (timeoutMs <= 0) {
      signOut();
      return;
    }
    const timer = window.setTimeout(() => {
      signOut();
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [signOut, token]);

  const requestCode = useCallback(async (emailValue: string) => {
    await requestAuthCode(emailValue);
  }, []);

  const verifyCode = useCallback(async (emailValue: string, codeValue: string) => {
    const res = await verifyAuthCode(emailValue, codeValue);
    setStoredToken(res.token);
    setToken(res.token);
    setEmail(res.email);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    token,
    email,
    authDisabled,
    allowedDomain,
    isAuthenticated: authDisabled || Boolean(token),
    requestCode,
    verifyCode,
    signOut,
  }), [status, token, email, authDisabled, allowedDomain, requestCode, verifyCode, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
