self.addEventListener('push', function (event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'New notification', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'New notification';
  const options = {
    body: payload.body || '',
    icon: '/CF_logo.png',
    badge: '/CF_logo.png',
    data: { url: payload.url || '/dashboard/notifications' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/dashboard/notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

