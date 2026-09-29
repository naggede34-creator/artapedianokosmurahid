// Anggota AI di Grup Umum (Sanzz, Manz, Ara, ...). Dipindahkan dari
// /api/chat/ai-reply ke penyimpanan baru; hanya berlaku di Grup Umum.
import { randomUUID } from "node:crypto";
import { waPesanCol, waRoomCol } from "@/lib/db";
import { askCsAi } from "@/lib/neoxr";
import { ROOM_UMUM } from "@/lib/wa/room";

export const PERSONA = [
  { name: "Sanzz", style: "gaul, santai, suka pakai 'wkwk', 'bro', singkat 1-2 kalimat" },
  { name: "Manz", style: "cool, lugas, kadang pakai emoji, informatif singkat" },
  { name: "Ara", style: "ramah, semangat, suka kasih semangat, pakai 'kak', perempuan" },
  { name: "Dunia OTP", style: "expert OTP dan deposit, bantu teknis dengan jelas" },
  { name: "Fascall ID", style: "responsif, cepat, pakai banyak emoji, positif" },
  { name: "Zall", style: "humor ringan, santai, jawab dengan bercanda tapi tetap helpful" }
];

const KONTEKS = `Kamu adalah anggota grup chat komunitas Artapedia — platform deposit saldo QRIS dan beli nomor OTP.

Info singkat Artapedia:
- Deposit lewat QRIS, saldo masuk otomatis
- Beli nomor OTP: pilih layanan, negara, operator
- Kode akun format AP-XXXX-XXXX adalah kunci akun, simpan baik-baik

Aturan menjawab:
- Jawab singkat (1-3 kalimat max), sesuai gaya karaktermu
- Boleh pakai emoji tapi jangan berlebihan
- JANGAN minta kode akun atau data sensitif
- Jangan sebut dirimu AI atau bot — kamu anggota grup biasa yang ramah
- Kalau tidak tahu, sarankan tanya admin atau cek website`;

export function deteksiPerintah(teks) {
  const t = String(teks || "").trim().toLowerCase();
  if (t.startsWith("/tanya ")) return { cmd: "tanya", arg: String(teks).slice(7).trim() };
  if (t.startsWith("/kurs")) return { cmd: "kurs" };
  if (t.startsWith("/cek-otp")) return { cmd: "cekotp" };
  return null;
}

export function perluBalas(teks, jenis, perintah, acak = Math.random) {
  if (perintah) return true;
  if (jenis !== "teks") return acak() < 0.15;
  const t = String(teks || "").toLowerCase();
  const pemicu = ["?", "gimana", "cara", "bisa", "saldo", "otp", "deposit", "error", "kenapa", "halo", "hai", "helo", "kok", "minta", "tolong", "help", "bantu"];
  if (pemicu.some((x) => t.includes(x))) return acak() < 0.65;
  return acak() < 0.22;
}

export async function balasAI({ namaPengirim, teks, jenis = "teks" }) {
  const cmd = deteksiPerintah(teks);
  if (!perluBalas(teks, jenis, cmd)) return { replied: false };

  const kol = await waPesanCol();
  const terakhir = await kol.findOne({ roomId: ROOM_UMUM, isAI: true, dihapusSemua: { $ne: true } }, { sort: { createdAt: -1 } });
  // AI baru saja bicara (<8 dtk) dan bukan perintah: diam, supaya tidak memborbardir.
  if (!cmd && terakhir?.createdAt && Date.now() - new Date(terakhir.createdAt).getTime() < 8000) return { replied: false };

  const pool = PERSONA.filter((p) => p.name !== terakhir?.aiPersona);
  const persona = cmd?.cmd === "cekotp" || cmd?.cmd === "kurs" ? PERSONA.find((p) => p.name === "Dunia OTP") : pool[Math.floor(Math.random() * pool.length)];

  const recent = await kol.find({ roomId: ROOM_UMUM, dihapusSemua: { $ne: true }, jenis: { $in: ["teks", "gambar"] } }).sort({ createdAt: -1 }).limit(8).toArray();
  const riwayat = [...recent].reverse().map((m) => `${m.namaDari}: ${m.teks || "[gambar]"}`).join("\n");
  let akhir = `${namaPengirim}: ${teks || "[stiker]"}\n${persona.name}:`;
  if (cmd?.cmd === "tanya") akhir = `${namaPengirim} bertanya langsung: "${cmd.arg}"\nJawab dengan jelas dan membantu.\n${persona.name}:`;
  else if (cmd?.cmd === "kurs") akhir = `${namaPengirim} minta info kurs QRIS atau nilai tukar untuk deposit. Berikan info umum cara deposit di Artapedia dan estimasi kurs.\n${persona.name}:`;
  else if (cmd?.cmd === "cekotp") akhir = `${namaPengirim} mau cek status OTP. Berikan panduan singkat cara cek nomor OTP di Artapedia.\n${persona.name}:`;

  const balasan = await askCsAi(`${KONTEKS}\n\nGaya karaktermu: ${persona.style}\nNamamu: ${persona.name}\n\nPercakapan terbaru di grup:\n${riwayat}\n\n${akhir}`);
  if (!balasan) return { replied: false };

  const sekarang = new Date();
  const teksAI = String(balasan).trim().slice(0, 400);
  await kol.insertOne({
    msgId: randomUUID(), roomId: ROOM_UMUM, dari: null, namaDari: persona.name, jenis: "teks", teks: teksAI, isAI: true, aiPersona: persona.name,
    reaksi: {}, dihapusUntuk: [], readBy: [], deliveredTo: [], bintang: [], createdAt: sekarang
  });
  await (await waRoomCol()).updateOne({ roomId: ROOM_UMUM }, { $set: { lastAt: sekarang, lastPreview: { dari: null, jenis: "teks", teks: `${persona.name}: ${teksAI}`.slice(0, 80), at: sekarang } } });
  return { replied: true, persona: persona.name };
}
