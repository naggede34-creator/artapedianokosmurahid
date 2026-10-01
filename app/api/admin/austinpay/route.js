// Panel admin AustinPay: status koneksi, SALDO, riwayat, dan PENARIKAN saldo (instant ke e-wallet / withdraw biasa) —
// HANYA ADMIN. Menarik saldo memindahkan uang pemilik web keluar, jadi selain cookie admin, setiap penarikan
// WAJIB menyertakan kode admin lagi (konfirmasi ulang) dan dibatasi lajunya.
import { NextResponse } from "next/server";
import { adminSah, adminCodeMatches } from "@/lib/adminAuth";
import { rateLimit } from "@/lib/rateLimit";
import {
  diagnosaAustin, austinAkun, austinTransaksi, dompetInstan, riwayatInstan, metodeWithdrawAustin, buatWithdrawAustin, austinConfigured
} from "@/lib/austinpay";
import { adminTarikInstan, daftarWdAdmin, jalankanWd, sinkronWd, DOMPET_CADANGAN } from "@/lib/wdInstan";
import { wdInstanCol } from "@/lib/db";
import { catatKejadian } from "@/lib/keamanan";
import { umumkan } from "@/lib/notifyHub";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const ipDari = (req) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
const j = (d, s = 200) => NextResponse.json(d, { status: s, headers: { "Cache-Control": "no-store" } });
const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

// GET → diagnosa + saldo + riwayat penarikan (pengguna & admin) + transaksi terbaru di AustinPay
export async function GET(req) {
  if (!(await adminSah(req))) return j({ error: "Unauthorized." }, 401);
  const url = new URL(req.url);
  const hasil = { terkonfigurasi: await austinConfigured(), webhook: `${url.origin}/api/deposit/austinpay-webhook` };
  if (!hasil.terkonfigurasi) return j({ ...hasil, ok: false, pesan: "API key belum diisi. Isi di Dasbor Admin → Konfigurasi → Pembayaran." });
  const diag = await diagnosaAustin();
  Object.assign(hasil, diag);
  if (diag.ok) {
    const [trx, dompet] = await Promise.all([austinTransaksi({ limit: 15 }).catch(() => ({ data: [] })), dompetInstan().catch(() => null)]);
    hasil.transaksi = trx.data;
    hasil.dompet = dompet?.wallets?.length ? dompet.wallets.filter((w) => (dompet.tipe[w] || "phone") === "phone") : DOMPET_CADANGAN;
  }
  hasil.penarikan = await daftarWdAdmin({ limit: 40 });
  return j(hasil);
}

// POST { aksi: "cek" | "tarik" | "tarik-biasa" | "metode" | "sinkron", ... }
export async function POST(req) {
  if (!(await adminSah(req))) return j({ error: "Unauthorized." }, 401);
  const b = await req.json().catch(() => ({}));
  const ip = ipDari(req);
  try {
    if (b.aksi === "cek") return j(await diagnosaAustin());
    if (b.aksi === "metode") return j({ ok: true, metode: await metodeWithdrawAustin() });
    if (b.aksi === "sinkron") {
      const w = await (await wdInstanCol()).findOne({ wid: String(b.wid || "") });
      if (!w) return j({ error: "Penarikan tidak ditemukan." }, 404);
      const baru = w.status === "baru" ? await jalankanWd(w.wid) : await sinkronWd(w);
      return j({ ok: true, status: baru?.status || w.status });
    }
    if (b.aksi === "tarik" || b.aksi === "tarik-biasa") {
      if (!rateLimit(`${ip || "?"}:admin-austin-tarik`, 5, 10 * 60_000)) return j({ error: "Terlalu banyak percobaan penarikan. Tunggu 10 menit." }, 429);
      // Konfirmasi ulang dengan kode admin: cookie curian / CSRF saja tidak cukup untuk menarik uang.
      if (!b.kode || !(await adminCodeMatches(String(b.kode)))) {
        await catatKejadian({ jenis: "admin-wd-kode-salah", tingkat: "tinggi", ip, detail: "Konfirmasi kode admin salah saat menarik saldo AustinPay" });
        return j({ error: "Kode admin salah." }, 403);
      }
      const nominal = Math.floor(Number(b.nominal));
      if (!Number.isFinite(nominal) || nominal < 10000) return j({ error: "Minimal Rp10.000." }, 400);
      if (b.aksi === "tarik") {
        const r = await adminTarikInstan({ wallet: b.wallet, nomor: b.nomor, nominal, catatan: b.catatan });
        if (!r.ok) return j({ error: r.alasan }, 400);
        await catatKejadian({ jenis: "admin-wd", tingkat: "info", ip, detail: `instant ${rp(nominal)} → ${b.wallet}` });
        return j({ ok: true, wd: r.wd });
      }
      const method = String(b.method || "").trim();
      const nomor = String(b.nomor || "").replace(/\s/g, "");
      const nama = String(b.nama || "").trim().slice(0, 80);
      if (!method || !nomor || !nama) return j({ error: "Metode, nomor, dan nama pemilik wajib diisi." }, 400);
      const r = await buatWithdrawAustin({ amount: nominal, method, accountNumber: nomor, accountName: nama, note: String(b.catatan || "").slice(0, 200) });
      await catatKejadian({ jenis: "admin-wd", tingkat: "info", ip, detail: `biasa ${rp(nominal)} → ${method}` });
      umumkan({ admin: `🏦 <b>ADMIN MENARIK SALDO AUSTINPAY (WD biasa)</b>\n💸 ${rp(nominal)} → ${method} <code>${nomor}</code> a.n. ${nama}\n🔖 ${r.id || "—"}` });
      return j({ ok: true, id: r.id, pesan: r.pesan });
    }
    return j({ error: "Aksi tidak dikenal." }, 400);
  } catch (err) {
    console.error("[admin/austinpay]", err?.message || err);
    return j({ error: err?.message || "Terjadi kesalahan." }, 400);
  }
}
