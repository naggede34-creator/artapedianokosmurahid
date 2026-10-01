// Tampilan layar "akun di-ban" yang bisa diatur admin: judul, teks, foto, latar, tombol, dan HTML kustom (disandbox).
// Tersimpan di `tampilan_kustom` (_id "ban"). Gambar berupa data URL di database dan disajikan lewat
// /api/ban-tampilan/gambar (jalur itu dikecualikan dari blokir IP supaya IP yang diblokir tetap bisa memuatnya).
import { tampilanKustomCol } from "@/lib/db";
import { tautanAman } from "@/lib/tautanDasbor";
import { gambarAman } from "@/lib/popupAdmin";

export const MAKS_HTML = 20000;
const warna = (v) => (/^#[0-9a-fA-F]{3,8}$/.test(String(v || "").trim()) ? String(v).trim() : "");
const teks = (v, n) => String(v || "").trim().slice(0, n);

export const BAWAAN_BAN = { aktif: false, judul: "", teks: "", gambar: "", gambarLatar: "", latar1: "#3a0d14", latar2: "#0b0b10", warnaTeks: "#ffffff", warnaJudul: "#ff5a67", tombolTeks: "", tombolHref: "", html: "", htmlTinggi: 320, versi: 0 };

/** Bentuk untuk admin: gambar apa adanya (data URL) supaya bisa dipratinjau dan disimpan ulang. */
export async function ambilBanAdmin() {
  const d = await (await tampilanKustomCol()).findOne({ _id: "ban" });
  return { ...BAWAAN_BAN, ...(d || {}), _id: undefined };
}

/** Bentuk publik: gambar diganti URL ringan; selalu mengembalikan objek lengkap (aktif=false → tampilan bawaan). */
export async function ambilBanPublik() {
  const d = await ambilBanAdmin();
  const url = (k) => (!d[k] ? "" : /^https:/i.test(d[k]) ? d[k] : `/api/ban-tampilan/gambar?k=${k}&v=${d.versi || 0}`);
  if (!d.aktif) return { ...BAWAAN_BAN };
  return { aktif: true, judul: d.judul, teks: d.teks, gambar: url("gambar"), gambarLatar: url("gambarLatar"), latar1: d.latar1, latar2: d.latar2, warnaTeks: d.warnaTeks, warnaJudul: d.warnaJudul, tombolTeks: d.tombolTeks, tombolHref: d.tombolHref, html: d.html, htmlTinggi: d.htmlTinggi, versi: d.versi || 0 };
}

export async function simpanBan(b) {
  const lama = await ambilBanAdmin();
  const f = {
    aktif: b.aktif === undefined ? !!lama.aktif : !!b.aktif,
    judul: teks(b.judul ?? lama.judul, 160),
    teks: teks(b.teks ?? lama.teks, 1500),
    gambar: b.gambar === undefined ? lama.gambar : gambarAman(b.gambar),
    gambarLatar: b.gambarLatar === undefined ? lama.gambarLatar : gambarAman(b.gambarLatar),
    latar1: warna(b.latar1 ?? lama.latar1) || BAWAAN_BAN.latar1,
    latar2: warna(b.latar2 ?? lama.latar2) || BAWAAN_BAN.latar2,
    warnaTeks: warna(b.warnaTeks ?? lama.warnaTeks) || BAWAAN_BAN.warnaTeks,
    warnaJudul: warna(b.warnaJudul ?? lama.warnaJudul) || BAWAAN_BAN.warnaJudul,
    tombolTeks: teks(b.tombolTeks ?? lama.tombolTeks, 40),
    tombolHref: b.tombolHref === undefined ? lama.tombolHref : tautanAman(b.tombolHref),
    html: String(b.html ?? lama.html ?? "").slice(0, MAKS_HTML),
    htmlTinggi: Math.max(80, Math.min(900, Math.floor(Number(b.htmlTinggi ?? lama.htmlTinggi) || 320)))
  };
  if (b.gambar && !f.gambar) return { ok: false, alasan: "Foto tidak valid atau terlalu besar (maks ±1 MB; PNG/JPG/WEBP/GIF)." };
  if (b.gambarLatar && !f.gambarLatar) return { ok: false, alasan: "Foto latar tidak valid atau terlalu besar (maks ±1 MB)." };
  if (b.tombolHref && !f.tombolHref) return { ok: false, alasan: "Tujuan tombol harus jalur dalam situs (mis. /dashboard) atau alamat https." };
  if (f.tombolTeks && !f.tombolHref) return { ok: false, alasan: "Pilih tujuan tombol." };
  await (await tampilanKustomCol()).updateOne({ _id: "ban" }, { $set: { ...f, versi: Date.now(), updatedAt: new Date() } }, { upsert: true });
  return { ok: true };
}

export async function resetBan() {
  await (await tampilanKustomCol()).deleteOne({ _id: "ban" });
  return { ok: true };
}

/** Mengurai data URL gambar tersimpan jadi { tipe, buffer } untuk disajikan. */
export async function gambarBan(kunci) {
  if (kunci !== "gambar" && kunci !== "gambarLatar") return null;
  const d = await ambilBanAdmin();
  const m = /^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/.exec(d[kunci] || "");
  return m ? { tipe: m[1], buffer: Buffer.from(m[2], "base64") } : null;
}
