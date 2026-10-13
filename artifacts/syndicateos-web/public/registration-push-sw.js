/* This worker is copied unchanged to both artifact-base and production-root builds.
 * No session token, registration identity document or buyer identity is stored here. */
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload;
    try { payload = event.data.json(); } catch { payload = { title: 'SyndicateOS', body: 'Open the notification bell for details.' }; }
    const url = new URL(self.registration.scope);
    if (/^[0-9a-f-]{36}$/i.test(payload.projectId || '') && /^[0-9a-f-]{36}$/i.test(payload.inventoryId || '')) {
      url.searchParams.set('registrationProject', payload.projectId);
      url.searchParams.set('registrationPlot', payload.inventoryId);
    }
    await self.registration.showNotification(payload.title || 'SyndicateOS', {
      body: payload.body || '', tag: payload.tag || 'sos-registration', renotify: false,
      data: { url: url.href }, icon: new URL('favicon.svg', self.registration.scope).href,
    });
  })());
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || self.registration.scope);
    const scope = new URL(self.registration.scope);
    if (target.origin !== scope.origin || !target.pathname.startsWith(scope.pathname)) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const window of windows) {
      if (window.url.startsWith(self.registration.scope)) {
        await window.focus();
        window.postMessage({ type: 'sos-open-registration', projectId: target.searchParams.get('registrationProject'), inventoryId: target.searchParams.get('registrationPlot') });
        return;
      }
    }
    await self.clients.openWindow(target.href);
  })());
});
