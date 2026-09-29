// Lencana verifikasi Room Chat. HANYA admin yang bisa memberi atau mencabut;
// warnanya dipilih admin (biru, hitam, oranye, pink, hijau, dst.).
import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { waProfilCol } from "@/lib/db";
import { LENCANA, lencanaSah, publik, lupakanCache, escRegex } from "@/lib/wa/inti";
import { kirimPush } from "@/lib/webPush";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const samar = (t = "") => (t.length <= 8 ? t : `${t.slice(0, 4)}••••${t.slice(-4)}`);
const bentuk = (p) => ({ ...publik(p), kode: samar(p.token) });

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const q = String(new URL(req.url).searchParams.get("q") || "").trim().slice(0, 40);
  const kol = await waProfilCol();
  const pemegang = await kol.find({ lencana: { $ne: null } }, { projection: { foto: 0 } }).sort({ nama: 1 }).limit(300).toArray();
  let hasil = [];
  if (q) {
    const re = { $regex: escRegex(q), $options: "i" };
    // Cari lewat nama, id publik, atau kode akun (admin memang boleh mencari lewat kode).
    hasil = await kol.find({ $or: [{ nama: re }, { pid: re }, { token: re }] }, { projection: { foto: 0 } }).limit(30).toArray();
  }
  return NextResponse.json({
    warna: Object.entries(LENCANA).map(([kunci, v]) => ({ kunci, ...v })),
    pemegang: pemegang.filter((p) => p.lencana).map(bentuk),
    hasil: hasil.map(bentuk)
  });
}

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!rateLimit("admin-lencana", 120, 60_000)) return NextResponse.json({ error: "Terlalu cepat." }, { status: 429 });
  const { pid, warna } = await req.json().catch(() => ({}));
  if (!pid) return NextResponse.json({ error: "Pengguna belum dipilih." }, { status: 400 });
  if (warna !== null && !lencanaSah(warna)) return NextResponse.json({ error: "Warna lencana tidak dikenal." }, { status: 400 });
  const kol = await waProfilCol();
  const p = await kol.findOneAndUpdate({ pid: String(pid) }, { $set: { lencana: warna || null, lencanaAt: new Date() } }, { returnDocument: "after", projection: { foto: 0 } });
  if (!p) return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  lupakanCache(p.token);
  if (warna) {
    kirimPush(p.token, { judul: "Lencana verifikasi 🎖", isi: `Kamu mendapat lencana ${LENCANA[warna].label.toLowerCase()} di Room Chat!`, url: "/chat" }).catch(() => {});
  }
  return NextResponse.json({ ok: true, pengguna: bentuk(p) });
}
