"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { onIntroDone } from "@/lib/introGate";

// Maskot kecil yang berjalan di layar menuju menu Beli Nokos atau Isi Saldo,
// lalu mengajak dengan satu kalimat.
//
// Tiga aturan yang membuatnya mengajak, bukan mengganggu:
//
//   1. Dia menunggu orangnya DIAM dulu. Muncul di tengah orang sedang mengetik
//      nominal atau membaca daftar layanan bukan ajakan — itu menghalangi.
//   2. Sekali per sesi peramban. Maskot yang muncul lagi tiap pindah halaman
//      berubah jadi gangguan, dan orang belajar menutupnya tanpa membaca.
//   3. Tidak muncul di halaman yang memang sedang dituju. Mengajak deposit
//      kepada orang yang sudah berdiri di halaman deposit membuat kita
//      terlihat tidak tahu dia sedang di mana.
//
// Dia juga tidak pernah menutupi bilah menu bawah — posisinya dihitung dari
// tombol yang dituju, dan diangkat di atas bilah itu.

const KEY = "artapedia_nudge_seen";
const DIAM_MS = 12000; // berapa lama orangnya harus diam dulu
const TAMPIL_MS = 11000; // berapa lama dia bertahan sebelum pergi sendiri

const AJAKAN = [
  { href: "/otp", cocok: ["Nokos", "Beli"], teks: "Mau nomor OTP? Aku antar ke sini~", tombol: "Beli Nokos" },
  { href: "/deposit", cocok: ["Deposit", "Isi"], teks: "Isi saldo dulu yuk, biar nggak kehabisan!", tombol: "Isi Saldo" }
];

export default function MascotNudge() {
  const pathname = usePathname();
  const [ajakan, setAjakan] = useState(null);
  const [posisi, setPosisi] = useState(null);
  const [keluar, setKeluar] = useState(false);
  const timerRef = useRef(null);
  const sudahRef = useRef(false);

  const tutup = useCallback(() => {
    clearTimeout(timerRef.current);
    setKeluar(true);
    setTimeout(() => setAjakan(null), 420);
  }, []);

  useEffect(() => {
    if (sudahRef.current) return undefined;

    // Halaman yang sedang dibuka tidak perlu diajak ke dirinya sendiri.
    const pilihan = AJAKAN.filter((a) => a.href !== pathname);
    if (!pilihan.length) return undefined;

    let sudahTampil = false;
    try {
      sudahTampil = sessionStorage.getItem(KEY) === "1";
    } catch {
      // sessionStorage diblokir (mode privat) — anggap belum pernah tampil.
    }
    if (sudahTampil) return undefined;

    let diamTimer = null;
    let batal = false;

    const mulaiHitung = () => {
      clearTimeout(diamTimer);
      diamTimer = setTimeout(tampilkan, DIAM_MS);
    };

    function tampilkan() {
      if (batal || sudahRef.current) return;
      if (document.hidden) return; // tab di latar belakang: tidak ada yang melihat

      // Yang dituju: tautan di BILAH MENU yang menempel di layar, bukan tombol
      // mana pun yang kebetulan ada di tengah halaman. Menempel ke tombol di
      // tengah halaman membuat maskotnya menutupi isi yang sedang dibaca, dan
      // ajakannya jadi penghalang. Kalau bilah menunya tidak ada di layar ini,
      // barulah tautan biasa dipakai.
      const semuaLink = [...document.querySelectorAll("a[href]")];
      const diBilahMenempel = (el) => {
        let n = el.parentElement;
        while (n && n !== document.body) {
          const pos = getComputedStyle(n).position;
          if (pos === "fixed" || pos === "sticky") return true;
          n = n.parentElement;
        }
        return false;
      };
      const terlihat = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
      };

      for (const a of pilihan) {
        const cocok = semuaLink.filter((el) => el.getAttribute("href") === a.href && terlihat(el));
        if (!cocok.length) continue;
        // Bilah menu dulu; kalau tidak ada, yang paling bawah di layar.
        const target =
          cocok.find(diBilahMenempel) ||
          cocok.sort((x, y) => y.getBoundingClientRect().top - x.getBoundingClientRect().top)[0];
        if (!target) continue;

        const r = target.getBoundingClientRect();
        sudahRef.current = true;
        try {
          sessionStorage.setItem(KEY, "1");
        } catch {}

        setPosisi({
          // Ditahan di dalam layar: di tepi kiri/kanan, balon katanya akan
          // terpotong kalau maskotnya tepat di atas tombol paling pinggir.
          x: Math.min(Math.max(r.left + r.width / 2, 86), window.innerWidth - 86),
          // Di ATAS tombolnya, bukan menimpanya. Maskot yang menutupi tombol
          // yang sedang dia tawarkan adalah lelucon yang tidak lucu.
          bawah: Math.max(window.innerHeight - r.top + 12, 84)
        });
        setAjakan(a);
        timerRef.current = setTimeout(tutup, TAMPIL_MS);
        return;
      }
    }

    const aktivitas = ["pointerdown", "keydown", "scroll", "touchstart"];
    aktivitas.forEach((e) => window.addEventListener(e, mulaiHitung, { passive: true }));
    mulaiHitung();

    return () => {
      batal = true;
      clearTimeout(diamTimer);
      aktivitas.forEach((e) => window.removeEventListener(e, mulaiHitung));
    };
  }, [pathname, tutup]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Jangan tampil menimpa animasi pembuka / komik.
  const [layarBebas, setLayarBebas] = useState(false);
  useEffect(() => onIntroDone(() => setLayarBebas(true)), []);

  if (!ajakan || !posisi || !layarBebas) return null;

  return (
    <div
      className={`nudge ${keluar ? "is-out" : ""}`}
      style={{ left: `${posisi.x}px`, bottom: `${posisi.bawah}px` }}
      role="dialog"
      aria-label="Ajakan dari maskot Arta Pedia"
    >
      <button type="button" className="nudge-tutup" onClick={tutup} aria-label="Tutup ajakan">
        ✕
      </button>

      <div className="nudge-balon">
        <p>{ajakan.teks}</p>
        <a href={ajakan.href} className="nudge-aksi" onClick={tutup}>
          {ajakan.tombol} →
        </a>
        <span className="nudge-ekor" />
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/maskot-sm.webp" alt="" width={528} height={750} className="nudge-maskot" />
    </div>
  );
}
