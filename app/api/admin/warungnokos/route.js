import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { diagnoseWarungNokos, warungNokosConfigured } from "@/lib/warungnokos";
import { diagnoseDibanana } from "@/lib/dibanana";

export const dynamic = "force-dynamic";

// Diagnosa koneksi provider dari sisi server. Tidak pernah membocorkan API key —
// hanya melaporkan berhasil/gagal, saldo, dan penyebabnya.
export async function GET(req) {
  if (!await adminSah(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const provider = new URL(req.url).searchParams.get("provider") || "warungnokos";
  try {
    if (provider === "dibanana") return NextResponse.json(await diagnoseDibanana());
    if (!(await warungNokosConfigured())) {
      return NextResponse.json({
        configured: false,
        verdict: "WARUNGNOKOS_APIKEY belum diisi (Dasbor Admin → Konfigurasi, atau Environment Variables Vercel)"
      });
    }
    const d = await diagnoseWarungNokos();
    const allOk = d.warungnokos_s1?.ok && d.warungnokos_s2?.ok && d.api?.ok && d.layanan?.ok !== false && d.produk?.ok !== false;
    const balance = d.profile?.balance;
    const gagalLangkah = [d.api, d.layanan, d.produk].find((x) => x && !x.ok);
    return NextResponse.json({
      ...d,
      verdict: allOk
        ? `Koneksi WarungNokos normal (API baru warkosv3): ${d.api.negara} negara, ${d.layanan?.layanan ?? "?"} layanan di ${d.layanan?.negaraUji ?? "-"}.${
            balance != null ? ` Saldo akun: Rp${Number(balance).toLocaleString("id-ID")}.` : ""
          }`
        : gagalLangkah
        ? `Gagal di ${gagalLangkah.jalur}${gagalLangkah.status ? ` (HTTP ${gagalLangkah.status})` : ""}: ${gagalLangkah.error}${[401, 403].includes(gagalLangkah.status) ? " — cek API key / whitelist IP di dashboard WarungNokos." : ""}`
        : "Sebagian server WarungNokos tidak bisa dihubungi — lihat rincian di bawah."
    });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Gagal diagnosa." }, { status: 502 });
  }
}
