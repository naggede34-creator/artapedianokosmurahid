// Pembukuan sederhana: pengeluaran manual (server, iklan, langganan…) + ringkasan laba per bulan.
//   Laba kotor = Σ(harga jual − harga modal) pesanan OTP yang BERHASIL (status "done") pada bulan itu (zona WIB).
//   Laba bersih = laba kotor − pengeluaran manual bulan itu.
// Belum termasuk margin produk digital / Stor Gmail / fee deposit — itu punya dasbornya sendiri.
import { randomBytes } from "node:crypto";
import { pembukuanCol, otpOrdersCol } from "@/lib/db";

const KATEGORI = ["Server & hosting", "Iklan & promosi", "Langganan API", "Domain", "Gaji / bagi hasil", "Lain-lain"];
export { KATEGORI };

const awalAkhir = (bulan) => {
  const [y, m] = bulan.split("-").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];
  return { dari: new Date(`${y}-${pad(m)}-01T00:00:00+07:00`), sampai: new Date(`${next[0]}-${pad(next[1])}-01T00:00:00+07:00`) };
};
export const bulanValid = (b) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(b || ""));

export async function ringkasanBulan(bulan) {
  const { dari, sampai } = awalAkhir(bulan);
  const orders = await (await otpOrdersCol()).find({ status: "done", createdAt: { $gte: dari, $lt: sampai } }, { projection: { price: 1, basePrice: 1 } }).limit(100000).toArray();
  const labaKotor = orders.reduce((a, o) => a + Math.max(0, (Number(o.price) || 0) - (Number(o.basePrice) || 0)), 0);
  const omzet = orders.reduce((a, o) => a + (Number(o.price) || 0), 0);
  const items = await (await pembukuanCol()).find({ tanggal: { $gte: dari, $lt: sampai } }).sort({ tanggal: -1 }).limit(500).toArray();
  const pengeluaran = items.reduce((a, x) => a + (Number(x.jumlah) || 0), 0);
  const perKategori = {};
  for (const x of items) perKategori[x.kategori] = (perKategori[x.kategori] || 0) + (Number(x.jumlah) || 0);
  return { bulan, pesananBerhasil: orders.length, omzet, labaKotor, pengeluaran, labaBersih: labaKotor - pengeluaran, perKategori, items: items.map(({ _id, ...r }) => r) };
}

export async function tambahPengeluaran({ tanggal, kategori, jumlah, catatan }) {
  const jml = Math.round(Number(jumlah));
  if (!Number.isFinite(jml) || jml <= 0 || jml > 1_000_000_000) return { ok: false, alasan: "Jumlah harus bilangan positif." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tanggal || ""))) return { ok: false, alasan: "Tanggal tidak valid." };
  const kat = KATEGORI.includes(kategori) ? kategori : "Lain-lain";
  const doc = { id: `PB${randomBytes(6).toString("hex")}`, tanggal: new Date(`${tanggal}T12:00:00+07:00`), kategori: kat, jumlah: jml, catatan: String(catatan || "").replace(/\s+/g, " ").trim().slice(0, 120), at: new Date() };
  await (await pembukuanCol()).insertOne(doc);
  return { ok: true, id: doc.id };
}

export async function hapusPengeluaran(id) {
  const r = await (await pembukuanCol()).deleteOne({ id: String(id || "") });
  return r.deletedCount ? { ok: true } : { ok: false, alasan: "Catatan tidak ditemukan." };
}
