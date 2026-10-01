// Penahanan saldo (hold) untuk pembelian yang bisa gagal di tengah jalan.
//
// ─────────────────────────────────────────────────────────────────────────
// MASALAH YANG DIPECAHKAN DI SINI
//
// Alur beli nokos memotong saldo DULU, lalu memanggil provider. Kalau provider
// gagal, saldo dikembalikan di baris berikutnya. Itu benar selama fungsinya
// sempat sampai ke baris itu.
//
// Masalahnya: fungsi serverless bisa DIBUNUH di tengah jalan — batas waktu
// habis, instance-nya dimatikan, atau koneksi database putus tepat di antara
// dua baris itu. Saat itu terjadi, saldo sudah terpotong dan kode
// pengembaliannya tidak pernah dijalankan.
//
// Yang membuatnya sulit dilacak: mutasi saldo baru dicatat SESUDAH order
// berhasil. Jadi potongan yang gagal itu tidak meninggalkan baris apa pun di
// mana pun — pengguna melihat saldonya berkurang, dan tidak ada satu catatan
// pun yang bisa dipakai membuktikannya.
//
// PENYELESAIANNYA: catatan hold ditulis SEBELUM saldo dipotong.
//
// Urutan itu yang penting. Dengan begitu, potongan apa pun selalu punya
// pasangannya di database, bahkan kalau fungsinya mati sedetik kemudian. Yang
// menggantung bisa ditemukan dan dikembalikan belakangan oleh penyapu, dan
// itu satu-satunya cara menutup kasus "fungsinya keburu mati" — tidak ada
// kode di dalam permintaan itu sendiri yang bisa menanganinya.
//
// ── PENGEMBALIAN HANYA UNTUK POTONGAN YANG BENAR-BENAR TERJADI ─────────────
// Hold ditulis SEBELUM potongan, jadi hold bisa ada tanpa potongan (saldo
// ternyata kurang, atau fungsinya mati di antara keduanya). Mengembalikan
// hold semacam itu berarti MENCETAK saldo dari nol. Karena itu potongannya
// menandai dirinya di dokumen user — `holdDebit: <holdId>`, DALAM findOneAndUpdate
// yang sama dengan pemotongannya (atomik) — dan pengembalian hanya berjalan
// kalau tanda itu ada, lalu menghapusnya dalam operasi kredit yang sama.
// Hold tanpa tanda (v2) = tidak pernah dipotong = dibatalkan tanpa kredit.
// ─────────────────────────────────────────────────────────────────────────
import { randomUUID } from "node:crypto";
import { saldoHoldsCol, usersCol, otpOrdersCol } from "@/lib/db";
import { incRefund } from "@/lib/saldoDeposit";
import { logBalance } from "@/lib/ledger";
import { umumkan } from "@/lib/notifyHub";
import { holdRefundNotif, holdRefundPublicNotif } from "@/lib/telegram";

/** Hold yang lebih tua dari ini dianggap macet dan dikembalikan penyapu. */
export const UMUR_MACET_MENIT = 5;

/**
 * Mencatat niat memotong saldo. Dipanggil SEBELUM saldo benar-benar dipotong.
 * Mengembalikan holdId, atau null kalau pencatatannya gagal — dan kalau
 * pencatatannya gagal, saldonya TIDAK BOLEH dipotong.
 */
export async function buatHold({ token, amount, jenis = "otp", catatan = "" }) {
  const nominal = Math.round(Number(amount) || 0);
  if (!token || nominal <= 0) return null;
  try {
    const col = await saldoHoldsCol();
    const holdId = `hold_${randomUUID()}`;
    await col.insertOne({
      holdId,
      token,
      amount: nominal,
      jenis,
      catatan: String(catatan || "").slice(0, 200),
      status: "held",
      // v2: pengembaliannya butuh tanda potongan di dokumen user (lihat atas).
      v: 2,
      createdAt: new Date()
    });
    return holdId;
  } catch (err) {
    console.error("[hold] gagal membuat hold:", err?.message || err);
    return null;
  }
}

/** Menandai hold sudah jadi pesanan sungguhan. Sesudah ini penyapu tidak menyentuhnya. */
export async function pakaiHold(holdId, ref) {
  if (!holdId) return;
  try {
    const col = await saldoHoldsCol();
    const hold = await col.findOneAndUpdate(
      { holdId, status: "held" },
      { $set: { status: "terpakai", ref: ref ? String(ref) : null, settledAt: new Date() } }
    );
    // Potongannya sudah jadi pesanan: tandanya tidak diperlukan lagi.
    if (hold?.token) {
      await (await usersCol()).updateOne({ token: hold.token }, { $pull: { holdDebit: holdId } });
    }
  } catch (err) {
    // Tidak fatal: penyapu memeriksa keberadaan pesanannya juga, jadi hold
    // yang gagal ditandai di sini tetap tidak akan dikembalikan dua kali.
    console.error("[hold] gagal menandai terpakai:", err?.message || err);
  }
}

/**
 * Mengembalikan saldo yang ditahan.
 *
 * Klaimnya atomik: syarat `status: "held"` ada DI DALAM filter, bukan
 * diperiksa lebih dulu. Tanpa itu, penyapu dan permintaan aslinya bisa
 * berjalan bersamaan, keduanya melihat status "held", dan saldonya
 * dikembalikan DUA KALI.
 */
export async function kembalikanHold(holdId, alasan = "") {
  if (!holdId) return { ok: false, berubah: false };
  const col = await saldoHoldsCol();

  let hold;
  try {
    hold = await col.findOneAndUpdate(
      { holdId, status: "held" },
      { $set: { status: "dikembalikan", alasan: String(alasan || "").slice(0, 300), settledAt: new Date() } },
      { returnDocument: "after" }
    );
  } catch (err) {
    console.error("[hold] klaim pengembalian gagal:", err?.message || err);
    return { ok: false, berubah: false };
  }

  // null = sudah pernah dikembalikan atau sudah terpakai. Bukan kegagalan.
  if (!hold) return { ok: true, berubah: false };

  try {
    const users = await usersCol();
    // v2: kredit HANYA kalau potongannya benar-benar terjadi (tandanya ada),
    // dan tanda itu dihapus dalam operasi yang sama — dua pengembalian tidak
    // mungkin sama-sama menang. Hold lama (tanpa v) memakai aturan lama.
    const filterKredit = hold.v === 2 ? { token: hold.token, holdDebit: holdId } : { token: hold.token };
    // Bagian deposit yang tadinya terpakai ikut kembali (tercatat di hold saat potongan terjadi).
    const incKredit = incRefund(hold.amount, hold.depositBagian);
    const ubah = hold.v === 2 ? { $inc: incKredit, $pull: { holdDebit: holdId } } : { $inc: incKredit };
    const sesudah = await users.findOneAndUpdate(filterKredit, ubah, { returnDocument: "after" });
    if (hold.v === 2 && !sesudah) {
      // Tidak ada potongan yang perlu dikembalikan: hold dibatalkan tanpa kredit.
      await col.updateOne({ holdId }, { $set: { status: "dibatalkan", alasan: "tidak pernah dipotong" } });
      return { ok: true, berubah: false, tidakDipotong: true };
    }

    // Mutasinya dicatat. Inilah yang selama ini tidak ada: tanpa baris ini,
    // potongan yang gagal tidak meninggalkan jejak apa pun, dan tidak ada
    // yang bisa membuktikan apa yang terjadi pada saldo seseorang.
    await logBalance({
      token: hold.token,
      type: "refund",
      amount: hold.amount,
      balanceAfter: sesudah?.balance ?? null,
      title: alasan ? `Saldo dikembalikan · ${String(alasan).slice(0, 60)}` : "Saldo dikembalikan",
      ref: holdId
    });

    return { ok: true, berubah: true, saldo: sesudah?.balance ?? null, amount: hold.amount, token: hold.token };
  } catch (err) {
    // Saldonya gagal ditambahkan padahal holdnya sudah ditandai dikembalikan.
    // Statusnya dikembalikan ke "held" supaya penyapu mencobanya lagi —
    // dibiarkan "dikembalikan" berarti uangnya hilang selamanya.
    console.error("[hold] PENGEMBALIAN GAGAL, dikembalikan ke antrean:", err?.message || err);
    await col
      .updateOne({ holdId }, { $set: { status: "held" }, $unset: { settledAt: "" }, $inc: { gagalKembali: 1 } })
      .catch(() => {});
    return { ok: false, berubah: false };
  }
}

/**
 * Membatalkan hold yang PASTI tidak pernah dipotong (mis. saldo ternyata kurang)
 * tanpa mengkredit apa pun. Berbeda dari kembalikanHold, yang mengembalikan uang.
 */
export async function batalkanHold(holdId, alasan = "") {
  if (!holdId) return { ok: false };
  try {
    const col = await saldoHoldsCol();
    await col.updateOne(
      { holdId, status: "held" },
      { $set: { status: "dibatalkan", alasan: String(alasan || "").slice(0, 300), settledAt: new Date() } }
    );
    return { ok: true };
  } catch (err) {
    console.error("[hold] gagal membatalkan:", err?.message || err);
    return { ok: false };
  }
}

/**
 * Menyapu hold yang menggantung dan mengembalikan saldonya.
 *
 * Ini satu-satunya yang bisa menangani fungsi yang mati di tengah jalan: kode
 * di dalam permintaan itu sendiri tidak pernah sempat jalan. Dipanggil dari
 * cron, dan juga di awal tiap pembelian berikutnya oleh orang yang sama —
 * yang paling cepat merasakan saldonya kurang adalah orang itu sendiri.
 */
export async function sapuHoldMacet({ token = null, umurMenit = UMUR_MACET_MENIT, batas = 50 } = {}) {
  const hasil = { diperiksa: 0, dikembalikan: 0, total: 0 };
  try {
    const col = await saldoHoldsCol();
    const batasWaktu = new Date(Date.now() - umurMenit * 60000);
    const filter = { status: "held", createdAt: { $lt: batasWaktu } };
    if (token) filter.token = token;

    const macet = await col.find(filter).limit(batas).toArray();
    hasil.diperiksa = macet.length;
    if (!macet.length) return hasil;

    const orders = await otpOrdersCol();
    for (const h of macet) {
      // Pesanannya mungkin sempat tersimpan sebelum fungsinya mati, dan
      // holdnya yang belum sempat ditandai. Mengembalikan saldo untuk pesanan
      // yang BERHASIL berarti memberi nomor gratis.
      const adaPesanan = await orders.findOne({ holdId: h.holdId }, { projection: { _id: 1 } });
      if (adaPesanan) {
        await col.updateOne({ holdId: h.holdId, status: "held" }, { $set: { status: "terpakai", settledAt: new Date() } });
        continue;
      }
      const r = await kembalikanHold(h.holdId, "Pesanan tidak pernah selesai dibuat");
      if (r.berubah) {
        hasil.dikembalikan += 1;
        hasil.total += r.amount || 0;

        // Dikabari HANYA dari penyapu, bukan dari kembalikanHold.
        //
        // Pengembalian biasa — provider menolak, stok habis — terjadi di dalam
        // permintaannya sendiri, penggunanya langsung melihat pesan galatnya,
        // dan mengumumkan tiap satu akan menenggelamkan channel. Yang sampai
        // ke sini justru yang tidak dilihat siapa pun: saldo yang tersangkut
        // karena fungsinya mati di tengah jalan. Itu yang perlu ada jejaknya.
        umumkan({
          jenis: "saldo_kembali",
          admin: holdRefundNotif({
            token: h.token,
            amount: r.amount,
            holdId: h.holdId,
            jenis: h.jenis,
            umurMenit: h.createdAt ? (Date.now() - new Date(h.createdAt).getTime()) / 60000 : umurMenit,
            balance: r.saldo
          }),
          publik: holdRefundPublicNotif({ amount: r.amount, token: h.token })
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[hold] penyapuan gagal:", err?.message || err);
  }
  return hasil;
}
