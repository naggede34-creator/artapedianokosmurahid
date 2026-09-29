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
