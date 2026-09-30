"use client";

// Popup "Yang baru": ringkasan semua pembaruan terbaru. Muncul sekali per versi
// (setelah popup pembuka selesai), bisa ditutup dengan tombol X, tombol
// "Mengerti", tombol Esc, atau ketukan di luar kartu. Bisa dibuka lagi dari
// menu samping ("✨ Yang baru").
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { onOpenersFree } from "@/lib/introGate";

// Naikkan versi ini saat ada pembaruan baru supaya popup muncul lagi.
export const VERSI_PEMBARUAN = "2026-09-30";
const KUNCI = "artapedia_pembaruan_dilihat";

const DAFTAR = [
  {
    ikon: "🎮", judul: "Duel Game — UNO, Remi, Mahjong & Catur", baru: true,
    isi: "Main lawan sesama pengguna, lengkap dengan taruhan saldo (potongan admin tampil jelas). Ada notifikasi saat ditantang, duel dimulai, giliranmu, dan hasil menang/kalah. Buka lewat WEARTA CHAT → tab Game.",
    href: "/chat?game=1", tombol: "Main sekarang"
  },
  {
    ikon: "💬", judul: "WEARTA CHAT — chat ala WhatsApp", baru: true,
    isi: "Chat pribadi & grup, kirim foto, pesan suara, stiker, jajak pendapat; balas, reaksi, teruskan, ubah & hapus pesan; centang dibaca, online/terakhir dilihat, dan indikator mengetik. Pesan sementara, arsip, bisukan, dan blokir juga ada."
  },
  {
    ikon: "📞", judul: "Panggilan suara & video + Status (SW)", baru: true,
    isi: "Telepon teman langsung dari web. Buat status teks/foto yang hilang setelah 24 jam, dan lihat siapa saja yang menontonnya."
  },
  {
    ikon: "🎖", judul: "Lencana verifikasi berwarna",
    isi: "Admin bisa memberi lencana verifikasi dengan pilihan warna: biru, hitam, oranye, pink, hijau, dan lainnya."
  },
  {
    ikon: "🔗", judul: "Bagikan kontak lewat tautan",
    isi: "Kontak dibagikan sebagai tautan yang langsung membuka chat — tanpa membagikan kode akun. Sebelum mengobrol, kamu wajib mengatur nama dulu."
  },
  {
    ikon: "👤", judul: "Profil Akun & tombol Keluar",
    isi: "Halaman profil lengkap: avatar, level, statistik, kode akun (sembunyi/salin/unduh), tema, notifikasi, dan Keluar dari akun dengan aman.",
    href: "/profil", tombol: "Buka profil"
  },
  {
    ikon: "🔐", judul: "Daftar & masuk dengan kode akun",
    isi: "Daftar cukup dengan nama — kamu mendapat kode akun untuk masuk lagi kapan saja, juga di bot Telegram."
  },
  {
    ikon: "🤖", judul: "Bot Telegram lebih rapi & lengkap",
    isi: "Tampilan Rich Message, tombol berwarna dan tertata rapi, notifikasi lebih detail, plus paket reseller dan program kreator."
  }
];

export default function PembaruanModal({ langsung = false }) {
  const [buka, setBuka] = useState(false);

  useEffect(() => {
    let batal = false;
    let sudah = false;
    try { sudah = localStorage.getItem(KUNCI) === VERSI_PEMBARUAN; } catch {}
    // Menunggu popup pembuka lain (mis. Tutorial & Informasi) ditutup dulu supaya tidak bertumpuk; paling lama 25 detik.
    const tampil = () => {
      const mulai = Date.now();
      const cek = () => {
        if (batal) return;
        const adaLain = document.querySelector("div.fixed.inset-0.z-\\[90\\]");
        if (adaLain && Date.now() - mulai < 25_000) setTimeout(cek, 600);
        else setBuka(true);
      };
      cek();
    };
    // Halaman tanpa popup pembuka (WEARTA CHAT layar penuh) tidak punya antrean yang ditunggu.
    const off = sudah ? () => {} : langsung ? (() => { const id = setTimeout(tampil, 1200); return () => clearTimeout(id); })() : onOpenersFree(() => setTimeout(tampil, 700));
    const manual = () => setBuka(true);
    window.addEventListener("buka-pembaruan", manual);
    return () => { batal = true; off?.(); window.removeEventListener("buka-pembaruan", manual); };
  }, []);

  const tutup = useCallback(() => {
    setBuka(false);
    try { localStorage.setItem(KUNCI, VERSI_PEMBARUAN); } catch {}
  }, []);

  useEffect(() => {
    if (!buka) return undefined;
    const k = (e) => { if (e.key === "Escape") tutup(); };
    window.addEventListener("keydown", k);
    const lama = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = lama; };
  }, [buka, tutup]);

  if (!buka) return null;
  return (
    <div className={`fixed inset-0 ${langsung ? "z-[10000]" : "z-[95]"} flex items-end justify-center px-3 pb-3 sm:items-center sm:pb-0`} role="dialog" aria-modal="true" aria-labelledby="pembaruan-judul">
      <button aria-label="Tutup pembaruan" className="animate-fade-in absolute inset-0" style={{ background: "rgb(var(--c-ink) / 0.55)" }} onClick={tutup} />
      <div className="animate-scale-in relative flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border-2 border-ink/15 bg-surface shadow-lift">
        <div className="relative shrink-0 bg-ink px-5 pb-4 pt-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-amber/30 blur-3xl" />
          <button onClick={tutup} className="press absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Tutup">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-bright">Pembaruan · {VERSI_PEMBARUAN}</p>
          <h2 id="pembaruan-judul" className="mt-1 font-display text-2xl">✨ Yang Baru di Artapedia</h2>
          <p className="mt-1 text-xs text-white/75">Banyak fitur baru sudah aktif. Ini ringkasannya.</p>
        </div>

        <ul className="gulir-aman min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
          {DAFTAR.map((d) => (
            <li key={d.judul} className="rounded-2xl border border-line bg-surface2/50 p-3.5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-soft text-xl" aria-hidden="true">{d.ikon}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-ink">
                    {d.judul}
                    {d.baru && <span className="rounded-full bg-rose px-2 py-0.5 text-[10px] font-black text-white">BARU</span>}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{d.isi}</p>
                  {d.href && (
                    <Link href={d.href} onClick={tutup} className="btn-3d mt-2 inline-block rounded-lg border border-amber/60 bg-amber-soft px-3 py-1.5 text-xs font-black text-amber-bright">
                      {d.tombol} →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="shrink-0 border-t border-line bg-surface p-3">
          <button onClick={tutup} className="btn-3d w-full rounded-xl border-2 border-blue bg-blue-bright py-3 text-sm font-black text-white">Mengerti, tutup</button>
        </div>
      </div>
    </div>
  );
}
