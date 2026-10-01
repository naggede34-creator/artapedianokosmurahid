import { NextResponse } from "next/server";
import { infoWdSetor, ajukanWdSetor } from "@/lib/wdInstan";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 45; // menunggu jawaban AustinPay

const ip = (req) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
const j = (data, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

// GET ?token= → batas, saldo Stor, e-wallet yang didukung, riwayat
export async function GET(req) {
  const token = String(new URL(req.url).searchParams.get("token") || "").trim().toUpperCase();
  if (!token) return j({ error: "Kode akun kosong." }, 400);
  if (!rateLimit(`${ip(req)}:setor-tarik-info`, 90, 60_000)) return j({ error: "Terlalu cepat. Tunggu sebentar." }, 429);
  const d = await infoWdSetor(token);
  return d ? j(d) : j({ error: "Akun tidak ditemukan." }, 404);
}

// POST { token, wallet, nomor, nama?, nominal } → tarik saldo Stor ke e-wallet (otomatis via AustinPay)
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "").trim().toUpperCase();
  if (!token) return j({ error: "Kode akun kosong." }, 400);
  if (!rateLimit(`${ip(req)}:setor-tarik`, 15, 60_000) || !rateLimit(`akun:${token}:setor-tarik`, 8, 60_000)) return j({ error: "Terlalu banyak percobaan. Tunggu sebentar." }, 429);
  try {
    const r = await ajukanWdSetor(token, { wallet: b.wallet, nomor: b.nomor, atasNama: b.nama, nominal: b.nominal }, { ip: ip(req) });
    if (!r.ok) return j({ error: r.alasan }, 400);
    return j({ ok: true, wd: r.wd, saldo: r.saldo });
  } catch (err) {
    console.error("[setor-gmail/tarik]", err?.message || err);
    return j({ error: "Terjadi kesalahan. Cek riwayat penarikanmu sebelum mencoba lagi." }, 500);
  }
}
