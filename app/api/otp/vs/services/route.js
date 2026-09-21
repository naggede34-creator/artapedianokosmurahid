import { NextResponse } from "next/server";
import { getVirtusimServices, sortWhatsappFirst, virtusimConfigured, virtusimCountry } from "@/lib/virtusim";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Layanan server "Nokos OTP Fast" (VirtuSIM) untuk negara Indonesia.
// WhatsApp selalu paling atas.
export async function GET() {
  try {
    if (!virtusimConfigured()) {
      return NextResponse.json({ error: "Server OTP Fast belum dikonfigurasi admin." }, { status: 503 });
    }
    const { markupPercent } = await getSettings();
    const list = await getVirtusimServices();
    const items = sortWhatsappFirst(list).map((s) => ({
      id: s.id,
      name: s.name,
      img: s.img || null,
      stock: s.stock,
      sell_price: Math.ceil(s.price * (1 + (Number(markupPercent) || 0) / 100))
    }));
    return NextResponse.json({ country: virtusimCountry(), items });
  } catch (err) {
    console.error("[otp/vs/services]", err?.message || err);
    return NextResponse.json({ error: "Gagal mengambil daftar layanan OTP Fast." }, { status: 500 });
  }
}
