// Adapter between the original SyndicateOS web UI and the existing Spring Boot API.
// All requests go through the artifact-scoped Vite proxy: <BASE_PATH>api/* -> Spring /api/*.
import type { AuthenticatedAppUser } from '../original/types';

const API_ROOT = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;
const TOKEN_KEY = 'sos_web_session_token';
const nativeFetch: typeof fetch = window.fetch.bind(window);

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }
  let res: Response;
  try {
    res = await nativeFetch(`${API_ROOT}${path}`, { method: init.method || (body ? 'POST' : 'GET'), headers, body, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the SyndicateOS API service. Check that the API server is running.');
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `HTTP_${res.status}`, data?.message || `Request failed (HTTP ${res.status}).`);
  }
  return data as T;
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

// ---- Session mapping ----
export interface SessionAccount {
  identityId: string;
  role: 'OWNER' | 'ACCOUNTANT' | 'PARTNER';
  displayName: string;
  mobile: string;
  mustChangeCredential: boolean;
  firmId?: string;
  clientCode?: string;
}

export function toAppUser(a: SessionAccount): AuthenticatedAppUser {
  return {
    id: a.identityId,
    phone: a.mobile,
    name: a.displayName,
    role: a.role === 'OWNER' ? 'super_admin' : a.role === 'ACCOUNTANT' ? 'accountant' : 'field_partner',
    firmId: a.firmId || null,
    firmCode: a.clientCode || null,
    partnerId: a.role === 'PARTNER' ? a.identityId : null,
    mustChangePin: a.mustChangeCredential,
  };
}

// Current credential is held in memory only, for the mandatory first-login change.
let pendingCredential: string | null = null;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// The original components call their own Express routes. Translate the ones that exist in
// the Spring API; reject everything else explicitly so no action appears to succeed.
export function installOriginalFetchBridge() {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    if (!url.startsWith('/api/')) return nativeFetch(input as any, init);
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
    try {
      if (url.startsWith('/api/auth/validate-firm/')) {
        const code = decodeURIComponent(url.split('/').pop() || '');
        const r = await api<{ clientCode: string; name: string }>('/auth/company', { body: { clientCode: code } });
        return json(200, { valid: true, firm: { id: '', name: r.name, code: r.clientCode, location: '', state: '' } });
      }
      if (url === '/api/auth/login') {
        const isMember = Boolean(body.firmCode);
        const r = await api<{ token: string; account: SessionAccount }>('/auth/login', {
          body: isMember
            ? { role: 'CLIENT', mobile: body.phone, credential: body.pin, clientCode: body.firmCode }
            : { role: 'OWNER', mobile: body.phone, credential: body.pin },
        });
        setToken(r.token);
        pendingCredential = r.account.mustChangeCredential ? body.pin : null;
        return json(200, { success: true, user: toAppUser(r.account) });
      }
      if (url === '/api/auth/change-pin') {
        if (!pendingCredential) {
          return json(409, { success: false, error: 'Your current credential is required. Sign out and sign in again to change it.' });
        }
        const r = await api<{ token: string; account: SessionAccount }>('/auth/credential', {
          body: { currentCredential: pendingCredential, newCredential: body.newPin },
        });
        setToken(r.token);
        pendingCredential = null;
        return json(200, { success: true, user: toAppUser(r.account) });
      }
      return json(501, { success: false, error: `This original operation (${url}) is not available in the SyndicateOS API yet.` });
    } catch (e) {
      const err = e as ApiError;
      return json(err.status || 500, { success: false, valid: false, error: err.message });
    }
  };
}
