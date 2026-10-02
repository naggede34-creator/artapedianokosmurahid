// Kunci akun oleh pemilik (lihat lib/gerbangUang.js untuk aturan mainnya).
import { usersCol } from "@/lib/db";
import { kunciAktif, tundaBukaKunciMenit } from "@/lib/gerbangUang";

export async function statusKunci(token) {
  const u = await (await usersCol()).findOne({ token: String(token || "") }, { projection: { kunciAkun: 1, kunciBukaAt: 1, kunciSejak: 1 } });
  if (!u) return null;
  const tunda = await tundaBukaKunciMenit();
  const aktif = kunciAktif(u);
  return {
    terkunci: aktif,
    sejak: u.kunciSejak || null,
    bukaAt: aktif && u.kunciBukaAt ? new Date(u.kunciBukaAt).getTime() : null, // pengajuan buka sedang berjalan
    tundaMenit: tunda
  };
}

/** aksi: "kunci" | "minta-buka" | "batal-buka" */
export async function ubahKunci(token, aksi) {
  const kol = await usersCol();
  const tk = String(token || "");
  const u = await kol.findOne({ token: tk }, { projection: { kunciAkun: 1, kunciBukaAt: 1, suspended: 1 } });
  if (!u) return { ok: false, status: 404, alasan: "Akun tidak ditemukan." };
  const aktif = kunciAktif(u);
  if (aksi === "kunci") {
    if (aktif) return { ok: false, status: 400, alasan: "Akun sudah terkunci." };
    await kol.updateOne({ token: tk }, { $set: { kunciAkun: true, kunciSejak: new Date() }, $unset: { kunciBukaAt: "" } });
    return { ok: true, status: await statusKunci(tk) };
  }
  if (!aktif) return { ok: false, status: 400, alasan: "Akun tidak sedang terkunci." };
  if (aksi === "minta-buka") {
    const tunda = await tundaBukaKunciMenit();
    if (u.kunciBukaAt) return { ok: false, status: 400, alasan: "Pengajuan buka kunci sudah berjalan." };
    if (tunda === 0) {
      await kol.updateOne({ token: tk }, { $unset: { kunciAkun: "", kunciBukaAt: "", kunciSejak: "" } });
    } else {
      await kol.updateOne({ token: tk }, { $set: { kunciBukaAt: new Date(Date.now() + tunda * 60000) } });
    }
    return { ok: true, status: await statusKunci(tk) };
  }
  if (aksi === "batal-buka") {
    await kol.updateOne({ token: tk }, { $unset: { kunciBukaAt: "" } });
    return { ok: true, status: await statusKunci(tk) };
  }
  return { ok: false, status: 400, alasan: "Aksi tidak dikenal." };
}
