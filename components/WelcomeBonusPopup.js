"use client";

import { useEffect, useState } from "react";
import { onOpenersFree } from "@/lib/introGate";
import { useUser } from "@/app/providers";

const DISMISSED_KEY = "artapedia_welcome_dismissed";

export default function WelcomeBonusPopup() {
  const { token, ready, setBalance } = useUser();
  const [open, setOpen] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready || !token) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch { return; }
    // Tampilkan hanya untuk user baru (belum pernah dapat bonus)
    fetch("/api/bonus/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.alreadyReceived) {
          try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
          return;
        }
        if (d.ok) {
          setClaimed(true);
          setBalance?.((b) => b + d.bonus);
          // Bonusnya tetap masuk sekarang; popupnya menunggu sapaan maskot
          // ditutup supaya tidak tertimbun.
          onOpenersFree(() => setOpen(true));
        }
      })
      .catch(() => {});
  }, [ready, token, setBalance]);

  function close() {
    setOpen(false);
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-5">
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: "rgb(var(--c-ink) / 0.5)" }}
        onClick={close}
      />
      <div className="animate-scale-in relative w-full max-w-sm kotak-tengah rounded-3xl bg-surface shadow-lift">
        {/* Gradient header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber to-amber-bright px-6 py-8 text-center text-white">
          <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-4xl shadow-3d">
              🎁
            </div>
            <h2 className="mt-3 text-xl font-extrabold">Selamat Datang!</h2>
            <p className="mt-1 text-sm text-white/80">Kamu baru saja dapat hadiah dari kami</p>
          </div>
        </div>

        <div className="p-6 text-center">
          <div className="rounded-2xl border-2 border-dashed border-amber/40 bg-amber-soft py-4 px-6">
            <p className="text-xs font-semibold text-muted">Bonus Selamat Datang</p>
            <p className="mt-1 text-3xl font-extrabold text-amber-bright">+ Rp500</p>
            <p className="mt-1 text-xs text-muted">sudah masuk ke saldo kamu</p>
          </div>
          <p className="mt-4 text-sm text-muted leading-relaxed">
            Gunakan saldo ini untuk mencoba <span className="font-semibold text-ink">beli nomor OTP</span> pertamamu. Selamat berbelanja!
          </p>
          <button
            onClick={close}
            className="mt-5 w-full rounded-xl bg-amber hover:bg-amber-bright px-5 py-3 text-sm font-bold text-white shadow-3d transition-colors"
          >
            Yay, Mulai Belanja! 🚀
          </button>
          <button onClick={close} className="mt-2 text-xs text-muted hover:text-ink">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
