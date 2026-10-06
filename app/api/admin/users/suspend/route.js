// Jalur lama (tab Pengguna di dasbor utama). Kini memakai logika yang sama dengan dasbor Pengguna & Blokir,
// sehingga riwayat blokir, notifikasi, dan pembatalan duel konsisten di kedua tempat.
import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { ubahBlokir } from "@/lib/penggunaAdmin";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { token, suspend, reason } = await req.json().catch(() => ({}));
    if (!token) return NextResponse.json({ error: "Token wajib diisi." }, { status: 400 });
    const r = await ubahBlokir({ token, aksi: suspend ? "ban" : "unban", alasan: reason || (suspend ? "Ditangguhkan oleh admin" : ""), kabari: true });
    if (!r.ok) {
      // Perilaku lama: membuka akun yang memang tidak dibekukan tetap sukses (idempoten).
      if (r.status === 400 && /tidak sedang dibekukan|sudah dibekukan/.test(r.alasan)) return NextResponse.json({ ok: true, suspended: !!suspend });
      return NextResponse.json({ error: r.alasan }, { status: r.status || 400 });
    }
    return NextResponse.json({ ok: true, suspended: !!suspend });
  } catch (err) {
    console.error("[admin/users/suspend]", err);
    return NextResponse.json({ error: "Gagal mengubah status suspend." }, { status: 500 });
  }
}
