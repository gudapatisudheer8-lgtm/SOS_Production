import { api } from './api';
const base = import.meta.env.BASE_URL;
const PUSH_ID_KEY = 'sos-browser-push-id';
export const supportsPush = () => window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
function decodeKey(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
export async function enablePush() {
  if (!supportsPush()) throw new Error('Background push is unsupported here. On iPhone/iPad, add this site to the Home Screen first. The bell remains available.');
  const config = await api<any>('/browser-push');
  if (!config.configured) throw new Error(config.error);
  // Explicit user action only, never request on page load.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Browser notifications were not permitted. Change the browser site settings to enable them; the bell remains available.');
  const registration = await navigator.serviceWorker.register(`${base}registration-push-sw.js`, { scope: base });
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const priorKey = subscription.options.applicationServerKey;
    const configuredKey = decodeKey(config.publicKey);
    if (priorKey && Array.from(new Uint8Array(priorKey)).join(',') !== Array.from(configuredKey).join(',')) {
      await subscription.unsubscribe(); subscription = null;
    }
  }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(config.publicKey) });
  try {
    const saved = await api<any>('/browser-push', { body: subscription.toJSON() });
    localStorage.setItem(PUSH_ID_KEY, String(saved.id));
    return 'Background push subscribed. Delivery depends on browser/OS settings; the bell remains available.';
  } catch (e) { await subscription.unsubscribe(); throw e; }
}
export async function disablePush() {
  const id = localStorage.getItem(PUSH_ID_KEY);
  let serverError: unknown;
  try { if (id) await api(`/browser-push/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  catch (e) { serverError = e; }
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration(base);
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription && !await subscription.unsubscribe())
      throw new Error('This browser could not disable background alerts. Retry before signing out on a shared device.');
  } else if (serverError) throw serverError;
  localStorage.removeItem(PUSH_ID_KEY);
  return serverError ? 'Alerts are disabled on this device. Server cleanup could not be confirmed; dead endpoints are disabled on delivery failure.' : 'Background alerts disabled on this device.';
}
export async function pushState(): Promise<string> {
  if (!supportsPush()) return 'Background push is unsupported here. On iPhone/iPad, use the installed Home Screen web app. The bell remains available.';
  if (Notification.permission === 'denied') return 'Browser notifications are blocked in this browser’s site settings. The bell remains available.';
  const config = await api<any>('/browser-push');
  if (!config.configured) return config.error;
  const id = localStorage.getItem(PUSH_ID_KEY);
  const registered = config.subscriptions.find((s: any) => s.id === id);
  if (registered?.lastError) return registered.lastError;
  const worker = await navigator.serviceWorker.getRegistration(base);
  const subscription = await worker?.pushManager.getSubscription();
  if (registered?.enabled && subscription && Notification.permission === 'granted')
    return 'Background push subscribed. Browser/OS restrictions may delay delivery; the bell remains available.';
  return 'Background push is not subscribed for this account. Enable alerts below; the bell remains available.';
}
