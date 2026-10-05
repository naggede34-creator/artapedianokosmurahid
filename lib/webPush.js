// Notifikasi push web (Web Push + VAPID).
//
// Prinsip:
//   • Tidak butuh pengaturan: pasangan kunci VAPID dibuat otomatis saat pertama
//     dipakai dan disimpan (privatnya terenkripsi). Kalau admin mengisi
//     VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (web atau Vercel), itu yang dipakai.
//   • Pengiriman TIDAK PERNAH melempar dan tidak pernah menahan transaksi:
//     push hanyalah kabar tambahan.
//   • Isi push tidak memuat kode OTP: layar kunci bisa dilihat siapa saja.
//   • Langganan yang mati (404/410) dibuang sendiri.
// web-push dimuat saat dipakai saja (bukan di awal modul): ringan untuk bundel & aman di platform non-Node penuh.
const muatWebPush = async () => (await import("web-push")).default;
import { pushLanggananCol, pushKunciCol } from "@/lib/db";
import { cfg, sandi, bukaSandi } from "@/lib/config";

const MAKS_PERANGKAT = 5;
const TIMEOUT_MS = 6000;

let cacheKunci = null;

/** Pasangan kunci VAPID: dari konfigurasi kalau ada, kalau tidak dibuat & disimpan otomatis. */
export async function ambilVapid() {
  if (cacheKunci) return cacheKunci;
  const pubCfg = String((await cfg("VAPID_PUBLIC_KEY")) || "").trim();
  const privCfg = String((await cfg("VAPID_PRIVATE_KEY")) || "").trim();
  const subject = String((await cfg("VAPID_SUBJECT")) || "mailto:admin@artapedia.id");
  if (pubCfg && privCfg) {
    cacheKunci = { publik: pubCfg, privat: privCfg, subject };
    return cacheKunci;
  }
  const col = await pushKunciCol();
  let dok = await col.findOne({ _id: "vapid" });
  if (!dok) {
    const webpush = await muatWebPush();
    const k = webpush.generateVAPIDKeys();
    try {
      await col.insertOne({ _id: "vapid", publik: k.publicKey, privat: sandi(k.privateKey), createdAt: new Date() });
    } catch (err) {
      // Dua permintaan pertama bersamaan: yang kalah membaca punya pemenang.
      if (err?.code !== 11000) throw err;
    }
    dok = await col.findOne({ _id: "vapid" });
  }
  const privat = bukaSandi(dok.privat);
  if (!privat) throw new Error("Kunci VAPID tersimpan tidak terbaca (kunci enkripsi berganti?). Isi VAPID_* manual.");
  cacheKunci = { publik: dok.publik, privat, subject };
  return cacheKunci;
}

export function lupakanKunciPush() {
  cacheKunci = null;
}

const layakEndpoint = (e) => typeof e === "string" && /^https:\/\/[^\s]{10,1000}$/.test(e);

/** Menyimpan (atau menimpa) langganan satu perangkat. */
export async function simpanLangganan(token, sub, ua = "") {
  if (!token || !layakEndpoint(sub?.endpoint) || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return { ok: false, error: "Data langganan tidak valid." };
  }
  const col = await pushLanggananCol();
  await col.updateOne(
    { endpoint: sub.endpoint },
    {
      $set: { token, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) }, ua: String(ua).slice(0, 200), updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
  // Batas perangkat per akun: yang terlama dibuang, supaya satu akun tidak
  // menumpuk ratusan langganan.
  const semua = await col.find({ token }).sort({ updatedAt: -1 }).toArray();
  for (const lama of semua.slice(MAKS_PERANGKAT)) await col.deleteOne({ endpoint: lama.endpoint });
  return { ok: true };
}

export async function hapusLangganan(token, endpoint) {
  const col = await pushLanggananCol();
  await col.deleteOne({ endpoint: String(endpoint), token });
  return { ok: true };
}

export async function adaLangganan(token) {
  const col = await pushLanggananCol();
  return (await col.countDocuments({ token })) > 0;
}

/**
 * Mengirim satu notifikasi ke semua perangkat milik akun.
 * @param {string} token akun tujuan
 * @param {{judul:string, isi:string, url?:string, tag?:string}} p
 * @returns {Promise<number>} jumlah perangkat yang berhasil
 */
export async function kirimPush(token, { judul, isi, url = "/", tag } = {}) {
  try {
    if (!token) return 0;
    const col = await pushLanggananCol();
    const daftar = await col.find({ token }).limit(MAKS_PERANGKAT).toArray();
    if (!daftar.length) return 0;
    const v = await ambilVapid();
    const muatan = JSON.stringify({ judul: String(judul || "ARTA PEDIA"), isi: String(isi || ""), url, tag: tag || undefined });
    let berhasil = 0;
    await Promise.allSettled(
      daftar.map(async (d) => {
        try {
          await (await muatWebPush()).sendNotification({ endpoint: d.endpoint, keys: d.keys }, muatan, {
            vapidDetails: { subject: v.subject, publicKey: v.publik, privateKey: v.privat },
            TTL: 3600,
            urgency: "high",
            timeout: TIMEOUT_MS
          });
          berhasil++;
        } catch (err) {
          // 404/410: perangkatnya sudah berhenti berlangganan — buang.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await col.deleteOne({ endpoint: d.endpoint }).catch(() => {});
          } else {
            console.error("[push] gagal kirim:", err?.statusCode || err?.message || err);
          }
        }
      })
    );
    return berhasil;
  } catch (err) {
    console.error("[push]", err?.message || err);
    return 0;
  }
}

/**
 * Seperti kirimPush tapi dibatasi waktu: dipakai di jalur permintaan pengguna
 * supaya push yang lambat tidak menahan jawaban. Serverless membekukan fungsi
 * begitu respons terkirim, jadi push yang "dilepas" tanpa ditunggu bisa tidak
 * pernah terkirim.
 */
export async function kirimPushCepat(token, isi, batasMs = 3000) {
  return Promise.race([kirimPush(token, isi), new Promise((r) => setTimeout(() => r(0), batasMs))]);
}
