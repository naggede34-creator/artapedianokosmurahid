import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { simpanLangganan, hapusLangganan, adaLangganan, kirimPush } from "@/lib/webPush";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const ip = (req) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

// Kode akun adalah kredensial di situs ini, jadi mengetahuinya cukup — sama
// seperti endpoint akun lainnya. Yang dicek: akunnya ada.
async function akunAda(token) {
  if (!token || typeof token !== "string") return false;
  return Boolean(await (await usersCol()).findOne({ token }, { projection: { _id: 1 } }));
}

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!(await akunAda(token))) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ aktif: await adaLangganan(token) });
}

export async function POST(req) {
  if (!rateLimit(`${ip(req)}:push-sub`, 20, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan." }, { status: 429 });
  }
  const { token, subscription, uji } = await req.json().catch(() => ({}));
  if (!(await akunAda(token))) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  const hasil = await simpanLangganan(token, subscription, req.headers.get("user-agent") || "");
  if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 400 });
  // Notifikasi sambutan: bukti langsung bahwa pushnya sampai ke perangkat ini.
  if (uji) {
    await kirimPush(token, { judul: "Notifikasi aktif ✅", isi: "Kamu akan dikabari di sini saat kode OTP masuk atau saldo bertambah.", url: "/otp", tag: "sambutan" });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const { token, endpoint } = await req.json().catch(() => ({}));
  if (!(await akunAda(token)) || !endpoint) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });
  return NextResponse.json(await hapusLangganan(token, endpoint));
}
