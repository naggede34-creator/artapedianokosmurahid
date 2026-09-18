"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/app/providers";

const TOUR_KEY = "artapedia_tour_done";

const STEPS = [
  {
    emoji: "👋",
    title: "Selamat Datang!",
    desc: "Halo! Sebelum mulai, yuk kenalan dulu. Isi nama kamu supaya struk transaksi kamu lebih personal.",
    action: "set-name",
  },
  {
    emoji: "💳",
    title: "Isi Saldo Dulu",
    desc: "Untuk beli nomor OTP kamu perlu saldo. Deposit via QRIS cepat — saldo masuk otomatis dalam 30 detik.",
    action: "go-deposit",
    link: "/deposit",
  },
  {
    emoji: "📱",
    title: "Beli Nomor OTP",
    desc: "Pilih layanan (WA, Telegram, dll), pilih negara, klik beli. Nomor langsung aktif dan kode OTP dikirim ke sini.",
    action: "go-otp",
    link: "/otp",
  },
  {
    emoji: "🎉",
    title: "Siap Bertransaksi!",
    desc: "Selamat! Kamu sudah siap pakai Artapedia OTP. Ada pertanyaan? Cek FAQ atau hubungi admin via Telegram.",
    action: "done",
  },
];

export default function OnboardingTour({ onDone }) {
  const { name, updateName, token } = useUser();
  const [step, setStep] = useState(0);
  const [inputName, setInputName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const current = STEPS[step];

  async function handleSetName() {
    const trimmed = inputName.trim();
    if (!trimmed) { setErr("Nama tidak boleh kosong."); return; }
    if (trimmed.length < 2) { setErr("Nama minimal 2 karakter."); return; }
    setSaving(true);
    setErr("");
    try {
      await updateName(trimmed);
      setStep((s) => s + 1);
    } catch (e) {
      setErr(e.message || "Gagal menyimpan nama.");
    } finally {
      setSaving(false);
    }
  }

  function handleSkipName() {
    setStep((s) => s + 1);
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  function finish() {
    try { localStorage.setItem(TOUR_KEY, "1"); } catch {}
    onDone?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" style={{ backdropFilter: "blur(4px)" }}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Progress dots */}
        <div className="flex gap-1.5 justify-center pt-5 pb-1">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-amber-500" : i < step ? "w-3 bg-amber-300" : "w-3 bg-slate-200 dark:bg-slate-700"}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 text-center">
          <div className="text-5xl mb-3">{current.emoji}</div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{current.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{current.desc}</p>

          {/* Name input step */}
          {current.action === "set-name" && (
            <div className="mt-4 text-left">
              <input
                type="text"
                placeholder="Contoh: Budi Santoso"
                value={inputName}
                onChange={(e) => { setInputName(e.target.value); setErr(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSetName()}
                maxLength={24}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-400"
              />
              {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
              {name && !inputName && (
                <p className="text-xs text-slate-400 mt-1">Nama saat ini: <span className="font-medium text-slate-600 dark:text-slate-300">{name}</span></p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          {current.action === "set-name" ? (
            <>
              <button
                onClick={handleSetName}
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition disabled:opacity-60"
              >
                {saving ? "Menyimpan…" : "Simpan Nama"}
              </button>
              <button
                onClick={handleSkipName}
                className="w-full py-2 rounded-xl text-slate-400 hover:text-slate-600 text-sm transition"
              >
                Lewati, isi nanti
              </button>
            </>
          ) : current.action === "done" ? (
            <button
              onClick={finish}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition"
            >
              Mulai Bertransaksi 🚀
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleNext}
                className="flex-1 py-2.5 rounded-xl text-slate-400 hover:text-slate-600 text-sm border border-slate-200 dark:border-slate-700 transition"
              >
                Lanjut
              </button>
              <a
                href={current.link}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm text-center transition"
              >
                Ke Halaman →
              </a>
            </div>
          )}
        </div>

        {/* Skip all */}
        {step < STEPS.length - 1 && (
          <div className="pb-4 text-center">
            <button onClick={finish} className="text-xs text-slate-400 hover:text-slate-500 underline">
              Lewati semua
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook: returns true if tour should be shown (new user, hasn't completed tour)
export function useShouldShowTour() {
  const { ready, joinedAt } = useUser();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!ready) return;
    try {
      const done = localStorage.getItem(TOUR_KEY);
      if (done) return;
      // Show for users created within last 7 days OR no joinedAt (very new)
      if (!joinedAt) { setShow(true); return; }
      const age = Date.now() - new Date(joinedAt).getTime();
      if (age < 7 * 24 * 60 * 60 * 1000) setShow(true);
    } catch {}
  }, [ready, joinedAt]);

  return [show, () => setShow(false)];
}
