"use client";

// Menjaga sesi admin tetap hidup dan membuat habisnya sesi tidak memaksa admin berpindah halaman:
//   • sesi diperpanjang diam-diam tiap beberapa menit & saat tab kembali aktif (selama dipakai, tidak pernah habis);
//   • permintaan /api/admin/* yang dijawab 401 dicoba sekali lagi setelah perpanjangan (menutup gangguan sesaat);
//   • bila memang habis, muncul jendela kode admin DI ATAS halaman yang sedang dikerjakan — tanpa redirect, tanpa kehilangan isian.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormMasuk } from "@/components/AdminGerbang";

const PERPANJANG_MS = 10 * 60_000;

/** Dipanggil kode halaman admin saat menerima 401: memunculkan jendela masuk (bukan pindah halaman). */
export function sesiHabis() {
  if (typeof window === "undefined") return undefined;
  // 401 juga dijawab untuk jalur yang TIDAK diizinkan bagi peran akun admin tambahan: bila sesinya sebenarnya masih sah,
  // jangan munculkan jendela masuk (itu bukan sesi habis) — cukup abaikan.
  fetch("/api/admin/sesi", { method: "POST", cache: "no-store" })
    .then((r) => { if (!r.ok) window.dispatchEvent(new Event("admin:sesi-habis")); return r.text().catch(() => ""); })
    .catch(() => window.dispatchEvent(new Event("admin:sesi-habis")));
  return undefined;
}

let terpasang = false;
export default function AdminSesi() {
  const router = useRouter();
  const [tampil, setTampil] = useState(false);
  const [sudah, setSudah] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const asli = typeof window !== "undefined" ? window.fetch.bind(window) : null;
    const perpanjang = async () => { try { const r = await (asli || fetch)("/api/admin/sesi", { method: "POST", cache: "no-store" }); await r.text().catch(() => ""); return r.ok; } catch { return false; } };

    if (!terpasang && asli) {
      terpasang = true;
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input?.url || "";
        const admin = /\/api\/admin\//.test(url) && !/\/api\/admin\/(login|sesi|logout)/.test(url);
        const r = await asli(input, init);
        if (admin && r.status === 401) {
          // Gangguan sesaat (mis. konfigurasi belum terbaca) atau sesi hampir habis: perpanjang lalu ulangi sekali.
          if (await perpanjang()) { try { return await asli(input, init); } catch { return r; } }
          window.dispatchEvent(new Event("admin:sesi-habis"));
        }
        return r;
      };
    }
    const bukaModal = () => setTampil(true);
    window.addEventListener("admin:sesi-habis", bukaModal);
    perpanjang();
    timer.current = setInterval(perpanjang, PERPANJANG_MS);
    const saatFokus = () => { if (document.visibilityState === "visible") perpanjang(); };
    document.addEventListener("visibilitychange", saatFokus);
    return () => { window.removeEventListener("admin:sesi-habis", bukaModal); document.removeEventListener("visibilitychange", saatFokus); clearInterval(timer.current); };
  }, []);

  if (!tampil) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-5" role="dialog" aria-modal="true" data-testid="admin-sesi-modal">
      <div>
        <FormMasuk
          judul="Sesi admin habis"
          sub="Masukkan kode admin — halaman ini tetap terbuka, tidak perlu kembali ke dasbor."
          onBerhasil={() => { setTampil(false); setSudah(true); router.refresh(); window.dispatchEvent(new Event("admin:masuk-lagi")); setTimeout(() => setSudah(false), 4000); }}
        />
      </div>
    </div>
  );
}
