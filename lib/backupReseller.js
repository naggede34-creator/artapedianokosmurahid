// Backup & ringkasan untuk admin utama: pengguna web reseller dan pengguna bot reseller.
//
// Isinya sengaja sama sempitnya dengan "database akun": token, nama, saldo, dan asalnya. Riwayat pembelian
// (nomor telepon, kode OTP) tidak ikut. Token akun adalah kredensial — siapa pun yang memegang berkas ini bisa
// membuka akun-akun di dalamnya. Token BOT (kredensial Telegram) tidak pernah diekspor.
import { usersCol, resellerWebCol, botsCol, resellerKomisiCol } from "@/lib/db";
import { selCsv } from "@/lib/ekspor";

export const BATAS_BARIS = 200_000;
const PROYEKSI = { _id: 0, token: 1, name: 1, balance: 1, totalSpent: 1, createdAt: 1, rwSlug: 1, telegramBotId: 1, telegramChatId: 1, telegramUsername: 1, suspended: 1 };

const PERINGATAN = "token adalah kredensial akun. Siapa pun yang memegang berkas ini bisa membuka akun mana pun di dalamnya. Simpan di tempat aman.";

const barisUser = (u, asal) => ({
  asal,
  token: u.token,
  nama: u.name || "",
  saldo: Number(u.balance) || 0,
  totalBelanja: Number(u.totalSpent) || 0,
  ditangguhkan: !!u.suspended,
  dibuat: u.createdAt ? new Date(u.createdAt).toISOString() : "",
  ...(u.telegramChatId ? { telegramChatId: u.telegramChatId, telegramUsername: u.telegramUsername || "" } : {})
});

/** Daftar semua web reseller + pengguna tiap web. `slug` = satu web saja. */
export async function bangunBackupWebReseller({ slug = null } = {}) {
  const webCol = await resellerWebCol();
  const webs = await webCol.find(slug ? { slug } : {}).sort({ createdAt: 1 }).toArray();
  const users = await usersCol();
  const hasil = [];
  let total = 0;
  for (const w of webs) {
    const rows = await users.find({ rwSlug: w.slug }, { projection: PROYEKSI }).sort({ createdAt: 1 }).limit(BATAS_BARIS).toArray();
    total += rows.length;
    hasil.push({
      web: {
        slug: w.slug, nama: w.nama, markupPersen: w.markupPersen, aktif: w.aktif !== false, dibekukan: !!w.dibekukan,
        pemilikToken: w.pemilik, dibuat: w.createdAt ? new Date(w.createdAt).toISOString() : "",
        kunjungan: w.kunjungan || 0, pesananTotal: Math.max(0, w.pesananTotal || 0), pesananSelesai: Math.max(0, w.pesananSelesai || 0),
        omzet: Math.max(0, w.omzet || 0), komisiTotal: Math.max(0, w.komisiTotal || 0), komisiTertunda: Math.max(0, w.komisiTertunda || 0)
      },
      jumlahPengguna: rows.length,
      pengguna: rows.map((u) => barisUser(u, w.slug))
    });
  }
  return { jenis: "web-reseller", dibuat: new Date().toISOString(), jumlahWeb: hasil.length, jumlahPengguna: total, peringatan: PERINGATAN, data: hasil };
}

/** Daftar semua bot reseller (TANPA token bot) + pengguna tiap bot. `botId` = satu bot saja. */
export async function bangunBackupBotReseller({ botId = null } = {}) {
  const bc = await botsCol();
  const bots = await bc.find({ jenis: "reseller", ...(botId ? { botId: String(botId) } : {}) }).sort({ createdAt: 1 }).toArray();
  const users = await usersCol();
  const hasil = [];
  let total = 0;
  for (const b of bots) {
    const rows = await users.find({ telegramBotId: String(b.botId) }, { projection: PROYEKSI }).sort({ createdAt: 1 }).limit(BATAS_BARIS).toArray();
    total += rows.length;
    hasil.push({
      bot: {
        botId: b.botId, username: b.username || "", nama: b.nama || "", aktif: b.aktif !== false, dimatikanAdmin: !!b.dimatikanAdmin,
        pemilikToken: b.pemilikToken, ownerUsername: b.ownerUsername || "", ownerTelegramId: b.ownerTelegramId || "",
        markupPersen: Number(b.markupPersen) || 0, komisi: Number(b.komisi) || 0, jumlahPembeli: Number(b.jumlahPembeli) || 0,
        jumlahTerjual: Number(b.jumlahTerjual) || 0, dibuat: b.createdAt ? new Date(b.createdAt).toISOString() : ""
      },
      jumlahPengguna: rows.length,
      pengguna: rows.map((u) => barisUser(u, `bot:${b.username || b.botId}`))
    });
  }
  return { jenis: "bot-reseller", dibuat: new Date().toISOString(), jumlahBot: hasil.length, jumlahPengguna: total, peringatan: PERINGATAN, data: hasil };
}

/** CSV pengguna dari hasil backup di atas (satu baris per pengguna). */
export function csvPengguna(backup) {
  const kolom = ["asal", "token", "nama", "saldo", "totalBelanja", "ditangguhkan", "dibuat", "telegramChatId", "telegramUsername"];
  const out = [kolom.join(",")];
  for (const g of backup.data) for (const u of g.pengguna) out.push(kolom.map((k) => selCsv(u[k] ?? "")).join(","));
  return out.join("\n");
}

/** Ringkasan semua bot reseller untuk panel admin. */
export async function ringkasBotReseller() {
  const bc = await botsCol();
  const users = await usersCol();
  const kom = await resellerKomisiCol();
  const bots = await bc.find({ jenis: "reseller" }).sort({ createdAt: -1 }).limit(300).toArray();
  const items = [];
  for (const b of bots) {
    const logs = await kom.find({ botId: String(b.botId), ditarik: { $ne: true } }, { projection: { hargaJual: 1, komisi: 1, selesai: 1 } }).limit(50000).toArray();
    const selesai = logs.filter((l) => l.selesai);
    items.push({
      botId: b.botId, username: b.username || "", nama: b.nama || "", aktif: b.aktif !== false, dimatikanAdmin: !!b.dimatikanAdmin,
      pemilik: String(b.pemilikToken || "").slice(0, 8) + "…", ownerUsername: b.ownerUsername || "", markupPersen: Number(b.markupPersen) || 0,
      pengguna: await users.countDocuments({ telegramBotId: String(b.botId) }),
      pesanan: logs.length, pesananSelesai: selesai.length,
      omzet: selesai.reduce((a, l) => a + (Number(l.hargaJual) || 0), 0), komisiSelesai: selesai.reduce((a, l) => a + (Number(l.komisi) || 0), 0),
      komisiSaldo: Number(b.komisi) || 0, dibuat: b.createdAt || null
    });
  }
  const ringkasan = items.reduce((a, b) => ({ bot: a.bot + 1, pengguna: a.pengguna + b.pengguna, pesanan: a.pesanan + b.pesananSelesai, omzet: a.omzet + b.omzet }), { bot: 0, pengguna: 0, pesanan: 0, omzet: 0 });
  return { items, ringkasan };
}
