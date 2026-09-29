// Program kreator (afiliasi).
//
// Kreator = akun yang disetujui admin. Teman yang mendaftar lewat link
// undangannya (?ref=KODE, sama dengan referral biasa) jadi "teman kreator";
// tiap nomor yang BERHASIL mereka beli (kode OTP masuk), kreatornya mendapat
// persen dari UNTUNG toko atas pesanan itu, selamanya.
//
// Dihitung dari untung (harga jual − modal − komisi reseller), bukan dari
// deposit atau harga jual, supaya toko tidak pernah membayar lebih daripada
// yang ia dapat dari pesanan itu. Biaya jaminan OTP tidak ikut dihitung.
import { usersCol, afiliasiPengajuanCol, afiliasiKomisiCol } from "@/lib/db";
import { cfg } from "@/lib/config";
import { logBalance } from "@/lib/ledger";
import { umumkan } from "@/lib/notifyHub";
import { kirimPush } from "@/lib/webPush";
import { afiliasiKomisiNotif } from "@/lib/resellerNotif";

const PERSEN_MAKS = 90;

// ── Murni ───────────────────────────────────────────────────────────────────

/** Untung toko atas satu pesanan (tidak pernah negatif). */
export function untungPesanan(order) {
  const jual = Number(order?.price) || 0;
  const modal = Number(order?.basePrice) || 0;
  const komisiReseller = Number(order?.komisiReseller) || 0;
  if (!(jual > 0) || !(modal > 0)) return 0; // modal tak diketahui = tidak dihitung, bukan dianggap 0
  return Math.max(0, jual - modal - komisiReseller);
}

export function hitungKomisiKreator(untung, persen) {
  const p = Number(persen);
  if (!(untung > 0) || !(p > 0)) return 0;
  return Math.floor((untung * Math.min(p, PERSEN_MAKS)) / 100);
}

// ── Status & pengajuan ──────────────────────────────────────────────────────

export async function persenBawaan() {
  const n = Number(await cfg("AFILIASI_PERSEN"));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, PERSEN_MAKS) : 20;
}

/** Persen yang berlaku untuk seorang kreator: miliknya sendiri, atau bawaan. */
export async function persenKreator(user) {
  const sendiri = Number(user?.affiliate?.persen);
  return Number.isFinite(sendiri) && sendiri > 0 ? Math.min(sendiri, PERSEN_MAKS) : persenBawaan();
}

export async function statusAfiliasi(token) {
  const users = await usersCol();
  const u = await users.findOne({ token });
  if (!u) return null;
  const dasarAktif = await persenBawaan();
  if (dasarAktif <= 0 && !u.affiliate?.aktif) return { status: "mati" };
  const kol = await afiliasiKomisiCol();
  const stat = (
    await kol
      .aggregate([{ $match: { kreatorToken: token, ditarik: { $ne: true } } }, { $group: { _id: null, total: { $sum: "$komisi" }, jumlah: { $sum: 1 } } }])
      .toArray()
  )[0];
  const teman = await users.countDocuments({ referredBy: token });
  if (u.affiliate?.aktif) {
    return {
      status: "aktif",
      persen: await persenKreator(u),
      komisiTotal: Number(stat?.total) || 0,
      jumlahPesanan: Number(stat?.jumlah) || 0,
      temanTerundang: teman
    };
  }
  const peng = await (await afiliasiPengajuanCol()).findOne({ token });
  return { status: peng?.status || "belum", persenBawaan: dasarAktif, temanTerundang: teman, alasanTolak: peng?.alasan || null };
}

const bersih = (t, maks) => String(t || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, maks);

export async function ajukanKreator({ token, channel, catatan }) {
  if ((await persenBawaan()) <= 0) return { ok: false, alasan: "Program kreator sedang tidak dibuka." };
  const kanal = bersih(channel, 200);
  if (kanal.length < 4) return { ok: false, alasan: "Isi link/nama channel atau akun media sosialmu." };
  const users = await usersCol();
  const u = await users.findOne({ token }, { projection: { affiliate: 1, suspended: 1 } });
  if (!u) return { ok: false, alasan: "Akun tidak ditemukan." };
  if (u.suspended) return { ok: false, alasan: "Akun ditangguhkan." };
  if (u.affiliate?.aktif) return { ok: false, alasan: "Kamu sudah jadi kreator." };
  const col = await afiliasiPengajuanCol();
  const ada = await col.findOne({ token });
  if (ada?.status === "menunggu") return { ok: false, alasan: "Pengajuanmu masih menunggu keputusan admin." };
  await col.updateOne(
    { token },
    {
      $set: { status: "menunggu", channel: kanal, catatan: bersih(catatan, 500), alasan: null, updatedAt: new Date() },
      $setOnInsert: { token, createdAt: new Date() }
    },
    { upsert: true }
  );
  return { ok: true };
}

// ── Admin ───────────────────────────────────────────────────────────────────

const samar = (t = "") => (t.length <= 8 ? t : `${t.slice(0, 4)}••••${t.slice(-4)}`);

export async function daftarAdmin() {
  const peng = await (await afiliasiPengajuanCol()).find({ status: "menunggu" }).sort({ createdAt: 1 }).limit(100).toArray();
  const users = await usersCol();
  const kreator = await users.find({ "affiliate.aktif": true }).limit(200).toArray();
  const kol = await afiliasiKomisiCol();
  const lengkapi = async (u) => {
    const s = (
      await kol.aggregate([{ $match: { kreatorToken: u.token, ditarik: { $ne: true } } }, { $group: { _id: null, total: { $sum: "$komisi" }, jumlah: { $sum: 1 } } }]).toArray()
    )[0];
    return {
      token: u.token,
      label: samar(u.token),
      nama: u.name || null,
      persen: Number(u.affiliate?.persen) || null,
      komisiTotal: Number(s?.total) || 0,
      jumlahPesanan: Number(s?.jumlah) || 0,
      temanTerundang: await users.countDocuments({ referredBy: u.token })
    };
  };
  return {
    bawaan: await persenBawaan(),
    pengajuan: peng.map((p) => ({ token: p.token, label: samar(p.token), channel: p.channel, catatan: p.catatan, createdAt: p.createdAt })),
    kreator: await Promise.all(kreator.map(lengkapi))
  };
}

/** aksi: setujui (persen opsional) | tolak (alasan opsional) | cabut. */
export async function putuskanKreator({ token, aksi, persen, alasan }) {
  const users = await usersCol();
  const col = await afiliasiPengajuanCol();
  if (aksi === "setujui") {
    const p = persen === undefined || persen === "" || persen === null ? null : Number(persen);
    if (p !== null && !(Number.isFinite(p) && p > 0 && p <= PERSEN_MAKS)) {
      return { ok: false, alasan: `Persen harus 1–${PERSEN_MAKS}, atau kosongkan untuk memakai bawaan.` };
    }
    // Hanya pengajuan yang menunggu yang bisa disetujui: klaim atomik lewat status.
    const klaim = await col.findOneAndUpdate({ token, status: "menunggu" }, { $set: { status: "disetujui", diputuskanAt: new Date() } });
    if (!klaim) return { ok: false, alasan: "Tidak ada pengajuan yang menunggu untuk akun ini." };
    await users.updateOne({ token }, { $set: { affiliate: { aktif: true, persen: p, disetujuiAt: new Date() } } });
    return { ok: true };
  }
  if (aksi === "tolak") {
    const klaim = await col.findOneAndUpdate(
      { token, status: "menunggu" },
      { $set: { status: "ditolak", alasan: bersih(alasan, 200) || null, diputuskanAt: new Date() } }
    );
    return klaim ? { ok: true } : { ok: false, alasan: "Tidak ada pengajuan yang menunggu untuk akun ini." };
  }
  if (aksi === "cabut") {
    const r = await users.updateOne({ token, "affiliate.aktif": true }, { $set: { "affiliate.aktif": false, "affiliate.dicabutAt": new Date() } });
    if (!r.matchedCount) return { ok: false, alasan: "Akun ini bukan kreator aktif." };
    await col.updateOne({ token }, { $set: { status: "dicabut", diputuskanAt: new Date() } });
    return { ok: true };
  }
  return { ok: false, alasan: "Aksi tidak dikenal." };
}

// ── Komisi ──────────────────────────────────────────────────────────────────

/**
 * Dipanggil saat kode OTP sebuah pesanan MASUK. Bila pembelinya teman seorang
 * kreator aktif, kreatornya dibayar. Idempoten per pesanan dan tidak pernah
 * melempar (kabar tambahan tidak boleh mengganggu pesanan).
 */
export async function bayarKomisiKreator(order) {
  try {
    if (!order?.token || !order?.orderId) return null;
    const users = await usersCol();
    const pembeli = await users.findOne({ token: order.token }, { projection: { referredBy: 1, signupIpHash: 1 } });
    if (!pembeli?.referredBy) return null;
    const kreator = await users.findOne({ token: pembeli.referredBy });
    if (!kreator?.affiliate?.aktif || kreator.suspended) return null;
    // Akun kembar milik kreator sendiri: IP daftar sama = tidak dihitung.
    if (pembeli.signupIpHash && kreator.signupIpHash && pembeli.signupIpHash === kreator.signupIpHash) return null;

    const persen = await persenKreator(kreator);
    const untung = untungPesanan(order);
    const komisi = hitungKomisiKreator(untung, persen);
    if (komisi <= 0) return null;

    const kol = await afiliasiKomisiCol();
    try {
      await kol.insertOne({
        orderId: String(order.orderId),
        kreatorToken: kreator.token,
        pembeliToken: order.token,
        untung,
        persen,
        komisi,
        serviceName: order.serviceName || null,
        createdAt: new Date()
      });
    } catch (err) {
      if (err?.code === 11000) return null; // sudah dibayar
      throw err;
    }
    const u = await users.findOneAndUpdate({ token: kreator.token }, { $inc: { balance: komisi } }, { returnDocument: "after" });
    await logBalance({
      token: kreator.token,
      type: "afiliasi",
      amount: komisi,
      balanceAfter: u?.balance,
      title: `Komisi kreator ${order.serviceName || ""}`.trim(),
      ref: order.orderId
    });
    umumkan({ jenis: "afiliasi", admin: afiliasiKomisiNotif({ kreatorToken: kreator.token, komisi, untung, persen, serviceName: order.serviceName }) }).catch(() => {});
    kirimPush(kreator.token, {
      judul: "Komisi kreator masuk 💸",
      isi: `+Rp${komisi.toLocaleString("id-ID")} dari pembelian temanmu (${order.serviceName || "nomor"}).`,
      url: "/referral",
      tag: `afiliasi-${order.orderId}`
    }).catch(() => {});
    return { komisi, kreatorToken: kreator.token };
  } catch (err) {
    console.error("[afiliasi] gagal membayar komisi:", err?.message || err);
    return null;
  }
}
