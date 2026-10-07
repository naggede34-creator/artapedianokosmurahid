import { MongoClient } from "mongodb";
import { sandi, bukaSandi } from "@/lib/sandi";

// ─────────────────────────────────────────────────────────────────────────────
// KONEKSI DATABASE — dua lapis, supaya alamat database bisa diganti dari dasbor
//
//   • database BOOTSTRAP : alamat dari Environment Variable MONGODB_URI. Satu-
//     satunya yang tidak bisa dipindah ke dasbor, sebab alamat baru itu sendiri
//     disimpan di database — harus ada satu database yang dibuka duluan.
//     Seluruh KONFIGURASI (koleksi app_config: kunci API, hash kode admin,
//     alamat database pilihan dasbor) selalu tinggal di sini.
//   • database DATA      : tempat pengguna, saldo, pesanan, dst. Defaultnya sama
//     dengan bootstrap; kalau admin mengisi "Alamat database MongoDB" di
//     dasbor (Konfigurasi), data pindah ke alamat itu.
//
// Konfigurasi sengaja TIDAK ikut pindah: kalau ikut, database baru yang kosong
// berarti hash kode admin hilang dan panel jatuh ke kode bawaan yang publik.
//
// Tidak ada I/O saat modul dimuat (hanya saat pertama dipakai) — platform
// seperti Cloudflare Workers melarang koneksi di lingkup global.
// ─────────────────────────────────────────────────────────────────────────────
const S = (globalThis.__artaDb ||= { boot: null, aktif: null, cekAt: 0, cek: null, indeksUntuk: "" });
const CEK_MS = 30_000; // seberapa sering tiap instance mengecek apakah alamat data diganti
const OPSI = { serverSelectionTimeoutMS: 10_000, maxPoolSize: 10 };
const DOK_KONFIG = "nilai";

export function uriBoot() {
  return (process.env.MONGODB_URI || "").trim();
}

function klienBoot() {
  if (!S.boot) {
    const uri = uriBoot();
    if (!uri) console.warn("[db] MONGODB_URI belum diset di environment variables.");
    const p = new MongoClient(uri || "mongodb://localhost:27017/artapedia", OPSI).connect();
    S.boot = p;
    // Gagal konek jangan dikenang selamanya: coba lagi di permintaan berikutnya.
    p.catch(() => {
      if (S.boot === p) S.boot = null;
    });
  }
  return S.boot;
}

/** Database konfigurasi (selalu bootstrap). Dipakai lib/config.js. */
export async function getConfigDb() {
  return (await klienBoot()).db();
}

// ── alamat database pilihan dasbor (tersimpan terenkripsi di app_config) ─────
/** { uri: "" | alamat, rusak: bool } — rusak = ada isinya tapi tak terbaca (MONGODB_URI env berganti). */
export async function bacaOverrideDb() {
  const d = await (await getConfigDb())
    .collection("app_config")
    .findOne({ _id: DOK_KONFIG }, { projection: { "internal.MONGODB_URI": 1 } });
  const mentah = d?.internal?.MONGODB_URI;
  if (!mentah) return { uri: "", rusak: false };
  const uri = bukaSandi(mentah);
  if (typeof uri !== "string" || !uri.trim()) return { uri: "", rusak: true };
  return { uri: uri.trim(), rusak: false };
}

export async function simpanOverrideDb(uri) {
  const col = (await getConfigDb()).collection("app_config");
  await col.updateOne(
    { _id: DOK_KONFIG },
    { $set: { "internal.MONGODB_URI": sandi(uri), updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function hapusOverrideDb() {
  const col = (await getConfigDb()).collection("app_config");
  await col.updateOne({ _id: DOK_KONFIG }, { $unset: { "internal.MONGODB_URI": "" }, $set: { updatedAt: new Date() } }, { upsert: true });
}

/** Format yang diterima: mongodb:// atau mongodb+srv:// DAN ada nama database setelah "/". */
export function validasiUriMongo(uri) {
  const v = String(uri ?? "").trim();
  if (!v) return "Alamat database kosong.";
  if (v.length > 1000) return "Terlalu panjang (maksimal 1000 karakter).";
  if (/\s/.test(v)) return "Tidak boleh berisi spasi atau baris baru.";
  if (!/^mongodb(\+srv)?:\/\//i.test(v)) return "Harus diawali mongodb:// atau mongodb+srv://";
  if (!/^mongodb(?:\+srv)?:\/\/[^/?#]+\/[^/?#]+/i.test(v)) {
    return "Tambahkan nama database setelah host, contoh: .../artapedia?retryWrites=true — tanpa itu data masuk ke database \"test\".";
  }
  return null;
}

/** Mencoba terhubung (ping) tanpa mengubah apa pun. Tidak pernah melempar. */
export async function ujiKoneksiMongo(uri) {
  const klien = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000, maxPoolSize: 1 });
  try {
    await klien.connect();
    const db = klien.db();
    await db.command({ ping: 1 });
    let pengguna = null;
    try {
      pengguna = await db.collection("users").estimatedDocumentCount();
    } catch {}
    return { ok: true, namaDb: db.databaseName, pengguna };
  } catch (err) {
    // Pesan driver tidak memuat kata sandi, tapi dipotong supaya tak membanjiri layar.
    return { ok: false, alasan: String(err?.message || err).slice(0, 220) };
  } finally {
    klien.close().catch(() => {});
  }
}

// ── database DATA ───────────────────────────────────────────────────────────
function pakaiKlien(uri) {
  const lama = S.aktif;
  let promise;
  if (!uri || uri === uriBoot()) {
    promise = klienBoot();
  } else {
    promise = new MongoClient(uri, OPSI).connect();
    promise.catch(() => {
      if (S.aktif?.promise === promise) S.aktif = null;
    });
  }
  S.aktif = { uri, promise };
  // Klien lama (bukan bootstrap) ditutup belakangan, memberi waktu permintaan yang masih jalan.
  if (lama && lama.promise !== promise && lama.promise !== S.boot) {
    lama.promise.then((c) => setTimeout(() => c.close().catch(() => {}), 15_000)).catch(() => {});
  }
  // Indeks dipasang sekali per alamat, TIDAK ditunggu: memasang indeks bisa
  // makan waktu pada koleksi besar, dan permintaan pertama tak perlu menunggunya.
  if (S.indeksUntuk !== uri) {
    S.indeksUntuk = uri;
    promise
      .then(() => import("@/lib/indexes"))
      .then((m) => m.ensureIndexes())
      .catch((err) => console.error("[db] gagal memasang indeks:", err?.message || err));
  }
}

function cekTujuan() {
  if (!S.cek) {
    S.cek = (async () => {
      try {
        const o = await bacaOverrideDb();
        const tujuan = o.uri || uriBoot();
        if (!S.aktif || S.aktif.uri !== tujuan) pakaiKlien(tujuan);
        S.cekAt = Date.now();
      } catch (err) {
        // Penunjuk alamat tak terbaca. JANGAN jatuh ke bootstrap diam-diam kalau
        // sebelumnya sudah memakai alamat lain: data bisa tertulis ke database
        // yang salah. Pertahankan yang sedang dipakai, coba lagi sebentar lagi.
        if (!S.aktif) throw err;
        S.cekAt = Date.now() - CEK_MS + 5_000;
      }
    })().finally(() => {
      S.cek = null;
    });
  }
  return S.cek;
}

/** Dipanggil setelah admin mengganti alamat: instance ini langsung pindah (instance lain ≤ 30 dtk). */
export function terapkanDbSekarang() {
  S.cekAt = 0;
  return cekTujuan();
}

/** Info untuk dasbor: alamat mana yang sedang dipakai (tanpa kata sandi). */
export function infoDbAktif() {
  return { uri: S.aktif?.uri || "", dariBoot: !S.aktif || S.aktif.uri === uriBoot() };
}

async function klienAktif() {
  if (!S.aktif) {
    await cekTujuan();
  } else if (Date.now() - S.cekAt >= CEK_MS) {
    cekTujuan().catch(() => {}); // di latar belakang: permintaan ini tak perlu menunggu
  }
  return S.aktif.promise;
}

export async function getDb() {
  return (await klienAktif()).db();
}

export async function usersCol() {
  return (await getDb()).collection("users");
}

export async function depositsCol() {
  return (await getDb()).collection("deposits");
}

export async function otpOrdersCol() {
  return (await getDb()).collection("otp_orders");
}

export async function settingsCol() {
  return (await getDb()).collection("settings");
}

export async function adminBalanceLogsCol() {
  return (await getDb()).collection("admin_balance_logs");
}

export async function vouchersCol() {
  return (await getDb()).collection("vouchers");
}

export async function broadcastsCol() {
  return (await getDb()).collection("broadcasts");
}

export async function announcementsCol() {
  return (await getDb()).collection("announcements");
}

// Buku besar semua perubahan saldo (sumber data halaman Mutasi Saldo).
export async function balanceLogsCol() {
  return (await getDb()).collection("balance_logs");
}

// Klaim garansi nokos bermasalah.
export async function warrantyClaimsCol() {
  return (await getDb()).collection("warranty_claims");
}

// Flash sale — diskon terbatas waktu dari admin.
export async function flashSalesCol() {
  return (await getDb()).collection("flash_sales");
}

// Notifikasi in-app per user.
export async function userNotificationsCol() {
  return (await getDb()).collection("user_notifications");
}

// Lucky hour — jam diskon yang diatur admin.
export async function luckyHoursCol() {
  return (await getDb()).collection("lucky_hours");
}

// Leaderboard pembeli terbanyak mingguan.
export async function weeklyBuyerLeaderboardCol() {
  return (await getDb()).collection("weekly_buyer_leaderboard");
}

// Markup kustom per platform OTP.
export async function platformMarkupCol() {
  return (await getDb()).collection("platform_markup");
}

// Favorit OTP user (kombinasi service + server yang sering dipakai).
export async function otpFavoritesCol() {
  return (await getDb()).collection("otp_favorites");
}

// Link Telegram user (chatId ↔ token).
export async function userTelegramCol() {
  return (await getDb()).collection("user_telegram");
}

// Produk digital yang dijual admin (foto, file, teks).
export async function productsCol() {
  return (await getDb()).collection("products");
}

// Riwayat pembelian produk digital per user.
export async function productOrdersCol() {
  return (await getDb()).collection("product_orders");
}

// Job / tugas dari admin — user selesaikan untuk dapat saldo gratis.
export async function jobsCol() {
  return (await getDb()).collection("jobs");
}

// Pengajuan penyelesaian job dari user (menunggu review admin).
export async function jobSubmissionsCol() {
  return (await getDb()).collection("job_submissions");
}

// Banner / iklan berbayar — tampil di homepage, halaman order, atau dashboard.
export async function bannersCol() {
  return (await getDb()).collection("banners");
}

// Tiket dukungan user (embedded messages array).
export async function ticketsCol() {
  return (await getDb()).collection("support_tickets");
}

// Pesan grup chat komunitas.
export async function chatMessagesCol() {
  return (await getDb()).collection("chat_messages");
}

// Pengaturan grup chat (nama, deskripsi, foto, status buka/tutup).
export async function chatGroupSettingsCol() {
  return (await getDb()).collection("chat_group_settings");
}

// Sesi bot Telegram toko: menghubungkan chat Telegram dengan kode akun web,
// sekaligus menyimpan langkah percakapan yang sedang berjalan.
export async function botSessionsCol() {
  return (await getDb()).collection("bot_sessions");
}

// Penarikan saldo Atlantic ke rekening/e-wallet pemilik web. Hanya admin yang
// bisa membuatnya; catatannya disimpan supaya ada riwayat di luar dasbor Atlantic.
export async function withdrawalsCol() {
  return (await getDb()).collection("withdrawals");
}

// Penarikan INSTANT via AustinPay: penarikan saldo nokos & poin game pengguna, serta penarikan admin.
// Catatan pesan WEARTA CHAT yang dihapus otomatis oleh saringan kata terlarang.
export async function waFilterLogCol() {
  return (await getDb()).collection("wa_filter_log");
}
// Catatan tiap percobaan pembuatan deposit lewat rute otomatis (penyedia terpilih, berhasil/gagal, alasan) — untuk diagnosa admin.
export async function depositRuteLogCol() {
  return (await getDb()).collection("deposit_rute_log");
}
// Pembukuan manual admin: pengeluaran (server, iklan, dll.) untuk menghitung laba bersih.
export async function pembukuanCol() {
  return (await getDb()).collection("pembukuan");
}
// Batch koreksi saldo massal (CSV) yang sudah diterapkan — kunci unik mencegah penerapan ganda.
export async function koreksiBatchCol() {
  return (await getDb()).collection("koreksi_batch");
}
// Popup buatan admin yang muncul di layar pengguna.
export async function popupAdminCol() {
  return (await getDb()).collection("popup_admin");
}
// Tampilan kustom (mis. layar akun di-ban): dokumen per kunci.
export async function tampilanKustomCol() {
  return (await getDb()).collection("tampilan_kustom");
}
// Stor Gmail: satu dokumen = satu email yang di-generate untuk pengguna (_id = email huruf kecil → tak bisa dobel).
export async function setorGmailCol() {
  return (await getDb()).collection("setor_gmail");
}
// Stor Gmail: satu dokumen = satu pengiriman daftar email ke penyedia (jobId penyedia).
export async function setorJobCol() {
  return (await getDb()).collection("setor_gmail_job");
}
// Stor Gmail: pengaturan lokal per room (untung khusus, tutup manual).
export async function setorRoomCol() {
  return (await getDb()).collection("setor_gmail_room");
}
// Satu dokumen = satu pengiriman ke penyedia (dicatat SEBELUM dikirim; lihat lib/wdInstan.js).
export async function wdInstanCol() {
  return (await getDb()).collection("wd_instan");
}

// Giveaway: event, dan tiket pesertanya.
export async function giveawayCol() {
  return (await getDb()).collection("giveaways");
}
export async function giveawayPesertaCol() {
  return (await getDb()).collection("giveaway_peserta");
}

// Komisi reseller per pesanan. Koleksi sendiri, bukan cuma $inc di dokumen
// botnya: satu $inc tidak punya cara tahu apakah ia sudah pernah dijalankan
// untuk pesanan yang sama. Lihat lib/resellerKomisi.js.
export async function resellerKomisiCol() {
  return (await getDb()).collection("reseller_komisi");
}

// Permintaan penarikan komisi reseller ke e-wallet. Diperiksa admin dulu.
export async function resellerWdCol() {
  return (await getDb()).collection("reseller_withdrawals");
}

// Penahanan saldo untuk pembelian yang bisa gagal di tengah jalan. Ditulis
// SEBELUM saldo dipotong, supaya potongan yang gagal selalu meninggalkan jejak
// walau fungsinya keburu mati. Lihat lib/saldoHold.js.
export async function saldoHoldsCol() {
  return (await getDb()).collection("saldo_holds");
}

// Program kreator (afiliasi): pengajuan dan komisi per pesanan.
export async function afiliasiPengajuanCol() {
  return (await getDb()).collection("afiliasi_pengajuan");
}
export async function afiliasiKomisiCol() {
  return (await getDb()).collection("afiliasi_komisi");
}

// Bonus target reseller yang sudah dibayar (satu per pemilik, bulan, level).
export async function resellerBonusCol() {
  return (await getDb()).collection("reseller_bonus");
}

// Permintaan "kabari saya kalau stok ada". Lihat lib/stokWatch.js.
export async function stokWatchCol() {
  return (await getDb()).collection("stok_watch");
}

// Langganan notifikasi push web (satu dokumen per perangkat) dan kunci VAPID
// yang dibuat otomatis. Lihat lib/webPush.js.
export async function pushLanggananCol() {
  return (await getDb()).collection("push_langganan");
}
export async function pushKunciCol() {
  return (await getDb()).collection("push_kunci");
}

// Bonus undang teman yang ditahan untuk ditinjau admin (dugaan farming).
// Lihat lib/referralGuard.js.
export async function referralTertahanCol() {
  return (await getDb()).collection("referral_tertahan");
}

// Bot toko tambahan yang didaftarkan admin. Bot pertama tetap dari
// SHOP_BOT_TOKEN di environment — ia tidak perlu ada di sini untuk jalan.
//
// Dokumennya memuat TOKEN BOT, dan token bot adalah kredensial penuh: siapa
// pun yang memegangnya bisa membaca seluruh percakapan pembeli dan mengirim
// pesan atas nama toko. Karena itu tokennya tidak pernah dikirim ke peramban,
// bahkan ke dasbor admin — yang dikirim hanya versi tersamarnya.
export async function botsCol() {
  return (await getDb()).collection("bots");
}

// ── QRIS Gateway ──────────────────────────────────────────────────────────────
// Dompet TERPISAH dari saldo Arta Pedia. Dipisah bukan karena kerapian: saldo
// gateway itu uang orang lain yang dititipkan lewat pembelinya, sedangkan saldo
// Arta Pedia adalah uang yang sudah dibelanjakan di toko ini. Mencampurnya
// berarti satu kesalahan hitung bisa memakai titipan orang untuk membayar nokos.

/** Satu akun gateway per kode akun: saldo, API key, dan statusnya. */
export async function gatewayAccountsCol() {
  return (await getDb()).collection("gateway_accounts");
}

/** Tagihan QRIS yang dibuat merchant. */
export async function gatewayInvoicesCol() {
  return (await getDb()).collection("gateway_invoices");
}

/** Permintaan penarikan saldo gateway ke e-wallet. */
export async function gatewayWithdrawalsCol() {
  return (await getDb()).collection("gateway_withdrawals");
}

/** Mutasi saldo gateway — sumber kebenaran untuk audit. */
export async function gatewayLedgerCol() {
  return (await getDb()).collection("gateway_ledger");
}


// ── Room Chat ala WhatsApp (lib/wa/*) ────────────────────────────────────────
// Profil dipisah dari dokumen users: foto profil dan bio tidak boleh ikut
// terbawa di setiap findOne({token}) yang dilakukan seluruh aplikasi.
export async function waProfilCol() {
  return (await getDb()).collection("wa_profil");
}
export async function waRoomCol() {
  return (await getDb()).collection("wa_room");
}
export async function waPesanCol() {
  return (await getDb()).collection("wa_pesan");
}
export async function waPrefCol() {
  return (await getDb()).collection("wa_pref");
}
export async function waStatusCol() {
  return (await getDb()).collection("wa_status");
}
export async function waCallCol() {
  return (await getDb()).collection("wa_call");
}
// Penanda bukti transfer yang sudah dipakai (hash gambar & nomor referensi). _id unik =
// pencegah ganda yang atomik: dua permintaan bersamaan tidak bisa sama-sama memasang.
export async function buktiTerpakaiCol() {
  return (await getDb()).collection("bukti_terpakai");
}
// Jejak perangkat & IP tiap akun (satu dokumen per pasangan akun+perangkat) untuk mendeteksi akun ganda.
export async function perangkatCol() {
  return (await getDb()).collection("perangkat_akun");
}
// IP yang diblokir dari seluruh situs (ikut terblokir saat akun di-ban, atau diblokir manual oleh admin).
// _id = IP; `tokens` = akun yang menyebabkannya (IP dibuka lagi bila semua akun itu dibuka blokirnya).
export async function ipBlokirCol() {
  return (await getDb()).collection("ip_blokir");
}
// Berkas media (gambar, catatan suara, foto profil, gambar status). Kunci
// _id string acak = kapabilitas: siapa yang tahu id-nya boleh mengambilnya.
export async function waMediaCol() {
  return (await getDb()).collection("wa_media");
}

// Kejadian keamanan platform (login admin gagal, pemindaian otomatis, penangguhan) — dihapus otomatis setelah 30 hari.
export async function keamananCol() {
  return (await getDb()).collection("security_events");
}

/** Paket Saldo Kaget: total, jumlah penerima, bagian yang sudah dibagi (tersembunyi), status, masa berlaku. */
export async function kagetCol() {
  return (await getDb()).collection("kaget");
}

/** Satu baris per (paket, akun) yang mengklaim. Indeks unik (kid, token) = satu klaim per akun per paket. */
export async function kagetKlaimCol() {
  return (await getDb()).collection("kaget_klaim");
}
