"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kode admin salah.");
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-5">
      <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-amber/25 blur-3xl" />
      <div className="absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-teal/25 blur-3xl" />

      <div className="glow-ring w-full max-w-sm rounded-3xl">
        <form onSubmit={submit} className="glass-dark relative rounded-3xl px-7 py-9 shadow-card-3d">
          <span className="btn-3d mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber to-amber-bright text-xl shadow-3d">
            🔒
          </span>
          <h1 className="mt-4 text-center font-display text-lg font-semibold text-white">Admin Artapedia</h1>
          <p className="mt-1 text-center text-xs text-white/60">Masukkan kode akses admin untuk lanjut.</p>

          <input
            type="password"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Kode admin"
            className="mt-6 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm tracking-[0.3em] text-white outline-none transition-colors focus:border-amber"
          />

          {error && <p className="mt-3 text-center text-sm text-rose">{error}</p>}

          <button
            type="submit"
            disabled={loading || !code}
            className="btn-3d mt-5 w-full rounded-xl bg-gradient-to-r from-amber to-amber-bright px-5 py-3 text-sm font-medium text-white shadow-3d disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Memeriksa..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
