import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { sendMonitorLog, userLoginLog } from "@/lib/monitor";
import { rateLimit } from "@/lib/rateLimit";
import { loginWajib, buatAkunBaru } from "@/lib/webAuth";
import { catatIpAkun, blokirIpAkun, ipDariReq } from "@/lib/blokirIp";
import { bacaPerangkat, catatPerangkat } from "@/lib/perangkat";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const users = await usersCol();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (body.token) {
      // Endpoint ini adalah pintu masuk akun: menyebutkan kode akun yang benar
      // langsung membuka akunnya. Tanpa batas percobaan, ia juga jadi tempat
      // menebak kode orang lain sepuasnya — dan tiap tebakan adalah satu kueri
      // ke database.
      if (!rateLimit(`${ip}:user-init`, 30, 60_000)) {
        return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi sebentar lagi." }, { status: 429 });
      }
      const existing = await users.findOne({ token: String(body.token).trim().toUpperCase() });
      if (existing && existing.suspended) {
        // Akun di-ban: tidak ada data akun yang dikirim — klien hanya menampilkan layar "AKUN ANDA TELAH DI BANNED…".
        // Dibuka dari IP baru = ikut diblokir (menghindari ban lewat ganti jaringan).
        blokirIpAkun(existing.token, "Akun yang di-ban dibuka dari IP lain", [ipDariReq(req)]).catch(() => {});
        return NextResponse.json({ token: existing.token, suspended: true });
      }
      if (existing) {
        catatIpAkun(existing.token, ipDariReq(req)).catch(() => {});
        catatPerangkat(existing.token, bacaPerangkat(req)).catch(() => {});
        sendMonitorLog(userLoginLog({ token: existing.token, isNew: false }));
        return NextResponse.json({
          token: existing.token,
          balance: existing.balance,
          
          depositBalance: existing.depositBalance ?? null,
          name: existing.name || null,
          createdAt: existing.createdAt || null,
          tourDone: existing.tourDone === true
        });
      }
      return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });
    }

    // Login diwajibkan: akun tidak boleh dibuat diam-diam. Pengunjung tanpa
    // kode diarahkan ke pendaftaran (nama saja) atau masuk dengan kode akun.
    if (await loginWajib()) {
      return NextResponse.json({ error: "Daftar atau masuk dulu untuk memakai website.", loginWajib: true }, { status: 403 });
    }

    // Pembuatan akun dibatasi lebih ketat daripada pembacaannya: akun baru
    // berhak atas bonus sambutan, jadi membuat akun massal adalah mencetak
    // saldo. Sepuluh per jam masih jauh di atas kebutuhan orang sungguhan yang
    // ganti perangkat atau membersihkan peramban.
    if (!rateLimit(`${ip}:user-create`, 10, 60 * 60_000)) {
      return NextResponse.json(
        { error: "Terlalu banyak akun baru dari koneksi ini. Coba lagi nanti atau hubungi CS." },
        { status: 429 }
      );
    }

    const { token, createdAt } = await buatAkunBaru({ req, ref: body.ref, sumber: "Website" });
    catatIpAkun(token, ipDariReq(req)).catch(() => {});
    catatPerangkat(token, bacaPerangkat(req)).catch(() => {});
    return NextResponse.json({ token, balance: 0, createdAt, tourDone: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
