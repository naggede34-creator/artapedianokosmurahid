"use client";

// Dasbor khusus "Pengguna & Blokir": cari/saring pengguna, lihat detail masing-masing, blokir / buka blokir (dengan alasan
// dan riwayat), serta koreksi saldo/poin. Semua aksi lewat /api/admin/pengguna/* (dan /api/admin/users/{balance,points}).
import { useCallback, useEffect, useRef, useState } from "react";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const tgl = (v) => (v ? new Date(v).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const samar = (t) => (t ? `${t.slice(0, 6)}••••${t.slice(-4)}` : "—");
const FILTER = [
  { id: "semua", label: "Semua", ikon: "👥", kunci: "semua" },
  { id: "aktif", label: "Aktif", ikon: "✅", kunci: "aktif" },
  { id: "dibekukan", label: "Dibekukan", ikon: "🚫", kunci: "dibekukan" },
  { id: "otomatis", label: "Auto-ban anti-curang", ikon: "🤖", kunci: "otomatis" },
  { id: "baru", label: "Baru 24 jam", ikon: "🆕", kunci: "baru" }
];
const ALASAN_CEPAT = ["Curang di game", "Akun ganda / menghindari ban", "Penipuan deposit / bukti palsu", "Menyalahgunakan referral / bonus", "Pelanggaran aturan"];

async function api(url, opsi) {
  const r = await fetch(url, { cache: "no-store", ...opsi });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Gagal (${r.status})`);
  return d;
}
const post = (url, body) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function Lencana({ u }) {
  if (u.suspended) return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black text-white ${u.autoBan ? "bg-orange-500" : "bg-rose"}`}>{u.autoBan ? "AUTO-BAN" : "DIBEKUKAN"}</span>;
  return <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-black text-success">AKTIF{u.bebas ? " · lolos anti-curang" : ""}</span>;
}

function Kotak({ judul, children, aksi }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-black uppercase tracking-wide text-muted">{judul}</h4>{aksi}</div>
      <div className="mt-2">{children}</div>
    </section>
  );
}
const Baris = ({ k, v }) => <div className="flex justify-between gap-3 border-b border-line/60 py-1 text-xs last:border-0"><span className="text-muted">{k}</span><b className="text-right text-ink">{v}</b></div>;

function Daftar({ kosong, baris }) {
  return baris.length === 0 ? <p className="text-xs text-muted">{kosong}</p> : <ul className="space-y-1">{baris}</ul>;
}

function PanelDetail({ token, onTutup, onUbah }) {
  const [d, setD] = useState(null);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [alasan, setAlasan] = useState("");
  const [kabari, setKabari] = useState(true);
  const [bebas, setBebas] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [tab, setTab] = useState("pesanan");
  const [saldo, setSaldo] = useState({ dompet: "nokos", aksi: "add", jumlah: "", catatan: "" });

  const muat = useCallback(async () => {
    try { setD(await api(`/api/admin/pengguna/detail?token=${encodeURIComponent(token)}`)); setGalat(""); } catch (e) { setGalat(e.message); }
  }, [token]);
  useEffect(() => { setD(null); setPesan(""); setAlasan(""); muat(); }, [muat]);

  const blokir = async (aksi) => {
    setSibuk(true); setPesan(""); setGalat("");
    try {
      await post("/api/admin/pengguna/blokir", { token, aksi, alasan, kabari, bebasAntiCurang: bebas });
      setPesan(aksi === "ban" ? "Akun dibekukan ✅" : "Blokir dibuka ✅"); setAlasan("");
      await muat(); onUbah?.();
    } catch (e) { setGalat(e.message); }
    setSibuk(false);
  };
  const ubahSaldo = async () => {
    setSibuk(true); setPesan(""); setGalat("");
    try {
      const n = Number(saldo.jumlah);
      if (saldo.dompet === "poin") await post("/api/admin/users/points", { token, amount: n, action: saldo.aksi, note: saldo.catatan });
      else await post("/api/admin/users/balance", { token, amount: n, action: saldo.aksi, note: saldo.catatan, wallet: saldo.dompet === "game" ? "game" : undefined });
      setPesan("Saldo diperbarui ✅"); setSaldo({ ...saldo, jumlah: "", catatan: "" });
      await muat(); onUbah?.();
    } catch (e) { setGalat(e.message); }
    setSibuk(false);
  };

  const tabs = d ? [["pesanan", `Pesanan (${d.pesanan.length})`], ["mutasi", "Mutasi"], ["deposit", "Deposit"], ["tarik", "Penarikan"], ["curang", `Anti-curang (${d.antiCurang.length})`], ["blokir", `Riwayat blokir (${d.riwayatBlokir.length})`]] : [];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55" onMouseDown={(e) => { if (e.target === e.currentTarget) onTutup(); }} data-testid="pg-detail-latar">
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-bg p-4 shadow-lift" role="dialog" aria-label="Detail pengguna" data-testid="pg-detail">
        <div className="flex items-start justify-between gap-2">
          <div><h3 className="text-lg font-black text-ink" data-testid="pg-detail-nama">{d?.name || "Tanpa nama"}</h3><p className="font-mono text-[11px] text-muted">{d ? d.token : samar(token)}</p></div>
          <button onClick={onTutup} className="rounded-lg border border-line px-2.5 py-1 text-sm font-bold" data-testid="pg-tutup" aria-label="Tutup">✕</button>
        </div>
        {galat && <p className="mt-2 rounded-lg bg-rose-soft px-3 py-2 text-xs font-bold text-rose" data-testid="pg-galat">{galat}</p>}
        {pesan && <p className="mt-2 rounded-lg bg-success-soft px-3 py-2 text-xs font-bold text-success" data-testid="pg-pesan">{pesan}</p>}
        {!d && !galat && <div className="mt-6 text-center text-sm text-muted">Memuat…</div>}
        {d && (
          <div className="mt-3 space-y-3">
            <Kotak judul="Status akun" aksi={<Lencana u={d} />}>
              {d.suspended ? (
                <>
                  <p className="text-xs text-ink">Dibekukan sejak <b>{tgl(d.suspendedAt)}</b></p>
                  <p className="mt-1 rounded-lg bg-rose-soft px-2.5 py-1.5 text-xs text-rose" data-testid="pg-alasan-aktif">Alasan: {d.suspendReason || "—"}</p>
                  <textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} maxLength={200} rows={2} placeholder="Catatan buka blokir (opsional)" className="mt-2 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm" data-testid="pg-alasan" />
                  <label className="mt-1 flex items-center gap-2 text-xs text-ink"><input type="checkbox" checked={bebas} onChange={(e) => setBebas(e.target.checked)} /> Bebaskan dari ban otomatis anti-curang berikutnya (direkomendasikan setelah ditinjau)</label>
                  <label className="flex items-center gap-2 text-xs text-ink"><input type="checkbox" checked={kabari} onChange={(e) => setKabari(e.target.checked)} /> Kabari pengguna lewat notifikasi</label>
                  <button disabled={sibuk} onClick={() => blokir("unban")} className="btn-3d mt-2 w-full rounded-xl bg-success px-3 py-2 text-sm font-black text-white disabled:opacity-60" data-testid="pg-unban-ok">✅ Buka blokir</button>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted">Akun aktif. Pembekuan memblokir pembelian, penarikan, game, dan fitur lain; saldo & poin tetap aman.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{ALASAN_CEPAT.map((a) => <button key={a} type="button" onClick={() => setAlasan(a)} className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-surface2">{a}</button>)}</div>
                  <textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} maxLength={200} rows={2} placeholder="Alasan blokir (wajib, tampil ke pengguna)" className="mt-2 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm" data-testid="pg-alasan" />
                  <label className="mt-1 flex items-center gap-2 text-xs text-ink"><input type="checkbox" checked={kabari} onChange={(e) => setKabari(e.target.checked)} /> Kabari pengguna lewat notifikasi</label>
                  <button disabled={sibuk} onClick={() => blokir("ban")} className="btn-3d mt-2 w-full rounded-xl bg-rose px-3 py-2 text-sm font-black text-white disabled:opacity-60" data-testid="pg-ban-ok">🚫 Bekukan akun</button>
                </>
              )}
            </Kotak>

            <Kotak judul="Keuangan">
              <Baris k="Saldo nokos" v={rp(d.balance)} />
              <Baris k="↳ bisa ditarik (dari deposit)" v={rp(d.bisaDitarik)} />
              <Baris k="↳ saldo bonus (tak bisa ditarik)" v={rp(d.saldoBonus)} />
              <Baris k="Saldo game" v={rp(d.saldoGame)} />
              <Baris k="Poin toko" v={Number(d.poin).toLocaleString("id-ID")} />
              <Baris k="Total deposit" v={`${rp(d.depositTotal)} (${d.depositCount}×)`} />
              <Baris k="Total belanja nokos" v={rp(d.totalBelanja)} />
              <Baris k="Total penarikan nokos" v={rp(d.wdNokosTotal)} />
              <Baris k="Komisi referral" v={`${rp(d.referralEarnings)} (${d.referralCount} teman)`} />
            </Kotak>

            <Kotak judul="Identitas & aktivitas">
              <Baris k="Daftar" v={tgl(d.createdAt)} />
              <Baris k="Telegram" v={d.telegramUsername ? `@${d.telegramUsername}` : d.telegramId || "—"} />
              <Baris k="WEARTA CHAT" v={d.chat ? `${d.chat.nama} · terakhir ${tgl(d.chat.lastSeen)}` : "belum"} />
              <Baris k="Duel dimainkan" v={d.jumlahDuel} />
              <Baris k="Strike anti-curang" v={d.strikeGame} />
            </Kotak>

            <Kotak judul="Koreksi saldo / poin">
              <div className="grid grid-cols-2 gap-2">
                <select value={saldo.dompet} onChange={(e) => setSaldo({ ...saldo, dompet: e.target.value })} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"><option value="nokos">Saldo nokos</option><option value="game">Saldo game</option><option value="poin">Poin toko</option></select>
                <select value={saldo.aksi} onChange={(e) => setSaldo({ ...saldo, aksi: e.target.value })} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"><option value="add">Tambah</option><option value="sub">Kurangi</option></select>
                <input value={saldo.jumlah} onChange={(e) => setSaldo({ ...saldo, jumlah: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" placeholder="Jumlah (Rp / poin)" className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" data-testid="pg-saldo-jumlah" />
                <input value={saldo.catatan} onChange={(e) => setSaldo({ ...saldo, catatan: e.target.value })} maxLength={120} placeholder="Catatan" className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" />
              </div>
              <button disabled={sibuk || !saldo.jumlah} onClick={ubahSaldo} className="btn-3d mt-2 w-full rounded-xl bg-amber px-3 py-2 text-sm font-black text-white disabled:opacity-50" data-testid="pg-saldo-ok">Terapkan</button>
              <p className="mt-1 text-[11px] text-muted">Saldo tambahan admin tidak bisa ditarik (bukan dari deposit).</p>
            </Kotak>

            <div className="no-scrollbar flex gap-1 overflow-x-auto" role="tablist">
              {tabs.map(([id, lb]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-w-max rounded-lg px-3 py-1.5 text-xs font-bold ${tab === id ? "bg-amber-soft text-amber-bright ring-1 ring-inset ring-amber/40" : "text-muted hover:bg-surface2"}`}>{lb}</button>)}
            </div>
            <div data-testid="pg-tab-isi">
              {tab === "pesanan" && <Daftar kosong="Belum ada pesanan." baris={d.pesanan.map((o) => <li key={o.orderId} className="flex justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs"><span><b>{o.layanan || "-"}</b> · {o.negara || "-"} · {o.nomor || "-"}<br /><span className="text-muted">{tgl(o.at)}</span></span><span className="text-right"><b>{rp(o.harga)}</b><br /><span className="text-muted">{o.status}</span></span></li>)} />}
              {tab === "mutasi" && <Daftar kosong="Belum ada mutasi." baris={d.mutasi.map((m, i) => <li key={i} className="flex justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs"><span>{m.judul || m.tipe}<br /><span className="text-muted">{tgl(m.at)} · {m.dompet}</span></span><b className={m.jumlah >= 0 ? "text-success" : "text-rose"}>{m.jumlah >= 0 ? "+" : ""}{rp(m.jumlah)}</b></li>)} />}
              {tab === "deposit" && <Daftar kosong="Belum ada deposit." baris={d.deposit.map((x) => <li key={x.orderId} className="flex justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs"><span>{x.provider}<br /><span className="text-muted">{tgl(x.at)}</span></span><span className="text-right"><b>{rp(x.jumlah)}</b><br /><span className="text-muted">{x.status}</span></span></li>)} />}
              {tab === "tarik" && <Daftar kosong="Belum ada penarikan." baris={d.penarikan.map((x) => <li key={x.id} className="flex justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs"><span>{x.jenis} → {x.dompet}<br /><span className="text-muted">{tgl(x.at)}</span></span><span className="text-right"><b>{rp(x.nominal)}</b><br /><span className="text-muted">{x.status}</span></span></li>)} />}
              {tab === "curang" && <Daftar kosong="Tidak ada catatan anti-curang." baris={d.antiCurang.map((x, i) => <li key={i} className="rounded-lg bg-surface px-2.5 py-1.5 text-xs"><b>{x.jenis}</b> · {tgl(x.at)}<br /><span className="text-muted">{x.alasan || ""}{x.ip ? ` · IP ${x.ip}` : ""}</span></li>)} />}
              {tab === "blokir" && <Daftar kosong="Belum pernah diblokir / dibuka lewat dasbor ini." baris={d.riwayatBlokir.map((x, i) => <li key={i} className={`rounded-lg px-2.5 py-1.5 text-xs ${x.aksi === "ban" ? "bg-rose-soft" : "bg-success-soft"}`} data-testid="pg-riwayat-baris"><b>{x.aksi === "ban" ? "🚫 Dibekukan" : "✅ Dibuka"}</b> · {tgl(x.at)}<br />{x.alasan || "—"}</li>)} />}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function AdminPengguna() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("semua");
  const [urut, setUrut] = useState("terbaru");
  const [hal, setHal] = useState(0);
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState(null);
  const tunda = useRef(null);

  const muat = useCallback(async (o = {}) => {
    const p = { q, status, urut, hal, ...o };
    try {
      const d = await api(`/api/admin/pengguna?q=${encodeURIComponent(p.q)}&status=${p.status}&urut=${p.urut}&hal=${p.hal}&ukuran=25`);
      setData(d); setGalat("");
    } catch (e) { setGalat(e.message); }
  }, [q, status, urut, hal]);

  useEffect(() => { clearTimeout(tunda.current); tunda.current = setTimeout(() => muat(), q ? 350 : 0); return () => clearTimeout(tunda.current); }, [muat]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = data?.ringkas;
  const jml = { semua: r?.semua, aktif: r?.aktif, dibekukan: r?.dibekukan, otomatis: r?.otomatis, baru: r?.baru };
  const totalHal = data ? Math.max(1, Math.ceil(data.total / data.ukuran)) : 1;
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6" data-testid="admin-pengguna">
      <h1 className="font-display text-2xl font-black text-ink">👥 Pengguna & Blokir</h1>
      <p className="mt-1 text-sm text-muted">Cari pengguna, lihat detailnya, lalu bekukan atau buka blokir. Setiap perubahan tercatat di riwayat.</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="pg-statistik">
        {FILTER.map((f) => (
          <button key={f.id} onClick={() => { setStatus(f.id); setHal(0); }} data-testid={`pg-filter-${f.id}`} aria-pressed={status === f.id}
            className={`rounded-2xl border-2 p-3 text-left transition-colors ${status === f.id ? "border-ink bg-ink text-bg" : "border-ink/15 bg-surface text-ink hover:bg-surface2"}`}>
            <div className="text-lg">{f.ikon}</div>
            <div className="text-xl font-black" data-testid={`pg-jml-${f.id}`}>{jml[f.id] != null ? Number(jml[f.id]).toLocaleString("id-ID") : "…"}</div>
            <div className="text-[11px] font-bold opacity-80">{f.label}</div>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input value={q} onChange={(e) => { setQ(e.target.value); setHal(0); }} placeholder="Cari nama atau kode akun…" className="min-w-0 flex-1 rounded-xl border-2 border-ink/20 bg-surface px-3 py-2 text-sm" data-testid="pg-cari" />
        <select value={urut} onChange={(e) => { setUrut(e.target.value); setHal(0); }} className="rounded-xl border-2 border-ink/20 bg-surface px-3 py-2 text-sm" aria-label="Urutkan">
          <option value="terbaru">Terbaru daftar</option><option value="saldo">Saldo terbesar</option><option value="deposit">Deposit terbesar</option><option value="nama">Nama A–Z</option>
        </select>
      </div>

      {galat && <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-sm font-bold text-rose">{galat}</p>}
      <div className="mt-3 space-y-2" data-testid="pg-daftar">
        {!data && !galat && <div className="skeleton h-24 rounded-2xl" />}
        {data && data.items.length === 0 && <p className="rounded-xl bg-surface2 p-4 text-center text-sm text-muted" data-testid="pg-kosong">Tidak ada pengguna yang cocok.</p>}
        {data?.items.map((u) => (
          <div key={u.token} className={`flex items-center gap-3 rounded-2xl border-2 bg-surface p-3 ${u.suspended ? "border-rose/50" : "border-ink/10"}`} data-testid="pg-baris" data-token={u.token}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white ${u.suspended ? "bg-rose" : "bg-ink"}`}>{(u.name || "?").slice(0, 1).toUpperCase()}</div>
            <button className="min-w-0 flex-1 text-left" onClick={() => setBuka(u.token)} data-testid="pg-buka-detail">
              <div className="flex flex-wrap items-center gap-1.5"><b className="truncate text-sm text-ink">{u.name || "Tanpa nama"}</b><Lencana u={u} /></div>
              <div className="truncate font-mono text-[11px] text-muted">{samar(u.token)} · daftar {tgl(u.createdAt)}</div>
              <div className="text-[11px] text-muted">Saldo {rp(u.balance)} · game {rp(u.saldoGame)} · deposit {rp(u.depositTotal)}</div>
              {u.suspended && u.suspendReason ? <div className="truncate text-[11px] text-rose">Alasan: {u.suspendReason}</div> : null}
            </button>
            <div className="flex shrink-0 flex-col gap-1.5">
              <button onClick={() => setBuka(u.token)} className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-bold hover:bg-surface2">Detail</button>
              <button onClick={() => setBuka(u.token)} className={`rounded-lg px-2.5 py-1 text-[11px] font-black text-white ${u.suspended ? "bg-success" : "bg-rose"}`} data-testid={u.suspended ? "pg-baris-unban" : "pg-baris-ban"}>{u.suspended ? "Buka blokir" : "Bekukan"}</button>
            </div>
          </div>
        ))}
      </div>

      {data && data.total > data.ukuran && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button disabled={hal <= 0} onClick={() => setHal(hal - 1)} className="rounded-lg border border-line px-3 py-1.5 font-bold disabled:opacity-40">← Sebelumnya</button>
          <span className="text-muted">Halaman {hal + 1} / {totalHal} · {data.total.toLocaleString("id-ID")} pengguna</span>
          <button disabled={hal + 1 >= totalHal} onClick={() => setHal(hal + 1)} className="rounded-lg border border-line px-3 py-1.5 font-bold disabled:opacity-40">Berikutnya →</button>
        </div>
      )}
      {buka && <PanelDetail token={buka} onTutup={() => setBuka(null)} onUbah={() => muat()} />}
    </div>
  );
}
