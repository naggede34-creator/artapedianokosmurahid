// Pengirim webhook keluar yang aman dari SSRF.
//
// Alamat callback ditulis merchant sendiri, jadi server ini akan menghubungi
// alamat yang dipilih orang asing. Tanpa penjagaan, alamat seperti
// https://169.254.169.254/ (metadata cloud) atau https://intranet.internal/
// membuat server kita menjadi perantara untuk membaca jaringan internal.
//
// Penjagaan, semuanya WAJIB:
//   1. hanya https, port 443 atau 8443, tanpa user:password di alamat
//   2. nama host diselesaikan DULU, dan SEMUA alamat hasilnya harus publik
//   3. koneksi dipaku ke alamat yang sudah diperiksa itu (lookup khusus), jadi
//      DNS yang berubah di antara pemeriksaan dan koneksi (DNS rebinding) tidak
//      bisa mengalihkan ke alamat internal
//   4. tanpa redirect (redirect ke alamat internal melewati pemeriksaan 1–3)
//   5. batas waktu dan batas ukuran balasan
//
// Berkas ini sengaja tidak mengimpor apa pun dari proyek supaya bisa diuji sendiri.
import dns from "node:dns";
import net from "node:net";
import https from "node:https";

const PORT_BOLEH = new Set([443, 8443]);

/** true bila alamat IP bukan alamat publik (loopback, privat, link-local, CGNAT, multicast, dst.). */
export function ipBukanPublik(ip) {
  const s = String(ip || "").trim().toLowerCase();
  if (net.isIPv4(s)) {
    const [a, b, c] = s.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;     // CGNAT
    if (a === 169 && b === 254) return true;                // link-local + metadata cloud
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 192 && b === 168) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;   // benchmarking
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 224) return true;                              // multicast, reserved, broadcast
    return false;
  }
  if (net.isIPv6(s)) {
    if (s === "::" || s === "::1") return true;
    const dipetakan = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);    // IPv4 yang dibungkus IPv6
    if (dipetakan) return ipBukanPublik(dipetakan[1]);
    const heks = s.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (heks) {
      const x = parseInt(heks[1], 16), y = parseInt(heks[2], 16);
      return ipBukanPublik(`${x >> 8}.${x & 255}.${y >> 8}.${y & 255}`);
    }
    if (/^f[cd]/.test(s)) return true;                      // fc00::/7 unique local
    if (/^fe[89ab]/.test(s)) return true;                   // fe80::/10 link-local
    if (/^ff/.test(s)) return true;                         // multicast
    if (/^2001:db8/.test(s)) return true;                   // dokumentasi
    return false;
  }
  return true; // bukan IP sama sekali
}

/** Memeriksa bentuk alamat. Mengembalikan { ok, url, host, port } atau { ok:false, alasan }. */
export function periksaAlamat(alamat) {
  let u;
  try { u = new URL(String(alamat || "").trim()); } catch { return { ok: false, alasan: "Alamat tidak valid." }; }
  if (u.protocol !== "https:") return { ok: false, alasan: "Alamat callback harus diawali https://" };
  if (u.username || u.password) return { ok: false, alasan: "Alamat callback tidak boleh memuat user:password." };
  const port = u.port ? Number(u.port) : 443;
  if (!PORT_BOLEH.has(port)) return { ok: false, alasan: "Port callback hanya boleh 443 atau 8443." };
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return { ok: false, alasan: "Alamat tidak valid." };
  if (net.isIP(host)) return { ok: false, alasan: "Pakai nama domain, bukan alamat IP." };
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) {
    return { ok: false, alasan: "Alamat callback harus berupa domain publik." };
  }
  return { ok: true, url: u, host, port };
}

/** Menyelesaikan host dan menolak bila ADA satu saja alamat yang tidak publik. */
async function selesaikanPublik(host, resolver) {
  const daftar = await resolver(host);
  if (!daftar.length) throw new Error("Domain tidak ditemukan.");
  for (const a of daftar) if (ipBukanPublik(a.address)) throw new Error("Domain mengarah ke alamat non-publik.");
  return daftar;
}

const resolverBawaan = (host) => dns.promises.lookup(host, { all: true, verbatim: true });

/**
 * POST JSON. Mengembalikan { ok, status } atau { ok:false, alasan }.
 * `opsi` hanya untuk uji dan hanya bisa diisi dari kode, bukan dari konfigurasi:
 *   resolver, izinkanPrivat, rejectUnauthorized, timeoutMs.
 */
export async function kirimAman(alamat, badan, header = {}, opsi = {}) {
  const cek = periksaAlamat(alamat);
  if (!cek.ok) return { ok: false, alasan: cek.alasan, permanen: true };
  const resolver = opsi.resolver || resolverBawaan;

  let daftar;
  try {
    daftar = opsi.izinkanPrivat ? await resolver(cek.host) : await selesaikanPublik(cek.host, resolver);
  } catch (e) {
    const pesan = String(e?.message || "DNS gagal").slice(0, 120);
    // Domain mengarah ke alamat non-publik = penolakan tetap, tidak perlu diulang.
    return { ok: false, alasan: pesan, permanen: /non-publik/.test(pesan) };
  }
  const tujuan = daftar[0];

  return new Promise((selesai) => {
    const mentah = typeof badan === "string" ? badan : JSON.stringify(badan);
    let beres = false;
    const akhir = (h) => { if (!beres) { beres = true; selesai(h); } };
    const req = https.request(
      {
        host: cek.host,
        port: cek.port,
        path: `${cek.url.pathname}${cek.url.search}`,
        method: "POST",
        servername: cek.host,
        rejectUnauthorized: opsi.rejectUnauthorized !== false,
        timeout: opsi.timeoutMs || 8000,
        // Dipaku ke alamat yang SUDAH diperiksa: tidak ada DNS kedua yang bisa dibelokkan.
        // Node 20+ memanggil lookup dengan { all: true } dan menuntut DAFTAR alamat.
        lookup: (_h, o, cb) => (o && o.all ? cb(null, [{ address: tujuan.address, family: tujuan.family }]) : cb(null, tujuan.address, tujuan.family)),
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(mentah),
          "user-agent": "Artapedia-Gateway/1.0",
          ...header
        }
      },
      (res) => {
        let n = 0;
        res.on("data", (c) => { n += c.length; if (n > 64 * 1024) req.destroy(); });
        res.on("end", () => akhir({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, ...(res.statusCode >= 300 && res.statusCode < 400 ? { alasan: "Redirect tidak diikuti." } : {}) }));
        res.on("error", () => akhir({ ok: false, alasan: "Balasan terputus." }));
      }
    );
    req.on("timeout", () => { req.destroy(); akhir({ ok: false, alasan: "Timeout." }); });
    req.on("error", (e) => akhir({ ok: false, alasan: String(e?.code || e?.message || "Gagal terhubung").slice(0, 80) }));
    req.write(mentah);
    req.end();
  });
}
