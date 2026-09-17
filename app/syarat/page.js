const sections = [
  {
    title: "1. Tentang layanan",
    body: [
      "Artapedia menyediakan dua layanan utama: pengisian saldo (deposit) otomatis lewat QRIS, dan pembelian nomor virtual untuk menerima kode verifikasi (OTP) dari berbagai layanan pihak ketiga.",
      "Nomor OTP yang dijual berasal dari mitra penyedia layanan pihak ketiga. Artapedia bertindak sebagai perantara yang menampilkan katalog dan memproses transaksinya secara otomatis."
    ]
  },
  {
    title: "2. Kode akun",
    body: [
      "Web ini tidak menggunakan sistem login dan kata sandi. Setiap pengunjung mendapat satu kode akun unik yang menjadi satu-satunya identitas untuk saldo dan riwayat transaksi.",
      "Kamu bertanggung jawab penuh menyimpan kode akun ini. Artapedia tidak dapat memulihkan saldo dari kode akun yang hilang, terhapus, atau dibagikan ke pihak lain tanpa sepengetahuan pemiliknya."
    ]
  },
  {
    title: "3. Deposit saldo",
    body: [
      "Nominal deposit dibatasi minimal Rp2.000 dan maksimal Rp1.000.000 per transaksi.",
      "Saldo ditambahkan secara otomatis oleh sistem setelah pembayaran QRIS terverifikasi. Jika pembayaran sudah dilakukan namun saldo belum masuk dalam waktu wajar, hubungi kontak bantuan dengan menyertakan kode order dan bukti pembayaran.",
      "Saldo yang sudah masuk tidak dapat ditarik kembali dalam bentuk uang tunai maupun dipindahkan ke rekening/e-wallet. Saldo hanya dapat digunakan untuk transaksi di dalam Artapedia."
    ]
  },
  {
    title: "4. Pembelian nomor OTP",
    body: [
      "Harga setiap nomor ditampilkan di depan sebelum pembelian dikonfirmasi, dan saldo dipotong sesuai harga tersebut begitu pesanan berhasil dibuat.",
      "Kode OTP bergantung pada ketersediaan dan kecepatan jaringan mitra penyedia nomor, sehingga waktu kedatangan kode tidak dapat dijamin persis sama setiap saat.",
      "Pembatalan dan pengembalian saldo (refund) hanya berlaku selama kode OTP belum berhasil diterima pada pesanan tersebut. Jika kode OTP sudah masuk, transaksi dianggap selesai dan saldo yang terpotong tidak dapat dikembalikan.",
      "Nomor yang diberikan hanya untuk keperluan menerima kode verifikasi, bukan nomor pribadi permanen, dan dapat ditarik ulang oleh penyedia sewaktu-waktu setelah masa aktifnya berakhir."
    ]
  },
  {
    title: "5. Penggunaan yang dilarang",
    body: [
      "Kamu dilarang menggunakan saldo, nomor, atau kode OTP dari Artapedia untuk aktivitas ilegal, penipuan, spam, pengambilalihan akun orang lain tanpa izin, atau pelanggaran hukum lainnya.",
      "Artapedia berhak menolak, membatalkan, atau memblokir akses kode akun yang terindikasi digunakan untuk pelanggaran di atas, tanpa kewajiban mengembalikan saldo yang tersisa.",
      "Segala risiko hukum akibat penyalahgunaan nomor atau kode OTP sepenuhnya menjadi tanggung jawab pengguna yang bersangkutan."
    ]
  },
  {
    title: "6. Harga dan perubahan layanan",
    body: [
      "Harga nomor OTP dapat berubah sewaktu-waktu mengikuti harga dari mitra penyedia, dan harga yang berlaku adalah harga yang tampil pada saat transaksi dilakukan.",
      "Artapedia dapat menambah, mengurangi, atau menghentikan sementara layanan tertentu tanpa pemberitahuan sebelumnya apabila mitra penyedia mengalami gangguan."
    ]
  },
  {
    title: "7. Batasan tanggung jawab",
    body: [
      "Artapedia tidak bertanggung jawab atas kerugian yang timbul dari penyalahgunaan kode akun oleh pihak yang tidak berwenang, gangguan pada aplikasi/layanan pihak ketiga tempat nomor OTP digunakan, atau keadaan di luar kendali wajar seperti gangguan jaringan atau pemadaman sistem pembayaran."
    ]
  },
  {
    title: "8. Perubahan syarat dan ketentuan",
    body: [
      "Syarat dan ketentuan ini dapat diperbarui sewaktu-waktu. Perubahan berlaku sejak dipublikasikan di halaman ini, dan penggunaan layanan setelah perubahan dianggap sebagai persetujuan terhadap versi terbaru."
    ]
  }
];

export default function SyaratPage() {
  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <p className="fade-up text-sm font-semibold text-amber-bright">Legal</p>
      <h1 className="fade-up delay-1 mt-2 text-[26px] font-extrabold tracking-tight text-ink sm:text-[32px]">Syarat & Ketentuan</h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Dengan menggunakan Artapedia untuk deposit saldo atau membeli nomor OTP, kamu dianggap sudah membaca dan
        menyetujui seluruh ketentuan berikut.
      </p>

      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <div key={s.title} className="fade-up border-t border-line pt-6" style={{ animationDelay: `${0.04 * i}s` }}>
            <h2 className="font-display text-lg font-medium text-ink">{s.title}</h2>
            <div className="mt-3 space-y-2">
              {s.body.map((p, idx) => (
                <p key={idx} className="text-sm leading-relaxed text-muted">
                  {p}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
