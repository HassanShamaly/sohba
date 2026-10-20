/* v6 — الواجهة: الشبكة أولاً (التحديثات تصل فوراً) · الملفات الثابتة: المخزن أولاً
   · صوت القراء: يُخزَّن عند أول سماع في مخزن دائم لا يُمسح مع التحديثات (يعمل بلا إنترنت) */
const CACHE = 'tasmee6-v1';
const AUDIO_CACHE = 'tasmee-audio';          // دائم عبر الإصدارات
const ASSETS = ['./', './index.html', './matcher.js', './quran.json', './manifest.json',
                './icons/icon-192.png', './icons/icon-512.png'];
const AUDIO_HOST = 'everyayah.com';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.startsWith('tasmee6-') && k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

async function audioResponse(req) {
  const url = req.url.split('#')[0];
  const cache = await caches.open(AUDIO_CACHE);
  const hit = await cache.match(url);
  if (hit) return hit;
  /* طلب كامل بلا Range حتى لا يُخزَّن مقطع جزئي */
  const res = await fetch(url, { mode: 'no-cors', credentials: 'omit' });
  if (res.type === 'opaque' || res.ok) cache.put(url, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
    return res;
  } catch (e) {
    return (await caches.match(req, { ignoreSearch: true })) || caches.match('./index.html');
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname.endsWith(AUDIO_HOST)) { e.respondWith(audioResponse(req)); return; }
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req)); return; }
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && (u.origin === self.location.origin || u.hostname.includes('fonts.g') || u.hostname.includes('cdn.jsdelivr.net'))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});

/* رسائل من الصفحة: حالة مخزن الصوت ومسحه */
self.addEventListener('message', async e => {
  const d = e.data || {};
  if (d.type === 'audioCount') {
    const keys = await (await caches.open(AUDIO_CACHE)).keys();
    e.source && e.source.postMessage({ type: 'audioCount', n: keys.length });
  } else if (d.type === 'audioClear') {
    await caches.delete(AUDIO_CACHE);
    e.source && e.source.postMessage({ type: 'audioCount', n: 0 });
  }
});
