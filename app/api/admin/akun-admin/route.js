import { NextResponse } from "next/server";
import { adminOwner, lupakanCacheAkunAdmin } from "@/lib/adminAuth";
import { daftarAkun, tambahAkun, ubahAkun } from "@/lib/adminAkun";
import { PERAN } from "@/lib/adminIzin";
import { sendTelegramNotif } from "@/lib/telegram";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };
const tolak = () => NextResponse.json({ error: "Hanya Owner (kode admin utama) yang bisa mengelola akun admin." }, { status: 403, headers: H });

// GET → daftar akun + peran · POST { aksi: "tambah" | "ubah" | "hapus", ... } — KHUSUS Owner.
export async function GET(req) {
  if (!(await adminOwner(req))) return tolak();
  return NextResponse.json({ akun: await daftarAkun(), peran: PERAN }, { headers: H });
}

export async function POST(req) {
  if (!(await adminOwner(req))) return tolak();
  const b = await req.json().catch(() => ({}));
  let r;
  if (b.aksi === "tambah") r = await tambahAkun(b);
  else if (b.aksi === "ubah") r = await ubahAkun(b.id, { aktif: b.aktif, peran: b.peran, kode: b.kode });
  else if (b.aksi === "hapus") r = await ubahAkun(b.id, { hapus: true });
  else r = { ok: false, alasan: "Aksi tidak dikenal." };
  lupakanCacheAkunAdmin();
  if (r.ok) sendTelegramNotif(`👮 <b>AKUN ADMIN DIUBAH</b>\n${String(b.aksi)} · ${String(b.nama || b.id || "").replace(/[<>&]/g, "").slice(0, 40)}${b.peran ? ` · ${b.peran}` : ""}`);
  return r.ok ? NextResponse.json(r, { headers: H }) : NextResponse.json({ error: r.alasan }, { status: 400, headers: H });
}
