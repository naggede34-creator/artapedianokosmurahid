// Giveaway: admin membuat event, pengguna ikut, pemenangnya diundi acak dan
// hadiahnya masuk otomatis.
//
// ─────────────────────────────────────────────────────────────────────────
// TIGA HAL YANG MENENTUKAN APAKAH INI ADIL
//
// 1. SATU ORANG SATU TIKET. Ditegakkan indeks unik (giveawayId, token), bukan
//    pemeriksaan di kode. Pemeriksaan bisa dilewati dua permintaan yang datang
//    bersamaan; indeks unik tidak bisa.
//
// 2. UNDIANNYA DIKLAIM ATOMIK. Status "berjalan" ada DI DALAM filter yang
//    mengubahnya jadi "selesai". Dua panggilan undi yang bersamaan — admin
//    menekan dua kali, atau cron dan admin bersamaan — akan sama-sama melihat
//    "berjalan" kalau statusnya diperiksa lebih dulu, dan hadiahnya dibagikan
//    DUA KALI.
//
// 3. ACAKNYA PAKAI crypto. Math.random() bisa ditebak dari keluaran
//    sebelumnya, dan giveaway yang pemenangnya bisa ditebak bukan giveaway.
// ─────────────────────────────────────────────────────────────────────────
import { randomUUID, randomInt } from "node:crypto";
import { giveawayCol, giveawayPesertaCol, usersCol } from "@/lib/db";
import { logBalance } from "@/lib/ledger";
import { ensureIndexes } from "@/lib/indexes";

export const HADIAH = { saldo: "Saldo", poin: "Poin" };
export const MAKS_PEMENANG = 100;

function bersih(v, maks) {
  return String(v ?? "").trim().slice(0, maks);
}

/** Memeriksa isian event. Semua kesalahan dikembalikan sekaligus. */
export function periksaEvent(e) {
  const salah = [];
  if (bersih(e?.judul, 200).length < 3) salah.push("Judul minimal 3 huruf.");
  if (!HADIAH[e?.jenisHadiah]) salah.push("Jenis hadiah harus saldo atau poin.");

  const nilai = Number(e?.nilaiHadiah);
  if (!Number.isFinite(nilai) || nilai <= 0) salah.push("Nilai hadiah harus lebih dari 0.");

  const menang = Number(e?.jumlahPemenang);
  if (!Number.isInteger(menang) || menang < 1 || menang > MAKS_PEMENANG) {
    salah.push(`Jumlah pemenang harus 1–${MAKS_PEMENANG}.`);
  }

  const maks = Number(e?.maksPeserta);
  // 0 = tanpa batas. Dibedakan dari "kosong" supaya admin yang memang tidak
  // mau membatasi tidak dipaksa mengarang angka besar.
  if (!Number.isInteger(maks) || maks < 0) salah.push("Maksimal peserta harus 0 (tanpa batas) atau lebih.");
  if (maks > 0 && menang > maks) salah.push("Jumlah pemenang tidak boleh lebih banyak dari maksimal peserta.");

  const mulai = new Date(e?.mulaiAt);
  const selesai = new Date(e?.selesaiAt);
  if (Number.isNaN(mulai.getTime())) salah.push("Jam mulai tidak sah.");
  if (Number.isNaN(selesai.getTime())) salah.push("Jam berakhir tidak sah.");
  if (!Number.isNaN(mulai.getTime()) && !Number.isNaN(selesai.getTime()) && selesai <= mulai) {
    salah.push("Jam berakhir harus setelah jam mulai.");
  }
  return salah;
}

export async function buatEvent(e) {
  const salah = periksaEvent(e);
  if (salah.length) return { ok: false, salah };
  await ensureIndexes();

  const col = await giveawayCol();
  const doc = {
    giveawayId: `gw_${randomUUID()}`,
    judul: bersih(e.judul, 200),
    keterangan: bersih(e.keterangan, 1000),
    jenisHadiah: e.jenisHadiah,
    nilaiHadiah: Math.round(Number(e.nilaiHadiah)),
    jumlahPemenang: Number(e.jumlahPemenang),
    maksPeserta: Number(e.maksPeserta),
    mulaiAt: new Date(e.mulaiAt),
    selesaiAt: new Date(e.selesaiAt),
    status: "berjalan",
    jumlahPeserta: 0,
    pemenang: [],
    createdAt: new Date()
  };
  await col.insertOne(doc);
  const { _id, ...sisa } = doc;
  return { ok: true, event: sisa };
}

/** Keadaan event terhadap waktu sekarang. */
export function fase(ev, now = new Date()) {
  if (ev.status === "selesai") return "selesai";
  if (ev.status === "batal") return "batal";
  if (now < new Date(ev.mulaiAt)) return "akan";
  if (now > new Date(ev.selesaiAt)) return "tutup";
  return "buka";
}

export async function daftarEvent({ token = null, hanyaAktif = false, batas = 50 } = {}) {
  const col = await giveawayCol();
  const filter = hanyaAktif ? { status: { $ne: "batal" } } : {};
  const rows = await col.find(filter).sort({ createdAt: -1 }).limit(batas).toArray();

  // Keikutsertaan orang ini diambil SEKALI untuk semua event, bukan satu kueri
  // per baris.
  let ikut = new Set();
  if (token && rows.length) {
    const pes = await giveawayPesertaCol();
    const milik = await pes
      .find({ token, giveawayId: { $in: rows.map((r) => r.giveawayId) } }, { projection: { giveawayId: 1 } })
      .toArray();
    ikut = new Set(milik.map((m) => m.giveawayId));
  }

  const now = new Date();
  return rows.map((ev) => ({
    giveawayId: ev.giveawayId,
    judul: ev.judul,
    keterangan: ev.keterangan || "",
    jenisHadiah: ev.jenisHadiah,
    nilaiHadiah: ev.nilaiHadiah,
    jumlahPemenang: ev.jumlahPemenang,
    maksPeserta: ev.maksPeserta,
    mulaiAt: ev.mulaiAt,
    selesaiAt: ev.selesaiAt,
    status: ev.status,
    fase: fase(ev, now),
    jumlahPeserta: ev.jumlahPeserta || 0,
    // Kode akun pemenang DISAMARKAN. Daftar ini dibaca semua orang, dan kode
    // akun adalah kredensial — menampilkannya utuh sama saja membagikan kunci
    // akun pemenangnya ke seluruh pengunjung.
    pemenang: (ev.pemenang || []).map((p) => ({ nama: p.nama || "Tanpa nama", token: samarToken(p.token) })),
    sudahIkut: ikut.has(ev.giveawayId)
  }));
}

export function samarToken(t) {
  const s = String(t || "");
  if (s.length < 8) return "AP-••••";
  return `${s.slice(0, 5)}••••${s.slice(-2)}`;
}

/**
 * Ikut giveaway.
 *
 * Tiketnya ditulis LEBIH DULU, baru hitungannya dinaikkan. Urutan itu yang
 * mengubah indeks uniknya dari pendeteksi jadi pencegah: percobaan kedua
 * ditolak database, dan penaikan hitungannya tidak pernah dijalankan.
 */
export async function ikutGiveaway(giveawayId, token, nama) {
  if (!giveawayId || !token) return { ok: false, alasan: "Data kurang." };

  const col = await giveawayCol();
  const ev = await col.findOne({ giveawayId });
  if (!ev) return { ok: false, alasan: "Giveaway tidak ditemukan." };

  const f = fase(ev);
  if (f === "akan") return { ok: false, alasan: "Giveaway ini belum dibuka." };
  if (f !== "buka") return { ok: false, alasan: "Giveaway ini sudah ditutup." };
  if (ev.maksPeserta > 0 && (ev.jumlahPeserta || 0) >= ev.maksPeserta) {
    return { ok: false, alasan: "Kuota peserta sudah penuh." };
  }

  const pes = await giveawayPesertaCol();
  try {
    await pes.insertOne({ giveawayId, token, nama: bersih(nama, 60), createdAt: new Date() });
  } catch (err) {
    if (err?.code === 11000) return { ok: false, alasan: "Kamu sudah ikut giveaway ini.", sudahIkut: true };
    throw err;
  }

  // Kuota diperiksa lagi DI DALAM filter. Tanpa itu, sepuluh orang yang
  // menekan Ikut bersamaan pada kuota tersisa satu akan lolos semua.
  const sesudah = await col.findOneAndUpdate(
    ev.maksPeserta > 0
      ? { giveawayId, jumlahPeserta: { $lt: ev.maksPeserta } }
      : { giveawayId },
    { $inc: { jumlahPeserta: 1 } },
    { returnDocument: "after" }
  );
  if (!sesudah) {
    // Kuota keburu penuh di antara dua langkah. Tiketnya ditarik lagi supaya
    // orang ini tidak ikut undian untuk kursi yang tidak ada.
    await pes.deleteOne({ giveawayId, token }).catch(() => {});
    return { ok: false, alasan: "Kuota peserta baru saja penuh." };
  }

  // Kursi terakhir baru saja terisi → diumumkan, sekali saja.
  //
  // "Sekali saja" dijamin oleh klaim atomik `penuhDiumumkan: { $ne: true }`,
  // bukan oleh pemeriksaan di baris sebelumnya. Yang menekan Ikut pada detik
  // yang sama sama-sama melihat hitungan penuh; tanpa klaim ini, channelnya
  // menerima pengumuman yang sama beberapa kali sekaligus.
  if (ev.maksPeserta > 0 && sesudah.jumlahPeserta >= ev.maksPeserta) {
    kabarkanPenuh(giveawayId).catch(() => {});
  }

  return { ok: true, jumlahPeserta: sesudah.jumlahPeserta };
}

async function kabarkanPenuh(giveawayId) {
  const col = await giveawayCol();
  const ev = await col.findOneAndUpdate(
    { giveawayId, penuhDiumumkan: { $ne: true } },
    { $set: { penuhDiumumkan: true } },
    { returnDocument: "after" }
  );
  if (!ev) return;
  // Diambil belakangan supaya lib/giveawayNotif.js tetap boleh mengimpor
  // berkas ini tanpa membentuk lingkaran impor.
  const [{ umumkan }, { giveawayPenuhNotif }] = await Promise.all([
    import("@/lib/notifyHub"),
    import("@/lib/giveawayNotif")
  ]);
  const teks = giveawayPenuhNotif(ev);
  await umumkan({ jenis: "giveaway_penuh", admin: teks, publik: teks });
}

/**
 * Membatalkan keikutsertaan.
 *
 * Tiketnya DIHAPUS DULU, baru hitungannya diturunkan — dan penurunannya hanya
 * dijalankan kalau penghapusannya benar-benar menghapus sesuatu. Kalau
 * urutannya dibalik, dua ketukan "Tidak Ikut" yang datang bersamaan
 * menurunkan hitungan dua kali untuk satu tiket, dan kuota giveaway jadi
 * melar tanpa ada yang menyadarinya.
 *
 * Hanya selama giveawaynya masih buka. Sesudah ditutup, daftar pesertanya
 * adalah dasar undian — mengubahnya berarti mengubah hasil undian yang sudah
 * ditunggu orang.
 */
export async function batalIkutGiveaway(giveawayId, token) {
  if (!giveawayId || !token) return { ok: false, alasan: "Data kurang." };

  const col = await giveawayCol();
  const ev = await col.findOne({ giveawayId });
  if (!ev) return { ok: false, alasan: "Giveaway tidak ditemukan." };

  const f = fase(ev);
  if (f !== "buka") {
    return {
      ok: false,
      alasan:
        f === "akan"
          ? "Giveaway ini belum dibuka."
          : "Pendaftaran sudah ditutup, keikutsertaan tidak bisa dibatalkan lagi."
    };
  }

  const pes = await giveawayPesertaCol();
  const hapus = await pes.deleteOne({ giveawayId, token });
  if (!hapus.deletedCount) return { ok: false, alasan: "Kamu memang belum ikut giveaway ini." };

  // $inc -1 dengan syarat hitungannya masih di atas nol: hitungan negatif
  // membuat kuota terbaca lebih longgar daripada yang sebenarnya.
  const sesudah = await col.findOneAndUpdate(
    { giveawayId, jumlahPeserta: { $gt: 0 } },
    { $inc: { jumlahPeserta: -1 } },
    { returnDocument: "after" }
  );

  return { ok: true, jumlahPeserta: sesudah?.jumlahPeserta ?? Math.max(0, (ev.jumlahPeserta || 1) - 1) };
}

/**
 * Mengundi pemenang dan membagikan hadiahnya.
 *
 * Selalu aman dipanggil dua kali: klaim atomiknya membuat panggilan kedua
 * tidak melakukan apa-apa.
 */
export async function undiPemenang(giveawayId) {
  const col = await giveawayCol();

  // Diklaim DULU. Kalau ini gagal, berarti sudah ada yang mengundinya, dan
  // pembagian hadiah di bawah tidak pernah dijalankan.
  const ev = await col.findOneAndUpdate(
    { giveawayId, status: "berjalan" },
    { $set: { status: "selesai", diundiAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!ev) return { ok: true, berubah: false, alasan: "Sudah pernah diundi." };

  const pes = await giveawayPesertaCol();
  const peserta = await pes.find({ giveawayId }).toArray();

  if (!peserta.length) {
    await col.updateOne({ giveawayId }, { $set: { pemenang: [], catatan: "Tidak ada peserta." } });
    return { ok: true, berubah: true, event: ev, pemenang: [], alasan: "Tidak ada peserta." };
  }

  // Fisher-Yates dengan randomInt dari crypto. Math.random() bisa ditebak dari
  // keluaran sebelumnya, dan giveaway yang pemenangnya bisa ditebak bukan
  // giveaway.
  const kocok = peserta.slice();
  for (let i = kocok.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [kocok[i], kocok[j]] = [kocok[j], kocok[i]];
  }
  const menang = kocok.slice(0, Math.min(ev.jumlahPemenang, kocok.length));

  const users = await usersCol();
  const bidang = ev.jenisHadiah === "poin" ? "points" : "balance";
  const hasil = [];

  for (const p of menang) {
    try {
      const sesudah = await users.findOneAndUpdate(
        { token: p.token },
        { $inc: { [bidang]: ev.nilaiHadiah } },
        { returnDocument: "after" }
      );
      if (!sesudah) {
        // Akunnya hilang sesudah ikut. Dicatat apa adanya, bukan diganti
        // pemenang lain: mengganti diam-diam membuat daftar pemenangnya
        // berbeda dari hasil undian yang sebenarnya.
        hasil.push({ token: p.token, nama: p.nama, gagal: "akun tidak ditemukan" });
        continue;
      }
      await logBalance({
        token: p.token,
        type: ev.jenisHadiah === "poin" ? "poin" : "hadiah",
        amount: ev.nilaiHadiah,
        balanceAfter: ev.jenisHadiah === "poin" ? null : sesudah.balance,
        title: `Menang giveaway: ${ev.judul}`.slice(0, 120),
        ref: giveawayId
      });
      hasil.push({ token: p.token, nama: p.nama });
    } catch (err) {
      console.error("[giveaway] hadiah gagal:", err?.message || err);
      hasil.push({ token: p.token, nama: p.nama, gagal: String(err?.message || err).slice(0, 100) });
    }
  }

  await col.updateOne({ giveawayId }, { $set: { pemenang: hasil } });
  return { ok: true, berubah: true, event: ev, pemenang: hasil };
}

export async function batalkanEvent(giveawayId) {
  const col = await giveawayCol();
  // findOneAndUpdate, bukan updateOne: dokumennya dipakai untuk isi
  // pengumuman, dan mengambilnya lagi sesudah itu berarti dua perjalanan ke
  // database untuk data yang sudah ada di tangan.
  const ev = await col.findOneAndUpdate(
    { giveawayId, status: "berjalan" },
    { $set: { status: "batal", batalAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!ev) return { ok: false, alasan: "Tidak bisa dibatalkan — mungkin sudah diundi." };

  // Yang sudah menekan Ikut berhak tahu bahwa undiannya tidak akan datang.
  // Dibatalkan diam-diam berarti mereka menunggu pengumuman yang tidak pernah
  // ada, dan menyalahkan giveaway berikutnya karena itu.
  (async () => {
    const [{ umumkan }, { giveawayBatalNotif }] = await Promise.all([
      import("@/lib/notifyHub"),
      import("@/lib/giveawayNotif")
    ]);
    const teks = giveawayBatalNotif(ev);
    await umumkan({ jenis: "giveaway_batal", admin: teks, publik: teks });
  })().catch(() => {});

  return { ok: true };
}

/** Event yang waktunya habis tapi belum diundi. Dipanggil cron. */
export async function undiYangJatuhTempo(now = new Date()) {
  const col = await giveawayCol();
  const jatuh = await col.find({ status: "berjalan", selesaiAt: { $lte: now } }).limit(20).toArray();
  const hasil = [];
  for (const ev of jatuh) {
    const r = await undiPemenang(ev.giveawayId);
    if (r.berubah) hasil.push({ giveawayId: ev.giveawayId, judul: ev.judul, event: r.event, pemenang: r.pemenang });
  }
  return hasil;
}
