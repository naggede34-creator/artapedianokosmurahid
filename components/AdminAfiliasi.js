"use client";

// Tab Kreator di dasbor admin: pengajuan program kreator dan daftar kreator aktif.
import { useCallback, useEffect, useState } from "react";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

export default function AdminAfiliasi() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [persen, setPersen] = useState({});

  const muat = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/admin/afiliasi");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal memuat.");
      setD(j);
    } catch (e) {
      setErr(e.message);
    }
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function aksi(token, a, extra = {}) {
    setBusy(token + a);
    setErr("");
    try {
      const r = await fetch("/api/admin/afiliasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, aksi: a, ...extra })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal.");
      await muat();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="card p-4">
        <h3 className="text-base font-extrabold text-ink">🎬 Program kreator</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Kreator yang disetujui mendapat persen dari UNTUNG toko atas tiap nomor yang berhasil dibeli teman yang mereka undang. Persen bawaan{" "}
          <b className="text-ink">{d ? `${d.bawaan}%` : "…"}</b> (ubah di tab Konfigurasi → Reseller &amp; kreator). Kosongkan kolom persen untuk memakai bawaan.
        </p>
      </div>
      {err && <p className="rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">{err}</p>}
      {!d && !err && <p className="text-sm text-muted">Memuat…</p>}

      {d && (
        <>
          <h4 className="text-sm font-black text-ink">Pengajuan menunggu ({d.pengajuan.length})</h4>
          {d.pengajuan.length === 0 && <p className="text-sm text-muted">Tidak ada.</p>}
          {d.pengajuan.map((p) => (
            <div key={p.token} className="card p-4">
              <p className="text-sm font-bold text-ink">{p.label}</p>
              <p className="mt-1 break-all text-xs text-muted">📎 {p.channel}</p>
              {p.catatan && <p className="mt-1 text-xs text-muted">“{p.catatan}”</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  className="field w-28"
                  placeholder={`persen (${d.bawaan})`}
                  value={persen[p.token] ?? ""}
                  onChange={(e) => setPersen((x) => ({ ...x, [p.token]: e.target.value }))}
                  inputMode="decimal"
                />
                <button
                  disabled={busy === p.token + "setujui"}
                  onClick={() => aksi(p.token, "setujui", { persen: persen[p.token] || "" })}
                  className="btn-3d rounded-lg bg-success px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  ✅ Setujui
                </button>
                <button
                  disabled={busy === p.token + "tolak"}
                  onClick={() => aksi(p.token, "tolak", { alasan: window.prompt("Alasan penolakan (opsional):") || "" })}
                  className="btn-3d rounded-lg bg-rose px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  ❌ Tolak
                </button>
              </div>
            </div>
          ))}

          <h4 className="pt-2 text-sm font-black text-ink">Kreator aktif ({d.kreator.length})</h4>
          {d.kreator.length === 0 && <p className="text-sm text-muted">Belum ada.</p>}
          {d.kreator.map((k) => (
            <div key={k.token} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-bold text-ink">{k.nama || k.label} <span className="text-xs text-muted">{k.nama ? k.label : ""}</span></p>
                <p className="text-xs text-muted">
                  {k.persen ? `${k.persen}%` : `bawaan ${d.bawaan}%`} · komisi {rp(k.komisiTotal)} · {k.jumlahPesanan} pesanan · {k.temanTerundang} teman
                </p>
              </div>
              <button
                disabled={busy === k.token + "cabut"}
                onClick={() => window.confirm("Cabut status kreator? Komisi berikutnya berhenti.") && aksi(k.token, "cabut")}
                className="btn-3d rounded-lg border-2 border-rose px-3 py-1.5 text-xs font-black text-rose disabled:opacity-50"
              >
                Cabut
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
