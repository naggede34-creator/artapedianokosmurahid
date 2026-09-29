"use client";

// Ajakan memasang situs ini sebagai aplikasi.
//
// Peramban menyimpan kejadian beforeinstallprompt dan HANYA memunculkan
// dialog pasangnya kalau dipanggil dari ketukan pengguna langsung. Karena itu
// kejadiannya ditahan dulu, lalu dipakai saat tombolnya ditekan — memanggilnya
// sendiri saat halaman dimuat akan diabaikan peramban tanpa error.
import { useEffect, useState } from "react";

const KUNCI = "artapedia_pasang_ditolak";

export default function PasangAplikasi() {
  const [kejadian, setKejadian] = useState(null);
  const [tampil, setTampil] = useState(false);

  useEffect(() => {
    let ditolak = false;
    try {
      ditolak = localStorage.getItem(KUNCI) === "1";
    } catch {}
    if (ditolak) return undefined;

    const onPrompt = (e) => {
      e.preventDefault();
      setKejadian(e);
      // Ditunda sebentar: ajakan yang muncul bersamaan dengan popup pembuka
      // akan bertumpuk, dan yang tertutup duluan bukan yang dimaksud.
      setTimeout(() => setTampil(true), 20000);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!tampil || !kejadian) return null;

  function tutup(permanen) {
    setTampil(false);
    if (permanen) {
      try {
        localStorage.setItem(KUNCI, "1");
      } catch {}
    }
  }

  async function pasang() {
    try {
      kejadian.prompt();
      await kejadian.userChoice;
    } catch {}
    // Kejadiannya hanya bisa dipakai sekali. Dibuang supaya tombolnya tidak
    // tertinggal di layar dalam keadaan tidak bisa ditekan lagi.
    setKejadian(null);
    tutup(true);
  }

  return (
    <div className="fixed inset-x-3 bottom-[max(6rem,calc(5.5rem+env(safe-area-inset-bottom)))] z-[95] mx-auto max-w-sm md:inset-x-auto md:right-6 md:bottom-6">
      <div className="balok-3d rounded-2xl border-2 border-ink/15 bg-surface p-4 shadow-lift">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-soft text-2xl">
            📲
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-ink">Pasang jadi aplikasi</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              Buka langsung dari layar utama, tanpa bilah alamat. Ukurannya kecil dan tidak
              perlu Play Store.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={pasang}
            className="btn-3d flex-1 rounded-xl bg-amber py-2.5 text-xs font-black text-white"
          >
            Pasang Sekarang
          </button>
          <button
            onClick={() => tutup(true)}
            className="btn-3d rounded-xl border border-line bg-surface2 px-4 py-2.5 text-xs font-bold text-muted"
          >
            Nanti
          </button>
        </div>
      </div>
    </div>
  );
}
