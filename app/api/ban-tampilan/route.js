import { NextResponse } from "next/server";
import { ambilBanPublik } from "@/lib/tampilanBan";
import { usersCol } from "@/lib/db";
import { sapuBanSementara } from "@/lib/penggunaAdmin";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

// Publik: dipakai layar ban di sisi klien. Tidak berisi data sensitif.
// Bila klien menyertakan kode akunnya (?t=…) dan akun itu kena ban SEMENTARA, jawabannya memuat `sampai` (epoch ms)
// untuk hitung mundur — dan ban yang sudah lewat waktunya dibuka saat itu juga (`dibuka: true`).
export async function GET(req) {
  try {
    const out = await ambilBanPublik();
    const t = String(new URL(req.url).searchParams.get("t") || "").trim().toUpperCase().slice(0, 40);
    if (t) {
      await sapuBanSementara({ token: t }).catch(() => {});
      const u = await (await usersCol()).findOne({ token: t }, { projection: { suspended: 1, suspendedSampai: 1 } }).catch(() => null);
      if (u && !u.suspended) out.dibuka = true;
      else if (u?.suspendedSampai) out.sampai = new Date(u.suspendedSampai).getTime();
    }
    return NextResponse.json(out, { headers: H });
  } catch { return NextResponse.json({ aktif: false }, { headers: H }); }
}
