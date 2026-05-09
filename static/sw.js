self.addEventListener('push', function(event) {
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return;
  }
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Reminder';
  const options = {
    body: data.body,
    icon: data.icon || '/static/img/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: self.location.origin + '/tasks' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(function(clientList) {
      for (let client of clientList) {
        if (client.url.includes('/tasks') && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow)
        return clients.openWindow('/tasks');
    })
  );
});

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});