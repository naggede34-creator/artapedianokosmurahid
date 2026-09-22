"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/app/providers";
import { PageHeader, Icon } from "@/components/ui";

const SERVERS = [
  { id: "rumahotp", name: "Server Nokos Murah", badge: "Murah", desc: "Harga paling hemat, cakupan aplikasi & negara terluas." },
  { id: "otpmania_s2", name: "Server Plus", badge: "Utama", desc: "Jalur utama OTPMANIA, stok paling melimpah." },
  { id: "otpmania_s1", name: "Server Express", badge: "Cadangan", desc: "Dipakai saat stok server utama kosong." },
  { id: "dibanana", name: "OTP Fast Murah", badge: "Fast", desc: "OTP masuk cepat, harga hemat, 5 negara." }
];

function Copy({ value, label = "Salin" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className="press shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-amber/50 hover:text-ink"
    >
      {done ? "✓ Tersalin" : label}
    </button>
  );
}

export default function ApiKeyPage() {
  const { token, ready } = useUser();
  const [info, setInfo] = useState(null);
  const [newKey, setNewKey] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/apikey?token=${token}`)
      .then((r) => r.json())
      .then((d) => setInfo(d?.error ? { hasKey: false } : d))
      .catch(() => setInfo({ hasKey: false }));
  }, [token]);

  async function generate() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/apikey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal membuat API key.");
      setNewKey(d.apiKey);
      setInfo({ hasKey: true, maskedKey: `${d.apiKey.slice(0, 4)}${"•".repeat(d.apiKey.length - 8)}${d.apiKey.slice(-4)}` });
      setConfirming(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader
        icon={<Icon.key />}
        title="API Key Developer"
        desc="Integrasikan pembelian nokos langsung ke aplikasi, bot, atau panel kamu sendiri."
      />

      <div className="fade-up mt-6 grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Kartu kunci */}
        <div className="card-3d card-shadow rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink">Kunci akses kamu</h2>
              <p className="mt-0.5 text-xs text-muted">Dipakai di header <code className="rounded bg-surface2 px-1 py-0.5 font-mono text-[11px]">X-API-Key</code>.</p>
            </div>
            <Link href="/api-docs" className="press shrink-0 rounded-lg bg-amber-soft px-3 py-1.5 text-xs font-bold text-amber-bright">
              Dokumentasi →
            </Link>
          </div>

          {!ready || info === null ? (
            <div className="skeleton mt-4 h-12 rounded-xl" />
          ) : info.hasKey ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-4 py-3">
                <span className="flex-1 truncate font-mono text-sm tracking-wider text-ink">{info.maskedKey}</span>
                <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">Aktif</span>
              </div>

              {newKey && (
                <div className="rounded-xl border border-teal/40 bg-teal-soft p-3.5">
                  <p className="text-xs font-bold text-teal-bright">⚠️ Simpan sekarang — kunci ini tidak akan ditampilkan lagi!</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 select-all break-all rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs text-ink">{newKey}</code>
                    <Copy value={newKey} />
                  </div>
                </div>
              )}

              {confirming ? (
                <div className="rounded-xl border border-amber/40 bg-amber-soft p-3.5">
                  <p className="text-xs font-semibold text-amber-bright">API key lama langsung tidak berlaku. Lanjutkan?</p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={generate} disabled={busy} className="btn-3d flex-1 rounded-lg bg-rose py-2 text-xs font-bold text-white disabled:opacity-60">
                      {busy ? "Memproses…" : "Ya, buat ulang"}
                    </button>
                    <button onClick={() => setConfirming(false)} className="flex-1 rounded-lg border border-line py-2 text-xs font-bold text-ink">
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="press w-full rounded-xl border border-line py-2.5 text-xs font-bold text-muted transition-colors hover:border-rose/40 hover:text-ink"
                >
                  🔄 Buat ulang API key
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted">Kamu belum punya API key. Buat sekarang untuk mulai integrasi.</p>
              <button onClick={generate} disabled={busy || !token} className="btn-3d press w-full rounded-xl bg-amber py-3 text-sm font-bold text-white shadow-3d disabled:opacity-60">
                {busy ? "Membuat…" : "🔑 Buat API Key"}
              </button>
            </div>
          )}

          {err && <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-xs font-medium text-rose">{err}</p>}
        </div>

        {/* Mulai cepat */}
        <div className="card-shadow rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-bold text-ink">Mulai cepat</h2>
          <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted">
            {[
              ["Pilih server", "GET /api/v1/servers"],
              ["Ambil daftar aplikasi", "GET /api/v1/services?server=…"],
              ["Ambil negara & harga", "GET /api/v1/countries?server=…&service_id=…"],
              ["Buat pesanan", "POST /api/v1/order"],
              ["Pantau OTP masuk", "GET /api/v1/orders/status?order_id=…"]
            ].map(([step, ep], i) => (
              <li key={ep} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-soft text-[10px] font-extrabold text-amber-bright">
                  {i + 1}
                </span>
                <span>
                  <span className="font-semibold text-ink">{step}</span>
                  <br />
                  <code className="font-mono text-[11px]">{ep}</code>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Server yang bisa dipakai lewat API */}
      <div className="fade-up delay-2 card-shadow mt-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">Server yang tersedia lewat API</h2>
        <p className="mt-0.5 text-xs text-muted">
          Kirim salah satu nilai <code className="rounded bg-surface2 px-1 py-0.5 font-mono text-[11px]">server</code> di bawah ini pada tiap request.
          Server yang sedang dimatikan admin akan menolak order.
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {SERVERS.map((s) => (
            <div key={s.id} className="card-3d rounded-xl border border-line bg-surface2 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink">{s.name}</span>
                <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-extrabold text-amber-bright">{s.badge}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{s.desc}</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink">{s.id}</code>
                <Copy value={s.id} label="Salin" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fade-up delay-3 mt-4 rounded-2xl border border-rose/30 bg-rose-soft p-4">
        <p className="text-xs font-bold text-rose">Jaga kerahasiaan API key</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Siapa pun yang memegang kunci ini bisa memesan nokos memakai saldo kamu. Jangan taruh di kode
          frontend, repo publik, atau screenshot. Kalau merasa bocor, langsung buat ulang di halaman ini.
        </p>
      </div>
    </div>
  );
}
