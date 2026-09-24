// Panel admin QRIS Gateway: antrean penarikan + tindakan atasnya.
//
// Penarikan sengaja MANUAL. Tidak ada jalur otomatis yang mengirim uang keluar
// tanpa ada manusia yang melihat tujuannya — kalau ada akun yang diambil alih
// orang lain, jeda ini satu-satunya kesempatan menangkapnya sebelum uangnya
// pergi dan tidak bisa ditarik kembali.
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { gatewayWithdrawalsCol, gatewayAccountsCol, usersCol } from "@/lib/db";
import { tolakPenarikan, selesaikanPenarikan } from "@/lib/gateway";
import { notifyBotUser } from "@/lib/shopBot";

export const dynamic = "force-dynamic";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status") || "pending";
  const col = await gatewayWithdrawalsCol();
  const daftar = await col
    .find(status === "all" ? {} : { status })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  // Nama pemilik akun ikut diambil supaya admin tahu SIAPA yang menarik, bukan
  // cuma kode akunnya. Diambil sekali untuk semua, bukan satu kueri per baris.
  const users = await usersCol();
  const tokens = [...new Set(daftar.map((w) => w.token))];
  const orang = await users.find({ token: { $in: tokens } }, { projection: { token: 1, name: 1 } }).toArray();
  const nama = Object.fromEntries(orang.map((u) => [u.token, u.name || ""]));

  const akunCol = await gatewayAccountsCol();
  const akun = await akunCol.find({ token: { $in: tokens } }).toArray();
  const saldo = Object.fromEntries(akun.map((a) => [a.token, a.balance || 0]));

  const pending = await col.countDocuments({ status: "pending" });

  return NextResponse.json({
    pending,
    items: daftar.map((w) => ({
      wdId: w.wdId,
      token: w.token,
      nama: nama[w.token] || "",
      saldoSisa: saldo[w.token] ?? 0,
      amount: w.amount,
      biaya: w.biaya,
      diterima: w.diterima,
      ewallet: w.ewallet,
      ewalletNama: w.ewalletNama,
      nomor: w.nomor,
      atasNama: w.atasNama,
      status: w.status,
      alasan: w.alasan || "",
      createdAt: w.createdAt,
      selesaiAt: w.selesaiAt || null
    }))
  });
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { wdId, aksi, alasan, catatan, token, beku } = await req.json().catch(() => ({}));

  // Bekukan / cairkan akun gateway.
  if (aksi === "beku") {
    if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
    const col = await gatewayAccountsCol();
    await col.updateOne({ token }, { $set: { dibekukan: Boolean(beku) } });
    return NextResponse.json({ ok: true, dibekukan: Boolean(beku) });
  }

  if (!wdId) return NextResponse.json({ error: "Kode penarikan kosong." }, { status: 400 });

  if (aksi === "tolak") {
    const r = await tolakPenarikan(wdId, alasan);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400 });
    notifyBotUser(
      r.penarikan.token,
      `❌ <b>PENARIKAN DITOLAK</b>\n\n` +
        `Penarikan ${rp(r.penarikan.amount)} ke ${r.penarikan.ewalletNama} ditolak.\n` +
        `Saldo gateway kamu sudah dikembalikan penuh, termasuk biayanya.\n` +
        (alasan ? `\n<b>Alasan:</b> ${String(alasan).slice(0, 200)}` : "")
    ).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (aksi === "selesai") {
    const r = await selesaikanPenarikan(wdId, catatan);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400 });
    notifyBotUser(
      r.penarikan.token,
      `✅ <b>PENARIKAN DIKIRIM</b>\n\n` +
        `${rp(r.penarikan.diterima)} sudah dikirim ke ${r.penarikan.ewalletNama} ${r.penarikan.nomor}.\n` +
        `Cek e-wallet kamu ya.`
    ).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
