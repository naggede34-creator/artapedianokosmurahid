// Pesan SIARAN ke segmen pengguna: notifikasi di dalam web (lonceng), push web, dan/atau pesan bot Telegram.
// Berjalan sebagai antrean: admin membuat siaran → `prosesSiaran` mengirim bertahap (per kelompok pengguna, kursor = kode akun)
// dari cron & dari tombol "Proses" — aman untuk serverless, bisa dihentikan, dan satu pengguna tidak pernah menerima dua kali
// (kursor maju monoton). Akun yang di-ban dilewati.
import { usersCol, userNotificationsCol, getDb } from "@/lib/db";
import { kirimPush } from "@/lib/webPush";
import { notifyBotUser } from "@/lib/shopBot";

export const SEGMEN = {
  semua: "Semua pengguna",
  baru: "Pengguna baru (daftar ≤ 7 hari)",
  belum_deposit: "Belum pernah deposit",
  pernah_deposit: "Pernah deposit",
  saldo_besar: "Saldo besar (≥ batas yang diisi)",
  pernah_saldo_habis: "Pernah deposit tapi saldo hampir habis (< Rp1.000)"
};
const col = async () => (await getDb()).collection("siaran");

export function filterSegmen(segmen, param = 0) {
  const f = { suspended: { $ne: true } };
  const hari = (n) => new Date(Date.now() - n * 86400000);
  if (segmen === "baru") f.createdAt = { $gte: hari(7) };
  else if (segmen === "belum_deposit") f.$or = [{ depositTotal: { $exists: false } }, { depositTotal: { $lte: 0 } }];
  else if (segmen === "pernah_deposit") f.depositTotal = { $gt: 0 };
  else if (segmen === "saldo_besar") f.balance = { $gte: Math.max(1, Math.round(Number(param) || 50000)) };
  else if (segmen === "pernah_saldo_habis") { f.depositTotal = { $gt: 0 }; f.balance = { $lt: 1000 }; }
  else if (segmen !== "semua") return null;
  return f;
}

export async function hitungSegmen(segmen, param) {
  const f = filterSegmen(segmen, param);
  if (!f) return null;
  return (await usersCol()).countDocuments(f);
}

const bersih = (s, n) => String(s || "").replace(/[<>&]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const tautanAman = (u) => (/^\/(?!\/)[A-Za-z0-9\-._~/?=&%#:+@!$()*,;]*$/.test(String(u || "")) ? String(u) : "/");

export async function buatSiaran({ judul, isi, url, segmen, param, kanal = {}, oleh = "admin" }) {
  const j = bersih(judul, 80), i = bersih(isi, 400);
  if (j.length < 3 || i.length < 3) return { ok: false, alasan: "Judul dan isi wajib diisi (min 3 huruf)." };
  const f = filterSegmen(segmen, param);
  if (!f) return { ok: false, alasan: "Segmen tidak dikenal." };
  const k = { notif: kanal.notif !== false, push: !!kanal.push, bot: !!kanal.bot };
  if (!k.notif && !k.push && !k.bot) return { ok: false, alasan: "Pilih minimal satu saluran." };
  const total = await (await usersCol()).countDocuments(f);
  if (!total) return { ok: false, alasan: "Tidak ada pengguna di segmen ini." };
  const doc = { id: `SR-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase(), judul: j, isi: i, url: tautanAman(url), segmen, param: Number(param) || 0, kanal: k, status: "berjalan", total, terkirim: 0, kursor: "", at: new Date(), oleh };
  await (await col()).insertOne(doc);
  return { ok: true, id: doc.id, total };
}

/** Mengirim satu kelompok untuk tiap siaran yang berjalan. Aman dipanggil bersamaan: kursor dimajukan lebih dulu (klaim). */
export async function prosesSiaran({ kelompok = 150 } = {}) {
  const sc = await col();
  const jobs = await sc.find({ status: "berjalan" }).sort({ at: 1 }).limit(3).toArray();
  const ringkas = [];
  for (const job of jobs) {
    const f = { ...filterSegmen(job.segmen, job.param), ...(job.kursor ? { token: { $gt: job.kursor } } : {}) };
    const users = await (await usersCol()).find(f, { projection: { token: 1 } }).sort({ token: 1 }).limit(kelompok).toArray();
    if (!users.length) { await sc.updateOne({ id: job.id }, { $set: { status: "selesai", selesaiAt: new Date() } }); ringkas.push({ id: job.id, selesai: true }); continue; }
    const akhir = users[users.length - 1].token;
    // Klaim: hanya satu pemroses yang berhasil memajukan kursor dari nilai yang sama.
    const klaim = await sc.findOneAndUpdate({ id: job.id, status: "berjalan", kursor: job.kursor || "" }, { $set: { kursor: akhir } });
    if (!klaim) continue;
    const now = new Date();
    if (job.kanal.notif) {
      await (await userNotificationsCol()).insertMany(users.map((u) => ({ token: u.token, type: "info", title: `📣 ${job.judul}`, body: job.isi, read: false, createdAt: now, url: job.url, siaranId: job.id })), { ordered: false }).catch(() => {});
    }
    const lain = async (u) => {
      if (job.kanal.push) await kirimPush(u.token, { judul: job.judul, isi: job.isi, url: job.url, tag: `siaran-${job.id}` }).catch(() => {});
      if (job.kanal.bot) notifyBotUser(u.token, `📣 <b>${job.judul}</b>\n${job.isi}`);
    };
    if (job.kanal.push || job.kanal.bot) for (let i = 0; i < users.length; i += 10) await Promise.all(users.slice(i, i + 10).map(lain));
    await sc.updateOne({ id: job.id }, { $inc: { terkirim: users.length } });
    ringkas.push({ id: job.id, dikirim: users.length });
  }
  return ringkas;
}

export async function batalSiaran(id) {
  const r = await (await col()).findOneAndUpdate({ id: String(id), status: "berjalan" }, { $set: { status: "dibatalkan", selesaiAt: new Date() } });
  return r ? { ok: true } : { ok: false, alasan: "Siaran tidak sedang berjalan." };
}

export async function daftarSiaran(limit = 20) {
  const rows = await (await col()).find({}).sort({ at: -1 }).limit(limit).toArray();
  return rows.map(({ _id, ...r }) => r);
}
