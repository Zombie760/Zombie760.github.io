// BOTWAVEBOMBA — PWA Enhancements
// Install prompt logic + push notification support + offline detection

let deferredPrompt = null;
let isOnline = navigator.onLine;

// ── INSTALL PROMPT LOGIC ──
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const prompt = document.getElementById('pwa-install-prompt');
  if (prompt) {
    prompt.style.display = 'flex';
  }
});

// Install button handler
document.addEventListener('click', async (e) => {
  if (e.target.id === 'pwa-install-btn') {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);
    deferredPrompt = null;
    const prompt = document.getElementById('pwa-install-prompt');
    if (prompt) {
      prompt.style.display = 'none';
    }
  }

  if (e.target.id === 'pwa-dismiss-btn') {
    const prompt = document.getElementById('pwa-install-prompt');
    if (prompt) {
      prompt.style.display = 'none';
    }
  }
});

// ── ONLINE/OFFLINE DETECTION ──
window.addEventListener('online', () => {
  isOnline = true;
  document.body.classList.remove('offline');
  console.log('[PWA] Back online');
});

window.addEventListener('offline', () => {
  isOnline = false;
  document.body.classList.add('offline');
  console.log('[PWA] Went offline');
});

// ── PUSH NOTIFICATION SUPPORT ──
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('[PWA] Notifications not supported');
    return false;
  }

  const permission = await Notification.requestPermission();
  console.log('[PWA] Notification permission:', permission);
  return permission === 'granted';
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator)) return null;
  if (!('pushManager' in window)) {
    console.log('[PWA] Push not supported');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      // VAPID public key - replace with your own from botwave-nisa or backend
      'BKddRxu3FHvT1e2HxG8F9qJ4kL5mN0oP2qR6sT8uV9wX0yZ1aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4yZ5'
    )
  });

  console.log('[PWA] Push subscription:', JSON.stringify(subscription));
  return subscription;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Expose for manual trigger (e.g., settings page)
window.BOTWAVEBOMBA = window.BOTWAVEBOMBA || {};
window.BOTWAVEBOMBA.requestNotifications = requestNotificationPermission;
window.BOTWAVEBOMBA.subscribePush = subscribeToPush;

// ── SERVICE WORKER MESSAGING ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'BLINDSPOT_ALERT') {
      new Notification('BOTWAVEBOMBA Blindspot', {
        body: event.data.title,
        icon: (window.BWB_URL ? window.BWB_URL('assets/icons/icon-192.png') : '/assets/icons/icon-192.png'),
        badge: (window.BWB_URL ? window.BWB_URL('assets/icons/icon-192.png') : '/assets/icons/icon-192.png'),
        tag: event.data.id,
        requireInteraction: false
      });
    }
  });
}

// ── INITIAL STATE CHECK ──
if (!isOnline) {
  document.body.classList.add('offline');
}
console.log('[PWA] Initialized · Online:', isOnline);
