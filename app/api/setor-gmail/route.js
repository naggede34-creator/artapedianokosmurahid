import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { infoPengguna, setujuiSyarat, generateEmail, emailBelumDisetor, setorkan, segarkanPengguna } from "@/lib/setorGmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ip = (req) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
const j = (data, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

// GET ?token=  → status layanan, saldo Stor, room + upah, ringkasan & riwayat email
export async function GET(req) {
  const token = String(new URL(req.url).searchParams.get("token") || "").trim().toUpperCase();
  if (!token) return j({ error: "Kode akun kosong." }, 400);
  if (!rateLimit(`${ip(req)}:setor-info`, 90, 60_000)) return j({ error: "Terlalu cepat. Tunggu sebentar." }, 429);
  try {
    await segarkanPengguna(token).catch(() => {});
    const d = await infoPengguna(token);
    return d ? j(d) : j({ error: "Akun tidak ditemukan." }, 404);
  } catch (err) {
    console.error("[setor-gmail]", err?.message || err);
    return j({ error: "Gagal memuat Stor Gmail." }, 500);
  }
}

// POST { token, aksi: "setuju" | "generate" | "belum" | "setor", ... }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "").trim().toUpperCase();
  if (!token) return j({ error: "Kode akun kosong." }, 400);
  const batasIp = Number(process.env.SETOR_RATE_IP) || 30, batasAkun = Number(process.env.SETOR_RATE_AKUN) || 15;
  if (!rateLimit(`${ip(req)}:setor`, batasIp, 60_000) || !rateLimit(`akun:${token}:setor`, batasAkun, 60_000)) return j({ error: "Terlalu banyak percobaan. Tunggu sebentar." }, 429);
  try {
    let r;
    if (b.aksi === "setuju") r = await setujuiSyarat(token, ip(req));
    else if (b.aksi === "generate") r = await generateEmail(token, b.jumlah);
    else if (b.aksi === "belum") r = await emailBelumDisetor(token);
    else if (b.aksi === "setor") r = await setorkan(token, { roomId: b.roomId, teks: b.teks, emails: b.emails });
    else return j({ error: "Aksi tidak dikenal." }, 400);
    return r.ok ? j(r) : j({ error: r.alasan }, 400);
  } catch (err) {
    console.error("[setor-gmail]", err?.message || err);
    return j({ error: "Terjadi kesalahan. Cek riwayat Stor Gmail sebelum mencoba lagi." }, 500);
  }
}
