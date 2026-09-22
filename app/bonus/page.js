"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import SpinWheelGame from "@/components/SpinWheelGame";
import MissionsPanel from "@/components/MissionsPanel";
import WeeklyChallenge from "@/components/WeeklyChallenge";

const TARGET_KEY = "artapedia_balance_target";

function rupiah(n) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

// Semua panel bonus & alat dikumpulkan di sini supaya Beranda tetap ringkas:
// check-in, roda keberuntungan, target saldo, misi, tantangan, dan API key.
export default function BonusPage() {
  const { token, balance } = useUser();

  const [checkin, setCheckin] = useState(null);
  const [checkinLoading, setCheckinLoading] = useState(true);
  const [checkinBusy, setCheckinBusy] = useState(false);

  const [balanceTarget, setBalanceTarget] = useState(0);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");

  const [achievements, setAchievements] = useState(null);

  // Hanya dipakai untuk menampilkan status di kartu pintasan; pengelolaannya
  // sudah pindah ke halaman /apikey.
  const [apiKeyInfo, setApiKeyInfo] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TARGET_KEY);
      if (saved) setBalanceTarget(Number(saved) || 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (!token) return;
    const t = encodeURIComponent(token);
    fetch(`/api/checkin?token=${t}`)
      .then((r) => r.json())
      .then((d) => setCheckin(d.error ? null : d))
      .catch(() => {})
      .finally(() => setCheckinLoading(false));
    fetch(`/api/achievements?token=${t}`)
      .then((r) => r.json())
      .then((d) => setAchievements(d.error ? null : d))
      .catch(() => {});
    fetch(`/api/apikey?token=${t}`)
      .then((r) => r.json())
      .then((d) => setApiKeyInfo(d))
      .catch(() => setApiKeyInfo({ hasKey: false }));
  }, [token]);

  async function doCheckin() {
    if (!token || checkinBusy) return;
    setCheckinBusy(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      setCheckin(await res.json());
    } catch {
    } finally {
      setCheckinBusy(false);
    }
  }

  function saveTarget() {
    const val = Number(targetInput);
    if (!val || val <= 0) return;
    setBalanceTarget(val);
    try { localStorage.setItem(TARGET_KEY, String(val)); } catch {}
    setEditingTarget(false);
  }

  return (
    <div className="mx-auto max-w-content px-4 pb-16 pt-6 sm:px-5 sm:pt-8">
      <div className="manga-panel relative overflow-hidden rounded-2xl px-5 py-5"
        style={{ background: "linear-gradient(135deg, rgb(var(--c-orange)) 0%, rgb(var(--c-orange-bright)) 55%, rgb(var(--c-blue-bright)) 100%)" }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{ backgroundImage: "repeating-linear-gradient(86deg, transparent 0 16px, #fff 16px 17px)" }} />
        <div className="relative">
          <p className="text-[11px] font-black uppercase tracking-widest text-white/75">Bonus &amp; Alat</p>
          <h1 className="mt-1 font-display text-2xl font-black tracking-tight text-white">Pusat Hadiah</h1>
          <p className="mt-1 text-xs leading-relaxed text-white/85">
            Check-in harian, roda keberuntungan, misi, target saldo, dan API key — semuanya di satu tempat.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Check-in harian */}
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">🗓️</span>
            <h2 className="text-base font-bold text-ink">Check-in Harian</h2>
          </div>
          {checkinLoading ? (
            <div className="skeleton h-16 rounded-xl" />
          ) : checkin?.alreadyDone ? (
            <div className="text-center">
              <p className="text-3xl font-extrabold text-amber-bright">🔥 {checkin.streak}</p>
              <p className="mt-1 text-xs text-muted">hari berturut-turut</p>
              <div className="mt-3 rounded-xl bg-amber-soft px-4 py-2">
                <p className="text-xs font-semibold text-amber-bright">Sudah check-in hari ini ✓</p>
                <p className="mt-0.5 text-xs text-muted">Total {checkin.points} poin terkumpul</p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-1 text-sm text-muted">
                Streak saat ini: <strong className="text-ink">{checkin?.streak || 0} hari</strong>
              </p>
              <p className="mb-3 text-xs text-muted">Check-in tiap hari = bonus poin berlipat!</p>
              <button
                onClick={doCheckin}
                disabled={checkinBusy}
                className="w-full rounded-xl bg-gradient-to-r from-amber to-amber-bright py-2.5 text-sm font-bold text-white shadow-3d disabled:opacity-50"
              >
                {checkinBusy ? "Memproses..." : "✅ Check-in Sekarang"}
              </button>
            </div>
          )}
          {checkin?.alreadyDone === false && checkin?.streak > 0 && (
            <p className="mt-2 text-center text-[11px] text-muted">Kembali besok untuk menjaga streak!</p>
          )}
        </div>

        {/* Roda keberuntungan */}
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">🎡</span>
            <h2 className="text-base font-bold text-ink">Putar Roda Keberuntungan</h2>
          </div>
          <SpinWheelGame />
        </div>

        {/* Target saldo */}
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <h2 className="text-base font-bold text-ink">Target Saldo</h2>
          </div>
          {balanceTarget > 0 ? (
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs text-muted">Saldo sekarang</span>
                <span className="text-xs font-semibold text-ink">{rupiah(balance || 0)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-surface2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal to-teal-bright transition-all"
                  style={{ width: `${Math.min(100, Math.round(((balance || 0) / balanceTarget) * 100))}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-[11px] text-muted">Rp0</span>
                <span className="text-[11px] font-semibold text-teal-bright">{rupiah(balanceTarget)}</span>
              </div>
              <p className="mt-2 text-center text-xs text-muted">
                {(balance || 0) >= balanceTarget
                  ? "🎉 Target tercapai!"
                  : `Kurang ${rupiah(balanceTarget - (balance || 0))} lagi`}
              </p>
              <button
                onClick={() => { setTargetInput(String(balanceTarget)); setEditingTarget(true); }}
                className="mt-3 w-full text-xs text-muted hover:text-ink"
              >
                Ubah target
              </button>
            </div>
          ) : editingTarget ? (
            <div>
              <p className="mb-2 text-xs text-muted">Masukkan target saldo kamu:</p>
              <input
                type="number"
                min="1000"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTarget()}
                placeholder="Contoh: 50000"
                autoFocus
                className="w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <div className="mt-2 flex gap-2">
                <button onClick={saveTarget} className="flex-1 rounded-xl bg-teal-bright py-2 text-xs font-bold text-white">Simpan</button>
                <button onClick={() => setEditingTarget(false)} className="flex-1 rounded-xl border border-line py-2 text-xs text-muted">Batal</button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-3 text-sm text-muted">Tetapkan target saldo untuk memantau progres tabunganmu.</p>
              <button
                onClick={() => { setTargetInput(""); setEditingTarget(true); }}
                className="rounded-xl border border-teal/30 bg-teal-soft px-5 py-2 text-sm font-semibold text-teal-bright hover:bg-teal/20"
              >
                + Set Target
              </button>
            </div>
          )}
        </div>
      </div>

      {achievements && achievements.items?.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-ink">🏅 Badge Kamu ({achievements.unlockedCount}/{achievements.total})</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {achievements.items.map((a) => (
              <div
                key={a.id}
                title={a.desc}
                className={`flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all w-[84px] ${
                  a.unlocked
                    ? a.tier === "diamond"
                      ? "border-teal/40 bg-teal-soft"
                      : a.tier === "gold"
                      ? "border-amber/40 bg-amber-soft"
                      : a.tier === "silver"
                      ? "border-line bg-surface2"
                      : "border-line bg-surface"
                    : "border-dashed border-line bg-surface opacity-40 grayscale"
                }`}
              >
                <span className="text-2xl">{a.icon}</span>
                <p className="text-[10px] font-bold text-ink leading-tight">{a.name}</p>
                {a.unlocked && (
                  <span className="text-[9px] rounded-full bg-teal-soft px-1.5 py-0.5 font-semibold text-teal-bright">✓ Dapat</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <MissionsPanel token={token} />
        <WeeklyChallenge token={token} />
      </div>

      {/* API key developer — panel lengkapnya ada di halaman khusus /apikey */}
      <Link
        href="/apikey"
        className="card-3d press mt-5 flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-amber/50"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-soft text-2xl">🔑</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-ink">API Key Developer</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            {apiKeyInfo?.hasKey
              ? "API key kamu aktif. Kelola, buat ulang, dan lihat contoh kode di halaman khusus."
              : "Integrasikan pembelian nokos ke aplikasi atau bot kamu sendiri."}
          </span>
        </span>
        <span className="shrink-0 rounded-lg bg-amber px-3 py-2 text-xs font-bold text-white">Buka →</span>
      </Link>
    </div>
  );
}
