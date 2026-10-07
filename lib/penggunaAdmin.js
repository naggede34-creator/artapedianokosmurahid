// Dasbor admin "Pengguna & Blokir": daftar/penelusuran, detail per pengguna, dan blokir/buka blokir dengan riwayat.
// Hanya dipanggil dari rute admin (sudah lewat adminSah).
import { getDb, usersCol, otpOrdersCol, depositsCol, balanceLogsCol, userNotificationsCol, waProfilCol, wdInstanCol } from "@/lib/db";
import { sendTelegramNotif } from "@/lib/telegram";
import { sendMonitorLog } from "@/lib/monitor";
import { blokirIpAkun, bukaIpAkun, ipAkun } from "@/lib/blokirIp";
import { ipBlokirCol } from "@/lib/db";

const riwayatCol = async () => (await getDb()).collection("admin_blokir_log");
const esc = (t) => String(t ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const regexAman = (q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const STATUS_FILTER = ["semua", "dibekukan", "aktif", "baru"];
const URUTAN = { terbaru: { createdAt: -1 }, saldo: { balance: -1 }, deposit: { depositTotal: -1 }, nama: { name: 1 } };

const ringkasUser = (u) => ({
  token: u.token, name: u.name || null, balance: u.balance || 0, depositTotal: u.depositTotal || 0,
  suspended: u.suspended === true, suspendReason: u.suspendReason || null, suspendedAt: u.suspendedAt || null, suspendedSampai: u.suspendedSampai || null,
  createdAt: u.createdAt || u.joinedAt || null
});

export async function daftarPengguna({ q = "", status = "semua", urut = "terbaru", hal = 0, ukuran = 25 } = {}) {
  const kol = await usersCol();
  const f = {};
  const teks = String(q || "").trim().slice(0, 60);
  if (teks) { const r = regexAman(teks); f.$or = [{ token: { $regex: r, $options: "i" } }, { name: { $regex: r, $options: "i" } }]; }
  if (status === "dibekukan") f.suspended = true;
  else if (status === "aktif") f.suspended = { $ne: true };
  else if (status === "baru") f.createdAt = { $gte: new Date(Date.now() - 24 * 3600_000) };
  const ukur = Math.min(100, Math.max(5, Number(ukuran) || 25));
  const lewati = Math.max(0, Number(hal) || 0) * ukur;
  const [items, total, semua, beku, baru] = await Promise.all([
    kol.find(f).sort(URUTAN[urut] || URUTAN.terbaru).skip(lewati).limit(ukur).toArray(),
    kol.countDocuments(f),
    kol.countDocuments({}),
    kol.countDocuments({ suspended: true }),
    kol.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 3600_000) } })
  ]);
  return { items: items.map(ringkasUser), total, hal: Math.floor(lewati / ukur), ukuran: ukur, ringkas: { semua, dibekukan: beku, aktif: semua - beku, baru } };
}

const potong = (arr) => arr.map((x) => { const { _id, ...r } = x; return r; });

export async function detailPengguna(token) {
  const u = await (await usersCol()).findOne({ token: String(token || "") });
  if (!u) return null;
  const t = u.token;
  const [pesanan, mutasi, deposit, penarikan, blokir, profil] = await Promise.all([
    (await otpOrdersCol()).find({ token: t }).sort({ createdAt: -1 }).limit(10).toArray(),
    (await balanceLogsCol()).find({ token: t }).sort({ createdAt: -1 }).limit(12).toArray(),
    (await depositsCol()).find({ token: t }).sort({ createdAt: -1 }).limit(8).toArray(),
    (await wdInstanCol()).find({ token: t, status: { $ne: "disiapkan" } }).sort({ createdAt: -1 }).limit(6).toArray(),
    (await riwayatCol()).find({ token: t }).sort({ at: -1 }).limit(20).toArray(),
    (await waProfilCol()).findOne({ token: t }, { projection: { foto: 0 } })
  ]);
  const ipList = await ipAkun(t).catch(() => []);
  const ipBeku = ipList.length ? new Set((await (await ipBlokirCol()).find({ _id: { $in: ipList } }).toArray()).map((x) => x._id)) : new Set();
  return {
    ...ringkasUser(u),
    ipAkun: ipList.map((ip) => ({ ip, diblokir: ipBeku.has(ip) })),
    depositBalance: u.depositBalance ?? null,
    depositCount: u.depositCount || 0,
    referralCount: u.referralCount || 0,
    referralEarnings: u.referralEarnings || 0,
    totalBelanja: u.totalSpent || 0,
    wdNokosTotal: u.wdNokosTotal || 0,
    bendera: u.securityFlags || null,
    telegramId: u.telegramId || null,
    telegramUsername: u.telegramUsername || null,
    chat: profil ? { pid: profil.pid, nama: profil.nama, lastSeen: profil.lastSeen || null } : null,
    pesanan: pesanan.map((o) => ({ orderId: o.orderId, layanan: o.serviceName, negara: o.countryName, nomor: o.phoneNumber, harga: o.price, status: o.refunded ? "refund" : o.status, at: o.createdAt })),
    mutasi: mutasi.map((m) => ({ tipe: m.type, jumlah: m.amount, judul: m.title, at: m.createdAt })),
    deposit: deposit.map((d) => ({ orderId: d.orderId, provider: d.provider, jumlah: d.amount, status: d.status, at: d.createdAt })),
    penarikan: penarikan.map((w) => ({ id: w.wid, jenis: w.jenis, dompet: w.wallet, nominal: w.nominal, status: w.status, at: w.createdAt })),
    riwayatBlokir: potong(blokir)
  };
}

/**
 * Blokir / buka blokir. aksi: "ban" | "unban".
 * - ban   : alasan wajib (min 3 huruf). Akun ditangguhkan, notifikasi ke pengguna (opsional).
 * - unban : membuka blokir dan tanda keamanan akun.
 * Setiap perubahan dicatat di riwayat (admin_blokir_log).
 */
export async function ubahBlokir({ token, aksi, alasan = "", kabari = true, durasiMenit = 0 }) {
  const kol = await usersCol();
  const u = await kol.findOne({ token: String(token || "") });
  if (!u) return { ok: false, status: 404, alasan: "Pengguna tidak ditemukan." };
  const ket = String(alasan || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const samar = `${u.token.slice(0, 6)}••••${u.token.slice(-4)}`;
  const log = await riwayatCol();

  if (aksi === "ban") {
    if (ket.length < 3) return { ok: false, status: 400, alasan: "Alasan blokir wajib diisi (minimal 3 huruf)." };
    if (u.suspended) return { ok: false, status: 400, alasan: "Akun ini sudah dibekukan." };
    // durasiMenit > 0 = ban SEMENTARA: berakhir sendiri (sapuBanSementara), layar ban menampilkan hitung mundur.
    const menit = Math.max(0, Math.min(525600, Math.floor(Number(durasiMenit) || 0)));
    const sampai = menit ? new Date(Date.now() + menit * 60000) : null;
    await kol.updateOne({ token: u.token }, { $set: { suspended: true, suspendedAt: new Date(), suspendReason: ket, ...(sampai ? { suspendedSampai: sampai } : {}) }, ...(sampai ? {} : { $unset: { suspendedSampai: "" } }) });
    if (kabari) {
      try { await (await userNotificationsCol()).insertOne({ token: u.token, type: "warning", title: "⚠️ Akun Ditangguhkan", body: `${ket}. Hubungi admin untuk info lebih lanjut.`, read: false, createdAt: new Date() }); } catch {}
    }
    const ipDiban = await blokirIpAkun(u.token, `Ban akun: ${ket}`);
    await log.insertOne({ token: u.token, nama: u.name || null, aksi: "ban", alasan: ket, kabari: !!kabari, oleh: "admin", ipDiblokir: ipDiban.length, ...(sampai ? { sampai } : {}), at: new Date() });
    sendTelegramNotif(`🚫 <b>USER DIBLOKIR${sampai ? " SEMENTARA" : ""} (DASBOR PENGGUNA)</b>\n━━━━━━━━━━━━━━━━━━\n🔑 <code>${samar}</code>\n👤 ${esc(u.name || "-")}\n🌐 ${ipDiban.length} IP ikut diblokir\n📋 ${esc(ket)}\n🕒 ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`);
    return { ok: true, suspended: true, ipDiblokir: ipDiban.length, ...(sampai ? { sampai } : {}) };
  }

  if (aksi === "unban") {
    if (!u.suspended) return { ok: false, status: 400, alasan: "Akun ini tidak sedang dibekukan." };
    await kol.updateOne({ token: u.token }, {
      $unset: { suspended: "", suspendedAt: "", suspendedSampai: "", suspendReason: "", securityFlags: "" }
    });
    const ipDibuka = await bukaIpAkun(u.token);
    if (kabari) {
      try { await (await userNotificationsCol()).insertOne({ token: u.token, type: "info", title: "✅ Akun Diaktifkan Kembali", body: "Akunmu sudah dibuka blokirnya oleh admin. Selamat berbelanja lagi!", read: false, createdAt: new Date() }); } catch {}
    }
    await log.insertOne({ token: u.token, nama: u.name || null, aksi: "unban", alasan: ket || null, kabari: !!kabari, oleh: "admin", ipDibuka: ipDibuka.length, sebelumnya: u.suspendReason || null, at: new Date() });
    sendMonitorLog(`✅ <b>USER DIBUKA BLOKIRNYA (DASBOR PENGGUNA)</b>\n🔑 <code>${samar}</code>\n👤 ${esc(u.name || "-")}${ket ? `\n📝 ${esc(ket)}` : ""}`);
    return { ok: true, suspended: false, ipDibuka: ipDibuka.length };
  }
  return { ok: false, status: 400, alasan: "Aksi tidak dikenal." };
}

/** Angka ringkas untuk kartu di Pusat Admin. */
export async function ringkasPusat() {
  const kol = await usersCol();
  const [total, beku, pendingManual, klaim, setorMenunggu] = await Promise.all([
    kol.countDocuments({}),
    kol.countDocuments({ suspended: true }),
    (await depositsCol()).countDocuments({ provider: "manual", status: "review" }).catch(() => 0),
    (await getDb()).collection("warranty_claims").countDocuments({ status: "pending" }).catch(() => 0),
    (await getDb()).collection("setor_gmail").countDocuments({ status: "menunggu-admin" }).catch(() => 0)
  ]);
  return { totalUser: total, dibekukan: beku, depositManual: pendingManual, klaimGaransi: klaim, setorMenunggu };
}

/**
 * Ban sementara yang sudah lewat waktunya dibuka otomatis (IP ikut dibuka, pengguna dikabari). `token` = hanya akun itu.
 * Dipanggil dari cron, dan oleh layar ban si pemilik akun (supaya terbuka tepat waktu walau cron jarang jalan).
 */
export async function sapuBanSementara({ token = null, maks = 25 } = {}) {
  const kol = await usersCol();
  const q = { suspended: true, suspendedSampai: { $lte: new Date() } };
  if (token) q.token = String(token);
  const daftar = await kol.find(q, { projection: { token: 1 } }).limit(maks).toArray();
  let dibuka = 0;
  for (const u of daftar) {
    const r = await ubahBlokir({ token: u.token, aksi: "unban", alasan: "Ban sementara berakhir", kabari: true }).catch(() => null);
    if (r?.ok) dibuka++;
  }
  return { dibuka };
}
