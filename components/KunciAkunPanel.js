"use client";

// Kartu "Keamanan akun" di Profil: kunci akun oleh pemilik. Terkunci = tidak bisa beli, tarik, transfer, main game bertaruhan;
// deposit tetap bisa. Buka kunci diajukan dulu dan baru berlaku setelah masa tunggu (lihat lib/gerbangUang.js).
import { useCallback, useEffect, useState } from "react";

function fmt(ms) {
  const d = Math.max(0, Math.ceil(ms / 1000));
  const j = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60), s = d % 60;
  return `${j ? `${j}j ` : ""}${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}d`;
}

export default function KunciAkunPanel({ token }) {
  const [st, setSt] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [kini, setKini] = useState(() => Date.now());

  const muat = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/user/kunci?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const j = await r.json();
      if (r.ok) setSt(j);
    } catch {}
  }, [token]);
  useEffect(() => { muat(); }, [muat]);
  useEffect(() => {
    if (!st?.bukaAt) return;
    const t = setInterval(() => setKini(Date.now()), 1000);
    return () => clearInterval(t);
  }, [st?.bukaAt]);
  // Masa tunggu habis → segarkan status (kunci terbuka sendiri).
  useEffect(() => { if (st?.bukaAt && st.bukaAt <= kini) muat(); }, [kini, st?.bukaAt, muat]);

  async function aksi(a) {
    setSibuk(true); setGalat("");
    try {
      const r = await fetch("/api/user/kunci", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, aksi: a }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal.");
      setSt(j);
    } catch (e) { setGalat(e.message); } finally { setSibuk(false); }
  }

  if (!st) return null;
  return (
    <div data-testid="kunci-panel">
      <p className="text-xs leading-relaxed text-muted">
        Merasa akunmu terancam? <b>Kunci akun</b>: pembelian, penarikan, transfer, dan game bertaruhan langsung berhenti. Deposit tetap bisa, saldo tetap aman.
      </p>
      {st.terkunci ? (
        <div className="mt-3 rounded-xl border-2 border-rose/40 bg-rose-soft px-3.5 py-3" data-testid="kunci-status">
          <p className="text-sm font-black text-rose">🔒 Akun DIKUNCI</p>
          {st.bukaAt ? (
            <>
              <p className="mt-1 text-xs text-ink/80">Kunci akan terbuka dalam <b data-testid="kunci-hitung" className="tabular-nums">{fmt(st.bukaAt - kini)}</b>.</p>
              <button type="button" disabled={sibuk} onClick={() => aksi("batal-buka")} className="btn-3d mt-2 w-full rounded-xl border-2 border-line bg-surface py-2 text-xs font-black text-ink disabled:opacity-60" data-testid="kunci-batal">Batalkan, tetap kunci</button>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-ink/80">Membuka kunci butuh masa tunggu <b>{st.tundaMenit ? `${st.tundaMenit} menit` : "—"}</b> supaya orang lain yang memegang kode akunmu tidak bisa membukanya seketika.</p>
              <button type="button" disabled={sibuk} onClick={() => aksi("minta-buka")} className="btn-3d mt-2 w-full rounded-xl border-2 border-line bg-surface py-2 text-xs font-black text-ink disabled:opacity-60" data-testid="kunci-minta">Ajukan buka kunci</button>
            </>
          )}
        </div>
      ) : (
        <button type="button" disabled={sibuk} onClick={() => aksi("kunci")} className="btn-3d mt-3 w-full rounded-xl border-2 border-rose bg-rose-soft py-2.5 text-sm font-black text-rose disabled:opacity-60" data-testid="kunci-kunci">🔒 Kunci akunku sekarang</button>
      )}
      {galat && <p className="mt-2 text-xs font-bold text-rose">{galat}</p>}
    </div>
  );
}
