// Service worker minimal: hanya untuk (1) memenuhi syarat pemasangan sebagai
// aplikasi dan (2) menampilkan halaman offline saat tidak ada jaringan.
//
// SENGAJA tidak menyimpan cache halaman atau API. Situs ini menampilkan saldo,
// status pesanan, dan kode OTP — data yang basi lebih berbahaya daripada
// halaman yang gagal dimuat. Satu-satunya yang disimpan adalah halaman offline.
const CACHE = "artapedia-offline-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  // Hanya perpindahan halaman. API, gambar, dan skrip lewat tanpa disentuh.
  if (r.method !== "GET" || r.mode !== "navigate") return;
  e.respondWith(fetch(r).catch(() => caches.match(OFFLINE)));
});

// ── Notifikasi push ──────────────────────────────────────────────────────────
// Isi push dikirim server (lib/webPush.js): { judul, isi, url, tag }. Kode OTP
// sengaja tidak ikut di dalamnya — layar kunci bisa dilihat siapa saja.
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { isi: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.judul || "Notifikasi", {
      body: d.isi || "",
      icon: "/api/logo/ikon-192",
      badge: "/api/logo/ikon-192",
      tag: d.tag || undefined,
      renotify: Boolean(d.tag),
      data: { url: d.url || "/" }
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
      for (const w of ws) {
        // Tab yang sudah terbuka dipakai ulang, bukan membuka tab baru.
        if ("focus" in w) {
          w.navigate && w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
