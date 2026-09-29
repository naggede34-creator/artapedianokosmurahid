// Pendaftaran di website: cukup nama. Kode akunnya dibuat sistem dan dikirim
// balik SEKALI di sini — klien wajib menyuruh pengguna menyimpannya, karena itu
// satu-satunya cara masuk lagi dari perangkat lain (tanpa email/password).
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { loginWajib, periksaNama, buatAkunBaru } from "@/lib/webAuth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Hanya berlaku saat login diwajibkan. Saat mati, akun dibuat otomatis lewat
    // /api/user/init dan pendaftaran manual tidak dipakai.
    if (!(await loginWajib())) {
      return NextResponse.json({ error: "Pendaftaran manual sedang tidak dipakai." }, { status: 403 });
    }

    // Bucket yang SAMA dengan pembuatan akun otomatis: dua jalur tidak boleh
    // menggandakan jatah akun baru per koneksi.
    if (!rateLimit(`${ip}:user-create`, 10, 60 * 60_000)) {
      return NextResponse.json(
        { error: "Terlalu banyak akun baru dari koneksi ini. Coba lagi nanti atau hubungi CS." },
        { status: 429 }
      );
    }

    const n = periksaNama(body.name);
    if (!n.ok) return NextResponse.json({ error: n.alasan }, { status: 400 });

    const { token, createdAt } = await buatAkunBaru({ req, nama: n.nama, ref: body.ref, sumber: "Website (daftar)" });
    return NextResponse.json({ token, name: n.nama, createdAt });
  } catch (err) {
    console.error("[user/register]", err?.message || err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
