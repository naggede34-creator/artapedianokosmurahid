"use client";

// Formulir kode admin yang dipakai DI TEMPAT: sebagai gerbang halaman admin (tanpa melempar ke /admin/login) dan sebagai
// modal "sesi habis" di tengah pekerjaan — admin memasukkan kode lalu langsung lanjut di halaman yang sama.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function FormMasuk({ onBerhasil, judul = "Masukkan kode admin", sub = "Halaman ini tetap terbuka — setelah masuk Anda langsung lanjut di sini." }) {
  const [kode, setKode] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  async function kirim(e) {
    e.preventDefault();
    if (sibuk) return;
    setSibuk(true); setGalat("");
    try {
      const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: kode }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Kode admin salah.");
      onBerhasil?.();
    } catch (err) { setGalat(err.message); } finally { setSibuk(false); }
  }
  return (
    <form onSubmit={kirim} className="w-full max-w-sm rounded-3xl border-2 border-ink/15 bg-surface p-6 shadow-lift" data-testid="admin-form-masuk">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber text-xl text-white" aria-hidden="true">🔒</span>
      <h2 className="mt-3 text-center font-display text-xl text-ink">{judul}</h2>
      <p className="mt-1 text-center text-xs text-muted">{sub}</p>
      <input type="password" autoFocus autoComplete="current-password" value={kode} onChange={(e) => setKode(e.target.value)} placeholder="Kode admin" className="mt-4 w-full rounded-xl border-2 border-ink/20 bg-bg px-3 py-2.5 text-sm text-ink" data-testid="admin-kode" aria-label="Kode admin" />
      {galat && <p className="mt-2 rounded-lg bg-rose-soft px-3 py-2 text-xs font-bold text-rose" data-testid="admin-masuk-galat">{galat}</p>}
      <button type="submit" disabled={!kode || sibuk} className="mt-3 w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-black text-bg disabled:opacity-50" data-testid="admin-masuk-kirim">{sibuk ? "Memeriksa…" : "Masuk"}</button>
    </form>
  );
}

/** Gerbang satu halaman penuh: dipakai server layout bila belum masuk. Setelah berhasil, halaman yang SAMA dimuat ulang. */
export default function AdminGerbang() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink/95 px-5" data-testid="admin-gerbang">
      <FormMasuk onBerhasil={() => router.refresh()} judul="Masuk admin" sub="Setelah memasukkan kode, Anda langsung lanjut di halaman ini." />
    </div>
  );
}
