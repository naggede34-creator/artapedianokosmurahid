"use client";

import { useEffect, useState } from "react";
import { useLembarTerbuka } from "@/lib/lembarTerbuka";
import { useUser } from "@/app/providers";

const AVATARS = ["😊", "😎", "🦁", "🐯", "🦊", "🐺", "🦝", "🦄", "🐲", "👾", "🤖", "👑", "🔥", "⚡", "🌟", "💎", "🎯", "🏆", "🌈", "🎮"];

function formatJoinDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function AccountInfoModal({ open, onClose, token, balance, joinedAt }) {
  const { name, updateName } = useUser();
  const [copied, setCopied] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const [avatar, setAvatar] = useState("😊");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  // Kode akun disembunyikan sampai diminta. Lihat alasannya di bawah.
  const [lihatKode, setLihatKode] = useState(false);
  useLembarTerbuka(true);

  useEffect(() => {
    if (!token) return;
    try {
      const saved = localStorage.getItem(`avatar-${token}`);
      if (saved) setAvatar(saved);
    } catch {}
  }, [token]);

  function pickAvatar(emoji) {
    setAvatar(emoji);
    setShowAvatarPicker(false);
    try { localStorage.setItem(`avatar-${token}`, emoji); } catch {}
  }

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setNameMsg("");
      setShowAvatarPicker(false);
    } else {
      setNameInput(name || "");
    }
  }, [open, name]);

  if (!open) return null;

  function copyToken() {
    if (!token) return;
    navigator.clipboard?.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function saveName(e) {
    e.preventDefault();
    setSavingName(true);
    setNameMsg("");
    try {
      await updateName(nameInput.trim());
      setNameMsg("Nama tersimpan.");
    } catch (err) {
      setNameMsg(err.message || "Gagal menyimpan nama.");
    } finally {
      setSavingName(false);
      setTimeout(() => setNameMsg(""), 2500);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5">
      <button
        aria-label="Tutup"
        onClick={onClose}
        className="animate-fade-in absolute inset-0"
        style={{ background: "rgb(var(--c-ink) / 0.45)" }}
      />
      {/* max-h + flex-col: headernya tetap terlihat saat isinya digulir.
          Sebelumnya seluruh kartu yang bergulir, jadi tombol Tutup ikut
          menghilang ke atas begitu pemilih avatar dibuka. */}
      <div className="animate-scale-in relative flex max-h-[88dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
        <div className="flex shrink-0 items-center justify-between bg-teal-bright px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAvatarPicker((v) => !v)}
              title="Ganti avatar"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xl hover:bg-white/30 transition-colors"
            >
              {avatar}
            </button>
            <div>
              <p className="text-sm font-semibold">Info Akun</p>
              <p className="text-[10px] text-white/70">Ketuk avatar untuk ganti</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="press flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15"
            aria-label="Tutup"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Sisa isinya bergulir, dengan jatah bilah gestur di dalam wadah
            gulirnya — jatah di luar wadah gulir tidak menolong baris terakhir. */}
        <div className="gulir-aman min-h-0 flex-1">
        {showAvatarPicker && (
          <div className="border-b border-line bg-surface2 p-4">
            <p className="mb-2.5 text-xs font-semibold text-muted">Pilih Avatar</p>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {AVATARS.map((e) => (
                <button
                  key={e}
                  onClick={() => pickAvatar(e)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl transition-all hover:scale-110 hover:bg-amber-soft ${
                    avatar === e ? "bg-amber-soft ring-2 ring-amber/60" : "bg-surface"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 p-5">
          <form onSubmit={saveName}>
            <p className="text-xs font-medium text-muted">Nama Tampilan</p>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={24}
                placeholder="Masukkan nama kamu"
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface2 px-3 py-2.5 text-sm text-ink outline-none focus:border-amber"
              />
              <button
                type="submit"
                disabled={savingName}
                className="btn-3d w-full flex-shrink-0 rounded-xl bg-amber px-3.5 py-2.5 text-xs font-bold text-white shadow-3d hover:bg-amber-bright disabled:opacity-60 sm:w-auto"
              >
                {savingName ? "..." : "Simpan"}
              </button>
            </div>
            {nameMsg && <p className="mt-1.5 text-[11px] font-medium text-teal-bright">{nameMsg}</p>}
            <p className="mt-1.5 text-[11px] text-muted">
              Nama ini akan ditampilkan di website kamu (misalnya di sapaan Dashboard).
            </p>
          </form>

          <div>
            <p className="text-xs font-medium text-muted">Kode Akun</p>
            {/* Disembunyikan sampai diminta.
                Kode akun adalah SATU-SATUNYA kunci ke saldo seseorang — tidak
                ada kata sandi kedua di situs ini. Layar ini sering dibuka
                sambil difoto, dishare screen, atau ditunjukkan ke orang lain
                untuk menanyakan sesuatu. Yang tidak tampil tidak ikut terekam
                di sana, dan tombol Salin tetap bekerja tanpa menampilkannya. */}
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface2 px-3 py-2.5 font-mono text-sm text-ink">
                {!token ? "..." : lihatKode ? token : "AP-••••-••••-••••"}
              </code>
              <button
                onClick={() => setLihatKode((v) => !v)}
                className="press flex-shrink-0 rounded-xl border border-line px-3 py-2.5 text-xs font-bold text-ink transition-colors hover:border-amber hover:text-amber-bright"
                aria-label={lihatKode ? "Sembunyikan kode akun" : "Tampilkan kode akun"}
              >
                {lihatKode ? "🙈" : "👁"}
              </button>
            </div>
            <button
              onClick={copyToken}
              className="btn-3d mt-2 w-full rounded-xl border border-line bg-surface2 py-2.5 text-xs font-bold text-ink transition-colors hover:border-amber hover:text-amber-bright"
            >
              {copied ? "✅ Tersalin!" : "📋 Salin Kode Akun"}
            </button>
            <p className="mt-2 rounded-xl border border-rose/30 bg-rose-soft px-3 py-2 text-[11px] font-bold leading-relaxed text-rose">
              ⚠️ Ini satu-satunya kunci ke saldo dan riwayatmu. Siapa pun yang punya kode ini
              bisa membuka akunmu dan membelanjakan saldonya. Jangan dikirim ke siapa pun,
              termasuk yang mengaku admin.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-surface2 p-3.5">
              <p className="text-xs text-muted">Saldo</p>
              <p className="mt-1 font-display text-lg font-semibold text-ink">
                Rp{Number(balance || 0).toLocaleString("id-ID")}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface2 p-3.5">
              <p className="text-xs text-muted">Tanggal Bergabung</p>
              <p className="mt-1 text-sm font-semibold text-ink">{formatJoinDate(joinedAt)}</p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
