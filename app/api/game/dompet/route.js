import { NextResponse } from "next/server";
import { infoDompet, tukarKeNokos, ajukanTarik, batalTarik } from "@/lib/game/dompet";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const ip = (req) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
const j = (data, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

// GET  ?token=  → saldo poin game, batas, syarat perputaran, riwayat tarikan
// POST { token, aksi: "tukar" | "tarik" | "batal", poin, ewallet, nomor, nama, id }
export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return j({ error: "Kode akun kosong." }, 400);
  if (!rateLimit(`${ip(req)}:dompet-info`, 120, 60_000)) return j({ error: "Terlalu cepat. Tunggu sebentar." }, 429);
  const d = await infoDompet(String(token).trim().toUpperCase());
  return d ? j(d) : j({ error: "Akun tidak ditemukan." }, 404);
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "").trim().toUpperCase();
  if (!token) return j({ error: "Kode akun kosong." }, 400);
  if (!rateLimit(`${ip(req)}:dompet-aksi`, 20, 60_000)) return j({ error: "Terlalu banyak percobaan. Tunggu sebentar." }, 429);
  try {
    let r;
    if (b.aksi === "tukar") r = await tukarKeNokos(token, b.poin);
    else if (b.aksi === "tarik") r = await ajukanTarik(token, { poin: b.poin, ewallet: b.ewallet, nomor: b.nomor, nama: b.nama });
    else if (b.aksi === "batal") r = await batalTarik(token, b.id);
    else return j({ error: "Aksi tidak dikenal." }, 400);
    if (!r.ok) return j({ error: r.alasan, ...(r.syarat ? { syarat: true } : {}) }, 400);
    const { ok: _ok, ...data } = r; void _ok;
    return j({ ok: true, ...data });
  } catch (err) {
    console.error("[game/dompet]", err?.message || err);
    return j({ error: "Terjadi kesalahan. Coba lagi." }, 500);
  }
}
