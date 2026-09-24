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
  botSessionsCol,
  petsCol
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
  // Batas baris CSV dinaikkan dari 5.000; bisa diatur lewat ?limit=.
  const limitMinta = Number.parseInt(searchParams.get("limit") || "", 10);
  const BATAS_CSV = Math.min(Math.max(Number.isFinite(limitMinta) ? limitMinta : 100000, 1), 500000);
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

    if (type === "akun") {
      // Ekspor ringkas: token, nama, saldo, koin, poin, pet. TITIK.
      //
      // Riwayat pembelian sengaja TIDAK ikut. Bukan demi ukuran berkas: di
      // riwayat itu ada nomor telepon dan kode OTP orang. Berkas seperti ini
      // ujungnya dikirim lewat chat, disimpan di folder unduhan, atau dibuka
      // di laptop yang dipakai bersama. Yang tidak ada di dalamnya tidak bisa
      // bocor dari situ, jadi yang tidak diminta tidak ikut dibawa.
      //
      // Yang ikut pun bukan tanpa risiko: `token` adalah KREDENSIAL di situs
      // ini. Siapa pun yang memegangnya bisa membuka akun itu dan
      // membelanjakan saldonya. Berkas ini setara daftar kata sandi.
      const users = await usersCol();

      // Batasnya besar, tapi tetap ada dan tetap dilaporkan. Ekspor yang
      // diam-diam terpotong lebih berbahaya daripada ekspor yang gagal:
      // yang gagal ketahuan sekarang, yang terpotong baru ketahuan saat
      // datanya dicari dan ternyata tidak ada.
      const diminta = Number.parseInt(searchParams.get("limit") || "", 10);
      const BATAS = Math.min(Math.max(Number.isFinite(diminta) ? diminta : 200000, 1), 500000);

      const total = await users.countDocuments({});

      // Pet dibaca SEKALI untuk semua baris, bukan satu kueri per pengguna.
      // Dengan batas 200.000, satu kueri per baris berarti 200.000 perjalanan
      // ke database — cukup untuk membuat ekspornya tidak pernah selesai.
      const petMap = new Map();
      try {
        const pets = await petsCol();
        const daftarPet = await pets
          .find({})
          .project({ _id: 0, token: 1, nama: 1, level: 1, xp: 1, totalHariDirawat: 1, bornAt: 1 })
          .toArray();
        for (const p of daftarPet) if (p.token) petMap.set(p.token, p);
      } catch (e) {
        // Pet gagal dibaca tidak boleh menggagalkan seluruh ekspor; kolomnya
        // jadi null dan itu jujur, berbeda dengan angka 0 yang terbaca seperti
        // "pet-nya ada tapi levelnya nol".
        console.error("[export/akun] pets gagal:", e?.message || e);
      }

      const cursor = users
        .find({})
        .project({ _id: 0, token: 1, name: 1, balance: 1, coins: 1, points: 1 })
        .limit(BATAS);

      const enc = new TextEncoder();

      // Dialirkan, tidak dikumpulkan dulu jadi satu teks raksasa. Dengan
      // ratusan ribu baris, JSON.stringify atas seluruh larik bisa memakan
      // memori melebihi jatah fungsinya, dan yang gagal bukan cuma ekspornya.
      const stream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(
              enc.encode(
                "{\n" +
                  `  "exportedAt": ${JSON.stringify(new Date().toISOString())},\n` +
                  `  "batasBaris": ${BATAS},\n` +
                  `  "totalDiDatabase": ${total},\n` +
                  `  "terpotong": ${total > BATAS},\n` +
                  '  "isi": "token, nama, saldo, koin, poin, pet",\n' +
                  '  "tidakDisertakan": "riwayat pembelian, deposit, mutasi, nomor telepon, kode OTP",\n' +
                  '  "peringatan": "token adalah kredensial akun. Siapa pun yang memegang berkas ini bisa membuka akun mana pun di dalamnya.",\n' +
                  '  "catatanKoin": "Situs ini belum punya mata uang koin terpisah dari poin, jadi koin bernilai 0 untuk semua akun sampai fiturnya ada.",\n' +
                  '  "users": ['
              )
            );

            let n = 0;
            for await (const u of cursor) {
              const p = petMap.get(u.token);
              const baris = {
                token: u.token,
                nama: u.name || "",
                saldo: u.balance || 0,
                koin: u.coins || 0,
                poin: u.points || 0,
                pet: p
                  ? {
                      nama: p.nama || "",
                      level: p.level || 0,
                      xp: p.xp || 0,
                      totalHariDirawat: p.totalHariDirawat || 0,
                      bornAt: p.bornAt ? new Date(p.bornAt).toISOString() : null
                    }
                  : null
              };
              controller.enqueue(enc.encode((n === 0 ? "\n    " : ",\n    ") + JSON.stringify(baris)));
              n += 1;
            }

            controller.enqueue(enc.encode(`${n === 0 ? "" : "\n  "}],\n  "jumlah": ${n}\n}\n`));
            controller.close();
          } catch (e) {
            console.error("[export/akun]", e);
            controller.error(e);
          } finally {
            await cursor.close().catch(() => {});
          }
        }
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="artapedia-akun-${Date.now()}.json"`,
          "Cache-Control": "no-store"
        }
      });

    } else if (type === "backup") {
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
      const rows = await users.find(filter).sort({ createdAt: -1 }).limit(BATAS_CSV).toArray();
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
      const rows = await deposits.find(filter).sort({ createdAt: -1 }).limit(BATAS_CSV).toArray();
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
      const rows = await orders.find(filter).sort({ createdAt: -1 }).limit(BATAS_CSV).toArray();
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
