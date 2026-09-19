import { NextResponse } from "next/server";
import { usersCol, resellersCol } from "@/lib/db";
import { logBalance } from "@/lib/ledger";
import { sendTelegramNotif, sendTelegramChannelNotif, resellerRegisteredNotif, esc } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const RESELLER_PRICE = 10000;

function slugify(str) {
  return String(str || "").toLowerCase().trim()
    .replace(/[^a-z0-9\-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

export async function POST(req) {
  try {
    const { token, webName, markup } = await req.json().catch(() => ({}));
    if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });
    if (!webName || String(webName).trim().length < 3)
      return NextResponse.json({ error: "Nama web minimal 3 karakter." }, { status: 400 });

    const mkp = Math.max(0, Math.min(100, Number(markup) || 0));
    const slug = slugify(webName);
    if (!slug) return NextResponse.json({ error: "Nama web tidak valid." }, { status: 400 });

    const col = await usersCol();
    const user = await col.findOne({ token });
    if (!user) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    if ((user.balance || 0) < RESELLER_PRICE)
      return NextResponse.json({ error: `Saldo tidak cukup. Butuh Rp${RESELLER_PRICE.toLocaleString("id-ID")}.` }, { status: 400 });

    const rCol = await resellersCol();

    // Cek slug sudah dipakai
    const existing = await rCol.findOne({ slug });
    if (existing) return NextResponse.json({ error: "Nama web sudah dipakai, coba nama lain." }, { status: 409 });

    // Cek sudah punya reseller
    const mine = await rCol.findOne({ token });
    if (mine) return NextResponse.json({ error: "Kamu sudah punya web reseller.", slug: mine.slug }, { status: 409 });

    // Potong saldo
    const newBalance = (user.balance || 0) - RESELLER_PRICE;
    await col.updateOne({ token }, { $inc: { balance: -RESELLER_PRICE } });
    await logBalance({ token, type: "admin_sub", amount: -RESELLER_PRICE, balanceAfter: newBalance, title: "Beli paket web reseller", ref: "reseller-register" });

    // Buat reseller
    const now = new Date();
    await rCol.insertOne({
      token,
      slug,
      webName: String(webName).trim().slice(0, 50),
      markup: mkp,
      active: true,
      logo: null,
      description: "",
      theme: "dark",
      totalOrders: 0,
      totalRevenue: 0,
      createdAt: now,
      updatedAt: now,
    });

    const notif = resellerRegisteredNotif({ token, name: user.name || "", webName: String(webName).trim(), slug, markup: mkp });
    sendTelegramNotif(notif).catch(() => {});
    sendTelegramChannelNotif(notif).catch(() => {});

    return NextResponse.json({ ok: true, slug, webName: String(webName).trim(), markup: mkp });
  } catch (err) {
    console.error("[reseller/register]", err);
    return NextResponse.json({ error: "Gagal mendaftar reseller." }, { status: 500 });
  }
}
