// Antrean bonus undang teman yang ditahan penjaga anti-farming.
// GET: daftar (status menunggu / disetujui / ditolak). POST {id, keputusan}.
import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { daftarTertahan, putuskanTertahan } from "@/lib/referralGuard";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const samar = (t = "") => (t.length <= 8 ? t : `${t.slice(0, 4)}••••${t.slice(-4)}`);
const rapikan = (r) => ({
  id: r.id,
  referrer: samar(r.referrerToken),
  invited: samar(r.invitedToken),
  amount: r.amount,
  bonus: r.bonus,
  alasan: r.alasan || [],
  status: r.status,
  createdAt: r.createdAt
});

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const status = new URL(req.url).searchParams.get("status") || "menunggu";
  if (!["menunggu", "disetujui", "ditolak"].includes(status)) {
    return NextResponse.json({ error: "Status tidak dikenal." }, { status: 400 });
  }
  return NextResponse.json({ items: (await daftarTertahan(status)).map(rapikan) });
}

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!rateLimit("admin-referral", 60, 60_000)) {
    return NextResponse.json({ error: "Terlalu cepat. Coba lagi sebentar." }, { status: 429 });
  }
  const { id, keputusan } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });
  const hasil = await putuskanTertahan(String(id), String(keputusan || ""));
  return NextResponse.json(hasil, { status: hasil.ok ? 200 : 409 });
}
