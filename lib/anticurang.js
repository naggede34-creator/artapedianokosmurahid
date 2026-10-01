// Anti-curang game: akun ganda pada satu perangkat/jaringan, kolusi antar-akun di duel, dan pola mencurigakan.
//
// Lapisan pertahanan (makin ke bawah makin "lunak" karena IP bisa dipakai bersama orang tak bersalah):
//   1. PERANGKAT  : id perangkat acak (localStorage + cookie) dikirim klien lewat header `x-perangkat`.
//                   Dua akun yang sama-sama aktif bermain game pada SATU perangkat → akun yang lebih baru di-BAN otomatis
//                   (akun tertua dipertahankan). Akun baru di perangkat yang pernah terkena ban → ban (menghindari ban).
//   2. DUEL       : lawan yang berbagi perangkat dengan tuan rumah → duel DIBLOKIR (& ban bila perangkat sama).
//                   Berbagi IP saja → diblokir + peringatan (strike); strike ke-2 dalam 7 hari → ban.
//                   Pasangan yang terlalu sering bertanding bertaruhan (≥4 kali/24 jam) → diblokir + kabar admin.
//   3. POLA       : duel bertaruhan yang selesai nyaris tanpa langkah (“buang” saldo) → kabar admin + strike kedua pemain.
//   4. IP RAMAI   : ≥3 akun aktif-game dari satu IP dalam 24 jam → kabar admin (tanpa ban; IP bersama itu wajar di ponsel).
//
// Setiap tindakan dicatat di `anti_curang` (terlihat di tab Game admin) dan dikabari ke Telegram admin + log monitor.
// Ban memakai mekanisme yang sudah ada (`users.suspended`), jadi admin bisa membukanya lewat tab Pengguna.
// Saklar admin: GAME_ANTICURANG_AKTIF (pemeriksaan) dan GAME_ANTICURANG_BAN (0 = hanya kabari, jangan ban).
import { usersCol, perangkatCol, antiCurangCol, userNotificationsCol, gameMatchCol } from "@/lib/db";
import { cfg } from "@/lib/config";
import { sendTelegramNotif } from "@/lib/telegram";
import { sendMonitorLog } from "@/lib/monitor";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const samar = (t = "") => (t.length <= 8 ? t : `${t.slice(0, 4)}••••${t.slice(-4)}`);
const waktu = () => new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " WIB";
const HARI = 24 * 3600_000;

const aktifCek = async () => String((await cfg("GAME_ANTICURANG_AKTIF")) ?? "1") !== "0";
const ipCek = async () => String((await cfg("GAME_ANTICURANG_IP")) ?? "1") !== "0";
const banBoleh = async () => String((await cfg("GAME_ANTICURANG_BAN")) ?? "1") !== "0";

// ───────────────────────── PERANGKAT ─────────────────────────
/** Membaca sidik perangkat & IP dari permintaan. */
export function bacaPerangkat(req) {
  const h = req.headers;
  const mentah = String(h.get("x-perangkat") || "");
  const [dev, fp] = mentah.split(".");
  const ip = String(h.get("x-forwarded-for") || "").split(",")[0].trim() || String(h.get("x-real-ip") || "");
  return {
    dev: /^[a-f0-9]{16,48}$/.test(dev || "") ? dev : null,
    fp: /^[a-f0-9]{8,20}$/.test(fp || "") ? fp : null,
    ip: ip.slice(0, 64) || null,
    ada: !!mentah
  };
}

const terakhirCatat = new Map(); // kunci → { ip, fp, t }: menghemat tulis ke DB
/** Mencatat (akun, perangkat, IP) — hanya menulis bila berubah atau sudah >10 menit. */
export async function catatPerangkat(token, info) {
  if (!token || !info || (!info.dev && !info.ip)) return;
  const kunci = `${token}|${info.dev || "-"}`;
  const c = terakhirCatat.get(kunci);
  const now = Date.now();
  if (c && c.ip === info.ip && c.fp === info.fp && now - c.t < 10 * 60_000) return;
  terakhirCatat.set(kunci, { ip: info.ip, fp: info.fp, t: now });
  if (terakhirCatat.size > 5000) terakhirCatat.clear();
  try {
    const kol = await perangkatCol();
    const ubah = { $set: { token, dev: info.dev, fp: info.fp, ip: info.ip, lastAt: new Date() }, $setOnInsert: { firstAt: new Date() }, $inc: { n: 1 } };
    if (info.ip && !(c && c.ip === info.ip)) ubah.$push = { ips: { $each: [info.ip], $slice: -25 } };
    await kol.updateOne({ kunci }, ubah, { upsert: true });
  } catch (err) {
    if (err?.code !== 11000) console.error("[anticurang] catat perangkat:", err?.message || err);
  }
}

// ───────────────────────── TINDAKAN ─────────────────────────
async function kabariAdmin(judul, baris, token) {
  const teks = `${judul}\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n${baris.filter(Boolean).join("\n")}\n🕒 ${waktu()}`;
  try { sendTelegramNotif(teks); } catch {}
  try { await sendMonitorLog(teks); } catch {}
  void token;
}

async function catatLog(jenis, data) {
  try { await (await antiCurangCol()).insertOne({ jenis, at: new Date(), ...data }); } catch (err) { console.error("[anticurang] log:", err?.message || err); }
}

const peringatanTerakhir = new Map();
const lulus = new Map(); // token → waktu lulus terakhir (cache 25 dtk)
const LULUS_MS = 25_000;

/** Membatalkan duel yang masih menunggu milik akun yang di-ban (taruhan dikembalikan). Dimuat malas agar tak melingkar. */
export async function bereskanDuel(token) {
  try {
    const { batalDuel } = await import("@/lib/game/inti");
    const { profilPid } = await import("@/lib/wa/inti");
    const kol = await gameMatchCol();
    const menunggu = await kol.find({ status: "menunggu", "pemain.token": token }).limit(10).toArray();
    for (const g of menunggu) {
      const p = g.pemain.find((x) => x.token === token);
      const me = p ? await profilPid(p.pid) : null;
      if (me) await batalDuel(me, g.gameId);
    }
  } catch (err) { console.error("[anticurang] bereskan duel:", err?.message || err); }
}

/** Hapus cache "sudah lulus pemeriksaan" supaya blokir manual langsung berlaku di game (bukan setelah 25 dtk). */
export const lupakanLulus = (token) => lulus.delete(token);

/**
 * Membekukan akun. true bila BARU di-ban sekarang. Bila GAME_ANTICURANG_BAN=0, hanya dicatat & dikabari.
 * `alasan` dipakai apa adanya di pesan ke pengguna & admin.
 */
export async function banOtomatis(token, alasan, konteks = {}) {
  const users = await usersCol();
  const u = await users.findOne({ token }, { projection: { name: 1, suspended: 1, saldoGame: 1, balance: 1, anticurangBebas: 1 } });
  // Akun yang sudah DIBUKA admin setelah ditinjau tidak di-ban otomatis lagi (daftar putih), tetapi tetap dikabari.
  if (!u || u.suspended) return false;
  if (u.anticurangBebas) return false;
  const ban = await banBoleh();
  const rincian = [
    `🔑 Akun : <code>${esc(samar(token))}</code> · ${esc(u.name || "—")}`,
    `📋 Alasan: ${esc(alasan)}`,
    konteks.perangkat ? `📱 Perangkat: <code>${esc(String(konteks.perangkat).slice(0, 10))}…</code>` : "",
    konteks.ip ? `🌐 IP: <code>${esc(konteks.ip)}</code>` : "",
    konteks.lain ? `👥 Terkait: ${esc(konteks.lain)}` : "",
    `💰 Poin game: ${Math.round((u.saldoGame || 0) / 500 * 100) / 100} · saldo nokos Rp${(u.balance || 0).toLocaleString("id-ID")}`
  ];
  if (!ban) {
    // Mode "hanya kabari": satu kabar per akun+alasan per jam supaya admin tidak dibanjiri.
    const kunciPeringatan = `${token}|${alasan}`;
    if (Date.now() - (peringatanTerakhir.get(kunciPeringatan) || 0) < 3600_000) return false;
    peringatanTerakhir.set(kunciPeringatan, Date.now());
    if (peringatanTerakhir.size > 2000) peringatanTerakhir.clear();
    await catatLog("peringatan", { token, alasan, ...konteks });
    await kabariAdmin("⚠️ <b>ANTI-CURANG — AKTIVITAS MENCURIGAKAN</b> (ban otomatis nonaktif)", rincian, token);
    return false;
  }
  const r = await users.findOneAndUpdate(
    { token, suspended: { $ne: true } },
    { $set: { suspended: true, suspendedAt: new Date(), suspendReason: `Anti-curang game: ${alasan}`, autoBanGame: true } },
    { returnDocument: "after" }
  );
  if (!r) return false;
  lulus.delete(token);
  await catatLog("ban", { token, alasan, ...konteks });
  try {
    await (await userNotificationsCol()).insertOne({
      token, type: "warning", title: "🚫 Akun Dibekukan Otomatis",
      body: `Sistem keamanan game mendeteksi aktivitas yang melanggar aturan (${alasan}). Saldo & poinmu tetap aman. Hubungi admin bila ini keliru.`,
      read: false, createdAt: new Date()
    });
  } catch {}
  await kabariAdmin("🚫 <b>ANTI-CURANG — AKUN DI-BAN OTOMATIS</b>", [...rincian, "🔓 Buka lewat tab Pengguna → Aktifkan."], token);
  bereskanDuel(token).catch(() => {});
  return true;
}

/** Peringatan ringan: 1 strike. Strike ke-2 dalam 7 hari → ban. Mengembalikan true bila akhirnya di-ban. */
export async function tambahStrike(token, alasan, konteks = {}) {
  const users = await usersCol();
  const now = new Date();
  const u = await users.findOneAndUpdate({ token }, { $push: { strikeGame: { $each: [{ at: now, alasan }], $slice: -6 } } }, { returnDocument: "after" });
  if (!u) return false;
  const baru = (u.strikeGame || []).filter((s) => now - new Date(s.at) < 7 * HARI);
  await catatLog("strike", { token, alasan, n: baru.length, ...konteks });
  if (baru.length >= 2) return banOtomatis(token, `${alasan} (peringatan ke-${baru.length})`, konteks);
  await kabariAdmin("🟡 <b>ANTI-CURANG — PERINGATAN</b>", [
    `🔑 Akun : <code>${esc(samar(token))}</code> · ${esc(u.name || "—")}`, `📋 ${esc(alasan)}`, konteks.lain ? `👥 Terkait: ${esc(konteks.lain)}` : "", konteks.ip ? `🌐 IP: <code>${esc(konteks.ip)}</code>` : "",
    "Peringatan ke-1 — pelanggaran berikutnya dalam 7 hari = ban otomatis."
  ], token);
  return false;
}

// ───────────────────────── PEMERIKSAAN PER AKSI GAME ─────────────────────────
/**
 * Dipanggil di awal setiap aksi game/dompet-poin. null = silakan; selain itu { alasan, status }.
 * Selalu memblokir akun yang ditangguhkan. Pemeriksaan perangkat dijalankan bila GAME_ANTICURANG_AKTIF.
 */
export async function jagaGame(me, req) {
  const users = await usersCol();
  const info = bacaPerangkat(req);
  if (await aktifCek()) await catatPerangkat(me.token, info);

  const cache = lulus.get(me.token);
  if (cache && Date.now() - cache < LULUS_MS) return null;

  const u = await users.findOne({ token: me.token }, { projection: { suspended: 1, suspendReason: 1, gameAktifAt: 1, createdAt: 1, name: 1, anticurangBebas: 1 } });
  if (!u) return { alasan: "Akun tidak ditemukan.", status: 404 };
  if (u.suspended) return { alasan: `Akun ditangguhkan${u.suspendReason ? ` (${u.suspendReason})` : ""}. Hubungi admin untuk bantuan.`, status: 403 };
  if (!(await aktifCek()) || u.anticurangBebas) { lulus.set(me.token, Date.now()); return null; } // dibebaskan admin → tidak diperiksa lagi

  if (!u.gameAktifAt) await users.updateOne({ token: me.token, gameAktifAt: { $exists: false } }, { $set: { gameAktifAt: new Date() } });

  // — akun lain pada perangkat yang sama
  if (info.dev) {
    const baris = await (await perangkatCol()).find({ dev: info.dev, token: { $ne: me.token } }).limit(30).toArray();
    const lainToken = [...new Set(baris.map((b) => b.token))];
    if (lainToken.length) {
      const lain = await users.find({ token: { $in: lainToken }, gameAktifAt: { $exists: true } }, { projection: { token: 1, name: 1, suspended: 1, autoBanGame: 1, createdAt: 1, gameAktifAt: 1, anticurangBebas: 1 } }).toArray();
      const umur = (x) => new Date(x.createdAt || x.gameAktifAt || 0).getTime();
      // Akun yang LEBIH LAMA dariku pernah di-ban pada perangkat ini → aku membuat akun baru untuk menghindari ban.
      const pernahBan = lain.filter((x) => x.suspended && x.autoBanGame && umur(x) < new Date(u.createdAt || u.gameAktifAt || Date.now()).getTime());
      if (pernahBan.length) {
        const diBan = await banOtomatis(me.token, "akun baru di perangkat yang pernah terkena ban (menghindari ban)", { perangkat: info.dev, ip: info.ip, lain: pernahBan.map((x) => samar(x.token)).join(", ") });
        if (diBan) return { alasan: "Akun ditangguhkan oleh sistem keamanan game. Hubungi admin untuk bantuan.", status: 403 };
      }
      const hidup = lain.filter((x) => !x.suspended && !x.anticurangBebas);
      if (hidup.length) {
        const semua = [{ token: me.token, name: u.name, createdAt: u.createdAt, gameAktifAt: u.gameAktifAt || new Date() }, ...hidup].sort((a, b) => umur(a) - umur(b));
        const tertua = semua[0];
        const daftar = semua.map((x) => `${esc(x.name || "—")} (${samar(x.token)})`).join(", ");
        let saya = false;
        for (const x of semua.slice(1)) {
          const diBan = await banOtomatis(x.token, "lebih dari satu akun bermain game pada satu perangkat", { perangkat: info.dev, ip: info.ip, lain: `dipertahankan: ${tertua.name || "—"} (${samar(tertua.token)}) · semua: ${daftar}` });
          if (diBan && x.token === me.token) saya = true;
        }
        if (saya) return { alasan: "Akun ditangguhkan: terdeteksi lebih dari satu akun bermain game pada satu perangkat. Hubungi admin bila ini keliru.", status: 403 };
      }
    }
  }

  // — banyak akun aktif-game dari satu IP (hanya kabar)
  if (info.ip && (await ipCek())) await periksaIpRamai(me, info.ip).catch(() => {});

  lulus.set(me.token, Date.now());
  if (lulus.size > 5000) lulus.clear();
  return null;
}

const ipDikabari = new Set();
async function periksaIpRamai(me, ip) {
  const kunci = `${ip}|${new Date().toISOString().slice(0, 10)}`;
  if (ipDikabari.has(kunci)) return;
  const kol = await perangkatCol();
  const baris = await kol.find({ ips: ip, lastAt: { $gte: new Date(Date.now() - HARI) } }).limit(50).toArray();
  const tokens = [...new Set(baris.map((b) => b.token))];
  if (tokens.length < 3) return;
  const aktif = await (await usersCol()).find({ token: { $in: tokens }, gameAktifAt: { $exists: true }, suspended: { $ne: true } }, { projection: { token: 1, name: 1 } }).toArray();
  if (aktif.length < 3) return;
  ipDikabari.add(kunci);
  if (ipDikabari.size > 2000) ipDikabari.clear();
  await catatLog("ip-ramai", { token: me.token, ip, akun: aktif.map((a) => a.token) });
  await kabariAdmin("🟡 <b>ANTI-CURANG — BANYAK AKUN SATU IP</b>", [
    `🌐 IP: <code>${esc(ip)}</code>`, `👥 ${aktif.length} akun aktif-game dalam 24 jam:`, ...aktif.slice(0, 8).map((a) => `• ${esc(a.name || "—")} <code>${esc(samar(a.token))}</code>`),
    "ℹ️ Bisa jaringan bersama (kos/kantor/seluler) — tidak di-ban otomatis. Periksa manual bila ada pola duel antar-akun ini."
  ], me.token);
}

// ───────────────────────── DUEL: PEMERIKSAAN PASANGAN ─────────────────────────
/**
 * Dipanggil sebelum penantang mengambil kursi. `tuan` dan `penantang` = { token, pid, nama }.
 * Mengembalikan null bila boleh; selain itu { alasan } (duel TIDAK dimulai, tidak ada taruhan yang berpindah).
 */
export async function periksaPasangan(tuan, penantang, req, { taruhan = 0 } = {}) {
  if (!(await aktifCek())) return null;
  try {
    const info = req ? bacaPerangkat(req) : { dev: null, fp: null, ip: null, ada: false };
    const kol = await perangkatCol();
    const [a, b] = await Promise.all([kol.find({ token: tuan.token }).limit(40).toArray(), kol.find({ token: penantang.token }).limit(40).toArray()]);
    const devA = new Set(a.map((x) => x.dev).filter(Boolean)), ipA = new Set(a.flatMap((x) => [x.ip, ...(x.ips || [])]).filter(Boolean));
    const devB = new Set([...b.map((x) => x.dev), info.dev].filter(Boolean)), ipB = new Set([...b.flatMap((x) => [x.ip, ...(x.ips || [])]), info.ip].filter(Boolean));
    const devSama = [...devB].find((d) => devA.has(d));
    const konteks = { perangkat: devSama || info.dev, ip: info.ip, lain: `lawan: ${tuan.nama} (${samar(tuan.token)})` };
    if (devSama) {
      await catatLog("kolusi-perangkat", { token: penantang.token, tuan: tuan.token, dev: devSama });
      await banOtomatis(penantang.token, "bertanding melawan akun di perangkat yang sama (kolusi)", konteks);
      await kabariAdmin("🚨 <b>ANTI-CURANG — DUEL ANTAR-AKUN SATU PERANGKAT</b>", [
        `⚔️ ${esc(tuan.nama)} <code>${esc(samar(tuan.token))}</code> 🆚 ${esc(penantang.nama)} <code>${esc(samar(penantang.token))}</code>`, `💰 Taruhan: ${taruhan ? `Rp${taruhan.toLocaleString("id-ID")}` : "tanpa"}`,
        "Duel diblokir; akun penantang di-ban. Periksa juga akun tuan rumah."
      ], penantang.token);
      return { alasan: "Duel diblokir: kamu dan lawan terdeteksi memakai perangkat yang sama. Akunmu ditangguhkan oleh sistem keamanan." };
    }
    const ipSama = (await ipCek()) ? [...ipB].find((ip) => ipA.has(ip)) : null;
    if (ipSama) {
      const diBan = await tambahStrike(penantang.token, "bertanding melawan akun pada jaringan/IP yang sama", { ...konteks, ip: ipSama });
      await catatLog("duel-ip-sama", { token: penantang.token, tuan: tuan.token, ip: ipSama });
      return { alasan: diBan ? "Akunmu ditangguhkan oleh sistem keamanan game." : "Duel diblokir demi keamanan: kamu dan lawan terdeteksi memakai jaringan (IP) yang sama. Duel antar-akun satu jaringan tidak diizinkan. Mengulang bisa membuat akunmu dibekukan." };
    }
    if (taruhan > 0) {
      const sejak = new Date(Date.now() - HARI);
      const n = await (await gameMatchCol()).countDocuments({ taruhan: { $gt: 0 }, createdAt: { $gte: sejak }, status: { $in: ["main", "selesai"] }, "pemain.pid": { $all: [tuan.pid, penantang.pid] } });
      const batas = Math.max(1, Math.round(Number(await cfg("GAME_PASANGAN_MAKS")) || 4));
      if (n >= batas) {
        await catatLog("pasangan-sering", { token: penantang.token, tuan: tuan.token, n });
        await kabariAdmin("🟡 <b>ANTI-CURANG — PASANGAN TERLALU SERING BERTARUH</b>", [
          `⚔️ ${esc(tuan.nama)} <code>${esc(samar(tuan.token))}</code> 🆚 ${esc(penantang.nama)} <code>${esc(samar(penantang.token))}</code>`, `🔁 ${n} duel bertaruhan dalam 24 jam — diblokir. Periksa kemungkinan oper-poin (win-trading).`
        ], penantang.token);
        return { alasan: "Kalian sudah terlalu sering bertanding dengan taruhan dalam 24 jam terakhir. Coba lawan lain atau tunggu besok." };
      }
    }
  } catch (err) {
    console.error("[anticurang] periksa pasangan:", err?.message || err);
  }
  return null;
}

// ───────────────────────── HASIL DUEL ─────────────────────────
/** Duel bertaruhan yang berakhir nyaris tanpa langkah = pola "buang saldo" → strike kedua pemain + kabar admin. */
export async function periksaHasil(g) {
  try {
    if (!(await aktifCek())) return;
    if (!g?.taruhan || !g.pemain?.[1]) return;
    const langkah = Math.max(0, (g.ver || 1) - 1);
    const durasi = g.mulaiAt && g.selesaiAt ? new Date(g.selesaiAt) - new Date(g.mulaiAt) : null;
    if (langkah > 1 || durasi == null || durasi > 120_000) return;
    const [a, b] = g.pemain;
    await catatLog("duel-terlalu-cepat", { gameId: g.gameId, a: a.token, b: b.token, langkah, durasi });
    await kabariAdmin("🟡 <b>ANTI-CURANG — DUEL BERTARUH SELESAI TERLALU CEPAT</b>", [
      `⚔️ ${esc(a.nama)} <code>${esc(samar(a.token))}</code> 🆚 ${esc(b.nama)} <code>${esc(samar(b.token))}</code>`, `⏱ ${Math.round(durasi / 1000)} dtk · ${langkah} langkah · taruhan Rp${g.taruhan.toLocaleString("id-ID")}`,
      `📝 ${esc(g.hasil?.alasan || "")}`, "Kemungkinan oper-poin lewat duel. Kedua akun mendapat peringatan."
    ], a.token);
    await tambahStrike(a.token, "duel bertaruh selesai nyaris tanpa langkah", { lain: `${b.nama} (${samar(b.token)})` });
    await tambahStrike(b.token, "duel bertaruh selesai nyaris tanpa langkah", { lain: `${a.nama} (${samar(a.token)})` });
  } catch (err) {
    console.error("[anticurang] periksa hasil:", err?.message || err);
  }
}

// ───────────────────────── ADMIN ─────────────────────────
export async function ringkasanAntiCurang() {
  const kol = await antiCurangCol();
  const baris = await kol.find({}).sort({ at: -1 }).limit(25).toArray();
  const tujuh = new Date(Date.now() - 7 * HARI);
  const [ban, peringatan] = await Promise.all([kol.countDocuments({ jenis: "ban", at: { $gte: tujuh } }), kol.countDocuments({ jenis: { $in: ["strike", "peringatan", "ip-ramai", "duel-ip-sama", "pasangan-sering", "duel-terlalu-cepat", "kolusi-perangkat"] }, at: { $gte: tujuh } })]);
  return {
    aktif: await aktifCek(), banAktif: await banBoleh(), ban7hari: ban, peringatan7hari: peringatan,
    terbaru: baris.map((r) => ({ jenis: r.jenis, at: r.at, token: r.token ? samar(r.token) : null, alasan: r.alasan || null, ip: r.ip || null, n: r.n || null }))
  };
}
