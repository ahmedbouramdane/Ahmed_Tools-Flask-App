// Service Worker Registration & Push Setup
if ('serviceWorker' in navigator && 'PushManager' in window) {
  const swUrl = '/static/sw.js';
  navigator.serviceWorker.register(swUrl)
    .then(reg => {
      if (Notification.permission === 'denied') return;
      if (Notification.permission === 'granted') {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) saveSubscription(sub);
        });
      }
    })
    .catch(() => {});
}

function saveSubscription(sub) {
  fetch('/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub)
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}
