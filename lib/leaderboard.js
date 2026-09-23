// Papan peringkat "Pembeli Terbanyak" mingguan, beserta pencairan hadiahnya.
//
// Kenapa ada berkas tersendiri: perhitungan peringkatnya dipakai di empat
// tempat — halaman leaderboard, cron mingguan, panel admin, dan notifikasi.
// Sebelumnya tiap tempat menulis pipeline-nya sendiri, dan yang di halaman
// leaderboard menyaring status: "completed" padahal pesanan OTP yang berhasil
// TIDAK PERNAH berstatus itu — nilainya "done". Akibatnya papan peringkatnya
// selalu kosong, dan tidak ada yang tahu kenapa karena tidak ada error apa pun:
// kueri yang tidak cocok dengan apa pun tetap kueri yang sah.
import { otpOrdersCol, usersCol, balanceLogsCol, userNotificationsCol, weeklyBuyerLeaderboardCol } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { logBalance } from "@/lib/ledger";
import { leaderboardWinnersNotif } from "@/lib/telegram";
import { umumkan } from "@/lib/notifyHub";
import { notifyBotUser } from "@/lib/shopBot";

// Status pesanan OTP yang dianggap BERHASIL. Ditulis sekali di sini supaya
// tidak ada lagi tempat yang menebak-nebak sendiri.
export const STATUS_SUKSES = "done";

export const DEFAULT_PRIZES = [5000, 3000, 1000];

// Rentang satu minggu menurut WIB: Senin 00:00 sampai Senin berikutnya.
// offset 0 = minggu berjalan, -1 = minggu lalu.
export function weekRange(offset = 0, now = new Date()) {
  const wib = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const hari = wib.getDay(); // 0 = Minggu
  const geserKeSenin = hari === 0 ? -6 : 1 - hari;
  const senin = new Date(wib);
  senin.setDate(wib.getDate() + geserKeSenin + offset * 7);
  senin.setHours(0, 0, 0, 0);
  const seninBerikutnya = new Date(senin);
  seninBerikutnya.setDate(senin.getDate() + 7);
  return { start: senin, end: seninBerikutnya };
}

export const weekKey = (start) => new Date(start).toISOString().slice(0, 10);

function samarkan(token = "") {
  const t = String(token || "");
  if (t.length <= 8) return t || "???";
  return `${t.slice(0, 4)}••••${t.slice(-4)}`;
}

/**
 * Peringkat pembeli dalam satu rentang waktu.
 *
 * Pesanan yang DIREFUND tidak dihitung. Kalau ikut dihitung, siapa pun bisa
 * memuncaki papan peringkat dengan memesan banyak nomor lalu membiarkannya
 * gagal — uangnya kembali utuh dan peringkatnya tetap naik.
 */
export async function topBuyers({ start, end, limit = 20 }) {
  const col = await otpOrdersCol();
  const raw = await col
    .aggregate([
      {
        $match: {
          status: STATUS_SUKSES,
          refunded: { $ne: true },
          createdAt: { $gte: new Date(start), $lt: new Date(end) }
        }
      },
      { $group: { _id: "$token", count: { $sum: 1 }, totalSpent: { $sum: "$price" } } },
      // Jumlah transaksi dulu, baru nilainya sebagai penentu seri. Yang diberi
      // nama "Pembeli Terbanyak" harus diurutkan menurut banyaknya pembelian.
      { $sort: { count: -1, totalSpent: -1, _id: 1 } },
      { $limit: Math.max(1, Math.min(100, limit)) }
    ])
    .toArray();

  return raw.map((r, i) => ({
    rank: i + 1,
    token: r._id,
    maskedToken: samarkan(r._id),
    count: r.count,
    totalSpent: r.totalSpent || 0
  }));
}

// Hadiah per peringkat, bisa diubah admin tanpa deploy ulang.
export function prizesFrom(settings) {
  const raw = settings?.leaderboard?.prizes;
  const list = Array.isArray(raw) && raw.length ? raw : DEFAULT_PRIZES;
  return list.slice(0, 10).map((n, i) => ({ rank: i + 1, amount: Math.max(0, Math.floor(Number(n) || 0)) }));
}

export function prizeForRank(settings, rank) {
  return prizesFrom(settings).find((p) => p.rank === rank)?.amount || 0;
}

/**
 * Cairkan hadiah satu minggu. Aman dipanggil berulang: penanda selesainya
 * diklaim ATOMIK lewat weeklyBuyerLeaderboardCol, jadi cron yang jalan dua kali
 * — atau cron yang bersamaan dengan tombol admin — tidak bisa membayar dua kali.
 *
 * Ini jalur uang keluar, dan satu-satunya pengaman yang benar-benar menahan
 * pembayaran ganda adalah syarat di dalam findOneAndUpdate-nya, bukan
 * pemeriksaan "sudah pernah belum" yang dilakukan lebih dulu.
 */
export async function settleWeek({ offset = -1, alasan = "cron", paksa = false } = {}) {
  const settings = await getSettings();
  const { start, end } = weekRange(offset);
  const key = weekKey(start);
  const col = await weeklyBuyerLeaderboardCol();

  const klaim = await col.findOneAndUpdate(
    paksa ? { _id: key } : { _id: key, settled: { $ne: true } },
    { $set: { settled: true, settledAt: new Date(), settledBy: alasan }, $setOnInsert: { _id: key, weekStart: start } },
    { upsert: true, returnDocument: "after" }
  );
  if (!klaim) {
    return { ok: false, alreadySettled: true, weekKey: key, winners: [] };
  }

  const prizes = prizesFrom(settings);
  const peringkat = await topBuyers({ start, end, limit: prizes.length });
  if (peringkat.length === 0) {
    await col.updateOne({ _id: key }, { $set: { winners: [], kosong: true } });
    return { ok: true, weekKey: key, winners: [], kosong: true };
  }

  const users = await usersCol();
  const notif = await userNotificationsCol();
  const winners = [];

  for (const orang of peringkat) {
    const amount = prizeForRank(settings, orang.rank);
    if (amount <= 0) continue;

    const updated = await users.findOneAndUpdate(
      { token: orang.token },
      { $inc: { balance: amount, leaderboardEarnings: amount } },
      { returnDocument: "after" }
    );
    if (!updated) continue;

    await logBalance({
      token: orang.token,
      type: "weekly_leaderboard_prize",
      amount,
      balanceAfter: updated.balance,
      title: `Hadiah Pembeli Terbanyak #${orang.rank}`,
      ref: key
    });

    await notif.insertOne({
      token: orang.token,
      type: "reward",
      title: "🏆 Hadiah Pembeli Terbanyak!",
      body: `Kamu peringkat #${orang.rank} minggu lalu dengan ${orang.count} transaksi. Rp${amount.toLocaleString("id-ID")} sudah masuk saldomu.`,
      read: false,
      createdAt: new Date()
    });

    // Kalau dia datang lewat bot, kabari di chatnya juga.
    notifyBotUser(
      orang.token,
      `🏆 <b>HADIAH PEMBELI TERBANYAK</b>\n\nKamu peringkat <b>#${orang.rank}</b> minggu lalu dengan <b>${orang.count}</b> transaksi.\n💰 <b>Rp${amount.toLocaleString("id-ID")}</b> sudah masuk saldomu.`
    );

    winners.push({ ...orang, amount, balance: updated.balance, name: updated.name || null });
  }

  await col.updateOne(
    { _id: key },
    { $set: { winners: winners.map((w) => ({ rank: w.rank, token: w.token, count: w.count, amount: w.amount })) } }
  );

  if (winners.length) {
    // Diumumkan ke channel dan dipin: pengumuman pemenang yang tenggelam di
    // antara notif transaksi tidak ada gunanya sebagai pengumuman.
    const teks = leaderboardWinnersNotif({ winners, start, end });
    umumkan({ jenis: "juara", admin: teks, publik: teks });
  }

  return { ok: true, weekKey: key, winners, weekStart: start, weekEnd: end };
}

/**
 * Hadiah khusus dari admin ke satu peringkat, kapan saja — di luar jadwal
 * mingguan. Dicatat terpisah supaya tidak tertukar dengan hadiah otomatis, dan
 * supaya memberi hadiah dua kali memang terbaca sebagai dua kali di mutasi.
 */
export async function sendPrizeToRank({ offset = 0, rank, amount, note = "" }) {
  const r = Math.max(1, Math.floor(Number(rank) || 0));
  const amt = Math.floor(Number(amount) || 0);
  if (amt <= 0) return { ok: false, error: "Nominal hadiah harus lebih dari 0." };
  if (amt > 10_000_000) return { ok: false, error: "Nominal hadiah terlalu besar." };

  const { start, end } = weekRange(offset);
  const peringkat = await topBuyers({ start, end, limit: r });
  const orang = peringkat.find((p) => p.rank === r);
  if (!orang) return { ok: false, error: `Belum ada pembeli di peringkat #${r} untuk periode ini.` };

  const users = await usersCol();
  const updated = await users.findOneAndUpdate(
    { token: orang.token },
    { $inc: { balance: amt, leaderboardEarnings: amt } },
    { returnDocument: "after" }
  );
  if (!updated) return { ok: false, error: "Pemilik peringkat itu tidak ditemukan." };

  await logBalance({
    token: orang.token,
    type: "leaderboard_bonus",
    amount: amt,
    balanceAfter: updated.balance,
    title: note || `Hadiah admin untuk peringkat #${r}`,
    ref: weekKey(start)
  });

  const notif = await userNotificationsCol();
  await notif.insertOne({
    token: orang.token,
    type: "reward",
    title: "🎁 Hadiah dari Admin!",
    body: `${note || `Hadiah untuk peringkat #${r} Pembeli Terbanyak`}. Rp${amt.toLocaleString("id-ID")} sudah masuk saldomu.`,
    read: false,
    createdAt: new Date()
  });

  notifyBotUser(
    orang.token,
    `🎁 <b>HADIAH DARI ADMIN</b>\n\n${note || `Hadiah untuk peringkat #${r} Pembeli Terbanyak`}.\n💰 <b>Rp${amt.toLocaleString("id-ID")}</b> sudah masuk saldomu.`
  );

  return { ok: true, rank: r, amount: amt, maskedToken: orang.maskedToken, count: orang.count, balance: updated.balance };
}
