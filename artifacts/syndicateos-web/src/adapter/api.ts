// Adapter between the original SyndicateOS web UI and the existing Spring Boot API.
// The API artifact is registered at /api on the same origin. Do not send API
// requests through the web artifact's route or its development-only Vite proxy.
import type { AuthenticatedAppUser } from '../original/types';

const API_ROOT = '/api';
// An absolute same-origin URL also bypasses the legacy /api/* fetch bridge
// during hot updates, without hardcoding any development or production host.
const apiUrl = (path: string) => new URL(`${API_ROOT}${path}`, window.location.origin).href;
const TOKEN_KEY = 'sos_web_session_token';
let pendingCredential: string | null = null;
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
  try { return window.sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}
// Session bearer lives in sessionStorage only (cleared when the tab closes). Failure to
// persist or remove it is surfaced, never swallowed.
export function setToken(token: string | null) {
  try {
    window.localStorage.removeItem(TOKEN_KEY); // purge tokens written by earlier builds
    if (token) {
      window.sessionStorage.setItem(TOKEN_KEY, token);
      if (window.sessionStorage.getItem(TOKEN_KEY) !== token) throw new Error("verify");
    } else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    if (token) { try { window.sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }
    throw new ApiError(0, "STORAGE_UNAVAILABLE", "This browser blocked session storage, so you cannot be signed in securely. Enable site storage and try again.");
  }
}
export function clearSession() {
  pendingCredential = null;
  try { window.sessionStorage.removeItem(TOKEN_KEY); } catch { /* nothing more can be done */ }
  try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

/** Client mobile: ten digits (+91 added). Owner: a full international number is kept as entered. */
export function normalizeClientMobile(v: string): string { return "+91" + v.replace(/\D/g, "").slice(-10); }
export function normalizeOwnerMobile(v: string): string {
  const t = v.replace(/[\s()-]/g, "");
  const digits = t.replace(/\D/g, "");
  if (t.startsWith("+")) return "+" + digits;
  if (/^[6-9]\d{9}$/.test(digits)) return "+91" + digits;
  if (/^91[6-9]\d{9}$/.test(digits)) return "+" + digits;
  return "+" + digits;
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (init.body instanceof FormData) {
    body = init.body;
  } else if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }
  let res: Response;
  try {
    res = await nativeFetch(apiUrl(path), { method: init.method || (body ? 'POST' : 'GET'), headers, body, credentials: 'include', redirect: 'manual' });
  } catch {
    throw new ApiError(0, 'NETWORK', 'The request could not reach the API. Check the Preview connection and retry.');
  }
  assertNoAccessRedirect(res);
  const text = await res.text();
  let data: any = null;
  let parsed = true;
  try { data = text ? JSON.parse(text) : null; } catch { parsed = false; }
  if (res.ok && text && !parsed) {
    throw new ApiError(res.status, 'UNEXPECTED_RESPONSE', 'Preview returned a web page instead of an API response. Reopen Preview in Replit and retry.');
  }
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith("/auth/login")
        && !(path === '/auth/credential' && data?.error === 'INVALID_CREDENTIALS')) {
      clearSession();
      window.dispatchEvent(new CustomEvent("sos-session-expired"));
    }
    throw new ApiError(res.status, data?.error || `HTTP_${res.status}`, data?.message || `Request failed (HTTP ${res.status}).`);
  }
  return data as T;
}

function assertNoAccessRedirect(response: Response) {
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new ApiError(0, 'PREVIEW_ACCESS_REQUIRED', 'Preview access was redirected. Reopen Preview in Replit to restore access, then retry. This request has not completed.');
  }
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

/** Downloads private project files with the same bearer session as API calls. */
export async function fetchProjectAttachmentBlob(projectId: string, attachmentId: string): Promise<Blob> {
  const token = getToken();
  const response = await nativeFetch(apiUrl(`/erp/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(attachmentId)}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include', redirect: 'manual',
  });
  assertNoAccessRedirect(response);
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new ApiError(response.status, error?.error || 'DOWNLOAD_FAILED', error?.message || 'Could not load this private project document.');
  }
  return response.blob();
}
export async function downloadProjectAttachment(projectId: string, attachmentId: string) {
  const token = getToken();
  const response = await nativeFetch(apiUrl(`/erp/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(attachmentId)}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include', redirect: 'manual',
  });
  assertNoAccessRedirect(response);
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new ApiError(response.status, error?.error || 'DOWNLOAD_FAILED', error?.message || 'Could not download this project document.');
  }
  const disposition = response.headers.get('Content-Disposition') || '';
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const name = encodedName ? decodeURIComponent(encodedName) : disposition.match(/filename="([^"]+)"/)?.[1] || 'document';
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// The original components call their own Express routes. Translate the ones that exist in
// the Spring API; reject everything else explicitly so no action appears to succeed.
export function installOriginalFetchBridge() {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    // These are real Spring endpoints, not legacy prototype operations.
    // Request resolves relative URLs and prevents an older hot-loaded bridge
    // from intercepting this forwarding call again.
    if (/^\/api\/(?:commands(?:\/|$)|erp(?:\/|$)|marketing(?:\/|$)|configuration(?:\/|$)|workspace(?:\?|$)|healthz(?:\?|$)|readyz(?:\?|$))/.test(url)) {
      return nativeFetch(new Request(input, { ...init, redirect: 'manual' }));
    }
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
            ? { role: 'CLIENT', mobile: normalizeClientMobile(String(body.phone)), credential: body.pin, clientCode: body.firmCode }
            : { role: 'OWNER', mobile: normalizeOwnerMobile(String(body.phone)), credential: body.pin },
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
