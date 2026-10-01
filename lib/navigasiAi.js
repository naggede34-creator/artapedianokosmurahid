// Peta menu situs untuk WEARTA AI: dari kalimat pengguna → tautan menu yang tepat (tanpa memanggil model AI),
// plus jawaban cadangan bila model AI sedang sibuk. Murni (tanpa database) sehingga cepat dan teruji.
export const MENU = [
  { href: "/deposit", label: "Deposit saldo", ikon: "💳", kata: ["deposit", "isi saldo", "top up", "topup", "qris", "bayar", "saldo tidak masuk", "saldo belum masuk"], jawab: "Deposit saldo lewat QRIS di menu **Deposit**: pilih nominal & metode, bayar PERSIS sesuai total, saldo masuk otomatis. Belum masuk? Tunggu beberapa menit lalu cek di Mutasi." },
  { href: "/otp", label: "Beli nomor OTP", ikon: "📱", kata: ["otp", "nomor", "nokos", "sms", "verifikasi", "beli nomor", "kode masuk", "whatsapp", "telegram"], jawab: "Beli nomor di menu **Beli Nokos**: pilih server, aplikasi, negara, lalu beli. Kode OTP muncul otomatis; kalau tak masuk, batalkan untuk refund otomatis." },
  { href: "/harga", label: "Daftar harga", ikon: "🏷️", kata: ["harga", "tarif", "berapa", "murah", "biaya"], jawab: "Lihat semua harga per negara & aplikasi di menu **Harga**." },
  { href: "/riwayat", label: "Riwayat pesanan", ikon: "🧾", kata: ["riwayat", "pesanan", "order", "history", "status pesanan"], jawab: "Semua pesananmu ada di **Riwayat**." },
  { href: "/mutasi", label: "Mutasi saldo", ikon: "📒", kata: ["mutasi", "saldo berkurang", "saldo hilang", "catatan saldo", "ledger"], jawab: "Setiap saldo masuk/keluar tercatat di **Mutasi**." },
  { href: "/transfer", label: "Transfer saldo", ikon: "🔁", kata: ["transfer", "kirim saldo", "kirim ke teman"], jawab: "Kirim saldo ke akun lain lewat menu **Transfer**." },
  { href: "/tarik", label: "Tarik saldo", ikon: "💸", kata: ["tarik", "withdraw", "wd", "cairkan", "dana", "gopay", "shopeepay", "e-wallet", "ewallet"], jawab: "Tarik saldo/poin ke e-wallet lewat menu **Tarik** (ada minimal & biaya admin)." },
  { href: "/game-deposit", label: "Isi saldo game", ikon: "🎲", kata: ["poin game", "saldo game", "isi poin", "topup game"], jawab: "Isi poin game (2 poin = Rp1.000) di menu **Isi saldo game**." },
  { href: "/chat?game=1", label: "Game & Arena Pendekar", ikon: "🥋", kata: ["game", "main", "arena", "pendekar", "duel", "catur", "uno", "remi", "mahjong", "gaple", "plinko", "tarung", "turnamen", "season", "peringkat"], jawab: "Game ada di **WEARTA CHAT → tab Game**: duel Catur, UNO, Remi, Mahjong, Gaple, plus Arena Pendekar dengan Season & Turnamen mingguan." },
  { href: "/chat", label: "WEARTA CHAT", ikon: "💬", kata: ["chat", "obrolan", "grup", "status", "panggilan", "wearta"], jawab: "Ngobrol dengan pengguna lain di **WEARTA CHAT** (chat, grup, status, panggilan)." },
  { href: "/klan", label: "Klan / tim", ikon: "🛡", kata: ["klan", "tim", "clan", "guild"], jawab: "Bentuk atau gabung tim di **Klan**: grup chat bersama, misi mingguan, dan papan peringkat." },
  { href: "/misi", label: "Misi & poin", ikon: "🎯", kata: ["misi", "tantangan", "daily", "harian"], jawab: "Selesaikan **Misi** harian & mingguan untuk poin dan saldo gratis." },
  { href: "/toko-poin", label: "Toko poin & skin maskot", ikon: "🛍️", kata: ["toko poin", "tukar poin", "skin", "kostum", "hadiah poin", "poin toko"], jawab: "Tukar poin di **Toko Poin**; skin kostum maskot ada di menu **Tampilan**." },
  { href: "/loyalitas", label: "Poin & level", ikon: "⭐", kata: ["loyalitas", "level", "badge", "cashback", "poin"], jawab: "Poin, level, dan cashback depositmu ada di **Poin & Level**." },
  { href: "/tampilan", label: "Tema & tampilan", ikon: "🎨", kata: ["tema", "tampilan", "gaya", "liquid", "glass", "neon", "clay", "retro", "dark", "mode malam", "warna", "skin maskot"], jawab: "Ganti gaya (Komik 3D, Liquid, Glass, Neon, Clay, Bersih, Retro), warna tema & skin maskot di **Tampilan**." },
  { href: "/referral", label: "Undang teman", ikon: "🎁", kata: ["referral", "undang", "ajak teman", "bonus teman"], jawab: "Ajak teman lewat **Undang Teman** untuk bonus." },
  { href: "/saldo-gratis", label: "Saldo gratis", ikon: "🪙", kata: ["gratis", "bonus", "voucher", "klaim", "check-in", "checkin"], jawab: "Klaim bonus harian & voucher di **Saldo Gratis**." },
  { href: "/reseller", label: "Bot reseller", ikon: "🤖", kata: ["reseller", "jualan", "bisnis", "bot sendiri"], jawab: "Jualan nomor dengan bot sendiri lewat **Bot Reseller**." },
  { href: "/apikey", label: "API key", ikon: "🔑", kata: ["api", "apikey", "developer", "integrasi", "gateway"], jawab: "Buat API key di **API Key**; dokumentasi di **Dokumentasi API**." },
  { href: "/profil", label: "Profil akun", ikon: "👤", kata: ["profil", "akun", "kode akun", "ganti nama", "logout", "keluar akun"], jawab: "Atur akunmu di **Profil**." },
  { href: "/leaderboard", label: "Leaderboard", ikon: "🏆", kata: ["leaderboard", "pembeli terbanyak", "juara"], jawab: "Lihat juara di **Leaderboard**." },
  { href: "/faq", label: "FAQ", ikon: "❓", kata: ["faq", "tanya jawab", "bantuan", "cara pakai", "tutorial"], jawab: "Jawaban cepat ada di **FAQ**." }
];

const norm = (t) => String(t || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s\-?]/g, " ");

/** Skor tiap menu dari kata kunci yang cocok; kembalikan paling relevan (maks n). */
export function sarankanTautan(teks, n = 3) {
  const t = ` ${norm(teks)} `;
  const hasil = [];
  for (const m of MENU) {
    let skor = 0;
    for (const k of m.kata) { if (t.includes(k.length <= 3 ? ` ${k} ` : k)) skor += k.includes(" ") ? 3 : 2; }
    if (skor > 0) hasil.push({ m, skor });
  }
  hasil.sort((a, b) => b.skor - a.skor);
  return hasil.slice(0, n).map(({ m }) => ({ href: m.href, label: m.label, ikon: m.ikon }));
}

/** Jawaban cadangan (tanpa model AI) berdasarkan menu terbaik. */
export function jawabCadangan(teks) {
  const t = ` ${norm(teks)} `;
  if (/\b(halo|hai|hi|hello|pagi|siang|sore|malam)\b/.test(t) && t.trim().split(/\s+/).length <= 3) return "Halo! 👋 Aku **WEARTA AI**. Mau deposit, beli nomor OTP, main game, atau atur tampilan? Tanya saja!";
  const s = sarankanTautan(teks, 1)[0];
  const m = s && MENU.find((x) => x.href === s.href);
  return m ? `${m.jawab} 😊` : "Aku belum yakin soal itu 😅 Coba pilih menu di bawah, atau hubungi Customer Service lewat tombol bantuan.";
}

/** Ringkasan menu untuk disisipkan ke prompt model. */
export const RINGKAS_MENU = MENU.map((m) => `- ${m.label}: ${m.href}`).join("\n");

/** Saran pertanyaan cepat menurut halaman yang sedang dibuka. */
export function saranHalaman(path = "") {
  const p = String(path || "");
  if (p.startsWith("/deposit")) return ["Saldo belum masuk, gimana?", "Metode deposit apa saja?", "Ada cashback deposit?"];
  if (p.startsWith("/otp")) return ["OTP tidak masuk, bagaimana?", "Cara beli nomor WhatsApp", "Apa itu server Fast?"];
  if (p.startsWith("/tarik")) return ["Berapa biaya tarik saldo?", "Berapa lama proses tarik?", "Kenapa tarik ditolak?"];
  if (p.startsWith("/chat")) return ["Cara main Arena Pendekar", "Apa itu Season & Turnamen?", "Cara pasang status"];
  if (p.startsWith("/klan")) return ["Cara bikin klan", "Hadiah misi klan apa?", "Cara gabung klan"];
  if (p.startsWith("/tampilan")) return ["Ada gaya apa saja?", "Cara beli skin maskot", "Gaya mana yang paling ringan?"];
  return ["Cara deposit saldo", "Cara beli nomor OTP", "Ganti tema & skin maskot", "Main game dapat apa?"];
}
