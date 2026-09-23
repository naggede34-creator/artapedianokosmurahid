// Penarikan saldo Atlantic — HANYA ADMIN.
//
// Endpoint ini memindahkan uang KELUAR dari saldo Atlantic ke rekening atau
// e-wallet. Tidak ada saldo pengguna yang tersentuh: yang ditarik adalah uang
// pemilik web yang sudah terkumpul di Atlantic.
//
// Karena itu tidak ada satu pun jalur di sini yang boleh dipakai tanpa cookie
// admin — termasuk daftar bank dan cek rekening, yang sekilas tampak tidak
// berbahaya tapi tetap memakai API key yang sama.
import { NextResponse } from "next/server";
import { withdrawalsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import {
  atlanticConfigured,
  atlanticBankList,
  atlanticCheckAccount,
  atlanticCreateTransfer,
  atlanticTransferStatus,
  normalizeAtlanticStatus
} from "@/lib/atlantic";
import { sendTelegramNotif, withdrawNotif } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const MIN_WITHDRAW = 10_000;

function guard(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!atlanticConfigured()) {
    return NextResponse.json(
      { error: "ATLANTIC_APIKEY belum diisi di environment variables, jadi penarikan belum bisa dipakai." },
      { status: 400 }
    );
  }
  return null;
}

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const col = await withdrawalsCol();
  const items = await col.find({}).sort({ createdAt: -1 }).limit(50).toArray();
  return NextResponse.json({
    configured: atlanticConfigured(),
    items: items.map((w) => ({
      refId: w.refId,
      providerId: w.providerId || null,
      bankCode: w.bankCode,
      bankName: w.bankName || w.bankCode,
      accountNumber: w.accountNumber,
      ownerName: w.ownerName || "",
      nameVerified: w.nameVerified !== false,
      nominal: w.nominal,
      fee: w.fee ?? null,
      total: w.total ?? null,
      status: w.status,
      note: w.note || "",
      error: w.error || "",
      createdAt: w.createdAt,
      updatedAt: w.updatedAt || null
    }))
  });
}

export async function POST(req) {
  const blocked = guard(req);
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  try {
    if (action === "banks") {
      return NextResponse.json({ ok: true, items: await atlanticBankList() });
    }

    if (action === "check") {
      const bankCode = String(body.bankCode || "").trim();
      const accountNumber = String(body.accountNumber || "").replace(/\s/g, "");
      if (!bankCode || !accountNumber) return NextResponse.json({ error: "Bank dan nomor rekening wajib diisi." }, { status: 400 });
      const info = await atlanticCheckAccount({ bankCode, accountNumber });
      return NextResponse.json({ ok: true, ...info });
    }

    if (action === "create") {
      const bankCode = String(body.bankCode || "").trim();
      const bankName = String(body.bankName || bankCode).slice(0, 80);
      const accountNumber = String(body.accountNumber || "").replace(/\s/g, "");
      const nominal = Math.floor(Number(body.nominal) || 0);
      const note = String(body.note || "").slice(0, 200);

      if (!bankCode || !accountNumber) return NextResponse.json({ error: "Bank dan nomor rekening wajib diisi." }, { status: 400 });
      if (!Number.isFinite(nominal) || nominal < MIN_WITHDRAW) {
        return NextResponse.json({ error: `Nominal penarikan minimal Rp${MIN_WITHDRAW.toLocaleString("id-ID")}.` }, { status: 400 });
      }

      // Nama pemilik ditanyakan ULANG di server, bukan diambil dari yang
      // dikirim halaman admin. Nomor yang salah ketik satu digit tetap lolos
      // cek di browser kalau namanya ikut dikirim begitu saja, dan uangnya
      // sudah tidak bisa ditarik kembali setelah pindah.
      let ownerName = String(body.ownerName || "").slice(0, 80);
      let nameVerified = false;
      try {
        const info = await atlanticCheckAccount({ bankCode, accountNumber });
        if (info.ownerName) {
          ownerName = info.ownerName;
          nameVerified = true;
        }
      } catch (err) {
        // Sebagian e-wallet tidak melayani cek nama. Kalau admin sudah mengisi
        // namanya sendiri, penarikan tetap diteruskan tapi ditandai belum
        // terverifikasi supaya terlihat jelas di riwayat.
        if (!ownerName) {
          return NextResponse.json(
            { error: `Nomor tujuan tidak bisa diperiksa (${err?.message || "gagal"}). Isi nama pemilik dulu, atau periksa nomornya.` },
            { status: 400 }
          );
        }
      }

      const refId = `WD${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const col = await withdrawalsCol();

      // Catatannya ditulis SEBELUM Atlantic dipanggil. Kalau prosesnya putus di
      // tengah, masih ada jejak nominal dan tujuannya untuk dicocokkan, bukan
      // uang yang hilang tanpa catatan.
      await col.insertOne({
        refId,
        bankCode,
        bankName,
        accountNumber,
        ownerName,
        nameVerified,
        nominal,
        note,
        status: "creating",
        createdAt: new Date()
      });

      let trf;
      try {
        trf = await atlanticCreateTransfer({ refId, bankCode, accountNumber, ownerName, nominal, note });
      } catch (err) {
        await col.updateOne(
          { refId },
          { $set: { status: "failed", error: String(err?.message || "gagal").slice(0, 300), updatedAt: new Date() } }
        );
        return NextResponse.json({ error: err?.message || "Penarikan gagal dibuat." }, { status: 400 });
      }

      const status = normalizeAtlanticStatus(trf.status);
      await col.updateOne(
        { refId },
        {
          $set: {
            providerId: trf.id,
            fee: trf.fee,
            total: trf.total,
            status,
            updatedAt: new Date()
          }
        }
      );

      sendTelegramNotif(
        withdrawNotif({
          refId,
          bankName,
          accountNumber,
          ownerName,
          nominal,
          fee: trf.fee,
          total: trf.total,
          status,
          providerId: trf.id
        })
      );

      return NextResponse.json({ ok: true, refId, providerId: trf.id, status, fee: trf.fee, total: trf.total, ownerName, nameVerified });
    }

    if (action === "refresh") {
      const refId = String(body.refId || "");
      if (!refId) return NextResponse.json({ error: "refId wajib." }, { status: 400 });
      const col = await withdrawalsCol();
      const w = await col.findOne({ refId });
      if (!w) return NextResponse.json({ error: "Penarikan tidak ditemukan." }, { status: 404 });
      if (!w.providerId) return NextResponse.json({ ok: true, status: w.status });

      const info = await atlanticTransferStatus(w.providerId);
      const status = normalizeAtlanticStatus(info.status);
      if (status !== w.status) {
        await col.updateOne({ refId }, { $set: { status, fee: info.fee, total: info.total, updatedAt: new Date() } });
        // Hasil akhirnya dikabari sekali, bukan tiap kali tombol segarkan ditekan.
        if (["completed", "failed", "canceled"].includes(status)) {
          sendTelegramNotif(
            withdrawNotif({
              refId,
              bankName: w.bankName,
              accountNumber: w.accountNumber,
              ownerName: w.ownerName,
              nominal: w.nominal,
              fee: info.fee,
              total: info.total,
              status,
              providerId: w.providerId
            })
          );
        }
      }
      return NextResponse.json({ ok: true, status, fee: info.fee, total: info.total });
    }

    return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
  } catch (err) {
    console.error("[admin/withdraw]", err?.message || err);
    return NextResponse.json({ error: err?.message || "Terjadi kesalahan." }, { status: 400 });
  }
}
