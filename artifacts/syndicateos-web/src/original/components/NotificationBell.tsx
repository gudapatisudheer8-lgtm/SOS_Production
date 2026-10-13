import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Check, RefreshCw } from 'lucide-react';
import { api } from '../../adapter/api';
import { enablePush, disablePush, pushState, supportsPush } from '../../adapter/browserPush';

export const NOTIFICATIONS_REFRESH_EVENT = 'sos-notifications-refresh';
export const NOTIFICATION_POLL_MS = 30000;

export interface AppNotification { id: string; projectId?: string | number | null; inventoryId?: string | null; title: string; message: string; createdAt: string; read: boolean }
export interface NotificationFeed { items: AppNotification[]; unread: number }

export function normalizeFeed(raw: any): NotificationFeed {
  const items: AppNotification[] = (Array.isArray(raw?.items) ? raw.items : []).map((n: any) => ({
    id: String(n.id), projectId: n.projectId ?? null, inventoryId: n.inventoryId ?? null, title: String(n.title ?? ''), message: String(n.message ?? ''),
    createdAt: String(n.createdAt ?? ''), read: n.read === true,
  }));
  const unread = Number.isFinite(Number(raw?.unread)) ? Number(raw.unread) : items.filter((n) => !n.read).length;
  return { items, unread };
}

/** Ids that arrived after the first successful fetch (the baseline never alerts). */
export function freshIds(known: Set<string> | null, items: AppNotification[]): string[] {
  if (!known) return [];
  return items.filter((n) => !n.read && !known.has(n.id)).map((n) => n.id);
}

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const browserNotify = typeof window !== 'undefined' && 'Notification' in window;

export const NotificationBell: React.FC<{ identityKey: string }> = ({ identityKey }) => {
  const [feed, setFeed] = useState<NotificationFeed>({ items: [], unread: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [permission, setPermission] = useState<string>(browserNotify ? Notification.permission : 'unsupported');
  const [pushStatus, setPushStatus] = useState('Checking background push…');
  const [pushBusy, setPushBusy] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const inflight = useRef(false);
  const identity = useRef(identityKey);
  const wrap = useRef<HTMLDivElement>(null);

  // Reset everything when the signed-in identity changes.
  useEffect(() => {
    identity.current = identityKey;
    known.current = null;
    setFeed({ items: [], unread: 0 }); setError(null); setLoading(true); setOpen(false);
  }, [identityKey]);

  const load = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    const who = identity.current;
    try {
      const next = normalizeFeed(await api<any>('/notifications'));
      if (who !== identity.current) return;
      known.current = new Set(next.items.map((n) => n.id));
      setFeed(next); setError(null);
    } catch (e: any) {
      if (who === identity.current) setError(e?.message || 'Notifications could not load.');
    } finally {
      inflight.current = false;
      if (who === identity.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => { if (!document.hidden) void load(); }, NOTIFICATION_POLL_MS);
    const onVis = () => { if (!document.hidden) void load(); };
    const onRefresh = () => void load();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', onVis); window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh); };
  }, [identityKey, load]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    pushState().then((value) => { if (alive) setPushStatus(value); }).catch((e) => { if (alive) setPushStatus(e.message); });
    const down = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { alive = false; document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open, identityKey]);

  const markRead = async (id: string) => {
    if (marking) return;
    setMarking(id);
    try {
      await api(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
      setFeed((f) => {
        const was = f.items.find((n) => n.id === id && !n.read);
        return { items: f.items.map((n) => (n.id === id ? { ...n, read: true } : n)), unread: Math.max(0, f.unread - (was ? 1 : 0)) };
      });
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not mark as read.');
    } finally { setMarking(null); }
  };

  const askPermission = async () => {
    setPushBusy(true);
    try { setPushStatus(await enablePush()); }
    catch (e: any) { setPushStatus(e.message || 'Background push subscription failed. The bell remains available.'); }
    finally { setPermission(browserNotify ? Notification.permission : 'unsupported'); setPushBusy(false); }
  };

  const Icon = feed.unread > 0 ? BellRing : Bell;
  return (
    <div ref={wrap} className="relative">
      <button type="button" data-testid="button-notifications" aria-haspopup="dialog" aria-expanded={open}
        aria-label={feed.unread ? `Notifications, ${feed.unread} unread` : 'Notifications'} onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-full border border-stone-200 bg-white hover:border-amber-400 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-500">
        <Icon className={`w-4 h-4 ${feed.unread ? 'text-amber-700' : 'text-stone-600'}`} />
        {feed.unread > 0 && (
          <span data-testid="badge-unread" className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center">
            {feed.unread > 99 ? '99+' : feed.unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white rounded-2xl border border-stone-200 shadow-lg overflow-hidden z-50">
          <div className="px-4 py-2.5 bg-[#F7F5EE] border-b border-stone-200 flex items-center justify-between gap-2">
            <span className="text-xs font-black text-slate-900">Notifications{feed.unread ? ` · ${feed.unread} unread` : ''}</span>
            <button type="button" data-testid="button-notifications-refresh" onClick={() => void load()} aria-label="Refresh notifications" className="text-stone-500 hover:text-slate-900">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {error && (
            <div role="alert" className="px-4 py-2 text-[11px] font-bold text-red-700 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => void load()} className="underline">Retry</button>
            </div>
          )}
          <ul className="max-h-[min(24rem,60dvh)] overflow-y-auto divide-y divide-stone-100">
            {loading && feed.items.length === 0 ? (
              [0, 1, 2].map((i) => <li key={i} className="px-4 py-3 space-y-1.5 animate-pulse"><div className="h-2.5 w-2/3 bg-stone-200 rounded" /><div className="h-2 w-full bg-stone-100 rounded" /></li>)
            ) : feed.items.length === 0 ? (
              <li className="px-4 py-6 text-center text-[11px] text-stone-500">Nothing new. Recorded entries, refer-backs and corrections appear here.</li>
            ) : feed.items.map((n) => (
              <li key={n.id} data-testid={`notification-${n.id}`} className={`px-4 py-3 flex gap-2 ${n.read ? '' : 'bg-amber-50/60'}`}>
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-stone-300' : 'bg-amber-500'}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className={`text-xs ${n.read ? 'font-semibold text-stone-700' : 'font-black text-slate-900'}`}>{n.title}</div>
                  <p className="text-[11px] text-stone-600 break-words">{n.message}</p>
                  {n.projectId && n.inventoryId && <button type="button" data-testid={`open-registration-${n.id}`}
                    onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('sos-open-registration', { detail: { projectId: String(n.projectId), inventoryId: n.inventoryId } })); }}
                    className="block text-[11px] font-bold text-blue-800 underline mt-1">Open plot booking form</button>}
                  <span className="text-[10px] text-stone-400 font-mono">{fmt(n.createdAt)}</span>
                </div>
                {!n.read && (
                  <button type="button" data-testid={`button-mark-read-${n.id}`} disabled={marking === n.id} onClick={() => void markRead(n.id)}
                    aria-label="Mark as read" className="self-start p-1 rounded-lg text-stone-500 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-40">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="px-4 py-2 border-t border-stone-100 text-[10px] text-stone-500">
            <p role="status">{pushStatus}</p>
            {supportsPush() && permission !== 'denied' && <div className="flex flex-wrap gap-3 mt-1">
              <button type="button" disabled={pushBusy} data-testid="button-enable-browser-alerts" onClick={() => void askPermission()} className="font-bold text-amber-800 hover:underline disabled:opacity-40">Enable / repair background alerts</button>
              <button type="button" disabled={pushBusy} onClick={async () => {
                setPushBusy(true);
                try { await disablePush(); setPushStatus('Background alerts disabled for this browser. The bell remains available.'); }
                catch (e: any) { setPushStatus(e.message); }
                finally { setPushBusy(false); }
              }} className="font-bold underline disabled:opacity-40">Disable alerts</button>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
};
