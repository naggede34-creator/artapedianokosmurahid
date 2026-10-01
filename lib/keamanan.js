// Pusat keamanan otomatis platform (di luar anti-curang game, lihat lib/anticurang.js):
//  • catat kejadian (login admin gagal, penangguhan, temuan pemindaian) → koleksi security_events
//  • pemindaian pola mencurigakan: banjir OTP/deposit, saldo negatif, lonjakan transfer, banyak akun satu perangkat
//  • penangguhan otomatis (bisa dimatikan admin) + kabar ke Telegram admin
//  • pindaiBerkala(): dipanggil dari cron tick & lalu lintas web — jalan tiap ±10 menit tanpa cron tambahan
import { usersCol, otpOrdersCol, depositsCol, balanceLogsCol, userNotificationsCol, perangkatCol, keamananCol, wdInstanCol } from "@/lib/db";
import { cfg, cfgAngka } from "@/lib/config";
import { sendTelegramNotif } from "@/lib/telegram";
import { tahan } from "@/lib/tahan";

const MENIT = 60_000;
const samar = (t = "") => (t && t.length > 8 ? `${t.slice(0, 4)}••••${t.slice(-4)}` : t || "-");
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const nyala = async (nama, bawaan = "1") => String((await cfg(nama)) ?? bawaan) !== "0";

/** tingkat: info | sedang | tinggi | kritis */
export async function catatKejadian({ jenis, tingkat = "info", ip = null, token = null, detail = "" }) {
  try {
    await (await keamananCol()).insertOne({ jenis, tingkat, ip, token, detail: String(detail).slice(0, 300), at: new Date() });
  } catch (e) {
    console.error("[keamanan] gagal mencatat:", e?.message || e);
  }
}

/** Ringkasan untuk panel admin. */
export async function ringkasanKeamanan() {
  const kol = await keamananCol();
  const sehari = new Date(Date.now() - 24 * 60 * MENIT);
  const [terbaru, tinggi24, login24, suspend24, status] = await Promise.all([
    kol.find({ at: { $exists: true } }).sort({ at: -1 }).limit(30).toArray(),
    kol.countDocuments({ tingkat: { $in: ["tinggi", "kritis"] }, at: { $gte: sehari } }),
    kol.countDocuments({ jenis: "login-admin-gagal", at: { $gte: sehari } }),
    kol.countDocuments({ jenis: "suspend-otomatis", at: { $gte: sehari } }),
    kol.findOne({ _id: "status" })
  ]);
  return {
    aktif: await nyala("KEAMANAN_OTOMATIS"),
    suspendAktif: await nyala("KEAMANAN_SUSPEND_OTOMATIS"),
    pemindaianTerakhir: status?.terakhir || null,
    hasilTerakhir: status?.hasil || null,
    tinggi24jam: tinggi24, loginGagal24jam: login24, suspend24jam: suspend24,
    terbaru: terbaru.map((e) => ({ jenis: e.jenis, tingkat: e.tingkat, at: e.at, ip: e.ip || null, token: e.token ? samar(e.token) : null, detail: e.detail || "" }))
  };
}

/** Satu putaran pemindaian. Mengembalikan { flagged, ditangguhkan, temuan[] }. */
export async function pindaiKeamanan({ kabarBersih = false } = {}) {
  const now = new Date();
  const users = await usersCol();
  const suspendBoleh = await nyala("KEAMANAN_SUSPEND_OTOMATIS");
  const temuan = []; // { token, alasan, tingkat }
  const tambah = (token, alasan, tingkat) => { if (token && !temuan.some((x) => x.token === token && x.alasan === alasan)) temuan.push({ token, alasan, tingkat }); };

  // 1. Banjir OTP: ≥15 pesanan dalam 1 jam dari satu akun.
  const jam = new Date(now.getTime() - 60 * MENIT);
  const otp = await (await otpOrdersCol()).aggregate([
    { $match: { createdAt: { $gte: jam }, status: { $in: ["pending", "completed"] } } },
    { $group: { _id: "$token", n: { $sum: 1 } } }, { $match: { n: { $gte: 15 } } }
  ]).toArray();
  for (const x of otp) tambah(x._id, `Banjir OTP: ${x.n} pesanan dalam 1 jam`, "tinggi");

  // 2. Banjir deposit: ≥10 tagihan dalam 30 menit.
  const dep = await (await depositsCol()).aggregate([
    { $match: { createdAt: { $gte: new Date(now.getTime() - 30 * MENIT) } } },
    { $group: { _id: "$token", n: { $sum: 1 } } }, { $match: { n: { $gte: 10 } } }
  ]).toArray();
  for (const x of dep) tambah(x._id, `Banjir deposit: ${x.n} tagihan dalam 30 menit`, "sedang");

  // 3. Saldo negatif (tidak seharusnya terjadi).
  const negatif = await users.find({ balance: { $lt: -1000 }, suspended: { $ne: true } }).limit(20).toArray();
  for (const u of negatif) tambah(u.token, `Saldo negatif Rp${Number(u.balance).toLocaleString("id-ID")}`, "kritis");

  // 4. Lonjakan transfer keluar: banyak transfer dalam 1 jam (indikasi pemindahan dana / cuci saldo).
  const batasTransfer = Math.max(3, await cfgAngka("KEAMANAN_TRANSFER_MAKS_JAM", 12));
  const tf = await (await balanceLogsCol()).aggregate([
    { $match: { type: "transfer_out", createdAt: { $gte: jam } } },
    { $group: { _id: "$token", n: { $sum: 1 }, total: { $sum: { $abs: "$amount" } } } }, { $match: { n: { $gte: batasTransfer } } }
  ]).toArray();
  for (const x of tf) tambah(x._id, `Lonjakan transfer: ${x.n}× (Rp${Number(x.total).toLocaleString("id-ID")}) dalam 1 jam`, x.n >= batasTransfer * 2 ? "tinggi" : "sedang");

  // 5. Banyak akun berbeda pada satu perangkat dalam 24 jam (akun ganda / farming bonus).
  const batasAkun = Math.max(2, await cfgAngka("KEAMANAN_AKUN_PER_PERANGKAT", 4));
  const akunGanda = await (await perangkatCol()).aggregate([
    { $match: { dev: { $ne: null }, firstAt: { $gte: new Date(now.getTime() - 24 * 60 * MENIT) } } },
    { $group: { _id: "$dev", tokens: { $addToSet: "$token" } } }, { $project: { tokens: 1, n: { $size: "$tokens" } } }, { $match: { n: { $gte: batasAkun } } }
  ]).toArray();
  for (const x of akunGanda) for (const t of x.tokens.slice(0, 6)) tambah(t, `Satu perangkat dipakai ${x.n} akun berbeda dalam 24 jam`, "sedang");

  // 6. Penarikan otomatis: menarik LEBIH banyak daripada total deposit (seharusnya mustahil — indikasi celah/penyalahgunaan).
  const lebih = await users.find({ wdNokosTotal: { $gt: 0 }, suspended: { $ne: true } }, { projection: { token: 1, wdNokosTotal: 1, depositTotal: 1 } }).limit(500).toArray();
  for (const u of lebih) if ((u.wdNokosTotal || 0) > (u.depositTotal || 0) + 1000) tambah(u.token, `Penarikan Rp${Number(u.wdNokosTotal).toLocaleString("id-ID")} melebihi total deposit Rp${Number(u.depositTotal || 0).toLocaleString("id-ID")}`, "kritis");

  // 7. Menebak nomor/tujuan: banyak penarikan GAGAL dari satu akun dalam 1 jam.
  try {
    const gagalWd = await (await wdInstanCol()).aggregate([
      { $match: { createdAt: { $gte: jam }, status: "gagal", token: { $ne: null } } },
      { $group: { _id: "$token", n: { $sum: 1 } } }, { $match: { n: { $gte: 4 } } }
    ]).toArray();
    for (const x of gagalWd) tambah(x._id, `Penarikan gagal berulang: ${x.n}× dalam 1 jam`, "sedang");
  } catch {}

  // Tindakan: bekukan yang tinggi/kritis (bila diizinkan), catat sisanya.
  const ditangguhkan = [];
  const kol = await keamananCol();
  for (const f of temuan) {
    const u = await users.findOne({ token: f.token }, { projection: { suspended: 1, anticurangBebas: 1, name: 1 } });
    if (!u) continue;
    // Temuan yang sama jangan dikabari berulang tiap 10 menit: 1× per jam per akun+alasan.
    const pernah = await kol.findOne({ jenis: "temuan", token: f.token, detail: f.alasan, at: { $gte: new Date(now.getTime() - 60 * MENIT) } });
    const tinggi = f.tingkat === "tinggi" || f.tingkat === "kritis";
    if (tinggi && suspendBoleh && !u.suspended && !u.anticurangBebas) {
      await users.updateOne({ token: f.token, suspended: { $ne: true } }, { $set: { suspended: true, suspendedAt: now, suspendReason: `Auto-security: ${f.alasan}`, "securityFlags.lastFlag": f.alasan, "securityFlags.flaggedAt": now } });
      try {
        await (await userNotificationsCol()).insertOne({ token: f.token, type: "warning", title: "⚠️ Akun Ditangguhkan Otomatis", body: "Akun kamu ditangguhkan karena aktivitas mencurigakan. Saldo tetap aman — hubungi admin untuk pemulihan.", read: false, createdAt: now });
      } catch {}
      await catatKejadian({ jenis: "suspend-otomatis", tingkat: f.tingkat, token: f.token, detail: f.alasan });
      ditangguhkan.push(f);
    } else {
      await users.updateOne({ token: f.token }, { $set: { "securityFlags.lastFlag": f.alasan, "securityFlags.flaggedAt": now } });
      if (!pernah) await catatKejadian({ jenis: "temuan", tingkat: f.tingkat, token: f.token, detail: f.alasan });
    }
    f.baru = !pernah || ditangguhkan.includes(f);
  }

  const baru = temuan.filter((f) => f.baru);
  if (baru.length) {
    const baris = baru.map((f) => `${f.tingkat === "kritis" ? "🚨" : f.tingkat === "tinggi" ? "🔴" : "🟡"} <code>${esc(samar(f.token))}</code> — ${esc(f.alasan)}${ditangguhkan.includes(f) ? " → <b>DIBEKUKAN</b>" : ""}`).join("\n");
    await sendTelegramNotif(`🛡️ <b>KEAMANAN OTOMATIS</b>\n━━━━━━━━━━━━━━━━━━\n${baris}\n━━━━━━━━━━━━━━━━━━\n🚫 Dibekukan: ${ditangguhkan.length} akun · ${now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`);
  } else if (kabarBersih) {
    await sendTelegramNotif(`🛡️ Pemindaian keamanan: bersih (${now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB)`);
  }
  const hasil = { flagged: temuan.length, ditangguhkan: ditangguhkan.length };
  await kol.updateOne({ _id: "status" }, { $set: { terakhir: now, hasil } }, { upsert: true });
  return { ...hasil, temuan: temuan.map((f) => ({ token: samar(f.token), alasan: f.alasan, tingkat: f.tingkat })) };
}

let sedang = false;
let terakhirLokal = 0;
/** Memindai bila sudah >10 menit sejak pemindaian terakhir (dibagi lintas instance lewat dokumen status). */
export async function pindaiBerkala() {
  if (sedang || Date.now() - terakhirLokal < 2 * MENIT) return { dilewati: true };
  sedang = true;
  terakhirLokal = Date.now();
  try {
    if (!(await nyala("KEAMANAN_OTOMATIS"))) return { nonaktif: true };
    const status = await (await keamananCol()).findOne({ _id: "status" });
    if (status?.terakhir && Date.now() - new Date(status.terakhir).getTime() < 10 * MENIT) return { dilewati: true };
    return await pindaiKeamanan();
  } catch (e) {
    console.error("[keamanan] pindai berkala:", e?.message || e);
    return { galat: true };
  } finally {
    sedang = false;
  }
}

/** Dijalankan di latar tanpa menunda respons (dijaga waitUntil di Vercel). */
export function pindaiDiLatar() {
  tahan(pindaiBerkala());
}

// ─────────────────────────── LOGIN ADMIN ───────────────────────────
// Percobaan masuk admin yang gagal dihitung per IP: ≥3 dalam 15 menit → admin dikabari; ≥6 → IP dikunci 30 menit.
const gagalAdmin = new Map(); // ip → { n, t0, kunciSampai }
export function adminTerkunci(ip) {
  const e = gagalAdmin.get(ip || "?");
  return e?.kunciSampai && e.kunciSampai > Date.now() ? Math.ceil((e.kunciSampai - Date.now()) / 1000) : 0;
}
export async function catatLoginAdminGagal(ip) {
  const k = ip || "?";
  const now = Date.now();
  let e = gagalAdmin.get(k);
  if (!e || now - e.t0 > 15 * MENIT) e = { n: 0, t0: now, kunciSampai: 0 };
  e.n += 1;
  if (e.n >= 6) e.kunciSampai = now + 30 * MENIT;
  gagalAdmin.set(k, e);
  if (gagalAdmin.size > 2000) gagalAdmin.clear();
  await catatKejadian({ jenis: "login-admin-gagal", tingkat: e.n >= 3 ? "tinggi" : "sedang", ip: k, detail: `Percobaan ke-${e.n} dalam 15 menit${e.kunciSampai ? " — IP dikunci 30 menit" : ""}` });
  if (e.n === 3 || e.n === 6) {
    await sendTelegramNotif(`🚨 <b>PERCOBAAN MASUK ADMIN GAGAL</b>\n🌐 IP: <code>${esc(k)}</code>\n🔁 Percobaan ke-${e.n} dalam 15 menit${e.kunciSampai ? "\n🔒 <b>IP dikunci 30 menit</b>" : ""}\nBila ini bukan kamu, segera ganti kode admin.`);
  }
  return e;
}
export function loginAdminBerhasil(ip) { gagalAdmin.delete(ip || "?"); }
