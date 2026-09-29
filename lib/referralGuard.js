// Penjaga bonus undang teman.
//
// Bonus dibayar dari kantong toko, jadi ia jadi sasaran: satu orang membuat
// banyak akun dari link undangannya sendiri, mendeposit di tiap akun, lalu
// memindahkan saldonya lewat transfer. Penjagaannya berlapis dan sengaja
// memilih MENAHAN, bukan menolak, untuk yang meragukan: IP yang sama bisa saja
// dua saudara di satu rumah atau satu jaringan seluler, dan menolak mereka
// diam-diam adalah kerugian yang tidak terlihat. Admin yang memutuskan.
//
// Aturan (semua bisa diatur dari tab Konfigurasi):
//   • Deposit di bawah REFERRAL_MIN_DEPOSIT tidak memicu bonus — dan tidak
//     menghabiskan jatah "deposit pertama", jadi deposit berikutnya yang
//     cukup besar tetap dihitung.
//   • Bonus dijepit ke REFERRAL_MAKS_BONUS per teman.
//   • Ditahan untuk ditinjau bila: IP daftar sama dengan pengundang, ≥2 akun
//     undangan pengundang yang sama daftar dari IP yang sama, atau pengundang
//     sudah menerima REFERRAL_MAKS_HARIAN bonus dalam 24 jam terakhir.
//   • Akun pengundang yang ditangguhkan tidak menerima bonus sama sekali.
import { createHash } from "node:crypto";
import { usersCol, balanceLogsCol, referralTertahanCol } from "@/lib/db";
import { cfg } from "@/lib/config";
import { logBalance } from "@/lib/ledger";
import { umumkan } from "@/lib/notifyHub";
import { referralBonusNotif, referralBonusPublicNotif } from "@/lib/telegram";

const GARAM = "artapedia-referral-v1";

const angkaCfg = async (nama, bawaan) => {
  const mentah = String((await cfg(nama)) ?? "").trim();
  if (mentah === "") return bawaan; // tak terisi = bawaan, BUKAN 0 (0 berarti "tanpa batas")
  const n = Number(mentah);
  return Number.isFinite(n) && n >= 0 ? n : bawaan;
};

/**
 * Sidik jari pendaftaran dari request: hash IP dan hash User-Agent. Yang
 * disimpan hanya hash bergaram, bukan IP-nya — cukup untuk membandingkan dua
 * akun, tidak cukup untuk melacak seseorang.
 */
export function sidikJari(req) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  const ua = req.headers.get("user-agent") || "";
  const h = (x) => (x ? createHash("sha256").update(GARAM + x).digest("hex").slice(0, 24) : null);
  return { signupIpHash: h(ip), signupUaHash: h(ua) };
}

/**
 * Keputusan murni dari fakta yang sudah dikumpulkan (mudah diuji).
 * @returns {{aksi:"mati"|"tidak"|"cair"|"tahan", bonus:number, alasan:string[]}}
 */
export function putuskanBonus({ amount, persen, minDeposit, maksBonus, maksHarian, fakta }) {
  // "mati": fiturnya dimatikan admin. Pemanggil tetap menghitung temannya
  // (referralCount) seperti dulu, hanya tanpa saldo.
  if (!(persen > 0)) return { aksi: "mati", bonus: 0, alasan: ["bonus dimatikan"] };
  if (amount < minDeposit) return { aksi: "tidak", bonus: 0, alasan: [`deposit di bawah minimum Rp${minDeposit}`] };
  let bonus = Math.floor((amount * persen) / 100);
  if (maksBonus > 0) bonus = Math.min(bonus, maksBonus);
  if (bonus <= 0) return { aksi: "tidak", bonus: 0, alasan: ["bonus nol"] };

  if (fakta.pengundangDitangguhkan) return { aksi: "tidak", bonus: 0, alasan: ["akun pengundang ditangguhkan"] };

  const alasan = [];
  if (fakta.ipSamaDenganPengundang) alasan.push("IP pendaftaran sama dengan pengundang");
  if (fakta.akunSeIpBersaudara >= 2) alasan.push(`${fakta.akunSeIpBersaudara} akun undangan pengundang ini daftar dari IP yang sama`);
  if (maksHarian > 0 && fakta.bonusHariIni >= maksHarian) alasan.push(`pengundang sudah menerima ${fakta.bonusHariIni} bonus dalam 24 jam`);
  return alasan.length ? { aksi: "tahan", bonus, alasan } : { aksi: "cair", bonus, alasan: [] };
}

/** Mengumpulkan fakta dari database lalu memutuskan. */
export async function nilaiBonus({ invited, referrer, amount }) {
  const users = await usersCol();
  const persen = await angkaCfg("REFERRAL_BONUS_PERCENT", 0);
  const minDeposit = await angkaCfg("REFERRAL_MIN_DEPOSIT", 10000);
  const maksBonus = await angkaCfg("REFERRAL_MAKS_BONUS", 50000);
  const maksHarian = await angkaCfg("REFERRAL_MAKS_HARIAN", 10);

  const ip = invited?.signupIpHash || null;
  const fakta = {
    pengundangDitangguhkan: Boolean(referrer?.suspended),
    ipSamaDenganPengundang: Boolean(ip && referrer?.signupIpHash && ip === referrer.signupIpHash),
    akunSeIpBersaudara: 0,
    bonusHariIni: 0
  };
  if (ip && referrer?.token) {
    // Akun undangan pengundang ini yang daftar dari IP yang sama (termasuk yang sedang dinilai).
    fakta.akunSeIpBersaudara = await users.countDocuments({ referredBy: referrer.token, signupIpHash: ip });
  }
  if (referrer?.token && maksHarian > 0) {
    const log = await balanceLogsCol();
    fakta.bonusHariIni = await log.countDocuments({
      token: referrer.token,
      type: "referral",
      createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) }
    });
  }
  return putuskanBonus({ amount, persen, minDeposit, maksBonus, maksHarian, fakta });
}

/** Menyimpan bonus yang ditahan. Idempoten per deposit (indeks unik). */
export async function tahanBonus({ invited, referrer, amount, bonus, alasan, depositOrderId }) {
  const col = await referralTertahanCol();
  try {
    await col.insertOne({
      id: `RT-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
      depositOrderId: String(depositOrderId),
      referrerToken: referrer.token,
      invitedToken: invited.token,
      amount,
      bonus,
      alasan,
      status: "menunggu",
      createdAt: new Date()
    });
    return true;
  } catch (err) {
    if (err?.code === 11000) return false;
    throw err;
  }
}

/**
 * Mencairkan bonus ke saldo pengundang: menambah saldo, mencatat mutasi, dan
 * mengabari. bonus 0 hanya menghitung teman (aturan lama saat fitur mati).
 * Dipakai oleh deposit (cair langsung) dan oleh persetujuan admin (dari antrean).
 */
export async function cairkanBonusReferral({ referrerToken, invitedToken, bonus, amount, ref }) {
  const users = await usersCol();
  const referrer = await users.findOneAndUpdate(
    { token: referrerToken },
    { $inc: { balance: bonus, referralEarnings: bonus, referralCount: 1 } },
    { returnDocument: "after" }
  );
  if (!referrer || !(bonus > 0)) return referrer || null;

  await logBalance({
    token: referrer.token,
    type: "referral",
    amount: bonus,
    balanceAfter: referrer.balance,
    title: "Bonus undang teman",
    ref
  });
  // Bonus masuk diam-diam ke saldo orang yang mungkin tidak sedang membuka web.
  // Ke channel, kode akun yang diundang TIDAK ikut: pasangan pengundang–diundang
  // bukan urusan pembaca channel.
  umumkan({
    jenis: "referral",
    admin: referralBonusNotif({
      referrerToken: referrer.token,
      invitedToken,
      bonus,
      amount,
      balance: referrer.balance,
      referralCount: referrer.referralCount
    }),
    publik: referralBonusPublicNotif({ bonus, referrerToken: referrer.token })
  }).catch(() => {});
  return referrer;
}

/** Daftar antrean untuk panel admin. */
export async function daftarTertahan(status = "menunggu", batas = 100) {
  const col = await referralTertahanCol();
  return col.find({ status }).sort({ createdAt: -1 }).limit(batas).toArray();
}

/**
 * Keputusan admin atas satu bonus tertahan. Klaim atomik lewat status di dalam
 * filter: dua klik "setujui" (atau setujui + tolak) tidak bisa sama-sama menang.
 */
export async function putuskanTertahan(id, keputusan) {
  if (!["setujui", "tolak"].includes(keputusan)) return { ok: false, error: "Keputusan tidak dikenal." };
  const col = await referralTertahanCol();
  const baru = keputusan === "setujui" ? "disetujui" : "ditolak";
  const klaim = await col.findOneAndUpdate(
    { id, status: "menunggu" },
    { $set: { status: baru, diputuskanAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!klaim) return { ok: false, error: "Sudah diputuskan sebelumnya atau tidak ditemukan." };
  if (keputusan === "setujui") {
    await cairkanBonusReferral({
      referrerToken: klaim.referrerToken,
      invitedToken: klaim.invitedToken,
      bonus: klaim.bonus,
      amount: klaim.amount,
      ref: klaim.depositOrderId
    });
  }
  return { ok: true, status: baru };
}
