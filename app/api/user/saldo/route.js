import { NextResponse } from "next/server";
import { pastikanDepositBalance } from "@/lib/saldoDeposit";
import { usersCol } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Penyegar saldo yang ringan: hanya membaca saldo nokos & poin game. Dipanggil sering oleh tampilan
// (pindah halaman, tab kembali aktif, setelah aksi game) — terpisah dari /api/user/init yang batasnya
// ketat dan tiap panggilannya dicatat sebagai "login" di log pemantauan.
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "").trim().toUpperCase();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!token) return NextResponse.json({ error: "Token wajib diisi." }, { status: 400 });
    if (!rateLimit(`${ip}:user-saldo`, 300, 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
    }
    await pastikanDepositBalance(token);
    const u = await (await usersCol()).findOne({ token }, { projection: { balance: 1, saldoGame: 1, depositBalance: 1 } });
    if (!u) {
      // Tebakan kode akun yang salah dibatasi jauh lebih ketat.
      if (!rateLimit(`${ip}:user-saldo-miss`, 20, 60_000)) return NextResponse.json({ error: "Terlalu banyak percobaan." }, { status: 429 });
      return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ balance: u.balance ?? 0, saldoGame: u.saldoGame ?? 0, depositBalance: u.depositBalance ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal memuat saldo." }, { status: 500 });
  }
}
