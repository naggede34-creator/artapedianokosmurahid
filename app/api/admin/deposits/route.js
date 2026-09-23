// Pengecekan deposit manual oleh admin.
//
// Hanya metode "manual" yang lewat sini. Metode lain punya provider yang bisa
// ditanya sendiri, dan saldonya masuk tanpa campur tangan siapa pun — membuka
// persetujuan manual untuk mereka cuma menambah satu jalan lagi untuk salah
// mengkreditkan transaksi yang sebetulnya belum dibayar.
import { NextResponse } from "next/server";
import { depositsCol, usersCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { creditDeposit } from "@/lib/depositService";
import { MANUAL_DEPOSIT_KEY } from "@/lib/paymentProviders";
import { sendTelegramNotif, manualDepositRejectedNotif } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Daftar deposit manual. status=review (bawaan) yang perlu dikerjakan admin;
// status=all untuk menelusuri riwayatnya.
export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "review";
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));

  const deposits = await depositsCol();
  const filter = { provider: MANUAL_DEPOSIT_KEY, ...(status === "all" ? {} : { status }) };
  const items = await deposits.find(filter).sort({ confirmedAt: -1, createdAt: -1 }).limit(limit).toArray();

  const users = await usersCol();
  const names = new Map();
  for (const t of [...new Set(items.map((d) => d.token))]) {
    const u = await users.findOne({ token: t }, { projection: { name: 1, balance: 1 } });
    if (u) names.set(t, { name: u.name || "", balance: u.balance || 0 });
  }

  return NextResponse.json({
    items: items.map((d) => ({
      orderId: d.orderId,
      token: d.token,
      name: names.get(d.token)?.name || "",
      balance: names.get(d.token)?.balance ?? null,
      amount: d.amount,
      status: d.status,
      // Bukti bayarnya bisa ratusan kilobita per transaksi. Di daftar cukup
      // ditandai ada atau tidak; gambarnya diambil satu-satu lewat ?orderId=.
      hasProof: Boolean(d.proofImage),
      userNote: d.userNote || "",
      adminNote: d.adminNote || "",
      createdAt: d.createdAt,
      confirmedAt: d.confirmedAt || null,
      reviewedAt: d.reviewedAt || null
    })),
    // Jumlah yang menunggu — dipakai lencana di menu admin.
    pending: await deposits.countDocuments({ provider: MANUAL_DEPOSIT_KEY, status: "review" })
  });
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { action, orderId, reason } = await req.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ error: "orderId wajib." }, { status: 400 });

  const deposits = await depositsCol();

  // Ambil gambar bukti bayarnya (satu transaksi saja, supaya daftarnya tetap ringan).
  if (action === "proof") {
    const d = await deposits.findOne({ orderId, provider: MANUAL_DEPOSIT_KEY }, { projection: { proofImage: 1 } });
    if (!d) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ ok: true, proofImage: d.proofImage || null });
  }

  if (action === "approve") {
    // Yang boleh disetujui hanya yang sedang menunggu dicek. Syaratnya ikut di
    // dalam filter supaya dua klik beruntun tidak pernah jadi dua kali kredit;
    // creditDeposit juga punya kunci sendiri, dan dua lapis di sini murah.
    const claimed = await deposits.findOneAndUpdate(
      { orderId, provider: MANUAL_DEPOSIT_KEY, status: "review" },
      { $set: { reviewedAt: new Date(), reviewedBy: "admin", adminNote: String(reason || "").slice(0, 300) } },
      { returnDocument: "after" }
    );
    if (!claimed) {
      const ada = await deposits.findOne({ orderId });
      if (!ada) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
      return NextResponse.json({ error: `Transaksi ini sudah berstatus "${ada.status}".` }, { status: 409 });
    }

    // Kredit saldo + cashback + bonus referral + semua notifnya lewat jalur yang
    // sama dengan deposit otomatis, jadi tidak ada perlakuan berbeda di mutasi.
    const credit = await creditDeposit(claimed);
    return NextResponse.json({ ok: true, credited: Boolean(credit), credit });
  }

  if (action === "reject") {
    const claimed = await deposits.findOneAndUpdate(
      { orderId, provider: MANUAL_DEPOSIT_KEY, status: "review" },
      {
        $set: {
          status: "failed",
          reviewedAt: new Date(),
          reviewedBy: "admin",
          adminNote: String(reason || "").slice(0, 300)
        }
      },
      { returnDocument: "after" }
    );
    if (!claimed) {
      const ada = await deposits.findOne({ orderId });
      if (!ada) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
      return NextResponse.json({ error: `Transaksi ini sudah berstatus "${ada.status}".` }, { status: 409 });
    }

    const u = await (await usersCol()).findOne({ token: claimed.token }, { projection: { name: 1 } });
    sendTelegramNotif(
      manualDepositRejectedNotif({
        orderId,
        amount: claimed.amount,
        token: claimed.token,
        name: u?.name,
        reason
      })
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
}
