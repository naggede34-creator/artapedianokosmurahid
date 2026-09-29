// Konfigurasi dari dasbor admin: isian yang dulu HARUS diisi di Environment
// Variables Vercel, kini bisa diisi di sini (atau tetap di Vercel — salah satu
// cukup, tidak perlu keduanya).
//
// Rahasia tidak pernah dikirim balik utuh. GET hanya memberi tahu SUDAH TERISI
// atau belum, dari mana asalnya, dan versi yang disamarkan.
import { NextResponse } from "next/server";
import {
  adminSah,
  adminCodeMatches,
  setKodeAdminWeb,
  hapusKodeAdminWeb,
  statusKodeAdmin,
  createAdminSession,
  adminCookieOptions,
  ADMIN_COOKIE
} from "@/lib/adminAuth";
import { daftarUntukAdmin, simpanCfg, catatRiwayat, bacaRiwayat, konfigTerbaca } from "@/lib/config";
import { rateLimit } from "@/lib/rateLimit";
import { PETA } from "@/lib/configRegistry";

export const dynamic = "force-dynamic";

async function ringkasan() {
  const kode = await statusKodeAdmin();
  // ADMIN_CODE tidak lewat cfg() (disimpan sebagai hash), jadi statusnya
  // diisi dari statusKodeAdmin.
  const ekstra = {
    ADMIN_CODE: {
      sumber: kode.web ? "web" : kode.env ? "vercel" : "bawaan",
      adaWeb: kode.web,
      terisi: true
    }
  };
  return {
    terbaca: await konfigTerbaca(),
    kodeAdmin: kode,
    item: await daftarUntukAdmin(ekstra),
    riwayat: await bacaRiwayat()
  };
}

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json(await ringkasan());
  } catch (err) {
    console.error("[admin/config GET]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat konfigurasi." }, { status: 500 });
  }
}

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak sah." }, { status: 400 });
  }

  // Konfigurasi yang tidak terbaca berarti menyimpan sekarang bisa menimpa
  // yang sudah ada tanpa terlihat. Ditolak sampai databasenya terjangkau.
  if (!(await konfigTerbaca())) {
    return NextResponse.json({ error: "Database belum terjangkau. Coba lagi beberapa detik lagi." }, { status: 503 });
  }

  const aksi = String(body?.aksi || "");
  try {
    if (aksi === "simpan") {
      const nama = String(body?.nama || "");
      const def = PETA[nama];
      if (!def) return NextResponse.json({ error: "Isian tidak dikenal." }, { status: 400 });
      if (def.khusus) return NextResponse.json({ error: "Kode admin diganti lewat aksi khusus." }, { status: 400 });
      const r = await simpanCfg(nama, body?.nilai);
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400 });
      return NextResponse.json({ ok: true, pesan: `${def.label} disimpan dan langsung berlaku.`, ...(await ringkasan()) });
    }

    if (aksi === "hapus") {
      const nama = String(body?.nama || "");
      const def = PETA[nama];
      if (!def || def.khusus) return NextResponse.json({ error: "Isian tidak dikenal." }, { status: 400 });
      const r = await simpanCfg(nama, "");
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400 });
      return NextResponse.json({
        ok: true,
        pesan: `${def.label} dihapus dari web. Kalau ada di Vercel, nilai itu yang dipakai lagi.`,
        ...(await ringkasan())
      });
    }

    if (aksi === "kode-admin" || aksi === "kode-admin-hapus") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      // Sama ketatnya dengan login: mengganti kode adalah mengambil alih panel.
      if (!rateLimit(`${ip}:admin-ganti-kode`, 3, 5 * 60_000)) {
        return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 5 menit." }, { status: 429 });
      }
      // Sesi yang sedang aktif TIDAK cukup: cookie yang dicuri tidak boleh
      // membuat pencurinya memegang panel selamanya dengan mengganti kodenya.
      if (!(await adminCodeMatches(body?.kodeSekarang))) {
        return NextResponse.json({ error: "Kode admin yang sekarang salah." }, { status: 401 });
      }

      if (aksi === "kode-admin-hapus") {
        const k = await statusKodeAdmin();
        // Tanpa kode dari Vercel, menghapus kode web berarti jatuh ke kode
        // bawaan yang tertulis di repositori — siapa pun bisa masuk.
        if (!k.env) {
          return NextResponse.json(
            { error: "Tidak bisa dihapus: Vercel belum punya ADMIN_CODE, jadi panel akan jatuh ke kode bawaan yang publik." },
            { status: 400 }
          );
        }
        await hapusKodeAdminWeb();
        await catatRiwayat("ADMIN_CODE", "kode web dihapus");
      } else {
        const r = await setKodeAdminWeb(body?.kodeBaru);
        if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400 });
        await catatRiwayat("ADMIN_CODE", "diganti");
      }

      // Rahasia tanda tangan berasal dari kode, jadi semua sesi lama batal.
      // Sesi ini diterbitkan ulang supaya adminnya tidak terlempar keluar.
      const res = NextResponse.json({ ok: true, pesan: "Kode admin diperbarui. Semua sesi lain otomatis keluar.", ...(await ringkasan()) });
      res.cookies.set(ADMIN_COOKIE, await createAdminSession(), adminCookieOptions());
      return res;
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err) {
    console.error("[admin/config POST]", err?.message || err);
    return NextResponse.json({ error: "Gagal memproses." }, { status: 500 });
  }
}
