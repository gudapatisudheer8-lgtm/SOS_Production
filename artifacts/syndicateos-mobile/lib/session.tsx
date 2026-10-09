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
import * as SecureStore from 'expo-secure-store';
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

const KEY = 'syndicateos.session.token';

// Tokens: sessionStorage on web (survives reload only), secure storage on native.
const store = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(KEY);
    }
    return SecureStore.getItemAsync(KEY);
  },
  async set(v: string) {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(KEY, v);
      return;
    }
    await SecureStore.setItemAsync(KEY, v);
  },
  async del() {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(KEY);
      return;
    }
    await SecureStore.deleteItemAsync(KEY);
  },
};

let memToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);
setAuthTokenGetter(() => memToken);

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
  phase: 'booting' | 'anon' | 'authed';
  account: SessionAccount | null;
  bootError: string | null;
  signIn: (r: LoginResult) => Promise<void>;
  signOut: () => Promise<void>;
  retryBoot: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [phase, setPhase] = useState<AuthValue['phase']>('booting');
  const [account, setAccount] = useState<SessionAccount | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const clear = useCallback(async () => {
    memToken = null;
    let delFailed = false;
    await store.del().catch(() => {
      delFailed = true;
    });
    queryClient.clear();
    if (delFailed) setBootError('Secure storage could not clear the saved session on this device.');
    setAccount(null);
    setPhase('anon');
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
        t = await store.get();
      } catch {
        if (alive) {
          setBootError('Secure storage could not be read on this device, so your saved session cannot be restored. Sign in again.');
          setPhase('anon');
        }
        return;
      }
      if (!t) {
        if (alive) setPhase('anon');
        return;
      }
      memToken = t;
      try {
        const me = await getMe();
        if (alive) {
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
  }, [attempt, clear]);

  const signIn = useCallback(async (r: LoginResult) => {
    try {
      await store.set(r.token);
    } catch {
      memToken = null;
      throw new Error('Secure storage is unavailable on this device, so the session was not started.');
    }
    memToken = r.token;
    setBootError(null);
    queryClient.clear();
    setAccount(r.account);
    setPhase('authed');
  }, []);

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
    () => ({ phase, account, bootError, signIn, signOut, retryBoot }),
    [phase, account, bootError, signIn, signOut, retryBoot],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
