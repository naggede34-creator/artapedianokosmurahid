// Kabar aktivitas game untuk ADMIN (Telegram): pengguna memasuki dasbor game, memulai game solo, atau membuka duel.
// Duel dimulai/selesai sudah diumumkan di lib/game/inti.js; berkas ini melengkapi tiga peristiwa lainnya.
//
// Anti-banjir: masuk dasbor dan mulai solo hanya dikabari sekali per pengguna dalam jeda tertentu (penanda waktu
// disimpan di dokumen pengguna, `users.gameLog`, sehingga berlaku juga di server tanpa memori bersama seperti Vercel).
// Kegagalan mengirim kabar TIDAK PERNAH boleh mengganggu permainan — semuanya dibungkus try/catch.
import { usersCol } from "@/lib/db";
import { cfg } from "@/lib/config";
import { umumkan } from "@/lib/notifyHub";
import { teksPoinRp } from "@/lib/poinGame";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const JEDA = { masuk: 30 * 60_000, solo: 10 * 60_000 };
const NAMA_SOLO = { plinko: "Plinko", slot: "Mahjong Spin 1024" };
const NAMA_DUEL = { catur: "Catur", uno: "UNO", remi: "Remi", mahjong: "Mahjong" };

const waktu = () => new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " WIB";
const samar = (t = "") => (t.length <= 8 ? t : `${t.slice(0, 4)}••••${t.slice(-4)}`);

/** True bila peristiwa ini boleh dikabari sekarang (dan menandainya). Tanpa jeda → selalu true. */
async function bolehKabari(token, kunci, jeda) {
  if (!jeda) return { boleh: true, user: await (await usersCol()).findOne({ token }, { projection: { saldoGame: 1, name: 1 } }) };
  const users = await usersCol();
  const u = await users.findOne({ token }, { projection: { saldoGame: 1, name: 1, gameLog: 1 } });
  if (!u) return { boleh: false };
  const terakhir = u.gameLog?.[kunci] ? new Date(u.gameLog[kunci]).getTime() : 0;
  if (Date.now() - terakhir < jeda) return { boleh: false, user: u };
  await users.updateOne({ token }, { $set: { [`gameLog.${kunci}`]: new Date() } });
  return { boleh: true, user: u };
}

/**
 * @param me   profil pengguna (token, nama)
 * @param jenis "masuk" | "solo" | "duel"
 */
export async function catatAktivitas(me, jenis, d = {}) {
  try {
    if ((await cfg("GAME_NOTIF_ADMIN")) === "0") return false;
    const kunci = jenis === "solo" ? `solo-${d.game}-${d.mode}` : jenis;
    const { boleh, user } = await bolehKabari(me.token, kunci, JEDA[jenis] || 0);
    if (!boleh) return false;
    const poin = user ? teksPoinRp(user.saldoGame ?? 0) : "—";
    const kepala = `👤 ${esc(me.nama || user?.name || "Pengguna")} · <code>${esc(samar(me.token))}</code>`;
    let teks;
    if (jenis === "masuk") {
      teks = `🎮 <b>MASUK DASBOR GAME</b>\n${kepala}\n🎲 Poin game: ${esc(poin)}\n🕒 ${waktu()}`;
    } else if (jenis === "solo") {
      teks = `🎲 <b>MULAI GAME SOLO</b>\n${kepala}\n🕹 ${esc(NAMA_SOLO[d.game] || d.game)} · ${d.mode === "saldo" ? "💳 poin game" : "🪙 koin latihan"}\n` +
        `${d.mode === "saldo" ? `💰 Taruhan: ${esc(teksPoinRp(d.bet))}\n🎲 Poin game: ${esc(poin)}\n` : ""}🕒 ${waktu()}`;
    } else if (jenis === "duel") {
      teks = `⚔️ <b>DUEL BARU DIBUKA</b>\n${kepala}\n🕹 ${esc(NAMA_DUEL[d.jenis] || d.jenis)}${d.taruhan ? ` · taruhan ${esc(teksPoinRp(d.taruhan))}` : " · main santai"}` +
        `${d.undang ? "\n🎯 Tantangan pribadi" : "\n📢 Terbuka di lobi"}\n🕒 ${waktu()}`;
    } else return false;
    umumkan({ admin: teks });
    return true;
  } catch (err) {
    console.error("[game] gagal mengabari aktivitas:", err?.message || err);
    return false;
  }
}
