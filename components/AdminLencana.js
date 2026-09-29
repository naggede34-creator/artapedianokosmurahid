"use client";

// Tab Lencana di dasbor admin: memberi/mencabut lencana verifikasi WEARTA CHAT
// dan memilih warnanya. Hanya admin yang bisa — server memeriksa sesi admin.
import { useCallback, useEffect, useRef, useState } from "react";
import { Lencana } from "@/components/wa/kit";

export default function AdminLencana() {
  const [warna, setWarna] = useState([]);
  const [pemegang, setPemegang] = useState(null);
  const [hasil, setHasil] = useState([]);
  const [q, setQ] = useState("");
  const [pilih, setPilih] = useState("biru");
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState("");
  const seq = useRef(0);

  const muat = useCallback(async (kata = "") => {
    const n = ++seq.current;
    try {
      const r = await fetch(`/api/admin/lencana${kata ? `?q=${encodeURIComponent(kata)}` : ""}`, { cache: "no-store" });
      const d = await r.json();
      if (n !== seq.current) return;
      if (!r.ok) throw new Error(d.error || "Gagal memuat.");
      setWarna(d.warna || []);
      setPemegang(d.pemegang || []);
      setHasil(d.hasil || []);
      setGalat("");
    } catch (e) {
      setGalat(e.message);
      setPemegang((x) => x || []);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => {
    const t = setTimeout(() => muat(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q, muat]);

  async function atur(pid, w) {
    setSibuk(pid);
    setGalat("");
    setInfo("");
    try {
      const r = await fetch("/api/admin/lencana", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pid, warna: w }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal menyimpan.");
      setInfo(w ? `Lencana ${warna.find((x) => x.kunci === w)?.label?.toLowerCase() || w} diberikan ke ${d.pengguna.nama}.` : `Lencana ${d.pengguna.nama} dicabut.`);
      await muat(q.trim());
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk("");
    }
  }

  const Baris = ({ p }) => (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
          {p.nama} {p.lencana ? <Lencana warna={p.lencana} size={16} /> : null}
        </p>
        <p className="truncate font-mono text-[11px] text-muted">{p.pid} · kode {p.kode}</p>
      </div>
      <button
        type="button"
        disabled={sibuk === p.pid}
        onClick={() => atur(p.pid, pilih)}
        className="rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-bg press disabled:opacity-50"
      >
        {p.lencana ? "Ganti ke " : "Beri "}
        {warna.find((x) => x.kunci === pilih)?.label || pilih}
      </button>
      {p.lencana ? (
        <button type="button" disabled={sibuk === p.pid} onClick={() => atur(p.pid, null)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-rose press disabled:opacity-50">
          Cabut
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="mt-5 space-y-4">
      <div className="card p-4">
        <h3 className="text-base font-extrabold text-ink">🎖 Lencana verifikasi WEARTA CHAT</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Hanya admin yang bisa memberi lencana. Pilih warna, lalu cari pengguna dan tekan “Beri”. Lencana tampil di samping nama
          pengguna di daftar chat, grup, status, dan profil.
        </p>

        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Warna lencana">
          {warna.map((w) => (
            <button
              key={w.kunci}
              type="button"
              role="radio"
              aria-checked={pilih === w.kunci}
              onClick={() => setPilih(w.kunci)}
              className={`flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-1.5 text-xs font-bold text-ink press ${pilih === w.kunci ? "border-ink bg-surface2" : "border-line"}`}
            >
              <Lencana warna={w.kunci} size={20} /> {w.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-xs font-bold text-muted" htmlFor="cari-lencana">Cari pengguna (nama, ID publik, atau kode akun)</label>
          <input
            id="cari-lencana"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ketik minimal 1 huruf…"
            className="mt-1 w-full rounded-xl border-2 border-line bg-surface px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-blue"
          />
        </div>

        {galat && <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-xs font-bold text-rose">{galat}</p>}
        {info && <p className="mt-3 rounded-lg bg-teal-soft px-3 py-2 text-xs font-bold text-teal-bright">{info}</p>}

        {q.trim() && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-bold text-muted">Hasil pencarian</p>
            {!hasil.length ? <p className="text-sm text-muted">Tidak ada pengguna yang cocok. Pengguna baru muncul setelah membuka WEARTA CHAT sekali.</p> : hasil.map((p) => <Baris key={p.pid} p={p} />)}
          </div>
        )}
      </div>

      <div className="card p-4">
        <h3 className="text-base font-extrabold text-ink">Pemegang lencana ({pemegang ? pemegang.length : "…"})</h3>
        <div className="mt-3 space-y-2">
          {pemegang === null && <p className="text-sm text-muted">Memuat…</p>}
          {pemegang && !pemegang.length && <p className="text-sm text-muted">Belum ada yang diberi lencana.</p>}
          {(pemegang || []).map((p) => <Baris key={p.pid} p={p} />)}
        </div>
      </div>
    </div>
  );
}
