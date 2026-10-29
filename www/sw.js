/* TerraPin 4.0 — shell offline actualizable. */
const CACHE = 'terrapin-shell-v4.3';
const SHELL = [
  './', './index.html', './app.js', './manifest.json', './icon-192.png', './icon-512.png', './jspdf.umd.min.js', './shp.min.js', './shpwrite.js', './jszip.min.js',
  './leaflet/leaflet.js', './leaflet/leaflet.css', './leaflet/images/marker-icon.png', './leaflet/images/marker-icon-2x.png', './leaflet/images/marker-shadow.png'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil((async()=>{ const ks=await caches.keys(); await Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))); await self.clients.claim(); const cs=await self.clients.matchAll({type:'window'}); await Promise.all(cs.map(c=>c.navigate(c.url).catch(()=>null))); })()); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const same = u.origin === self.location.origin;
  const externalShell = u.hostname.startsWith('fonts.');
  if (!same && !externalShell) return;
  if (same) {
    e.respondWith(fetch(e.request).then(r=>{ if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone())); return r; }).catch(()=>caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(hit=>hit || fetch(e.request).then(r=>{ if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone())); return r; })));
  }
});
