// WEARTA AI CHAT — asisten pintar di dalam WEARTA CHAT (seperti Meta AI di WhatsApp).
//  • Tiap pengguna punya satu obrolan pribadi dengan asisten (roomId "ai-<pid>"), selalu tersemat di paling atas.
//  • Di obrolan mana pun, awali pesan dengan "@ai" atau "@wearta" untuk memanggilnya.
//  • Mengenal Artapedia (deposit QRIS, nomor OTP, game & poin, bot Telegram, WEARTA CHAT) dan memanggil model AI
//    dengan ingatan percakapan singkat; bila model sedang sibuk, jawaban cadangan dari panduan bawaan dipakai.
import { randomUUID } from "node:crypto";
import { waPesanCol, waRoomCol, usersCol } from "@/lib/db";
import { askCsAi } from "@/lib/neoxr";
import { ambilRoom, anggotaRoom } from "@/lib/wa/room";

export const NAMA_AI = "WEARTA AI";
export const idRoomAi = (pid) => `ai-${pid}`;
export const adalahRoomAi = (roomId) => String(roomId || "").startsWith("ai-");
export const POLA_PANGGIL = /^\s*@(ai|wearta(?:\s*ai)?)\b[:,]?\s*/i;

const PENGANTAR = `Halo! Aku **WEARTA AI**, asisten pintar di WEARTA CHAT 🦅✨\n\nAku bisa bantu:\n• Cara deposit, beli nomor OTP, isi poin game & tarik poin\n• Menjelaskan fitur WEARTA CHAT, Arena Pendekar & game lain\n• Menulis pesan/caption, menerjemahkan, merangkum, memberi ide\n• Menjawab pertanyaan umum\n\nKetik pertanyaanmu, atau pilih saran di bawah ya!`;

/** Membuat (bila belum ada) obrolan pribadi dengan asisten. */
export async function pastikanRoomAi(me) {
  const kol = await waRoomCol();
  const roomId = idRoomAi(me.pid);
  let r = await kol.findOne({ roomId });
  if (!r) {
    const now = new Date();
    try {
      await kol.insertOne({ roomId, jenis: "ai", anggota: [me.pid], admin: [], nama: NAMA_AI, deskripsi: "Asisten pintar WEARTA CHAT", createdAt: now, lastAt: now, lastPreview: { dari: null, jenis: "teks", teks: "Halo! Aku WEARTA AI — tanya apa saja ✨", at: now } });
      await (await waPesanCol()).insertOne({
        msgId: randomUUID(), roomId, dari: null, namaDari: NAMA_AI, jenis: "teks", teks: PENGANTAR, isAI: true, aiPersona: NAMA_AI,
        reaksi: {}, dihapusUntuk: [], readBy: [], deliveredTo: [], bintang: [], createdAt: now
      });
    } catch (e) { if (e?.code !== 11000) throw e; }
    r = await kol.findOne({ roomId });
  }
  return r;
}

const PENGETAHUAN = `Kamu adalah WEARTA AI, asisten resmi di WEARTA CHAT milik Artapedia (artapedia.id). Jawab dalam Bahasa Indonesia yang ramah, jelas, ringkas (maks ±6 kalimat atau daftar pendek), boleh pakai emoji secukupnya. Jujur: kamu adalah AI. Jangan pernah meminta kode akun, kata sandi, atau data rahasia; ingatkan pengguna untuk tidak membagikannya.
Pengetahuan Artapedia:
- Deposit saldo nokos lewat QRIS di menu Deposit atau bot Telegram; saldo masuk otomatis setelah dibayar (bayar PERSIS nominal yang tertera). Jika belum masuk, tekan Cek Pembayaran atau hubungi CS.
- Beli nomor OTP di menu "Beli Nokos": pilih server, aplikasi, negara; kode OTP muncul otomatis; ada jaminan ganti nomor/refund bila OTP tidak masuk.
- Game memakai POIN (2 poin = Rp1.000), terpisah dari saldo nokos. Isi poin lewat QRIS manual atau ubah dari saldo nokos; tukar poin ke saldo nokos; tarik ke e-wallet (ada minimal & biaya, diproses admin 1–2 hari kerja).
- Game solo: Plinko, Mahjong Spin 1024, Dadu Naga, Keno Hoki, Roda Hoki. Duel antar pengguna: Catur, UNO, Remi, Mahjong, Domino Gaple, Arena Pendekar (game tarung 5 petarung). Semua hasil dijaga server.
- WEARTA CHAT: chat pribadi & grup, foto, suara, stiker, dokumen, jajak pendapat, balasan, reaksi, status, panggilan suara/video, pesan sementara.
- Keamanan: satu perangkat satu akun untuk game; akun yang curang dibekukan otomatis.
- Bantuan manusia: tombol Customer Service di web/bot.`;

const FAQ = [
  [/deposit|isi saldo|top ?up|qris/i, "Untuk deposit: buka menu **Deposit** (atau bot Telegram), pilih metode QRIS, masukkan nominal, lalu bayar PERSIS sesuai total yang tertera sebelum waktunya habis. Saldo masuk otomatis. Kalau belum masuk, tekan *Cek Pembayaran* atau hubungi Customer Service 🙏"],
  [/otp|nomor|nokos|sms|kode/i, "Untuk beli nomor OTP: menu **Beli Nokos** → pilih server, aplikasi, dan negara → beli. Kode OTP muncul otomatis di halaman pesanan. Bila OTP tidak masuk, ada jaminan ganti nomor/refund otomatis 📱"],
  [/poin|game|tarik|tukar/i, "Game memakai **poin** (2 poin = Rp1.000). Isi poin lewat QRIS manual atau ubah dari saldo nokos di halaman *Poin Game*. Poin bisa ditukar ke saldo nokos atau ditarik ke e-wallet (ada minimal & biaya; diproses admin 1–2 hari kerja) 🎮"],
  [/arena|tarung|pendekar/i, "**Arena Pendekar** adalah game tarung 1 lawan 1 dengan 5 petarung. Main solo melawan CPU (gratis) atau duel lawan pengguna lain dengan taruhan poin. Buka tab Game → Arena Pendekar 🥋"],
  [/chat|wa|grup|panggil|status/i, "WEARTA CHAT mirip WhatsApp: chat pribadi & grup, foto, suara, stiker, dokumen, lokasi, status 24 jam, dan panggilan suara/video. Mulai dari tab Obrolan atau Kontak 💬"],
  [/halo|hai|hi\b|hello|pagi|siang|malam/i, "Halo! 👋 Aku WEARTA AI. Mau tanya soal deposit, nomor OTP, poin game, atau fitur WEARTA CHAT? Tinggal ketik!"]
];
const cadangan = (t) => FAQ.find(([p]) => p.test(t))?.[1] || "Maaf, aku lagi sulit menjawab itu sekarang 😅 Coba tanya lebih spesifik (deposit, OTP, poin game, WEARTA CHAT), atau hubungi Customer Service lewat tombol bantuan.";

function bersihkan(t) {
  return String(t || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1200);
}

/**
 * Menjawab pesan pengguna. `roomId` = obrolan asisten pribadi ATAU obrolan lain bila dipanggil dengan "@ai".
 * Mengembalikan { replied, teks }.
 */
export async function balasAsisten(me, roomId, teks) {
  const pribadi = roomId === idRoomAi(me.pid);
  let pesanUser = String(teks || "").trim();
  if (!pribadi) {
    const r = await ambilRoom(roomId);
    if (!r || !anggotaRoom(r, me.pid)) return { replied: false };
    if (!POLA_PANGGIL.test(pesanUser)) return { replied: false };
    pesanUser = pesanUser.replace(POLA_PANGGIL, "").trim() || "Halo!";
  }
  if (!pesanUser) return { replied: false };

  const kol = await waPesanCol();
  const riwayat = await kol.find({ roomId, dihapusSemua: { $ne: true }, jenis: "teks" }).sort({ createdAt: -1 }).limit(pribadi ? 8 : 4).toArray();
  const ingatan = [...riwayat].reverse().map((m) => `${m.isAI ? NAMA_AI : m.namaDari || "Pengguna"}: ${String(m.teks || "").slice(0, 220)}`).join("\n");
  // Data pribadi pengguna sendiri (untuk menjawab "saldoku berapa?") — hanya bila ia sedang di obrolan asisten pribadinya.
  let profil = "";
  if (pribadi) {
    try {
      const u = await (await usersCol()).findOne({ token: me.token }, { projection: { balance: 1, saldoGame: 1 } });
      if (u) profil = `\nData pengguna (boleh disebut bila ditanya): nama ${me.nama}, saldo nokos Rp${Number(u.balance || 0).toLocaleString("id-ID")}, poin game ${Math.round(((u.saldoGame || 0) / 500) * 100) / 100}.`;
    } catch {}
  }
  const prompt = `${PENGETAHUAN}${profil}\n\nPercakapan terbaru:\n${ingatan}\n\n${me.nama}: ${pesanUser.slice(0, 600)}\n${NAMA_AI}:`.slice(0, 3400);

  let jawab;
  try {
    jawab = bersihkan(await askCsAi(prompt));
  } catch (e) {
    console.error("[wa/asisten]", e?.message || e);
  }
  if (!jawab) jawab = cadangan(pesanUser);

  const now = new Date();
  await kol.insertOne({
    msgId: randomUUID(), roomId, dari: null, namaDari: NAMA_AI, jenis: "teks", teks: jawab, isAI: true, aiPersona: NAMA_AI,
    reaksi: {}, dihapusUntuk: [], readBy: [], deliveredTo: [], bintang: [], createdAt: now
  });
  await (await waRoomCol()).updateOne({ roomId }, { $set: { lastAt: now, lastPreview: { dari: null, jenis: "teks", teks: jawab.slice(0, 80), at: now } } });
  return { replied: true, teks: jawab };
}
