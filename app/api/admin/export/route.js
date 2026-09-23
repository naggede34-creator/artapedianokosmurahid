// GET /api/admin/export?type=deposits|transactions|users|backup&from=YYYY-MM-DD&to=YYYY-MM-DD
// type=backup  → JSON penuh semua user (untuk restore)
// type=users   → CSV ringkasan user
// type=deposits → CSV deposit
// type=transactions → CSV transaksi OTP
import { NextResponse } from "next/server";
import {
  usersCol,
  depositsCol,
  otpOrdersCol,
  balanceLogsCol,
  adminBalanceLogsCol,
  settingsCol,
  vouchersCol,
  dailyActivitiesCol,
  missionsCol,
  scratchCardsCol,
  mysteryBoxCol,
  weeklyChallengesCol,
  userNotificationsCol,
  otpFavoritesCol,
  userTelegramCol,
  productOrdersCol,
  jobSubmissionsCol,
  warrantyClaimsCol,
  ticketsCol,
  botSessionsCol
} from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function escCsv(v) {
  const s = String(v ?? "").replace(/"/g, '""');
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
}

function toWIB(date) {
  if (!date) return "";
  return new Date(date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "transactions";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateFilter.$lte = toDate;
  }

  try {
    let csv = "";
    let filename = "";

    if (type === "backup") {
      // Backup penuh = SEMUA koleksi, bukan cuma user.
      //
      // Versi sebelumnya hanya menyalin koleksi users. Dokumen user memang
      // sudah lengkap di situ (saldo, poin, totalSpent, cashback, semuanya),
      // tapi kalau datanya benar-benar hilang, yang tidak ikut terselamatkan
      // adalah riwayat pesanan, deposit, dan mutasi saldo — justru bagian yang
      // tidak bisa dibangun ulang dari mana pun.
      //
      // Tiap koleksi dibatasi jumlahnya, dan kalau kena batas itu DITULIS di
      // dalam berkasnya. Backup yang diam-diam terpotong lebih berbahaya
      // daripada backup yang gagal, karena baru ketahuan saat dipakai.
      const BATAS = 50000;

      const daftar = [
        ["users", usersCol],
        ["deposits", depositsCol],
        ["otp_orders", otpOrdersCol],
        ["balance_logs", balanceLogsCol],
        ["admin_balance_logs", adminBalanceLogsCol],
        ["settings", settingsCol],
        ["vouchers", vouchersCol],
        ["daily_activities", dailyActivitiesCol],
        ["missions", missionsCol],
        ["scratch_cards", scratchCardsCol],
        ["mystery_box", mysteryBoxCol],
        ["weekly_challenges", weeklyChallengesCol],
        ["user_notifications", userNotificationsCol],
        ["otp_favorites", otpFavoritesCol],
        ["user_telegram", userTelegramCol],
        ["product_orders", productOrdersCol],
        ["job_submissions", jobSubmissionsCol],
        ["warranty_claims", warrantyClaimsCol],
        ["tickets", ticketsCol],
        ["bot_sessions", botSessionsCol]
      ];

      const data = {};
      const ringkasan = {};
      const terpotong = [];
      let users = [];

      for (const [nama, ambil] of daftar) {
        try {
          const col = await ambil();
          const total = await col.countDocuments({});
          const rows = await col.find({}).limit(BATAS).toArray();
          const bersih = rows.map(({ _id, ...sisa }) => ({ _id: _id?.toString(), ...sisa }));
          if (nama === "users") users = bersih;
          else data[nama] = bersih;
          ringkasan[nama] = { disimpan: rows.length, totalDiDatabase: total };
          if (total > rows.length) terpotong.push(nama);
        } catch (e) {
          // Satu koleksi yang gagal dibaca tidak boleh menggagalkan seluruh
          // backup — sisanya tetap jauh lebih berharga daripada tidak ada.
          console.error(`[backup] koleksi ${nama} gagal:`, e?.message || e);
          if (nama !== "users") data[nama] = [];
          ringkasan[nama] = { disimpan: 0, totalDiDatabase: null, gagal: String(e?.message || e) };
        }
      }

      const json = JSON.stringify(
        {
          version: 2,
          exportedAt: new Date().toISOString(),
          batasPerKoleksi: BATAS,
          koleksiTerpotong: terpotong,
          ringkasan,
          // users SENGAJA ditaruh di tingkat atas, bukan di dalam `data`:
          // /api/admin/import membacanya dari sana, jadi berkas versi 2 tetap
          // bisa di-restore alat yang sudah ada. Dan karena tidak disalin dua
          // kali, koleksi terbesar tidak menggandakan ukuran berkasnya.
          count: users.length,
          users,
          data
        },
        null,
        2
      );

      return new NextResponse(json, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="artapedia-backup-${Date.now()}.json"`,
          "Cache-Control": "no-store"
        }
      });

    } else if (type === "users") {
      const users = await usersCol();
      const filter = from || to ? { createdAt: dateFilter } : {};
      const rows = await users.find(filter).sort({ createdAt: -1 }).limit(5000).toArray();
      const headers = ["Token", "Nama", "Saldo", "Total Deposit", "Poin", "Tier", "Referral", "Ditangguhkan", "Daftar (WIB)"];
      csv = headers.join(",") + "\n" + rows.map((u) => [
        u.token, u.name || "", u.balance || 0, u.depositTotal || 0,
        u.points || 0, u.lastKnownTier || "Bronze", u.referralCount || 0,
        u.suspended ? "Ya" : "Tidak", toWIB(u.createdAt)
      ].map(escCsv).join(",")).join("\n");
      filename = `artapedia-users-${Date.now()}.csv`;

    } else if (type === "deposits") {
      const deposits = await depositsCol();
      const filter = from || to ? { createdAt: dateFilter } : {};
      const rows = await deposits.find(filter).sort({ createdAt: -1 }).limit(5000).toArray();
      const headers = ["ID Deposit", "Token", "Provider", "Jumlah (Rp)", "Status", "Dibuat (WIB)", "Dibayar (WIB)"];
      csv = headers.join(",") + "\n" + rows.map((d) => [
        d.depositId || d._id?.toString(), d.token, d.provider,
        d.amount || 0, d.status, toWIB(d.createdAt), toWIB(d.paidAt)
      ].map(escCsv).join(",")).join("\n");
      filename = `artapedia-deposits-${Date.now()}.csv`;

    } else {
      // transactions (OTP orders)
      const orders = await otpOrdersCol();
      const filter = from || to ? { createdAt: dateFilter } : {};
      const rows = await orders.find(filter).sort({ createdAt: -1 }).limit(5000).toArray();
      const headers = ["Order ID", "Token", "Layanan", "Negara", "Nomor", "Harga Jual (Rp)", "Harga Base (Rp)", "Status", "OTP Code", "Dibuat (WIB)"];
      csv = headers.join(",") + "\n" + rows.map((o) => [
        o.orderId, o.token, o.serviceName, o.countryName, o.phoneNumber,
        o.price || 0, o.basePrice || 0, o.status, o.otpCode || "", toWIB(o.createdAt)
      ].map(escCsv).join(",")).join("\n");
      filename = `artapedia-transaksi-${Date.now()}.csv`;
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    console.error("[admin/export]", err);
    return NextResponse.json({ error: "Gagal ekspor data." }, { status: 500 });
  }
}
