import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCodeMatches, adminCodeIsDefault, createAdminSession, createAdminSessionAkun, adminCookieOptions } from "@/lib/adminAuth";
import { cariAkunDariKode, catatMasuk } from "@/lib/adminAkun";
import { sendMonitorLog, adminLoginLog } from "@/lib/monitor";
import { rateLimit } from "@/lib/rateLimit";
import { adminTerkunci, catatLoginAdminGagal, loginAdminBerhasil } from "@/lib/keamanan";

export async function POST(req) {
  try {
    const { code } = await req.json().catch(() => ({}));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    const kunci = adminTerkunci(ip);
    if (kunci) return NextResponse.json({ error: `IP dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(kunci / 60)} menit.` }, { status: 429 });
    if (!rateLimit(`${ip || "unknown"}:admin-login`, Number(process.env.ADMIN_LOGIN_RATE) || 3, 5 * 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 5 menit." }, { status: 429 });
    }

    // Kode utama → Owner. Bukan kode utama → cari di akun admin tambahan (peran terbatas).
    const owner = !!code && (await adminCodeMatches(code));
    const akun = !owner && code ? await cariAkunDariKode(code).catch(() => null) : null;
    if (akun) {
      sendMonitorLog(`🔑 <b>LOGIN ADMIN (${akun.peran})</b>\n👤 ${String(akun.nama).replace(/[<>&]/g, "")}\n🌐 ${ip || "-"}`);
      loginAdminBerhasil(ip);
      catatMasuk(akun.id);
      const r = NextResponse.json({ ok: true, peran: akun.peran, nama: akun.nama });
      r.cookies.set(ADMIN_COOKIE, await createAdminSessionAkun(akun.id), adminCookieOptions());
      return r;
    }
    if (!code || !owner) {
      sendMonitorLog(adminLoginLog({ success: false, ip }));
      await catatLoginAdminGagal(ip).catch(() => {});
      return NextResponse.json({ error: "Kode admin salah." }, { status: 401 });
    }

    sendMonitorLog(adminLoginLog({ success: true, ip }));
    loginAdminBerhasil(ip);

    const masihBawaan = await adminCodeIsDefault();
    if (masihBawaan) {
      // Kode bawaan tertulis di repositori, jadi ia bukan rahasia siapa pun.
      console.warn("[admin] Kode admin belum diisi (web maupun Vercel) — panel admin memakai kode bawaan yang ada di kode sumber.");
    }

    const res = NextResponse.json({ ok: true, defaultCode: masihBawaan });
    res.cookies.set(ADMIN_COOKIE, await createAdminSession(), adminCookieOptions());
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
