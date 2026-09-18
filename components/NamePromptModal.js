"use client";

import { useState } from "react";
import { useUser } from "@/app/providers";

const DISMISSED_KEY = "artapedia_name_dismissed";

export default function NamePromptModal({ onClose }) {
  const { updateName } = useUser();
  const [inputName, setInputName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    const trimmed = inputName.trim();
    if (!trimmed) { setErr("Nama tidak boleh kosong."); return; }
    if (trimmed.length < 2) { setErr("Minimal 2 karakter."); return; }
    setSaving(true);
    setErr("");
    try {
      await updateName(trimmed);
      onClose?.();
    } catch (e) {
      setErr(e.message || "Gagal menyimpan nama.");
    } finally {
      setSaving(false);
    }
  }

  function handleDismiss() {
    try { localStorage.setItem(DISMISSED_KEY, Date.now()); } catch {}
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 p-4" style={{ backdropFilter: "blur(3px)" }}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="text-2xl mb-2">✍️</div>
        <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-1">Isi nama kamu yuk!</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Nama akan ditampilkan di struk transaksi dan memudahkan admin mengenali akunmu.
        </p>
        <input
          type="text"
          placeholder="Nama kamu..."
          value={inputName}
          onChange={(e) => { setInputName(e.target.value); setErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          maxLength={24}
          autoFocus
          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-400 mb-2"
        />
        {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
        <div className="flex gap-2 mt-1">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2 rounded-xl text-slate-400 hover:text-slate-600 text-sm border border-slate-200 dark:border-slate-700 transition"
          >
            Nanti saja
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition disabled:opacity-60"
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
