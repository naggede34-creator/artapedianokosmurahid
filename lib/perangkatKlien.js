// Sidik perangkat sisi-klien. Dipasang sekali di UserProvider: setiap permintaan ke /api/ membawa header
// `x-perangkat: <id perangkat>.<sidik jari>`.
//
//  • id perangkat  : acak, disimpan di localStorage DAN cookie (bertahan bila salah satunya dihapus).
//  • sidik jari    : hash sifat peramban/layar/kanvas — tidak unik mutlak (ponsel sejenis bisa sama) sehingga
//                    server hanya memakainya sebagai sinyal PENDUKUNG, bukan satu-satunya dasar ban.
//
// Ini bukan pengaman mutlak (pengguna mahir bisa memalsukannya); server tetap memeriksa IP sebagai lapisan lain.
const KUNCI = "artapedia_dev";
let idCache = null;
let fpCache = null;
let terpasang = false;

const acak = () => {
  try { const b = new Uint8Array(12); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(""); } catch {}
  return (Math.random().toString(16).slice(2) + Date.now().toString(16)).padEnd(24, "0").slice(0, 24);
};

// cyrb53: hash sinkron yang cepat & cukup tersebar.
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function bacaCookie() {
  try { return (document.cookie.match(new RegExp(`(?:^|; )${KUNCI}=([a-f0-9]{16,48})`)) || [])[1] || null; } catch { return null; }
}
function tulisCookie(v) {
  try { document.cookie = `${KUNCI}=${v}; max-age=${60 * 60 * 24 * 730}; path=/; SameSite=Lax`; } catch {}
}

export function idPerangkat() {
  if (idCache) return idCache;
  let v = null;
  try { v = localStorage.getItem(KUNCI); } catch {}
  if (!v || !/^[a-f0-9]{16,48}$/.test(v)) v = bacaCookie();
  if (!v || !/^[a-f0-9]{16,48}$/.test(v)) v = acak();
  try { localStorage.setItem(KUNCI, v); } catch {}
  tulisCookie(v);
  idCache = v;
  return v;
}

export function sidikJari() {
  if (fpCache) return fpCache;
  const bagian = [];
  try {
    const n = navigator, s = screen;
    bagian.push(n.userAgent, n.language, (n.languages || []).join(","), n.platform, n.hardwareConcurrency, n.deviceMemory, n.maxTouchPoints,
      s.width, s.height, s.colorDepth, window.devicePixelRatio, Intl.DateTimeFormat().resolvedOptions().timeZone, new Date().getTimezoneOffset());
  } catch {}
  try {
    const c = document.createElement("canvas");
    c.width = 140; c.height = 30;
    const g = c.getContext("2d");
    g.textBaseline = "top"; g.font = "16px Arial"; g.fillStyle = "#f60"; g.fillRect(10, 2, 60, 20);
    g.fillStyle = "#069"; g.fillText("Artapedia ✓ 0Ol1", 4, 6);
    bagian.push(c.toDataURL().slice(-120));
  } catch {}
  fpCache = hash(bagian.join("|")).padStart(14, "0").slice(0, 14);
  return fpCache;
}

/** Membungkus window.fetch: permintaan ke /api/ milik sendiri membawa header x-perangkat. Aman dipanggil berulang. */
export function pasangPenyadapPerangkat() {
  if (terpasang || typeof window === "undefined" || typeof window.fetch !== "function") return;
  terpasang = true;
  const asli = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const url = typeof input === "string" ? input : input?.url || "";
      const dalam = url.startsWith("/api/") || url.startsWith(`${location.origin}/api/`);
      if (dalam) {
        const h = new Headers(init?.headers || (typeof input !== "string" ? input.headers : undefined) || {});
        if (!h.has("x-perangkat")) h.set("x-perangkat", `${idPerangkat()}.${sidikJari()}`);
        return asli(input, { ...(init || {}), headers: h });
      }
    } catch {}
    return asli(input, init);
  };
}
