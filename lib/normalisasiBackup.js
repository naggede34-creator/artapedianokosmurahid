// Mengubah BERBAGAI bentuk berkas JSON backup menjadi satu bentuk:
//   { jenis, label, koleksi: { namaKoleksi: [dokumen,...] }, legacy: bool, perluPilihKoleksi?: [...] }
//
// Format yang dikenali:
//   1. Data Lengkap (artapedia-data-lengkap)       — dari kartu Ekspor Data Lengkap
//   2. Backup Penuh lama  { users:[...], data:{koleksi:[...]} }  (/api/admin/export?type=backup, backup bot)
//   3. Database Akun      { users:[{token,nama,saldo}] }
//   4. Backup Web Reseller / Bot Reseller  { jenis:"web-reseller"|"bot-reseller", data:[...] }
//   5. Objek biasa yang kunci-kuncinya nama koleksi { users:[...], deposits:[...] }
//   6. Larik polos [...]: user kalau ada `token`; selain itu admin memilih koleksi tujuan
//
// Murni (tanpa import server) supaya aman dipakai di peramban.
const WAJIB_KOLEKSI = null; // daftar putih ditegakkan SERVER; di sini hanya membentuk data.

const adalahObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const tgl = (v) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : { $date: d.toISOString() };
};
const bersih = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

function penggunaDariAkun(u, ekstra = {}) {
  return bersih({
    token: u.token,
    name: u.name ?? u.nama,
    balance: u.balance ?? u.saldo,
    totalSpent: u.totalSpent ?? u.totalBelanja,
    suspended: u.suspended ?? u.ditangguhkan,
    createdAt: u.createdAt && typeof u.createdAt === "object" ? u.createdAt : tgl(u.createdAt ?? u.dibuat),
    telegramChatId: u.telegramChatId,
    telegramUsername: u.telegramUsername,
    ...ekstra
  });
}

export function normalisasiBackup(data) {
  // 1. Data Lengkap
  if (adalahObj(data) && data.format === "artapedia-data-lengkap" && adalahObj(data.koleksi)) {
    return { jenis: "lengkap", label: "Data Lengkap", koleksi: data.koleksi, legacy: false, meta: data };
  }

  // 4. Backup web / bot reseller
  if (adalahObj(data) && (data.jenis === "web-reseller" || data.jenis === "bot-reseller") && Array.isArray(data.data)) {
    const users = [];
    const web = [];
    const bots = [];
    for (const g of data.data) {
      if (g?.web) {
        const w = g.web;
        web.push(bersih({
          slug: w.slug, nama: w.nama, markupPersen: w.markupPersen, aktif: w.aktif, dibekukan: w.dibekukan,
          pemilik: w.pemilikToken, createdAt: tgl(w.dibuat), kunjungan: w.kunjungan, pesananTotal: w.pesananTotal,
          pesananSelesai: w.pesananSelesai, omzet: w.omzet, komisiTotal: w.komisiTotal, komisiTertunda: w.komisiTertunda
        }));
        for (const u of g.pengguna || []) users.push(penggunaDariAkun(u, { rwSlug: w.slug }));
      }
      if (g?.bot) {
        const b = g.bot;
        bots.push(bersih({
          botId: String(b.botId), jenis: "reseller", username: b.username, nama: b.nama, aktif: b.aktif,
          dimatikanAdmin: b.dimatikanAdmin, pemilikToken: b.pemilikToken, ownerUsername: b.ownerUsername,
          ownerTelegramId: b.ownerTelegramId, markupPersen: b.markupPersen, komisi: b.komisi,
          jumlahPembeli: b.jumlahPembeli, jumlahTerjual: b.jumlahTerjual, createdAt: tgl(b.dibuat)
        }));
        for (const u of g.pengguna || []) users.push(penggunaDariAkun(u, { telegramBotId: String(b.botId) }));
      }
    }
    const koleksi = { users };
    if (web.length) koleksi.reseller_web = web;
    if (bots.length) koleksi.bots = bots;
    return { jenis: data.jenis, label: data.jenis === "web-reseller" ? "Backup Web Reseller" : "Backup Bot Reseller", koleksi, legacy: false };
  }

  // 2 & 3. users di tingkat atas (Backup Penuh lama / Database Akun / impor lama)
  if (adalahObj(data) && Array.isArray(data.users)) {
    const akunRingkas = data.users.length && data.users.every((u) => u && u.token && (u.nama !== undefined || u.saldo !== undefined) && u.name === undefined && u.balance === undefined);
    if (akunRingkas) {
      return { jenis: "akun", label: "Database Akun (token, nama, saldo)", koleksi: { users: data.users.map((u) => penggunaDariAkun(u)) }, legacy: false };
    }
    const koleksi = { users: data.users };
    if (adalahObj(data.data)) for (const [k, v] of Object.entries(data.data)) if (Array.isArray(v)) koleksi[k] = v;
    return { jenis: "penuh-lama", label: "Backup Penuh (format lama)", koleksi, legacy: true };
  }

  // 5. objek { data:{...} } atau { namaKoleksi:[...] }
  if (adalahObj(data)) {
    const sumber = adalahObj(data.data) && Object.values(data.data).some(Array.isArray) ? data.data
      : adalahObj(data.koleksi) ? data.koleksi : data;
    const koleksi = {};
    for (const [k, v] of Object.entries(sumber)) if (Array.isArray(v) && v.length && v.every(adalahObj)) koleksi[k] = v;
    if (Object.keys(koleksi).length) return { jenis: "koleksi", label: "Kumpulan koleksi", koleksi, legacy: true };
  }

  // 6. larik polos
  if (Array.isArray(data) && data.length && data.every(adalahObj)) {
    if (data.every((u) => u.token)) {
      const ringkas = data.every((u) => u.name === undefined && u.balance === undefined && (u.nama !== undefined || u.saldo !== undefined));
      return { jenis: "larik-users", label: "Daftar pengguna", koleksi: { users: ringkas ? data.map((u) => penggunaDariAkun(u)) : data }, legacy: !ringkas };
    }
    return { jenis: "larik", label: "Larik dokumen", koleksi: {}, larikMentah: data, legacy: true, perluPilihKoleksi: true };
  }

  return null;
}
