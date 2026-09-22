import { NextResponse } from "next/server";
import { getOperators } from "@/lib/rumahotp";
import { getSimuruOperators } from "@/lib/simuru";

export const dynamic = "force-dynamic";

// Daftar operator untuk satu kombinasi layanan+negara. Bentuk item ({ id, name })
// sengaja sama untuk kedua server supaya layar pilih operator identik.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const server = searchParams.get("server") || "rumahotp";

  try {
    if (server === "simuru") {
      const serviceId = searchParams.get("service_id");
      const countryId = searchParams.get("country_id");
      if (!serviceId || !countryId) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

      const { supportsSelection, operators } = await getSimuruOperators(serviceId, countryId);
      // Provider tanpa pemilihan operator -> UI langsung order dengan "random".
      if (!supportsSelection) return NextResponse.json({ items: [] });
      return NextResponse.json({
        items: operators.map((o) => ({ id: o.value, name: o.label || o.value }))
      });
    }

    const country = searchParams.get("country");
    const providerId = searchParams.get("provider_id");
    if (!country || !providerId) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const data = await getOperators(process.env.RUMAHOTP_APIKEY, country, providerId);
    return NextResponse.json({ items: data.data || data || [] });
  } catch (err) {
    console.error("[otp/operators]", err?.response?.data || err?.message || err);
    // Gagal ambil operator bukan alasan menggagalkan pembelian: UI lanjut tanpa
    // pemilihan operator dan provider memilih otomatis.
    return NextResponse.json({ items: [] });
  }
}
