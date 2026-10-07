// SALDO KAGET — bagi saldo ke teman lewat satu tautan, siapa cepat dia dapat.
//
// Cara kerja uangnya (escrow):
//   • Pembuat membayar total (+ biaya admin, bila ada) di muka; saldo langsung dipotong dan "ditahan" di paket.
//   • Bagian tiap penerima ditentukan SAAT paket dibuat (acak atau rata) dan disimpan tersembunyi di server —
//     tidak pernah dikirim ke halaman, jadi tak ada yang bisa memilih-milih bagian terbesar.
//   • Satu akun hanya bisa mengklaim satu kali per paket (indeks unik), pembuat tidak bisa mengklaim paketnya sendiri.
//   • Paket berakhir (masa berlaku habis / ditutup pembuat / ditutup admin): bagian yang belum diklaim kembali
//     ke pembuat otomatis. Yang sudah diklaim tidak ditarik kembali.
//   • Saldo yang diterima lewat Kaget masuk sebagai saldo BIASA (bukan saldo deposit) → tidak bisa ditarik ke e-wallet,
//     jadi fitur ini tidak bisa dipakai mencuci saldo bonus menjadi saldo tarik.
//
// Keamanan uang — tiap langkah yang menambah saldo dicatat DULU di buku besar dengan referensi tetap yang dijaga indeks
// unik (lihat lib/indexes.js), baru saldo ditambah. Klik ganda, retry, dan penyapu tidak bisa menambah dua kali.
// Penambahan yang tertinggal (proses mati di tengah jalan) diselesaikan penyapu `sapuKaget()` lewat cron tick.
import { randomInt, randomBytes } from "node:crypto";
import { usersCol, kagetCol, kagetKlaimCol, balanceLogsCol, userNotificationsCol } from "@/lib/db";
import { cfg, cfgAngka } from "@/lib/config";
import { logBalance, logBalanceOnce, setLedgerBalanceAfter } from "@/lib/ledger";
import { catatPotongan, incRefund, pastikanDepositBalance } from "@/lib/saldoDeposit";
import { periksaTransaksi } from "@/lib/gerbangUang";
import { kirimPushCepat } from "@/lib/webPush";

const MENIT = 60_000;
const JAM = 3_600_000;
const ALFABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // tanpa 0/O/1/I/L
export const STATUS_AKTIF = ["disiapkan", "aktif"];

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const jumlahSah = (x) => Math.floor(Number(x));

// ───────────────────────── KONFIGURASI ─────────────────────────
export async function konfigKaget() {
  const bulat = async (nama, bawaan, min, maks) => Math.min(maks, Math.max(min, Math.round(await cfgAngka(nama, bawaan))));
  const minPerOrang = await bulat("KAGET_MIN_PER_ORANG", 500, 100, 1_000_000);
  const minTotal = Math.max(await bulat("KAGET_MIN_TOTAL", 2000, 1000, 100_000_000), minPerOrang);
  return {
    aktif: String((await cfg("KAGET_AKTIF")) ?? "1") !== "0",
    minTotal,
    maksTotal: Math.max(minTotal, await bulat("KAGET_MAKS_TOTAL", 1_000_000, 1000, 100_000_000)),
    minPerOrang,
    maksPenerima: await bulat("KAGET_MAKS_PENERIMA", 100, 1, 1000),
    masaJam: await bulat("KAGET_MASA_JAM", 24, 1, 168),
    maksAktif: await bulat("KAGET_MAKS_AKTIF", 5, 1, 100),
    biayaPersen: Math.min(20, Math.max(0, Number(await cfgAngka("KAGET_BIAYA_PERSEN", 0)) || 0)),
    umurAkunJam: await bulat("KAGET_UMUR_AKUN_JAM", 0, 0, 720),
    pesanMaks: 80,
    // Hanya untuk pengujian otomatis (masa berlaku dalam detik); kosong di produksi.
    masaDetikUji: Math.max(0, Number(process.env.KAGET_UJI_MASA_DETIK) || 0)
  };
}

export const biayaKaget = (total, persen) => (persen > 0 ? Math.ceil((total * persen) / 100) : 0);

// ───────────────────────── PEMBAGIAN ─────────────────────────
/**
 * Membagi `total` rupiah menjadi `jumlah` bagian (jumlahnya PERSIS sama dengan total, tiap bagian ≥ minPerOrang).
 *   "rata": selisih sisa pembagian dibagikan 1 rupiah ke beberapa orang pertama.
 *   "acak": setelah tiap orang diberi minimum, sisanya dipecah dengan bobot acak seragam (potongan acak sejati,
 *           ada yang kecil ada yang besar). Urutan klaim = urutan array, jadi tidak ada yang tahu siapa dapat berapa.
 */
export function bagiKaget({ total, jumlah, mode, minPerOrang }) {
  total = jumlahSah(total); jumlah = jumlahSah(jumlah); minPerOrang = Math.max(1, jumlahSah(minPerOrang) || 1);
  if (!(total > 0) || !(jumlah > 0) || total < jumlah * minPerOrang) throw new Error("Total terlalu kecil untuk jumlah penerima.");
  if (mode === "rata") {
    const dasar = Math.floor(total / jumlah);
    const lebih = total - dasar * jumlah;
    return Array.from({ length: jumlah }, (_, i) => dasar + (i < lebih ? 1 : 0));
  }
  const sisa = total - jumlah * minPerOrang;
  const bobot = Array.from({ length: jumlah }, () => -Math.log((randomInt(1, 1_000_000_000) + 0.5) / 1_000_000_000));
  const jumlahBobot = bobot.reduce((a, b) => a + b, 0);
  const bagian = bobot.map((w) => minPerOrang + Math.floor((sisa * w) / jumlahBobot));
  let kurang = total - bagian.reduce((a, b) => a + b, 0);
  while (kurang > 0) { bagian[randomInt(0, jumlah)] += 1; kurang -= 1; }
  // Acak urutan sekali lagi (Fisher–Yates) supaya posisi tidak berkorelasi dengan apa pun.
  for (let i = bagian.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [bagian[i], bagian[j]] = [bagian[j], bagian[i]]; }
  return bagian;
}

function kodeBaru() {
  const b = randomBytes(10);
  let s = "";
  for (let i = 0; i < 10; i++) s += ALFABET[b[i] % ALFABET.length];
  return s;
}
export const kodeKagetSah = (k) => typeof k === "string" && /^[2-9A-HJKMNP-Z]{10}$/.test(k);

const bersihPesan = (t, maks) => String(t || "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, maks);
const namaTampil = (u) => bersihPesan(u?.name, 30) || "Pengguna";

async function beriTahu(token, { judul, isi, url = "/kaget", tipe = "kaget" }) {
  try { await (await userNotificationsCol()).insertOne({ token, type: tipe, title: judul, body: isi, read: false, createdAt: new Date(), url }); } catch {}
  await kirimPushCepat(token, { judul, isi, url, tag: `kaget-${Date.now()}` }, 2500).catch(() => {});
}

// ───────────────────────── KREDIT AMAN ─────────────────────────
/**
 * Menambah saldo SEKALI saja untuk (token, type, ref). Catat dulu di buku besar → baru tambah → lengkapi saldo akhir.
 * Bila catatan sudah ada tapi saldo akhirnya belum terisi dan sudah lewat 2 menit (proses sebelumnya mati di tengah),
 * satu-satunya pemanggil yang berhasil memenangkan CAS-nya melanjutkan penambahan.
 */
async function kreditSekali({ token, type, ref, jumlah, title, inc }) {
  const r = await logBalanceOnce({ token, type, amount: jumlah, ref, title });
  const users = await usersCol();
  if (r.ok) {
    const sesudah = await users.findOneAndUpdate({ token }, { $inc: inc || { balance: jumlah } }, { returnDocument: "after" });
    if (!sesudah) return { ok: false, alasan: "akun tidak ditemukan" };
    await setLedgerBalanceAfter(r.id, sesudah.balance);
    return { ok: true, baru: true, saldo: sesudah.balance };
  }
  if (!r.duplikat) return { ok: false, alasan: r.alasan || "gagal mencatat" };
  const log = await balanceLogsCol();
  const lama = await log.findOneAndUpdate(
    { token, type, ref: String(ref), balanceAfter: null, createdAt: { $lt: new Date(Date.now() - 2 * MENIT) } },
    { $set: { balanceAfter: -1 } },
    { returnDocument: "after" }
  );
  if (!lama) return { ok: true, baru: false };
  const sesudah = await users.findOneAndUpdate({ token }, { $inc: inc || { balance: jumlah } }, { returnDocument: "after" });
  if (sesudah) await setLedgerBalanceAfter(lama._id, sesudah.balance);
  return { ok: !!sesudah, baru: !!sesudah, saldo: sesudah?.balance };
}

// ───────────────────────── MEMBUAT PAKET ─────────────────────────
export async function buatKaget({ token, total, jumlah, mode, pesan }) {
  token = String(token || "").trim();
  if (!token) return gagal(400, "Kode akun kosong.");
  const k = await konfigKaget();
  if (!k.aktif) return gagal(403, "Saldo Kaget sedang ditutup oleh admin.");
  const gerbang = await periksaTransaksi(token, { jenis: "keluar" });
  if (gerbang) return gagal(gerbang.status, gerbang.error);

  total = jumlahSah(total); jumlah = jumlahSah(jumlah); mode = mode === "rata" ? "rata" : "acak";
  if (!Number.isFinite(total) || !Number.isFinite(jumlah)) return gagal(400, "Total dan jumlah penerima harus berupa angka.");
  if (jumlah < 1 || jumlah > k.maksPenerima) return gagal(400, `Jumlah penerima 1–${k.maksPenerima} orang.`);
  if (total < k.minTotal) return gagal(400, `Total minimal ${rp(k.minTotal)}.`);
  if (total > k.maksTotal) return gagal(400, `Total maksimal ${rp(k.maksTotal)}.`);
  if (total < jumlah * k.minPerOrang) return gagal(400, `Tiap penerima minimal ${rp(k.minPerOrang)} — untuk ${jumlah} orang total minimal ${rp(jumlah * k.minPerOrang)}.`);

  const users = await usersCol();
  const u = await users.findOne({ token }, { projection: { name: 1, balance: 1, suspended: 1, createdAt: 1 } });
  if (!u) return gagal(404, "Kode akun tidak ditemukan.");
  if (u.suspended) return gagal(403, "Akun ditangguhkan. Hubungi CS.");
  if (k.umurAkunJam > 0 && u.createdAt && Date.now() - new Date(u.createdAt).getTime() < k.umurAkunJam * JAM) {
    return gagal(403, `Akun baru bisa membuat Kaget setelah ${k.umurAkunJam} jam sejak mendaftar.`);
  }
  const kol = await kagetCol();
  const aktif = await kol.countDocuments({ owner: token, status: { $in: STATUS_AKTIF } });
  if (aktif >= k.maksAktif) return gagal(429, `Maksimal ${k.maksAktif} paket aktif sekaligus. Tutup atau tunggu salah satu selesai.`);

  const biaya = biayaKaget(total, k.biayaPersen);
  const bayar = total + biaya;
  if ((u.balance || 0) < bayar) return gagal(400, `Saldo tidak cukup. Dibutuhkan ${rp(bayar)}${biaya ? ` (total ${rp(total)} + biaya ${rp(biaya)})` : ""}.`);

  const bagian = bagiKaget({ total, jumlah, mode, minPerOrang: k.minPerOrang });
  const kini = new Date();
  let doc = null;
  for (let i = 0; i < 5 && !doc; i++) {
    const kid = kodeBaru();
    const calon = {
      kid, owner: token, ownerNama: namaTampil(u), pesan: bersihPesan(pesan, k.pesanMaks), mode,
      total, biaya, bayar, jumlah, bagian, sisaSlot: jumlah, diklaim: 0, depositBagian: 0,
      status: "disiapkan", refundStatus: "belum", createdAt: kini, expiresAt: new Date(kini.getTime() + (k.masaDetikUji > 0 ? k.masaDetikUji * 1000 : k.masaJam * JAM))
    };
    try { await kol.insertOne(calon); doc = calon; } catch (e) { if (e?.code !== 11000) throw e; }
  }
  if (!doc) return gagal(500, "Gagal membuat paket. Coba lagi.");

  // Potong saldo (atomik, tidak bisa minus). Bila gagal, paket yang baru disiapkan dibuang.
  await pastikanDepositBalance(token);
  const sesudah = await users.findOneAndUpdate({ token, balance: { $gte: bayar } }, { $inc: { balance: -bayar } }, { returnDocument: "after" });
  if (!sesudah) {
    await kol.deleteOne({ kid: doc.kid, status: "disiapkan" });
    return gagal(400, "Saldo tidak cukup.");
  }
  const depositBagian = await catatPotongan(token, sesudah, bayar);
  await logBalance({ token, type: "kaget_buat", amount: -bayar, balanceAfter: sesudah.balance, ref: doc.kid, title: `Buat Saldo Kaget ${rp(total)} untuk ${jumlah} orang` });
  await kol.updateOne({ kid: doc.kid, status: "disiapkan" }, { $set: { status: "aktif", depositBagian } });
  return { ok: true, kid: doc.kid, saldo: sesudah.balance, biaya, expiresAt: doc.expiresAt };
}

const gagal = (status, error) => ({ ok: false, status, error });

// ───────────────────────── MELIHAT PAKET ─────────────────────────
const sisaRupiah = (k) => (k.bagian || []).slice(k.diklaim || 0).reduce((a, b) => a + b, 0);

/** Status yang tampil ke pengguna: "aktif" yang masa berlakunya lewat dianggap "berakhir" walau penyapu belum jalan. */
export function statusTampil(k, kini = Date.now()) {
  if (k.status === "aktif" && new Date(k.expiresAt).getTime() <= kini) return "berakhir";
  if (k.status === "disiapkan") return "aktif";
  return k.status;
}

function ringkasKlaim(daftar) {
  const terbesar = daftar.reduce((m, c) => (c.jumlah > m ? c.jumlah : m), 0);
  return daftar.map((c) => ({ nama: c.nama || "Pengguna", jumlah: c.jumlah, waktu: c.createdAt, terbesar: terbesar > 0 && c.jumlah === terbesar && daftar.length > 1 }));
}

export async function lihatKaget(kid, token) {
  if (!kodeKagetSah(kid)) return gagal(404, "Paket Kaget tidak ditemukan.");
  const k = await (await kagetCol()).findOne({ kid });
  if (!k) return gagal(404, "Paket Kaget tidak ditemukan.");
  const klaim = await (await kagetKlaimCol()).find({ kid, jumlah: { $gt: 0 } }).sort({ createdAt: 1 }).limit(500).toArray();
  const status = statusTampil(k);
  const saya = token ? klaim.find((c) => c.token === token) || (await (await kagetKlaimCol()).findOne({ kid, token })) : null;
  const milikku = !!token && k.owner === token;
  return {
    ok: true,
    kid, status, mode: k.mode, pesan: k.pesan || "", pembuat: k.ownerNama || "Pengguna",
    total: k.total, jumlah: k.jumlah, diklaim: k.diklaim || 0, sisaSlot: k.sisaSlot, sisaRp: ["aktif", "habis"].includes(status) ? sisaRupiah(k) : 0,
    dibuat: k.createdAt, berakhirPada: k.expiresAt, selesaiPada: k.selesaiAt || null,
    milikku,
    refund: milikku && ["berakhir", "dibatalkan"].includes(status) ? { status: k.refundStatus, jumlah: k.refundRp ?? null } : null,
    saya: saya ? { jumlah: saya.jumlah ?? null, status: saya.status } : null,
    klaim: ringkasKlaim(klaim),
    bisaKlaim: status === "aktif" && !milikku && !saya && !!token
  };
}

export async function daftarKagetSaya(token) {
  const kol = await kagetCol();
  const dibuat = await kol.find({ owner: token }).sort({ createdAt: -1 }).limit(30).toArray();
  const klaimSaya = await (await kagetKlaimCol()).find({ token, jumlah: { $gt: 0 } }).sort({ createdAt: -1 }).limit(30).toArray();
  const kids = [...new Set(klaimSaya.map((c) => c.kid))];
  const induk = kids.length ? await kol.find({ kid: { $in: kids } }, { projection: { kid: 1, ownerNama: 1, pesan: 1 } }).toArray() : [];
  const peta = new Map(induk.map((x) => [x.kid, x]));
  const terima = klaimSaya.map((c) => ({ kid: c.kid, jumlah: c.jumlah, waktu: c.createdAt, dari: peta.get(c.kid)?.ownerNama || "Pengguna", pesan: peta.get(c.kid)?.pesan || "" }));
  const dibagi = dibuat.map((k) => ({
    kid: k.kid, status: statusTampil(k), mode: k.mode, total: k.total, jumlah: k.jumlah, diklaim: k.diklaim || 0, pesan: k.pesan || "",
    dibuat: k.createdAt, berakhirPada: k.expiresAt, refund: k.refundRp ?? null
  }));
  return {
    dibuat: dibagi,
    diterima: terima,
    ringkasan: {
      totalDibagi: dibagi.reduce((a, k) => a + (k.status === "dibatalkan" || k.status === "berakhir" ? 0 : k.total), 0),
      totalDiterima: terima.reduce((a, c) => a + c.jumlah, 0),
      paketAktif: dibagi.filter((k) => k.status === "aktif").length
    }
  };
}

// ───────────────────────── MENGKLAIM ─────────────────────────
const ALASAN_TUTUP = { habis: "Yah, Kaget ini sudah habis diambil.", berakhir: "Kaget ini sudah berakhir.", dibatalkan: "Kaget ini sudah ditutup pembuatnya." };

export async function klaimKaget({ token, kid }) {
  token = String(token || "").trim();
  if (!token) return gagal(401, "Masuk dulu untuk mengambil Kaget.");
  if (!kodeKagetSah(kid)) return gagal(404, "Paket Kaget tidak ditemukan.");
  const k = await konfigKaget();
  const gerbang = await periksaTransaksi(token, { jenis: "masuk" });
  if (gerbang) return gagal(gerbang.status, gerbang.error);

  const users = await usersCol();
  const u = await users.findOne({ token }, { projection: { name: 1, suspended: 1, createdAt: 1 } });
  if (!u) return gagal(404, "Kode akun tidak ditemukan.");
  if (u.suspended) return gagal(403, "Akun ditangguhkan. Hubungi CS.");
  if (k.umurAkunJam > 0 && u.createdAt && Date.now() - new Date(u.createdAt).getTime() < k.umurAkunJam * JAM) {
    return gagal(403, `Akun baru bisa mengambil Kaget setelah ${k.umurAkunJam} jam sejak mendaftar.`);
  }

  const kol = await kagetCol();
  const klaimKol = await kagetKlaimCol();
  const paket = await kol.findOne({ kid });
  if (!paket) return gagal(404, "Paket Kaget tidak ditemukan.");
  if (paket.owner === token) return gagal(400, "Ini paket Kaget buatanmu sendiri — bagikan tautannya ke teman.");

  const pernah = await klaimKol.findOne({ kid, token });
  if (pernah) return pernah.jumlah > 0 ? hasilKlaim(pernah, paket, true) : gagal(409, "Klaimmu sedang diproses.");

  const st = statusTampil(paket);
  if (st !== "aktif") return gagal(410, ALASAN_TUTUP[st] || "Kaget ini tidak tersedia.");

  // 1) Tandai akun ini sudah mengklaim (indeks unik = satu klaim per akun per paket).
  try {
    await klaimKol.insertOne({ kid, token, nama: namaTampil(u), status: "antre", createdAt: new Date() });
  } catch (e) {
    if (e?.code !== 11000) throw e;
    const dobel = await klaimKol.findOne({ kid, token });
    return dobel?.jumlah > 0 ? hasilKlaim(dobel, paket, true) : gagal(409, "Klaimmu sedang diproses.");
  }
  // 2) Ambil satu slot secara atomik.
  const dapat = await kol.findOneAndUpdate(
    { kid, status: "aktif", expiresAt: { $gt: new Date() }, sisaSlot: { $gt: 0 }, owner: { $ne: token } },
    { $inc: { sisaSlot: -1, diklaim: 1 } },
    { returnDocument: "after" }
  );
  if (!dapat) {
    await klaimKol.deleteOne({ kid, token, status: "antre" });
    const terbaru = await kol.findOne({ kid }, { projection: { status: 1, expiresAt: 1, sisaSlot: 1 } });
    const st2 = terbaru ? (terbaru.sisaSlot <= 0 && terbaru.status === "aktif" ? "habis" : statusTampil(terbaru)) : "berakhir";
    return gagal(410, ALASAN_TUTUP[st2] || "Kaget ini tidak tersedia.");
  }
  const idx = dapat.jumlah - dapat.sisaSlot - 1;
  const nominal = dapat.bagian[idx];
  await klaimKol.updateOne({ kid, token }, { $set: { idx, jumlah: nominal, status: "menunggu", slotAt: new Date() } });
  if (dapat.sisaSlot === 0) await kol.updateOne({ kid, status: "aktif" }, { $set: { status: "habis", selesaiAt: new Date() } });

  // 3) Kreditkan.
  const hasil = await selesaikanKlaim(kid, token);
  if (!hasil.ok) return gagal(202, "Klaimmu tercatat dan saldo akan masuk sebentar lagi.");
  if (dapat.sisaSlot === 0) beriTahu(dapat.owner, { judul: "🧧 Kaget-mu sudah habis!", isi: `Semua ${dapat.jumlah} penerima sudah mengambil paket ${rp(dapat.total)}.`, url: `/kaget/${kid}` }).catch(() => {});
  const klaim = await klaimKol.findOne({ kid, token });
  return hasilKlaim(klaim, dapat, false, hasil.saldo);
}

function hasilKlaim(klaim, paket, sudah, saldo) {
  return { ok: true, sudah, jumlah: klaim?.jumlah ?? 0, dari: paket.ownerNama || "Pengguna", pesan: paket.pesan || "", saldo: saldo ?? null, status: klaim?.status || "menunggu" };
}

/** Menuntaskan kredit sebuah klaim yang slotnya sudah terambil. Aman dipanggil berulang. */
async function selesaikanKlaim(kid, token) {
  const klaimKol = await kagetKlaimCol();
  const klaim = await klaimKol.findOne({ kid, token });
  if (!klaim || !(klaim.jumlah > 0) || klaim.status === "selesai") return { ok: !!klaim && klaim.status === "selesai" };
  const paket = await (await kagetCol()).findOne({ kid }, { projection: { owner: 1, ownerNama: 1, total: 1 } });
  const r = await kreditSekali({ token, type: "kaget_terima", ref: kid, jumlah: klaim.jumlah, title: `Saldo Kaget dari ${paket?.ownerNama || "teman"}` });
  if (!r.ok) return r;
  await klaimKol.updateOne({ kid, token }, { $set: { status: "selesai", kreditAt: new Date() } });
  if (r.baru && paket?.owner) {
    beriTahu(token, { judul: "🧧 Kaget masuk!", isi: `Kamu dapat ${rp(klaim.jumlah)} dari ${paket.ownerNama || "teman"}.`, url: `/kaget/${kid}` }).catch(() => {});
    beriTahu(paket.owner, { judul: "🧧 Kagetmu diambil", isi: `${klaim.nama || "Seseorang"} mengambil ${rp(klaim.jumlah)}.`, url: `/kaget/${kid}` }).catch(() => {});
  }
  return r;
}

// ───────────────────────── MENUTUP & MENGEMBALIKAN SISA ─────────────────────────
/** Menutup paket aktif (oleh pembuat atau admin) lalu mengembalikan sisanya. */
export async function tutupKaget({ kid, token, admin = false }) {
  if (!kodeKagetSah(kid)) return gagal(404, "Paket Kaget tidak ditemukan.");
  const kol = await kagetCol();
  const filter = { kid, status: "aktif", ...(admin ? {} : { owner: String(token || "") }) };
  const tutup = await kol.findOneAndUpdate(filter, { $set: { status: "dibatalkan", selesaiAt: new Date(), ditutupOleh: admin ? "admin" : "pemilik" } }, { returnDocument: "after" });
  if (!tutup) {
    const ada = await kol.findOne({ kid }, { projection: { owner: 1, status: 1 } });
    if (!ada || (!admin && ada.owner !== token)) return gagal(404, "Paket Kaget tidak ditemukan.");
    return gagal(409, "Paket ini sudah tidak aktif.");
  }
  const hasil = await kembalikanSisa(kid);
  return { ok: true, dikembalikan: hasil.jumlah || 0 };
}

/** Mengembalikan bagian yang belum diklaim ke pembuat — tepat satu kali (CAS + catatan buku besar unik). */
export async function kembalikanSisa(kid) {
  const kol = await kagetCol();
  const k = await kol.findOneAndUpdate(
    { kid, status: { $in: ["berakhir", "dibatalkan"] }, refundStatus: "belum" },
    { $set: { refundStatus: "proses", refundAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!k) return { ok: true, jumlah: 0, lewat: true };
  const sisa = sisaRupiah(k);
  const sisaBiaya = k.total > 0 ? Math.floor(((k.biaya || 0) * sisa) / k.total) : 0;
  const jumlah = sisa + sisaBiaya;
  if (jumlah <= 0) {
    await kol.updateOne({ kid }, { $set: { refundStatus: "selesai", refundRp: 0 } });
    return { ok: true, jumlah: 0 };
  }
  const depositBagian = k.bayar > 0 ? Math.floor(((k.depositBagian || 0) * jumlah) / k.bayar) : 0;
  await pastikanDepositBalance(k.owner);
  const r = await kreditSekali({ token: k.owner, type: "kaget_kembali", ref: kid, jumlah, title: `Sisa Saldo Kaget dikembalikan (${rp(jumlah)})`, inc: incRefund(jumlah, depositBagian) });
  if (!r.ok) {
    await kol.updateOne({ kid, refundStatus: "proses" }, { $set: { refundStatus: "belum" } });
    return { ok: false };
  }
  await kol.updateOne({ kid }, { $set: { refundStatus: "selesai", refundRp: jumlah } });
  if (r.baru) beriTahu(k.owner, { judul: "🧧 Sisa Kaget kembali", isi: `${rp(jumlah)} yang belum diambil sudah dikembalikan ke saldomu.`, url: `/kaget/${kid}` }).catch(() => {});
  return { ok: true, jumlah };
}

// ───────────────────────── PENYAPU (cron) ─────────────────────────
export async function sapuKaget({ maks = 40 } = {}) {
  const hasil = { berakhir: 0, dikembalikan: 0, dikreditkan: 0, dibersihkan: 0, galat: 0 };
  const kol = await kagetCol();
  const klaimKol = await kagetKlaimCol();
  const kini = new Date();
  try {
    // 1) Paket yang masa berlakunya lewat.
    for (let i = 0; i < maks; i++) {
      const p = await kol.findOneAndUpdate({ status: "aktif", expiresAt: { $lte: kini } }, { $set: { status: "berakhir", selesaiAt: kini } }, { returnDocument: "after" });
      if (!p) break;
      hasil.berakhir++;
    }
    // 2) Pengembalian yang belum tuntas (termasuk yang macet di "proses" > 3 menit).
    await kol.updateMany({ status: { $in: ["berakhir", "dibatalkan"] }, refundStatus: "proses", refundAt: { $lt: new Date(Date.now() - 3 * MENIT) } }, { $set: { refundStatus: "belum" } });
    const tunggu = await kol.find({ status: { $in: ["berakhir", "dibatalkan"] }, refundStatus: "belum" }).limit(maks).toArray();
    for (const p of tunggu) { const r = await kembalikanSisa(p.kid).catch(() => ({ ok: false })); if (r.ok) hasil.dikembalikan++; else hasil.galat++; }
    // 3) Klaim yang slotnya sudah terambil tapi kreditnya belum selesai.
    const macet = await klaimKol.find({ status: "menunggu", slotAt: { $lt: new Date(Date.now() - MENIT) } }).limit(maks).toArray();
    for (const c of macet) { const r = await selesaikanKlaim(c.kid, c.token).catch(() => ({ ok: false })); if (r.ok) hasil.dikreditkan++; else hasil.galat++; }
    // 4) Klaim "antre" yang tak pernah mendapat slot (proses mati sebelum slot) dibuang supaya akunnya bisa mencoba lagi.
    const batas = new Date(Date.now() - 10 * MENIT);
    hasil.dibersihkan += (await klaimKol.deleteMany({ status: "antre", createdAt: { $lt: batas } })).deletedCount || 0;
    // 5) Paket "disiapkan" yang tak pernah selesai dibuat: bila saldonya sudah terpotong (ada catatan buku besar) aktifkan, bila belum buang.
    const setengah = await kol.find({ status: "disiapkan", createdAt: { $lt: new Date(Date.now() - 3 * MENIT) } }).limit(maks).toArray();
    const log = await balanceLogsCol();
    for (const p of setengah) {
      const ada = await log.findOne({ token: p.owner, type: "kaget_buat", ref: p.kid }, { projection: { _id: 1 } });
      if (ada) await kol.updateOne({ kid: p.kid, status: "disiapkan" }, { $set: { status: "aktif" } });
      else { await kol.deleteOne({ kid: p.kid, status: "disiapkan" }); hasil.dibersihkan++; }
    }
  } catch (e) {
    console.error("[kaget] penyapu:", e?.message || e);
    hasil.galat++;
  }
  return hasil;
}

// ───────────────────────── ADMIN ─────────────────────────
export async function daftarKagetAdmin({ status = "", q = "", limit = 50 } = {}) {
  const kol = await kagetCol();
  const filter = {};
  if (status === "aktif") { filter.status = { $in: STATUS_AKTIF }; }
  else if (["habis", "berakhir", "dibatalkan"].includes(status)) filter.status = status;
  const cari = String(q || "").trim();
  if (cari) filter.$or = [{ kid: cari.toUpperCase() }, { owner: cari }];
  const items = await kol.find(filter, { projection: { bagian: 0 } }).sort({ createdAt: -1 }).limit(Math.min(200, Math.max(1, limit))).toArray();
  const hari = await kol.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * JAM) } } },
    { $group: { _id: null, paket: { $sum: 1 }, total: { $sum: "$total" } } }
  ]).toArray();
  const aktif = await kol.countDocuments({ status: { $in: STATUS_AKTIF } });
  return {
    items: items.map((k) => ({
      kid: k.kid, owner: k.owner, pembuat: k.ownerNama, status: statusTampil(k), statusAsli: k.status, mode: k.mode,
      total: k.total, biaya: k.biaya || 0, jumlah: k.jumlah, diklaim: k.diklaim || 0, pesan: k.pesan || "",
      dibuat: k.createdAt, berakhirPada: k.expiresAt, refundStatus: k.refundStatus, refund: k.refundRp ?? null, ditutupOleh: k.ditutupOleh || null
    })),
    ringkasan: { aktif, paket7Hari: hari[0]?.paket || 0, total7Hari: hari[0]?.total || 0 }
  };
}
