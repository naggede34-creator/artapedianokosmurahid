// Giveaway untuk pengguna: lihat daftar dan ikut.
import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { daftarEvent, ikutGiveaway } from "@/lib/giveaway";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token") || null;
  try {
    return NextResponse.json({ items: await daftarEvent({ token, hanyaAktif: true }) });
  } catch (err) {
    console.error("[giveaway GET]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat giveaway." }, { status: 500 });
  }
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak sah." }, { status: 400 });
  }

  const users = await usersCol();
  const user = await users.findOne(
    { token: body?.token },
    { projection: { token: 1, name: 1, suspended: 1 } }
  );
  if (!user) return NextResponse.json({ error: "Kode akun tidak dikenali." }, { status: 401 });
  // Akun yang ditangguhkan tidak ikut undian: hadiahnya masuk ke saldo yang
  // memang sedang tidak boleh dipakai, dan kursinya terpakai percuma.
  if (user.suspended) return NextResponse.json({ error: "Akun kamu sedang ditangguhkan." }, { status: 403 });

  try {
    const r = await ikutGiveaway(body?.giveawayId, user.token, user.name);
    if (!r.ok) return NextResponse.json({ error: r.alasan, sudahIkut: !!r.sudahIkut }, { status: 400 });
    return NextResponse.json({ ok: true, jumlahPeserta: r.jumlahPeserta, pesan: "Kamu ikut! Tunggu pengumumannya ya." });
  } catch (err) {
    console.error("[giveaway POST]", err?.message || err);
    return NextResponse.json({ error: "Gagal mendaftar." }, { status: 500 });
  }
}
