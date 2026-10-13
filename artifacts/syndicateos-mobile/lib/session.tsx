import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import { mobileApiBase } from './api-base';
import * as SecureStore from 'expo-secure-store';
import { usePathname } from 'expo-router';
import {
  focusManager,
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import {
  getMe,
  logout,
  setAuthTokenGetter,
  setBaseUrl,
  type LoginResult,
  type SessionAccount,
} from '@workspace/api-client-react';

type Portal = 'owner' | 'client';
const sessionKey = (portal: Portal) => `syndicateos.${portal}.session.token`;

// Tokens: sessionStorage on web (survives reload only), secure storage on native.
const store = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async set(v: string, key: string) {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, v);
      return;
    }
    await SecureStore.setItemAsync(key, v);
  },
  async del(key: string) {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

let memToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

const domain = process.env.EXPO_PUBLIC_DOMAIN;
setBaseUrl(mobileApiBase(Platform.OS, domain) || null);
setAuthTokenGetter(() => memToken);
export const currentToken = () => memToken;

if (Platform.OS !== 'web') {
  focusManager.setEventListener((handle) => {
    const sub = AppState.addEventListener('change', (s) => handle(s === 'active'));
    return () => sub.remove();
  });
}

type HttpErr = { status: number; data?: unknown; message?: string };
function asHttp(e: unknown): HttpErr | null {
  if (e && typeof e === 'object' && (e as { name?: unknown }).name === 'ApiError' && typeof (e as HttpErr).status === 'number') return e as HttpErr;
  return null;
}

export function httpStatus(e: unknown): number | null {
  return asHttp(e)?.status ?? null;
}

/** Clears the session only when the error is a 401. */
export function reportError(e: unknown) {
  handleError(e);
}

function handleError(e: unknown) {
  if (asHttp(e)?.status === 401) onUnauthorized?.();
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: { queries: { retry: false } },
});

export function errMessage(e: unknown): string {
  const h = asHttp(e);
  if (h) {
    const d = h.data as { message?: unknown } | null;
    if (d && typeof d === 'object' && typeof d.message === 'string') return d.message;
    if (h.status === 503) return 'The SyndicateOS database is not available yet.';
    return h.message ?? 'Request failed.';
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}

export function isUnavailable(e: unknown) {
  return asHttp(e)?.status === 503;
}

interface AuthValue {
  portal: Portal;
  phase: 'booting' | 'anon' | 'authed';
  account: SessionAccount | null;
  bootError: string | null;
  signIn: (r: LoginResult) => Promise<void>;
  signOut: () => Promise<void>;
  retryBoot: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const portal: Portal = Platform.OS === 'web' && /^\/owner(?:\/|$)/.test(pathname) ? 'owner' : 'client';
  return <PortalAuthProvider key={portal} portal={portal}>{children}</PortalAuthProvider>;
}

function belongsToPortal(account: SessionAccount, portal: Portal) {
  return portal === 'owner'
    ? account.role === 'OWNER'
    : (account.role === 'ACCOUNTANT' || account.role === 'PARTNER') && !!account.firmId;
}

function PortalAuthProvider({ children, portal }: PropsWithChildren<{ portal: Portal }>) {
  const key = sessionKey(portal);
  const [phase, setPhase] = useState<AuthValue['phase']>('booting');
  const [account, setAccount] = useState<SessionAccount | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const phaseRef = useRef(phase);
  const mounted = useRef(true);
  phaseRef.current = phase;

  const clear = useCallback(async () => {
    if (mounted.current) memToken = null;
    let delFailed = false;
    await store.del(key).catch(() => {
      delFailed = true;
    });
    if (!mounted.current) return;
    queryClient.clear();
    if (delFailed) setBootError('Secure storage could not clear the saved session on this device.');
    setAccount(null);
    setPhase('anon');
  }, [key]);

  useEffect(() => {
    mounted.current = true;
    memToken = null;
    queryClient.clear();
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    onUnauthorized = () => {
      if (phaseRef.current === 'authed') void clear();
    };
    return () => {
      onUnauthorized = null;
    };
  }, [clear]);

  useEffect(() => {
    let alive = true;
    setBootError(null);
    (async () => {
      let t: string | null = null;
      try {
        t = await store.get(key);
      } catch {
        if (alive) {
          setBootError('Secure storage could not be read on this device, so your saved session cannot be restored. Sign in again.');
          setPhase('anon');
        }
        return;
      }
      if (!alive) return;
      if (!t) {
        if (alive) setPhase('anon');
        return;
      }
      memToken = t;
      try {
        const me = await getMe();
        if (alive) {
          if (!belongsToPortal(me, portal)) {
            await clear();
            return;
          }
          setAccount(me);
          setPhase('authed');
        }
      } catch (e) {
        if (!alive) return;
        if (asHttp(e)?.status === 401) {
          await clear();
        } else {
          memToken = null;
          setBootError(errMessage(e));
          setPhase('anon');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt, clear, key, portal]);

  const signIn = useCallback(async (r: LoginResult) => {
    if (!mounted.current || !belongsToPortal(r.account, portal))
      throw new Error('Use the correct sign-in portal for this account.');
    try {
      await store.set(r.token, key);
    } catch {
      if (mounted.current) memToken = null;
      throw new Error('Secure storage is unavailable on this device, so the session was not started.');
    }
    if (!mounted.current) {
      await store.del(key);
      throw new Error('The sign-in page changed. Sign in again.');
    }
    memToken = r.token;
    setBootError(null);
    queryClient.clear();
    setAccount(r.account);
    setPhase('authed');
  }, [key, portal]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Local sign-out proceeds even if the server cannot be reached.
    }
    await clear();
  }, [clear]);

  const retryBoot = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo(
    () => ({ portal, phase, account, bootError, signIn, signOut, retryBoot }),
    [portal, phase, account, bootError, signIn, signOut, retryBoot],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
