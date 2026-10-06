"use client";

// Dasbor "Laporan & Ekspor" (admin): ekspor CSV, koreksi saldo massal dari CSV (pratinjau → terapkan), dan pembukuan pengeluaran + laba.
import { useCallback, useEffect, useState } from "react";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const TAB = [{ id: "ekspor", l: "📤 Ekspor CSV" }, { id: "koreksi", l: "🧮 Koreksi saldo massal" }, { id: "buku", l: "📒 Pembukuan & laba" }];

async function api(path, body) {
  const r = await fetch(path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Gagal (${r.status})`);
  return j;
}
const Kartu = ({ judul, children }) => (
  <section className="rounded-2xl border-2 border-ink/10 bg-surface p-4 shadow-soft sm:p-5">
    <h2 className="font-display text-base font-black text-ink">{judul}</h2>
    <div className="mt-3">{children}</div>
  </section>
);
const inp = "w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm text-ink";

function Ekspor() {
  const [f, setF] = useState({ jenis: "deposit", dari: "", sampai: "", penyedia: "", status: "" });
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  async function unduh() {
    setSibuk(true); setPesan("");
    try {
      const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
      const r = await fetch(`/api/admin/ekspor-csv?${q}`, { cache: "no-store" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Gagal");
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (r.headers.get("content-disposition") || "").match(/filename="([^"]+)"/)?.[1] || "ekspor.csv";
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      setPesan(`✅ ${r.headers.get("x-baris") || "0"} baris diunduh${r.headers.get("x-terpotong") === "1" ? " (dipotong 50.000 baris — persempit rentang tanggal)" : ""}.`);
    } catch (e) { setPesan("❌ " + e.message); } finally { setSibuk(false); }
  }
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Kartu judul="Ekspor data ke CSV">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-bold text-ink">Data
          <select className={inp} value={f.jenis} onChange={set("jenis")} data-testid="ek-jenis">
            <option value="deposit">Deposit</option><option value="pesanan">Pesanan OTP (+laba kotor)</option><option value="penarikan">Penarikan</option><option value="mutasi">Mutasi saldo</option>
          </select>
        </label>
        <label className="text-xs font-bold text-ink">Status (opsional)<input className={inp} value={f.status} onChange={set("status")} placeholder="mis. completed / done" data-testid="ek-status" /></label>
        <label className="text-xs font-bold text-ink">Dari tanggal<input type="date" className={inp} value={f.dari} onChange={set("dari")} data-testid="ek-dari" /></label>
        <label className="text-xs font-bold text-ink">Sampai tanggal<input type="date" className={inp} value={f.sampai} onChange={set("sampai")} data-testid="ek-sampai" /></label>
        <label className="text-xs font-bold text-ink sm:col-span-2">Penyedia / server (opsional)<input className={inp} value={f.penyedia} onChange={set("penyedia")} placeholder="mis. pakasir, qrisfast, warungnokos" data-testid="ek-penyedia" /></label>
      </div>
      <button type="button" disabled={sibuk} onClick={unduh} className="btn-3d mt-3 w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-black text-bg disabled:opacity-60" data-testid="ek-unduh">{sibuk ? "Menyiapkan…" : "⬇️ Unduh CSV"}</button>
      {pesan && <p className="mt-2 text-xs font-bold text-ink" data-testid="ek-pesan">{pesan}</p>}
      <p className="mt-2 text-[11px] leading-relaxed text-muted">Maks 50.000 baris, tanggal mengikuti WIB. Sel yang diawali = + - @ diberi tanda ' supaya tidak dieksekusi Excel (perlindungan CSV injection).</p>
    </Kartu>
  );
}

function Koreksi() {
  const [csv, setCsv] = useState("");
  const [pr, setPr] = useState(null);
  const [alasan, setAlasan] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  async function pratinjau() {
    setSibuk(true); setPesan(""); setPr(null);
    try { setPr(await api("/api/admin/koreksi-saldo", { aksi: "pratinjau", csv })); } catch (e) { setPesan("❌ " + e.message); } finally { setSibuk(false); }
  }
  async function terapkan() {
    if (!window.confirm(`Terapkan ${pr.ringkas.valid} koreksi saldo? Tindakan ini langsung mengubah saldo pengguna.`)) return;
    setSibuk(true); setPesan("");
    try {
      const r = await api("/api/admin/koreksi-saldo", { aksi: "terapkan", csv, kunci: pr.kunci, alasanUmum: alasan });
      setPesan(`✅ ${r.berhasil} akun diubah${r.gagal.length ? ` · ⚠️ ${r.gagal.length} gagal` : ""}${r.dilewati ? ` · ${r.dilewati} baris salah dilewati` : ""}.`);
      setPr(null); setCsv("");
    } catch (e) { setPesan("❌ " + e.message); } finally { setSibuk(false); }
  }
  return (
    <Kartu judul="Koreksi saldo massal (CSV)">
      <p className="text-[11px] leading-relaxed text-muted">Satu baris per akun: <code>kode_akun,jumlah,alasan[,game]</code>. Jumlah negatif = kurangi. Kolom ke-4 <code>game</code> = saldo game (bawaan: saldo nokos). Baris judul boleh ada. Maks 500 baris.</p>
      <textarea className={`${inp} mt-2 h-32 font-mono text-xs`} value={csv} onChange={(e) => { setCsv(e.target.value); setPr(null); }} placeholder={"AP-XXXX-0001,5000,ganti rugi error\nAP-XXXX-0002,-2000,koreksi dobel"} data-testid="kr-csv" />
      <button type="button" disabled={sibuk || !csv.trim()} onClick={pratinjau} className="btn-3d mt-2 w-full rounded-xl border-2 border-line bg-surface px-4 py-2 text-sm font-black text-ink disabled:opacity-60" data-testid="kr-pratinjau">🔍 Pratinjau (tidak mengubah apa pun)</button>
      {pr && (
        <div className="mt-3" data-testid="kr-hasil">
          <p className="text-xs font-bold text-ink">{pr.ringkas.valid} valid · {pr.ringkas.salah} salah · tambah {rp(pr.ringkas.tambah)} · kurang {rp(pr.ringkas.kurang)}</p>
          <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-line">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-surface2 text-muted"><tr><th className="px-2 py-1">#</th><th>Akun</th><th>Jumlah</th><th>Sebelum → sesudah</th><th>Status</th></tr></thead>
              <tbody>{pr.baris.map((b) => (
                <tr key={b.no} className={b.valid ? "" : "bg-rose-soft"} data-testid={b.valid ? "kr-baris-ok" : "kr-baris-salah"}>
                  <td className="px-2 py-1">{b.no}</td><td className="font-mono">{b.token}{b.nama ? ` (${b.nama})` : ""}</td>
                  <td className={b.jumlah < 0 ? "text-rose" : "text-success"}>{Number.isFinite(b.jumlah) ? (b.jumlah > 0 ? "+" : "") + b.jumlah.toLocaleString("id-ID") : "?"}{b.dompet === "game" ? " (game)" : ""}</td>
                  <td>{b.valid ? `${rp(b.sebelum)} → ${rp(b.sesudah)}` : "—"}</td><td>{b.valid ? "✅" : `❌ ${b.galat}`}</td>
                </tr>))}</tbody>
            </table>
          </div>
          {pr.ringkas.valid > 0 && (
            <>
              <input className={`${inp} mt-2`} value={alasan} onChange={(e) => setAlasan(e.target.value)} maxLength={100} placeholder="Alasan umum (wajib, tercatat di mutasi tiap akun)" data-testid="kr-alasan" />
              <button type="button" disabled={sibuk || alasan.trim().length < 3} onClick={terapkan} className="btn-3d mt-2 w-full rounded-xl bg-rose px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" data-testid="kr-terapkan">⚠️ Terapkan {pr.ringkas.valid} koreksi</button>
            </>
          )}
        </div>
      )}
      {pesan && <p className="mt-2 text-xs font-bold text-ink" data-testid="kr-pesan">{pesan}</p>}
    </Kartu>
  );
}

function Buku() {
  const [bulan, setBulan] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 7));
  const [d, setD] = useState(null);
  const [galat, setGalat] = useState("");
  const [baru, setBaru] = useState({ tanggal: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }), kategori: "Server & hosting", jumlah: "", catatan: "" });
  const muat = useCallback(async () => { try { setD(await api(`/api/admin/pembukuan?bulan=${bulan}`)); setGalat(""); } catch (e) { setGalat(e.message); } }, [bulan]);
  useEffect(() => { muat(); }, [muat]);
  async function tambah() { try { await api("/api/admin/pembukuan", { aksi: "tambah", ...baru }); setBaru((b) => ({ ...b, jumlah: "", catatan: "" })); await muat(); } catch (e) { setGalat(e.message); } }
  async function hapus(id) { try { await api("/api/admin/pembukuan", { aksi: "hapus", id }); await muat(); } catch (e) { setGalat(e.message); } }
  return (
    <Kartu judul="Pembukuan & laba bulanan">
      <label className="text-xs font-bold text-ink">Bulan<input type="month" className={inp} value={bulan} onChange={(e) => setBulan(e.target.value)} data-testid="bk-bulan" /></label>
      {galat && <p className="mt-2 text-xs font-bold text-rose">{galat}</p>}
      {d && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="bk-ringkas">
            <div className="rounded-xl border border-line bg-surface2/50 p-3"><p className="text-[10px] font-bold uppercase text-muted">Omzet OTP</p><p className="text-sm font-black text-ink" data-testid="bk-omzet">{rp(d.omzet)}</p><p className="text-[10px] text-muted">{d.pesananBerhasil} pesanan</p></div>
            <div className="rounded-xl border border-line bg-surface2/50 p-3"><p className="text-[10px] font-bold uppercase text-muted">Laba kotor</p><p className="text-sm font-black text-success" data-testid="bk-kotor">{rp(d.labaKotor)}</p></div>
            <div className="rounded-xl border border-line bg-surface2/50 p-3"><p className="text-[10px] font-bold uppercase text-muted">Pengeluaran</p><p className="text-sm font-black text-rose" data-testid="bk-keluar">{rp(d.pengeluaran)}</p></div>
            <div className="rounded-xl border-2 border-ink/20 bg-surface p-3"><p className="text-[10px] font-bold uppercase text-muted">Laba bersih</p><p className={`text-sm font-black ${d.labaBersih >= 0 ? "text-success" : "text-rose"}`} data-testid="bk-bersih">{rp(d.labaBersih)}</p></div>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted">Laba kotor = selisih harga jual − harga modal pesanan OTP yang berhasil. Belum termasuk produk digital, Stor Gmail, dan fee deposit.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <input type="date" className={inp} value={baru.tanggal} onChange={(e) => setBaru({ ...baru, tanggal: e.target.value })} data-testid="bk-tgl" />
            <select className={inp} value={baru.kategori} onChange={(e) => setBaru({ ...baru, kategori: e.target.value })} data-testid="bk-kat">{(d.kategori || []).map((k) => <option key={k}>{k}</option>)}</select>
            <input inputMode="numeric" className={inp} value={baru.jumlah} onChange={(e) => setBaru({ ...baru, jumlah: e.target.value.replace(/\D/g, "") })} placeholder="Jumlah (Rp)" data-testid="bk-jumlah" />
            <input className={inp} value={baru.catatan} onChange={(e) => setBaru({ ...baru, catatan: e.target.value })} maxLength={120} placeholder="Catatan" data-testid="bk-catatan" />
          </div>
          <button type="button" onClick={tambah} disabled={!baru.jumlah} className="btn-3d mt-2 w-full rounded-xl bg-ink px-4 py-2 text-sm font-black text-bg disabled:opacity-50" data-testid="bk-tambah">+ Catat pengeluaran</button>
          <ul className="mt-3 space-y-1.5" data-testid="bk-daftar">
            {d.items.length === 0 && <li className="text-xs text-muted">Belum ada pengeluaran tercatat bulan ini.</li>}
            {d.items.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs" data-testid="bk-baris">
                <span className="min-w-0"><b>{x.kategori}</b> · {new Date(x.tanggal).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short" })}{x.catatan ? ` · ${x.catatan}` : ""}</span>
                <span className="flex shrink-0 items-center gap-2"><b className="text-rose">{rp(x.jumlah)}</b><button type="button" onClick={() => hapus(x.id)} aria-label="Hapus" className="rounded bg-surface2 px-1.5 text-muted">✕</button></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Kartu>
  );
}

export default function AdminKeuangan() {
  const [tab, setTab] = useState("ekspor");
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-5" data-testid="admin-keuangan">
      <header>
        <h1 className="font-display text-xl font-black text-ink">🧾 Laporan & Ekspor</h1>
        <p className="text-xs text-muted">Ekspor data, koreksi saldo massal, dan pembukuan pengeluaran.</p>
      </header>
      <div role="tablist" className="flex gap-1 overflow-x-auto">
        {TAB.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`kt-${t.id}`}
            className={`min-w-max rounded-lg px-3 py-1.5 text-xs font-bold ${tab === t.id ? "bg-ink text-bg" : "bg-surface2 text-muted"}`}>{t.l}</button>
        ))}
      </div>
      {tab === "ekspor" && <Ekspor />}
      {tab === "koreksi" && <Koreksi />}
      {tab === "buku" && <Buku />}
    </main>
  );
}
