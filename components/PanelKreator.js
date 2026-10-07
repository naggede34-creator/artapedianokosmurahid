"use client";

// Program kreator di halaman Referral: ajukan, lihat status, dan (kalau sudah
// disetujui) lihat komisi dari pembelian teman yang diundang.
import { useCallback, useEffect, useState } from "react";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

export default function PanelKreator({ token }) {
  const [s, setS] = useState(null);
  const [channel, setChannel] = useState("");
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const muat = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/afiliasi?token=${encodeURIComponent(token)}`);
      if (r.ok) setS(await r.json());
    } catch {}
  }, [token]);
  useEffect(() => { muat(); }, [muat]);

  async function ajukan(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/afiliasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, channel, catatan })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal mengajukan.");
      await muat();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  if (!s || s.status === "mati") return null;

  return (
    <div className="mt-6 rounded-2xl border-2 border-ink/10 bg-surface p-5 shadow-soft">
      <p className="text-xs font-black uppercase tracking-wide text-muted">🎬 Program kreator</p>

      {s.status === "aktif" ? (
        <>
          <p className="mt-1 text-lg font-black text-ink">Kamu kreator aktif · komisi {s.persen}% dari untung toko</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Tiap nomor yang berhasil dibeli teman yang mendaftar lewat link undanganmu, kamu dapat {s.persen}% dari untung toko atas pesanan itu —
            selamanya, masuk otomatis ke saldo.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[["Komisi total", rp(s.komisiTotal)], ["Pesanan", s.jumlahPesanan], ["Teman", s.temanTerundang]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-surface2/60 p-2.5">
                <p className="text-sm font-black text-ink">{v}</p>
                <p className="text-[10px] text-muted">{l}</p>
              </div>
            ))}
          </div>
        </>
      ) : s.status === "menunggu" ? (
        <p className="mt-2 text-sm text-muted">⏳ Pengajuanmu sedang ditinjau admin. Kamu akan tahu begitu diputuskan.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Punya channel, grup, atau audiens? Jadi kreator dan dapat <b className="text-ink">{s.persenBawaan}%</b> dari untung toko atas tiap pembelian
            teman yang kamu ajak — bukan cuma sekali di deposit pertama, tapi selamanya.
            {s.status === "ditolak" && <> Pengajuan sebelumnya ditolak{s.alasanTolak ? `: ${s.alasanTolak}` : ""}. Kamu boleh mengajukan lagi.</>}
            {s.status === "dicabut" && <> Status kreatormu dicabut admin. Kamu boleh mengajukan lagi.</>}
          </p>
          <form onSubmit={ajukan} className="mt-3 space-y-2">
            <input
              className="field"
              placeholder="Link channel / akun media sosial"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              maxLength={200}
            />
            <textarea
              className="field"
              placeholder="Ceritakan singkat audiensmu (opsional)"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={2}
              maxLength={500}
            />
            {err && <p className="text-xs font-bold text-rose">{err}</p>}
            <button disabled={busy} className="btn-3d rounded-xl bg-amber px-5 py-2.5 text-sm font-black text-ink disabled:opacity-60">
              {busy ? "Mengirim…" : "Ajukan jadi kreator"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
