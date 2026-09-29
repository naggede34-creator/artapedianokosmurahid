// Komisi reseller: selisih markup resellernya atas harga situs.
//
// ─────────────────────────────────────────────────────────────────────────
// KENAPA ADA KOLEKSI SENDIRI, BUKAN CUMA $inc DI DOKUMEN BOTNYA
//
// Menambah komisi langsung ke dokumen bot itu satu baris, dan satu baris itu
// tidak punya cara tahu apakah ia sudah pernah dijalankan untuk pesanan yang
// sama. Satu pemanggilan ulang — percobaan ulang jaringan, dua permintaan
// bersamaan, kode baru setahun lagi yang memanggilnya dari tempat lain —
// menggandakan komisinya, dan tidak ada yang bisa membuktikan itu terjadi.
//
// Dengan catatan per pesanan dan indeks unik pada orderId, percobaan kedua
// DITOLAK DATABASE. Catatannya ditulis LEBIH DULU, baru komisinya ditambahkan:
// urutan itu yang mengubah indeks uniknya dari pendeteksi jadi PENCEGAH.
// ─────────────────────────────────────────────────────────────────────────
import { botsCol, resellerKomisiCol } from "@/lib/db";

/**
 * Harga jual di bot reseller.
 *
 * Markup resellernya dihitung di atas harga situs (yang sudah termasuk markup
 * situs), bukan di atas harga modal. Reseller melihat harga situs sebagai
 * modalnya sendiri, jadi "markup 10%" harus berarti 10% dari yang ia lihat —
 * bukan angka lain yang harus ia hitung sendiri.
 */
export function hargaResellerDari(hargaSitus, markupPersen, hargaModalReseller = null) {
  const dasar = Math.max(0, Math.round(Number(hargaSitus) || 0));
  const m = Math.max(0, Number(markupPersen) || 0);
  // Potongan grosir (lib/resellerPaket.js) menurunkan MODAL reseller, bukan
  // harga jual: pembeli membayar sama, selisihnya jadi tambahan komisi. Tidak
  // pernah di atas harga situs.
  const modal = hargaModalReseller == null ? dasar : Math.min(dasar, Math.max(0, Math.round(Number(hargaModalReseller) || 0)));
  const harga = dasar && m ? Math.ceil(dasar * (1 + m / 100)) : dasar;
  // Tanpa markup dan tanpa potongan tetap tidak ada komisi. Dengan potongan
  // grosir, komisi bisa ada walau markup 0 — potongannya sendiri komisinya.
  return { harga, komisi: Math.max(0, harga - modal) };
}

/**
 * Mencatat komisi satu penjualan.
 *
 * Selalu mengembalikan objek, tidak pernah melempar: komisi yang gagal dicatat
 * tidak boleh menggagalkan pesanan yang nomornya SUDAH diberikan ke pembeli.
 * Yang gagal tercatat di log dan bisa diperbaiki; pesanan yang dibatalkan
 * sesudah nomornya keluar tidak bisa.
 */
export async function catatKomisi({ botId, orderId, pemilikToken, komisi, hargaJual, hargaSitus, hargaGrosir = null, serviceName, countryName }) {
  const nominal = Math.round(Number(komisi) || 0);
  if (!botId || !orderId || nominal <= 0) return { ok: true, berubah: false };

  try {
    const col = await resellerKomisiCol();

    // Ditulis DULU. Kalau ini ditolak indeks unik, berarti pesanan ini sudah
    // pernah dihitung dan penambahan saldonya di bawah tidak pernah jalan.
    try {
      await col.insertOne({
        orderId: String(orderId),
        botId: String(botId),
        pemilikToken: pemilikToken || null,
        komisi: nominal,
        hargaJual: Math.round(Number(hargaJual) || 0),
        hargaSitus: Math.round(Number(hargaSitus) || 0),
        ...(hargaGrosir != null ? { hargaGrosir: Math.round(Number(hargaGrosir) || 0) } : {}),
        // Baru true saat kode OTP-nya masuk. Omzet level & bonus target hanya
        // menghitung yang selesai: beli lalu batal tidak boleh menaikkan level.
        selesai: false,
        serviceName: serviceName || null,
        countryName: countryName || null,
        createdAt: new Date()
      });
    } catch (err) {
      if (err?.code === 11000) {
        console.error(`[komisi] pesanan ${orderId} sudah pernah dihitung — percobaan kedua ditolak indeks unik.`);
        return { ok: true, berubah: false, duplikat: true };
      }
      throw err;
    }

    const bots = await botsCol();
    await bots.updateOne({ botId: String(botId) }, { $inc: { komisi: nominal, jumlahTerjual: 1 } });
    return { ok: true, berubah: true, komisi: nominal };
  } catch (err) {
    console.error("[komisi] gagal mencatat:", err?.message || err);
    return { ok: false, berubah: false };
  }
}

/**
 * Mengembalikan komisi saat pesanannya direfund.
 *
 * Tanpa ini, pembeli dapat uangnya kembali DAN resellernya tetap dapat
 * komisi — uang yang tidak pernah ada. Klaimnya atomik lewat status di dalam
 * filter, supaya pembatalan yang terjadi dua kali tidak memotong dua kali.
 */
export async function tarikKomisi(orderId) {
  if (!orderId) return { ok: true, berubah: false };
  try {
    const col = await resellerKomisiCol();
    const c = await col.findOneAndUpdate(
      { orderId: String(orderId), ditarik: { $ne: true } },
      { $set: { ditarik: true, ditarikAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!c) return { ok: true, berubah: false };

    const bots = await botsCol();
    // Komisinya boleh membuat saldo jadi minus kalau resellernya keburu
    // menarik. Itu utang yang benar, dan lebih jujur daripada diam-diam
    // membiarkan komisi dari pesanan yang dibatalkan tetap jadi miliknya.
    await bots.updateOne({ botId: c.botId }, { $inc: { komisi: -c.komisi, jumlahTerjual: -1 } });
    return { ok: true, berubah: true, komisi: c.komisi };
  } catch (err) {
    console.error("[komisi] gagal menarik:", err?.message || err);
    return { ok: false, berubah: false };
  }
}
