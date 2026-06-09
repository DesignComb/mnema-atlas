// Minimal service worker — enough to make Mnema installable + offline-tolerant
// for the app shell. It NEVER touches the API (different origin) or Supabase, so
// data always comes fresh from the network.
const CACHE = 'mnema-v3'
const SHELL = ['/', '/index.html', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE)
      await Promise.allSettled(SHELL.map((u) => c.add(u))) // best-effort, never block install
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // skip API / Supabase / fonts

  // SPA navigations: network-first (fresh app), fall back to the cached shell.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/index.html')))
    return
  }

  // Hashed static assets: cache-first.
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname))) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})

// ── Web Push (Mnema Tempo reminders) ──
self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || 'Mnema Tempo'
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      // 延後 / 已完成 buttons when the sender includes them (task reminders).
      actions: Array.isArray(data.actions) ? data.actions : [],
      data: {
        url: data.url || '/tempo',
        task_id: data.task_id,
        reminder_id: data.reminder_id,
        action_url: data.action_url,
        kind: data.kind,
      },
    }),
  )
})

// Handle a notification action button (done/snooze) WITHOUT opening the app: the
// SW identifies the user by its own push subscription endpoint and POSTs the
// worker's /_action route (url carried in the payload).
async function runNotificationAction(action, d) {
  try {
    const sub = await self.registration.pushManager.getSubscription()
    if (!sub || !d.action_url) return
    await fetch(d.action_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, action, task_id: d.task_id, reminder_id: d.reminder_id }),
    })
    await self.registration.showNotification(action === 'done' ? '已完成 ✓' : '已延後 1 小時 ⏰', {
      body: '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: (d.task_id || 'ota') + '-ack',
      silent: true,
    })
  } catch {
    /* best-effort */
  }
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const d = e.notification.data || {}
  // Action buttons act in the background; a plain click opens the app.
  if ((e.action === 'done' || e.action === 'snooze') && d.action_url) {
    e.waitUntil(runNotificationAction(e.action, d))
    return
  }
  const target = d.url || '/tempo'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          c.navigate(target).catch(() => {})
          return c.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
