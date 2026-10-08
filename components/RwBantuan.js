"use client";

// Tombol bantuan web reseller: satu tombol melayang ke Customer Service (tanpa maskot & asisten AI web utama).
import { useCsBuka } from "@/lib/useCsBuka";
import { CS_JAM_TEKS, csBukaLagi } from "@/lib/jamCs";

export default function RwBantuan({ csUsername = "teatlas" }) {
  const buka = useCsBuka();
  const kelas = "fixed right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full text-xl shadow-lift md:right-6 bottom-[calc(6rem_+_env(safe-area-inset-bottom))] md:bottom-6";
  if (buka === false) {
    return (
      <span role="button" aria-disabled="true" title={`Customer Service buka ${CS_JAM_TEKS} · buka lagi ${csBukaLagi()}`} data-testid="rw-cs-tutup" className={`${kelas} cursor-not-allowed bg-surface2 text-muted grayscale`}>💬</span>
    );
  }
  return (
    <a href={`https://t.me/${String(csUsername).replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" aria-label="Customer Service" data-testid="rw-cs" className={`${kelas} bg-amber text-white`}>💬</a>
  );
}
