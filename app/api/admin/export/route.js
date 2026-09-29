// GET /api/admin/export?type=deposits|transactions|users|backup&from=YYYY-MM-DD&to=YYYY-MM-DD
// type=backup  → JSON penuh semua user (untuk restore)
// type=users   → CSV ringkasan user
// type=deposits → CSV deposit
// type=transactions → CSV transaksi OTP
import { NextResponse } from "next/server";
import { usersCol, depositsCol, otpOrdersCol, petsCol } from "@/lib/db";
import { adminSah } from "@/lib/adminAuth";
import { bangunBackupPenuh, barisAkun, PROYEKSI_AKUN, KETERANGAN_AKUN } from "@/lib/backupData";

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
  if (!await adminSah(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

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
        .project(PROYEKSI_AKUN)
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
                  `  "isi": ${JSON.stringify(KETERANGAN_AKUN.isi)},\n` +
                  `  "tidakDisertakan": ${JSON.stringify(KETERANGAN_AKUN.tidakDisertakan)},\n` +
                  `  "peringatan": ${JSON.stringify(KETERANGAN_AKUN.peringatan)},\n` +
                  `  "catatanKoin": ${JSON.stringify(KETERANGAN_AKUN.catatanKoin)},\n` +
                  '  "users": ['
              )
            );

            let n = 0;
            for await (const u of cursor) {
              const p = petMap.get(u.token);
              // barisAkun() dipakai bersama backup otomatis: kalau kolomnya
              // ditentukan dua kali, suatu saat yang satu ikut menyertakan apa
              // yang di satu lagi sengaja dibuang.
              const baris = barisAkun(u, p);
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
      // Dibangun lib/backupData.js, yang SAMA dipakai backup otomatis lewat
      // bot. Dua kode terpisah akan berbeda pelan-pelan, dan yang berbeda di
      // sini adalah kolom mana yang ikut dibawa keluar.
      const { teks } = await bangunBackupPenuh();
      return new NextResponse(teks, {
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
