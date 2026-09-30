// Dompet POIN GAME: tukar poin ke saldo nokos dan tarik poin ke e-wallet.
//
// 2 poin = Rp1.000 (lib/poinGame.js). Saldo game disimpan dalam rupiah (`users.saldoGame`).
//
// ── KEAMANAN UANG ───────────────────────────────────────────────────────────────────────────
// Sama seperti duel & solo: tiap perubahan saldo adalah SATU pembaruan atomik pada dokumen pengguna yang
// sekaligus menulis kunci idempotensi (`gameBayar`); tidak ada "baca lalu tulis".
//   tukar : { token, saldoGame ≥ rp, gameBayar ∌ ref } → saldoGame −rp, balance +bersih   (satu dokumen, satu operasi)
//   tarik : pengajuan dicatat dulu, poin DITAHAN (dipotong) atomik, lalu menunggu admin.
//           dibayar → selesai. ditolak/dibatalkan → poin dikembalikan sekali (ref idempoten); penyapu mengulang yang tertunda.
//
// ── SYARAT PERPUTARAN ───────────────────────────────────────────────────────────────────────
// Poin baru boleh ditukar/ditarik bila total taruhan game (`gameTurnover`) ≥ GAME_SYARAT_PUTAR_KALI × total poin yang
// pernah DIISI (`gameDepositTotal`). Tujuannya: bukan pintu cuci uang, dan bukti transfer palsu tidak langsung bisa
// diuangkan. Poin dari admin/hadiah tidak menambah kewajiban.
import { randomUUID } from "node:crypto";
import { usersCol, tarikPoinCol, userNotificationsCol } from "@/lib/db";
import { cfg, cfgAngka } from "@/lib/config";
import { logBalance } from "@/lib/ledger";
import { kirimPush } from "@/lib/webPush";
import { umumkan } from "@/lib/notifyHub";
import { POIN_RP, keRupiah, kelipatanPoin, teksPoin, teksRp, EWALLET } from "@/lib/poinGame";

const PANJANG_TANDA = 300;
const MAKS_MENUNGGU = 3;
const MACET_MS = 90_000;
const rp = teksRp;
const esc = (x) => String(x ?? "").replace(/[<>&]/g, "");

export async function konfigDompet() {
  const bulatkan = (n) => Math.max(POIN_RP, Math.ceil(Number(n) / POIN_RP) * POIN_RP);
  return {
    topupMinPoin: Math.max(1, Math.round(await cfgAngka("GAME_POIN_TOPUP_MIN", 2))),
    topupMaksPoin: Math.max(1, Math.round(await cfgAngka("GAME_POIN_TOPUP_MAKS", 20000))),
    tarikAktif: String((await cfg("GAME_TARIK_AKTIF")) ?? "1") !== "0",
    tarikMinRp: bulatkan(await cfgAngka("GAME_TARIK_MIN_RP", 10000)),
    tarikFeeRp: Math.max(0, Math.round(await cfgAngka("GAME_TARIK_FEE_RP", 0))),
    tarikJam: String((await cfg("GAME_TARIK_JAM")) || "Diproses maksimal 1–2 hari kerja sesuai jam kerja admin"),
    tukarAktif: String((await cfg("GAME_TUKAR_AKTIF")) ?? "1") !== "0",
    tukarFeePersen: Math.min(50, Math.max(0, await cfgAngka("GAME_TUKAR_FEE_PERSEN", 0))),
    isiNokosAktif: String((await cfg("GAME_ISI_NOKOS_AKTIF")) ?? "1") !== "0",
    isiNokosFeePersen: Math.min(50, Math.max(0, await cfgAngka("GAME_ISI_NOKOS_FEE_PERSEN", 0))),
    syaratKali: Math.max(0, await cfgAngka("GAME_SYARAT_PUTAR_KALI", 1))
  };
}

function syarat(u, k) {
  const deposit = Number(u?.gameDepositTotal) || 0;
  const putar = Number(u?.gameTurnover) || 0;
  const wajib = Math.round(deposit * k.syaratKali);
  return { deposit, putar, wajib, terpenuhi: putar >= wajib, kurang: Math.max(0, wajib - putar) };
}

async function kabari(token, { judul, isi, url = "/game-deposit", meta = null }) {
  try { await (await userNotificationsCol()).insertOne({ token, type: "game_tarik", title: judul, body: isi, read: false, createdAt: new Date(), url, ...(meta ? { meta } : {}) }); } catch {}
  await kirimPush(token, { judul, isi, url, tag: "game-tarik" }).catch(() => {});
}

const tarikPublik = (t) => ({ id: t.tid, poin: t.poin, rp: t.rp, fee: t.fee, bersih: t.bersih, ewallet: t.ewallet, nomor: t.nomor, nama: t.nama, status: t.status, catatan: t.catatan || "", refBayar: t.refBayar || "", dibuat: t.createdAt, diputus: t.diputusAt || null });

/** Semua yang dibutuhkan halaman Poin Game. */
export async function infoDompet(token) {
  const k = await konfigDompet();
  const u = await (await usersCol()).findOne({ token }, { projection: { saldoGame: 1, balance: 1, gameDepositTotal: 1, gameTurnover: 1, name: 1 } });
  if (!u) return null;
  const tarikan = await (await tarikPoinCol()).find({ token, status: { $ne: "baru" } }).sort({ createdAt: -1 }).limit(15).toArray();
  return {
    poinRp: POIN_RP,
    saldoRp: u.saldoGame || 0,
    saldoNokos: u.balance || 0,
    topup: { minPoin: k.topupMinPoin, maksPoin: k.topupMaksPoin },
    tukar: { aktif: k.tukarAktif, feePersen: k.tukarFeePersen, minPoin: 2 },
    isiNokos: { aktif: k.isiNokosAktif, feePersen: k.isiNokosFeePersen, minPoin: 2 },
    tarik: { aktif: k.tarikAktif, minRp: k.tarikMinRp, minPoin: k.tarikMinRp / POIN_RP, feeRp: k.tarikFeeRp, jam: k.tarikJam, ewallet: EWALLET, maksMenunggu: MAKS_MENUNGGU },
    syarat: { kali: k.syaratKali, ...syarat(u, k) },
    tarikan: tarikan.map(tarikPublik)
  };
}

// ───────────────────────── TUKAR KE SALDO NOKOS ─────────────────────────
export async function tukarKeNokos(token, poin) {
  const k = await konfigDompet();
  if (!k.tukarAktif) return { ok: false, alasan: "Tukar poin ke saldo nokos sedang dinonaktifkan admin." };
  const p = Number(poin);
  if (!Number.isInteger(p) || p < 2) return { ok: false, alasan: "Minimal tukar 2 poin (Rp1.000), dan harus bilangan bulat." };
  const jumlah = keRupiah(p);
  const potongan = Math.floor((jumlah * k.tukarFeePersen) / 100);
  const bersih = jumlah - potongan;
  const kol = await usersCol();
  const u = await kol.findOne({ token }, { projection: { saldoGame: 1, gameDepositTotal: 1, gameTurnover: 1 } });
  if (!u) return { ok: false, alasan: "Akun tidak ditemukan." };
  if ((u.saldoGame || 0) < jumlah) return { ok: false, alasan: "Poin game tidak cukup." };
  const sy = syarat(u, k);
  if (!sy.terpenuhi) return { ok: false, syarat: true, alasan: `Mainkan game dulu: taruhan total harus mencapai ${teksPoin(sy.wajib)} sebelum poin bisa ditukar (kurang ${teksPoin(sy.kurang)}).` };

  const ref = `tukar:${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  const h = await kol.findOneAndUpdate(
    { token, saldoGame: { $gte: jumlah }, gameBayar: { $ne: ref } },
    { $inc: { saldoGame: -jumlah, balance: bersih, gameDitukar: jumlah }, $push: { gameBayar: { $each: [ref], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (!h) return { ok: false, alasan: "Poin game tidak cukup." };
  await logBalance({ token, type: "tukar_poin_keluar", amount: -jumlah, balanceAfter: h.saldoGame, title: `Tukar ${teksPoin(jumlah)} ke saldo nokos`, ref, wallet: "game" });
  await logBalance({ token, type: "tukar_poin", amount: bersih, balanceAfter: h.balance, title: `Dari tukar ${teksPoin(jumlah)} poin game`, ref });
  await kabari(token, {
    judul: "🔁 Poin game ditukar ke saldo nokos",
    isi: [`${teksPoin(jumlah)} → ${rp(bersih)} masuk ke saldo nokos${potongan ? ` (potongan ${rp(potongan)})` : ""}.`, `Sisa poin game ${teksPoin(h.saldoGame)}.`].join("\n"),
    url: "/otp", meta: { hasil: "menang", hadiah: bersih, saldo: h.balance }
  });
  return { ok: true, poin: p, rp: jumlah, bersih, potongan, saldoRp: h.saldoGame, saldoNokos: h.balance };
}

// ───────────────────────── UBAH SALDO NOKOS → POIN GAME ─────────────────────────
// `poin` = poin yang DITERIMA (bilangan bulat). Saldo nokos yang dipotong = poin × Rp500 (+ potongan bila ada).
// Satu operasi atomik pada satu dokumen: balance −bayar, saldoGame +poin. Poin hasil ubahan menambah
// `gameDepositTotal` — diperlakukan seperti poin yang diisi, jadi harus diputar dulu sebelum bisa ditukar/ditarik
// (kalau tidak, ini jadi jalan pintas menarik saldo nokos/bonus ke e-wallet).
export async function isiPoinDariNokos(token, poin) {
  const k = await konfigDompet();
  if (!k.isiNokosAktif) return { ok: false, alasan: "Mengubah saldo nokos ke poin game sedang dinonaktifkan admin." };
  const p = Number(poin);
  if (!Number.isInteger(p) || p < 2) return { ok: false, alasan: "Minimal 2 poin (Rp1.000), dan harus bilangan bulat." };
  const rpPoin = keRupiah(p);
  if (p > k.topupMaksPoin) return { ok: false, alasan: `Maksimal ${k.topupMaksPoin.toLocaleString("id-ID")} poin sekali ubah.` };
  const potongan = Math.ceil((rpPoin * k.isiNokosFeePersen) / 100);
  const bayar = rpPoin + potongan;
  const kol = await usersCol();
  const ref = `nokos2poin:${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  const h = await kol.findOneAndUpdate(
    { token, balance: { $gte: bayar }, gameBayar: { $ne: ref } },
    { $inc: { balance: -bayar, saldoGame: rpPoin, gameDepositTotal: rpPoin, gameDariNokos: rpPoin }, $push: { gameBayar: { $each: [ref], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (!h) return { ok: false, alasan: "Saldo nokos tidak cukup." };
  await logBalance({ token, type: "tukar_nokos_ke_poin", amount: -bayar, balanceAfter: h.balance, title: `Ubah ke ${teksPoin(rpPoin)} poin game`, ref });
  await logBalance({ token, type: "tukar_nokos_ke_poin_masuk", amount: rpPoin, balanceAfter: h.saldoGame, title: `Dari saldo nokos ${rp(bayar)}`, ref, wallet: "game" });
  await kabari(token, {
    judul: "🎮 Saldo nokos diubah jadi poin game",
    isi: [`${rp(bayar)} → ${teksPoin(rpPoin)}${potongan ? ` (potongan ${rp(potongan)})` : ""}.`, `Poin game kamu sekarang ${teksPoin(h.saldoGame)}.`].join("\n"),
    url: "/chat?game=1", meta: { hasil: "menang", saldo: h.saldoGame }
  });
  return { ok: true, poin: p, rp: rpPoin, bayar, potongan, saldoRp: h.saldoGame, saldoNokos: h.balance };
}

// ───────────────────────── TARIK KE E-WALLET ─────────────────────────
export async function ajukanTarik(token, { poin, ewallet, nomor, nama }) {
  const k = await konfigDompet();
  if (!k.tarikAktif) return { ok: false, alasan: "Penarikan poin sedang dinonaktifkan admin." };
  const p = Number(poin);
  if (!Number.isInteger(p) || p < 1) return { ok: false, alasan: "Jumlah poin tidak valid." };
  const jumlah = keRupiah(p);
  if (!kelipatanPoin(jumlah)) return { ok: false, alasan: "Jumlah harus bilangan bulat poin." };
  if (jumlah < k.tarikMinRp) return { ok: false, alasan: `Minimal tarik ${rp(k.tarikMinRp)} (${teksPoin(k.tarikMinRp)}).` };
  const dompet = EWALLET.find((e) => e.toLowerCase() === String(ewallet || "").toLowerCase());
  if (!dompet) return { ok: false, alasan: "Pilih e-wallet tujuan: " + EWALLET.join(", ") + "." };
  const no = String(nomor || "").replace(/[^\d]/g, "");
  if (no.length < 9 || no.length > 15) return { ok: false, alasan: "Nomor e-wallet harus 9–15 digit." };
  const atasNama = String(nama || "").replace(/\s+/g, " ").trim();
  if (atasNama.length < 3 || atasNama.length > 60) return { ok: false, alasan: "Isi nama pemilik e-wallet (3–60 huruf)." };
  const fee = k.tarikFeeRp;
  const bersih = jumlah - fee;
  if (bersih <= 0) return { ok: false, alasan: "Jumlah tidak cukup untuk biaya tarik." };

  const kol = await usersCol();
  const u = await kol.findOne({ token }, { projection: { saldoGame: 1, gameDepositTotal: 1, gameTurnover: 1, name: 1 } });
  if (!u) return { ok: false, alasan: "Akun tidak ditemukan." };
  if ((u.saldoGame || 0) < jumlah) return { ok: false, alasan: "Poin game tidak cukup." };
  const sy = syarat(u, k);
  if (!sy.terpenuhi) return { ok: false, syarat: true, alasan: `Mainkan game dulu: taruhan total harus mencapai ${teksPoin(sy.wajib)} sebelum poin bisa ditarik (kurang ${teksPoin(sy.kurang)}).` };

  const tk = await tarikPoinCol();
  if ((await tk.countDocuments({ token, status: { $in: ["baru", "menunggu"] } })) >= MAKS_MENUNGGU) return { ok: false, alasan: `Maksimal ${MAKS_MENUNGGU} pengajuan yang sedang menunggu. Tunggu diproses dulu.` };

  const tid = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
  await tk.insertOne({ tid, token, poin: p, rp: jumlah, fee, bersih, ewallet: dompet, nomor: no, nama: atasNama, status: "baru", createdAt: new Date() });
  const ref = `tarik:${tid}`;
  // Poin DITAHAN dulu (atomik + idempoten); baru pengajuan resmi "menunggu".
  const h = await kol.findOneAndUpdate(
    { token, saldoGame: { $gte: jumlah }, gameBayar: { $ne: ref } },
    { $inc: { saldoGame: -jumlah, gameDitarik: jumlah }, $push: { gameBayar: { $each: [ref], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (!h) { await tk.deleteOne({ tid, status: "baru" }); return { ok: false, alasan: "Poin game tidak cukup." }; }
  await tk.updateOne({ tid, status: "baru" }, { $set: { status: "menunggu" } });
  await logBalance({ token, type: "tarik_poin", amount: -jumlah, balanceAfter: h.saldoGame, title: `Tarik ${teksPoin(jumlah)} ke ${dompet}`, ref, wallet: "game" });
  umumkan({ admin: `💸 <b>TARIK POIN GAME — PERLU DIBAYAR</b>\n🧾 <code>${tid}</code>\n👤 ${esc(u.name || "—")}\n💰 ${teksPoin(jumlah)} = ${rp(jumlah)} (biaya ${rp(fee)}) → <b>transfer ${rp(bersih)}</b>\n🏦 ${esc(dompet)} · <code>${no}</code> a.n. ${esc(atasNama)}` });
  await kabari(token, {
    judul: "💸 Penarikan poin diajukan",
    isi: [`${teksPoin(jumlah)} → ${rp(bersih)} ke ${dompet} (${no}).`, `⏳ ${k.tarikJam}.`, "Poin sudah ditahan; bila ditolak akan dikembalikan."].join("\n"),
    meta: { taruhan: jumlah, hadiah: bersih }
  });
  return { ok: true, tarikan: tarikPublik({ tid, poin: p, rp: jumlah, fee, bersih, ewallet: dompet, nomor: no, nama: atasNama, status: "menunggu", createdAt: new Date() }), saldoRp: h.saldoGame };
}

/** Mengembalikan poin tarikan yang batal/ditolak. Idempoten (ref) — aman diulang oleh penyapu. */
async function kembalikanPoin(t) {
  const kol = await usersCol();
  const ref = `tarik-batal:${t.tid}`;
  const h = await kol.findOneAndUpdate(
    { token: t.token, gameBayar: { $ne: ref } },
    { $inc: { saldoGame: t.rp, gameDitarik: -t.rp }, $push: { gameBayar: { $each: [ref], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (h) await logBalance({ token: t.token, type: "tarik_poin_batal", amount: t.rp, balanceAfter: h.saldoGame, title: `Poin tarikan ${t.tid} dikembalikan`, ref, wallet: "game" });
  else if (!(await kol.findOne({ token: t.token }, { projection: { _id: 1 } }))) return false;
  await (await tarikPoinCol()).updateOne({ tid: t.tid }, { $set: { refundOk: true } });
  return true;
}

export async function batalTarik(token, tid) {
  const tk = await tarikPoinCol();
  const t = await tk.findOneAndUpdate({ tid: String(tid), token, status: "menunggu" }, { $set: { status: "batal", diputusAt: new Date(), catatan: "Dibatalkan pengguna" } }, { returnDocument: "after" });
  if (!t) return { ok: false, alasan: "Pengajuan tidak ditemukan atau sudah diproses." };
  await kembalikanPoin(t);
  return { ok: true };
}

// ───────────────────────── ADMIN ─────────────────────────
export async function daftarTarikAdmin({ status = "menunggu", limit = 100 } = {}) {
  const tk = await tarikPoinCol();
  const saring = status === "semua" ? { status: { $ne: "baru" } } : { status };
  const items = await tk.find(saring).sort({ createdAt: status === "menunggu" ? 1 : -1 }).limit(Math.min(200, limit)).toArray();
  const kol = await usersCol();
  const nama = {};
  for (const tkn of [...new Set(items.map((i) => i.token))]) nama[tkn] = (await kol.findOne({ token: tkn }, { projection: { name: 1 } }))?.name || "";
  return {
    items: items.map((t) => ({ ...tarikPublik(t), token: t.token, namaAkun: nama[t.token] || "" })),
    menunggu: await tk.countDocuments({ status: "menunggu" })
  };
}

export async function putusTarik(tid, aksi, { catatan = "", refBayar = "" } = {}) {
  const tk = await tarikPoinCol();
  const c = String(catatan || "").slice(0, 200);
  if (aksi === "bayar") {
    const t = await tk.findOneAndUpdate({ tid: String(tid), status: "menunggu" }, { $set: { status: "dibayar", diputusAt: new Date(), catatan: c, refBayar: String(refBayar || "").slice(0, 80) } }, { returnDocument: "after" });
    if (!t) return { ok: false, alasan: "Pengajuan tidak ada atau sudah diputuskan." };
    await kabari(t.token, { judul: "✅ Penarikan poin sudah dibayar", isi: [`${rp(t.bersih)} sudah dikirim ke ${t.ewallet} ${t.nomor}.`, c ? `Catatan admin: ${c}` : ""].filter(Boolean).join("\n"), meta: { hasil: "menang", hadiah: t.bersih } });
    return { ok: true };
  }
  if (aksi === "tolak") {
    const t = await tk.findOneAndUpdate({ tid: String(tid), status: "menunggu" }, { $set: { status: "ditolak", diputusAt: new Date(), catatan: c } }, { returnDocument: "after" });
    if (!t) return { ok: false, alasan: "Pengajuan tidak ada atau sudah diputuskan." };
    await kembalikanPoin(t);
    await kabari(t.token, { judul: "❌ Penarikan poin ditolak", isi: [`${teksPoin(t.rp)} sudah dikembalikan ke poin game kamu.`, c ? `Alasan: ${c}` : ""].filter(Boolean).join("\n"), meta: { hasil: "kalah" } });
    return { ok: true };
  }
  return { ok: false, alasan: "Aksi tidak dikenal." };
}

// ───────────────────────── PENYAPU ─────────────────────────
export async function sapuDompet({ batas = 40 } = {}) {
  const tk = await tarikPoinCol();
  const kol = await usersCol();
  let diproses = 0;
  // Pengajuan yang proses mati di tengah: sudah terpotong → jadi "menunggu"; belum → dibuang.
  for (const t of await tk.find({ status: "baru", createdAt: { $lt: new Date(Date.now() - MACET_MS) } }).limit(batas).toArray()) {
    if (await kol.findOne({ token: t.token, gameBayar: `tarik:${t.tid}` }, { projection: { _id: 1 } })) await tk.updateOne({ tid: t.tid, status: "baru" }, { $set: { status: "menunggu" } });
    else await tk.deleteOne({ tid: t.tid, status: "baru" });
    diproses++;
  }
  // Pengembalian poin yang belum tuntas.
  for (const t of await tk.find({ status: { $in: ["batal", "ditolak"] }, refundOk: { $ne: true } }).limit(batas).toArray()) { if (await kembalikanPoin(t)) diproses++; }
  return { diproses };
}
