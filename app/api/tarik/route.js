import { NextResponse } from "next/server";
import { infoWdNokos, ajukanWdNokos } from "@/lib/wdInstan";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 45; // menunggu jawaban AustinPay

const ip = (req) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
const j = (data, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

// GET  ?token=  → batas, saldo yang bisa ditarik, e-wallet yang didukung, riwayat
// POST { token, wallet, nomor, nama?, nominal }  → tarik saldo nokos ke e-wallet (otomatis via AustinPay)
export async function GET(req) {
  const token = String(new URL(req.url).searchParams.get("token") || "").trim().toUpperCase();
  if (!token) return j({ error: "Kode akun kosong." }, 400);
  if (!rateLimit(`${ip(req)}:tarik-info`, 90, 60_000)) return j({ error: "Terlalu cepat. Tunggu sebentar." }, 429);
  const d = await infoWdNokos(token);
  return d ? j(d) : j({ error: "Akun tidak ditemukan." }, 404);
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "").trim().toUpperCase();
  if (!token) return j({ error: "Kode akun kosong." }, 400);
  // Dua lapis: per alamat IP dan per akun — uang keluar, jadi dibatasi jauh lebih ketat daripada API biasa.
  const batasIp = Number(process.env.WD_RATE_IP) || 15, batasAkun = Number(process.env.WD_RATE_AKUN) || 8;
  if (!rateLimit(`${ip(req)}:tarik`, batasIp, 60_000) || !rateLimit(`akun:${token}:tarik`, batasAkun, 60_000)) return j({ error: "Terlalu banyak percobaan. Tunggu sebentar." }, 429);
  try {
    const r = await ajukanWdNokos(token, { wallet: b.wallet, nomor: b.nomor, atasNama: b.nama, nominal: b.nominal }, { ip: ip(req) });
    if (!r.ok) return j({ error: r.alasan }, 400);
    return j({ ok: true, wd: r.wd, saldo: r.saldo });
  } catch (err) {
    console.error("[tarik]", err?.message || err);
    return j({ error: "Terjadi kesalahan. Cek riwayat penarikanmu sebelum mencoba lagi." }, 500);
  }
}
