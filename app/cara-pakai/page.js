const steps = [
  {
    title: "Simpan kode akun kamu",
    desc:
      "Begitu membuka web ini pertama kali, sistem otomatis membuatkan kode akun unik (format AP-XXXX-XXXX-XXXX). Kode ini tampil di kartu saldo pada halaman Beranda (ketuk untuk menyalin). Kode ini adalah satu-satunya cara mengakses saldo dan riwayat kamu, jadi salin dan simpan di tempat aman — misalnya catatan HP atau chat pribadi ke diri sendiri."
  },
  {
    title: "Deposit saldo lewat QRIS",
    desc:
      "Buka halaman Deposit, masukkan nominal, pilih QRIS yang mau dipakai (Simuru, Pakasir, atau RumahOTP — tergantung yang aktif), lalu scan kode QRIS yang muncul pakai e-wallet atau m-banking apa saja. Bayar persis sesuai total yang tertera. Saldo bertambah otomatis begitu pembayaran terkonfirmasi, biasanya dalam hitungan detik."
  },
  {
    title: "Cari layanan yang kamu butuhkan",
    desc:
      "Buka halaman Beli OTP, ketik nama layanan di kotak pencarian (contoh: WhatsApp, Telegram, Google, Facebook). Semua layanan yang tersedia di katalog akan muncul, tidak dibatasi satu jenis saja."
  },
  {
    title: "Pilih negara dan operator",
    desc:
      "Setelah memilih layanan, pilih negara dan harga yang tersedia — harga dan jumlah stok ditampilkan langsung di setiap pilihan. Kalau layanan meminta operator tertentu, pilih salah satu dari daftar yang muncul."
  },
  {
    title: "Konfirmasi dan terima nomor",
    desc:
      "Cek ringkasan pesanan (layanan, negara, operator, harga), lalu tekan Beli Nomor Sekarang. Saldo terpotong sesuai harga yang tertera dan nomor langsung ditampilkan di layar."
  },
  {
    title: "Tunggu kode OTP masuk",
    desc:
      "Gunakan nomor yang diberikan untuk verifikasi di aplikasi/layanan tujuan. Kode OTP yang masuk akan otomatis muncul di halaman ini — tidak perlu refresh manual. Kalau nomor bermasalah dan kode tidak kunjung masuk, kamu bisa menekan tombol Batalkan & Refund selama pesanan belum berhasil menerima kode."
  },
  {
    title: "Suntik sosmed (opsional)",
    desc:
      "Buka halaman Suntik, pilih platform (Instagram, TikTok, YouTube, dll), kategori (followers, likes, views…), lalu layanan yang cocok. Isi link atau username target — pastikan akun/postingan dalam mode publik — dan jumlahnya. Progres tampil di halaman Riwayat. Kalau pesanan dibatalkan atau hanya masuk sebagian, sisa saldo dikembalikan otomatis."
  },
  {
    title: "Cek riwayat kapan saja",
    desc:
      "Semua deposit, pembelian nomor, dan pesanan suntik tercatat di halaman Riwayat; setiap perubahan saldo tercatat di Mutasi Saldo, bisa dibuka lagi kapan saja selama kamu masih menyimpan kode akun yang sama."
  }
];

export default function CaraPakaiPage() {
  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <p className="fade-up text-sm font-semibold text-teal-bright">Panduan</p>
      <h1 className="fade-up delay-1 mt-2 text-[26px] font-extrabold tracking-tight text-ink sm:text-[32px]">Cara menggunakan Artapedia</h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Langkah-langkah ini mencakup seluruh alur, dari menyimpan kode akun sampai menerima kode OTP dan memesan suntik sosmed.
      </p>

      <ol className="mt-10 space-y-8">
        {steps.map((s, i) => (
          <li key={s.title} className="hover-lift fade-up flex gap-5 rounded-2xl p-2" style={{ animationDelay: `${0.06 * i}s` }}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-teal/40 bg-teal-soft font-display text-sm text-teal-bright">
              {i + 1}
            </span>
            <div>
              <h2 className="font-display text-lg font-medium text-ink">{s.title}</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="fade-up relative mt-12 overflow-hidden rounded-2xl border border-amber/25 bg-amber-soft p-6">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber/15 blur-2xl" />
        <h3 className="relative font-display text-base font-medium text-ink">Kehilangan kode akun?</h3>
        <p className="relative mt-2 text-sm leading-relaxed text-muted">
          Karena web ini tidak memakai sistem login, saldo dan riwayat hanya bisa diakses lewat kode akun yang tersimpan
          di perangkat kamu. Kalau kode hilang dan tidak dicatat di tempat lain, saldo di kode tersebut tidak bisa
          dipulihkan. Selalu salin kode akun ke tempat yang aman sesaat setelah pertama kali membuka web ini.
        </p>
      </div>
    </div>
  );
}
