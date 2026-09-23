// Audit saldo: mencari kredit deposit yang rangkap, dan mencocokkan saldo tiap
// akun dengan jumlah seluruh mutasinya.
//
// Ada karena laporan "deposit 5.000 masuk 10.000" tidak bisa dijawab dengan
// membaca kode saja — yang menjawabnya adalah datanya sendiri. Alat ini
// menunjukkan transaksi mana yang tercatat dua kali, dan akun mana yang
// saldonya tidak cocok dengan riwayat mutasinya.
//
// Hanya MEMBACA. Tidak ada satu pun saldo yang diubah dari sini.
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { balanceLogsCol, usersCol, depositsCol } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tokenDicari = searchParams.get("token");

  try {
    const logs = await balanceLogsCol();
    const users = await usersCol();
    const deposits = await depositsCol();

    // ── Satu akun tertentu ─────────────────────────────────────────────
    if (tokenDicari) {
      const user = await users.findOne({ token: tokenDicari });
      if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });

      const mutasi = await logs.find({ token: tokenDicari }).sort({ createdAt: -1 }).limit(100).toArray();
      const jumlahMutasi = mutasi.reduce((t, m) => t + (Number(m.amount) || 0), 0);
      const depositUser = await deposits
        .find({ token: tokenDicari })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      return NextResponse.json({
        token: tokenDicari,
        name: user.name || null,
        saldoSekarang: user.balance || 0,
        jumlahSeluruhMutasi: jumlahMutasi,
        // Kalau mutasinya sudah lebih dari 100 baris, selisih ini wajar.
        mutasiTampil: mutasi.length,
        mutasi: mutasi.map((m) => ({
          type: m.type,
          amount: m.amount,
          title: m.title,
          ref: m.ref,
          balanceAfter: m.balanceAfter ?? null,
          createdAt: m.createdAt
        })),
        deposit: depositUser.map((d) => ({
          orderId: d.orderId,
          provider: d.provider,
          amount: d.amount,
          status: d.status,
          credited: Boolean(d.credited),
          createdAt: d.createdAt
        }))
      });
    }

    // ── Sapuan menyeluruh ──────────────────────────────────────────────
    // Kredit deposit dengan (token, ref) yang sama lebih dari sekali =
    // transaksi yang dikreditkan dua kali.
    const rangkap = await logs
      .aggregate([
        { $match: { type: "deposit", ref: { $type: "string" } } },
        { $group: { _id: { token: "$token", ref: "$ref" }, jumlah: { $sum: 1 }, total: { $sum: "$amount" } } },
        { $match: { jumlah: { $gt: 1 } } },
        { $sort: { jumlah: -1 } },
        { $limit: 50 }
      ])
      .toArray();

    // Deposit yang ditandai sudah dikredit tapi tidak punya catatan mutasi
    // sama sekali — kebalikannya, dan sama-sama perlu dilihat.
    const terkreditTanpaCatatan = [];
    const contohTerkredit = await deposits.find({ credited: true }).sort({ creditedAt: -1 }).limit(200).toArray();
    for (const d of contohTerkredit) {
      const ada = await logs.findOne({ token: d.token, type: "deposit", ref: d.orderId });
      if (!ada) terkreditTanpaCatatan.push({ orderId: d.orderId, token: d.token, amount: d.amount, createdAt: d.createdAt });
    }

    // Sekalian pastikan indeks pengamannya terpasang, dan laporkan kalau ia
    // tidak bisa dipasang karena datanya sudah punya duplikat.
    await ensureIndexes();

    return NextResponse.json({
      kreditDepositRangkap: rangkap.map((r) => ({
        token: r._id.token,
        orderId: r._id.ref,
        dikreditkanBerapaKali: r.jumlah,
        totalMasuk: r.total
      })),
      terkreditTanpaCatatan: terkreditTanpaCatatan.slice(0, 50),
      kesimpulan:
        rangkap.length === 0 && terkreditTanpaCatatan.length === 0
          ? "Tidak ada kredit deposit yang rangkap. Kalau ada saldo yang terasa berlebih, kemungkinan besar ia datang dari bonus (kartu gores, mystery box, voucher, atau koreksi admin) — cek mutasi akunnya satu per satu lewat ?token=KODE_AKUN."
          : `Ditemukan ${rangkap.length} transaksi yang dikreditkan lebih dari sekali dan ${terkreditTanpaCatatan.length} deposit terkredit tanpa catatan mutasi.`
    });
  } catch (err) {
    console.error("[admin/audit]", err?.message || err);
    return NextResponse.json({ error: err?.message || "Gagal menjalankan audit." }, { status: 500 });
  }
}
