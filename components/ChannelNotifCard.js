"use client";

import { CHANNEL_URL, BOT_URL, WEBAPP_URL } from "@/lib/links";

// Kartu ajakan gabung channel notifikasi pembelian.
//
// Ditaruh tepat di bawah "Pembelian terbaru": di situ orang baru saja melihat
// transaksi berjalan satu per satu, dan pertanyaan yang muncul persis saat itu
// adalah "bisa lihat semuanya di mana?". Kartunya menjawab sebelum ditanya.
//
// Tiga tombolnya sengaja tidak sama besar. Yang paling sering diklik orang baru
// adalah gabung channelnya — itu yang dibuat lebar dan penuh warna; dua tombol
// order di bawahnya untuk yang memang sudah siap beli.
export default function ChannelNotifCard({ className = "" }) {
  return (
    <section className={className}>
      <div className="card card-tilt relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-10 text-[110px] leading-none opacity-[0.07] select-none">
          📢
        </div>

        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="pulse-live absolute inset-0 inline-flex rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success beat" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-success">Live</span>
          </div>

          <h2 className="font-display mt-2 text-xl font-black leading-tight text-ink sm:text-2xl">
            Notifikasi Pembelian
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
            Tiap nokos terjual, tiap kode OTP masuk, tiap deposit berhasil — semuanya diumumkan
            otomatis di channel Telegram kami. Termasuk refund yang cair sendiri, jadi kamu bisa
            lihat sendiri bagaimana tokonya jalan sebelum ikut beli.
          </p>

          <ul className="mt-4 grid gap-1.5 text-[13px] text-ink sm:grid-cols-2">
            <li>📱 Nokos terjual &amp; kode OTP masuk</li>
            <li>💰 Deposit masuk &amp; berhasil</li>
            <li>↩️ Refund otomatis</li>
            <li>📊 Info stok, harga &amp; promo</li>
          </ul>

          <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-primary press mt-5 w-full text-[15px]"
          >
            📢 Gabung Channel Notifikasi
          </a>

          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <a href={BOT_URL} target="_blank" rel="noreferrer" className="btn-ghost press text-xs">
              🤖 Order via Bot
            </a>
            <a href={WEBAPP_URL} target="_blank" rel="noreferrer" className="btn-ghost press text-xs">
              🌐 Order via Web
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
