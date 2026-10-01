// Skin maskot: daftar (harga, kepemilikan, ketersediaan musiman), beli pakai POIN TOKO, dan pakai.
// Skin musiman hanya bisa dibeli saat event-nya berlangsung; yang sudah dimiliki tetap bisa dipakai kapan saja.
import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { mergeLegacyPoints } from "@/lib/loyalty";
import { SKIN, SKIN_PETA } from "@/lib/gaya";
import { musimSekarang } from "@/lib/musim";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
const j = (d, s = 200) => NextResponse.json(d, { status: s, headers: { "Cache-Control": "no-store" } });
const ip = (req) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

async function ringkas(token) {
  await mergeLegacyPoints(token).catch(() => {});
  const u = await (await usersCol()).findOne({ token }, { projection: { points: 1, skinDimiliki: 1, skinAktif: 1 } });
  if (!u) return null;
  const m = await musimSekarang();
  const milik = new Set(u.skinDimiliki || []);
  return {
    poin: u.points || 0,
    aktif: u.skinAktif || "",
    skinMusimAktif: m.utama?.skin || "",
    skin: SKIN.map((s) => ({
      id: s.id, nama: s.nama, ikon: s.ikon, harga: s.harga, ket: s.ket, musim: s.musim || "", aksesori: s.aksesori || "",
      dimiliki: s.harga === 0 || milik.has(s.id),
      // Musiman: dijual hanya saat event berlangsung. Skin non-musiman selalu dijual.
      dijual: s.harga > 0 && (!s.musim || (m.skinMusim || []).includes(s.musim)),
      gratisMusim: !!s.musim && (m.skinMusim || []).includes(s.musim) // otomatis terpasang untuk semua selama event
    }))
  };
}

export async function GET(req) {
  const token = String(new URL(req.url).searchParams.get("token") || "").trim().toUpperCase();
  if (!token) return j({ error: "Kode akun kosong." }, 400);
  if (!rateLimit(`${ip(req)}:skin-info`, 60, 60_000)) return j({ error: "Terlalu cepat." }, 429);
  const d = await ringkas(token);
  return d ? j(d) : j({ error: "Akun tidak ditemukan." }, 404);
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "").trim().toUpperCase();
  const id = String(b.id || "");
  const s = SKIN_PETA[id];
  if (!token || !s) return j({ error: "Data tidak lengkap." }, 400);
  if (!rateLimit(`${ip(req)}:skin-aksi`, 20, 60_000)) return j({ error: "Terlalu banyak percobaan." }, 429);
  const kol = await usersCol();
  const u = await kol.findOne({ token }, { projection: { skinDimiliki: 1, suspended: 1 } });
  if (!u) return j({ error: "Akun tidak ditemukan." }, 404);

  if (b.aksi === "beli") {
    if (s.harga <= 0) return j({ error: "Skin ini gratis." }, 400);
    if ((u.skinDimiliki || []).includes(id)) return j({ error: "Kamu sudah memiliki skin ini." }, 400);
    const m = await musimSekarang();
    if (s.musim && !(m.skinMusim || []).includes(s.musim)) return j({ error: "Skin musiman ini hanya dijual saat event-nya berlangsung." }, 400);
    await mergeLegacyPoints(token).catch(() => {});
    // Satu operasi atomik: cukup poin + belum punya → potong & tambahkan (dua klik serentak tidak bisa membayar dua kali).
    const h = await kol.findOneAndUpdate({ token, points: { $gte: s.harga }, skinDimiliki: { $ne: id } }, { $inc: { points: -s.harga }, $addToSet: { skinDimiliki: id } }, { returnDocument: "after" });
    if (!h) return j({ error: "Poin tidak cukup." }, 400);
    return j({ ok: true, ...(await ringkas(token)) });
  }
  if (b.aksi === "pakai") {
    const m = await musimSekarang();
    const boleh = s.harga === 0 || (u.skinDimiliki || []).includes(id) || (s.musim && (m.skinMusim || []).includes(s.musim));
    if (!boleh) return j({ error: "Kamu belum memiliki skin ini." }, 400);
    await kol.updateOne({ token }, { $set: { skinAktif: id === "klasik" ? "" : id } });
    return j({ ok: true, ...(await ringkas(token)) });
  }
  return j({ error: "Aksi tidak dikenal." }, 400);
}
