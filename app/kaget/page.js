"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/providers";
import { PageHeader, Segmented, EmptyState, CopyButton, fmtWIB, rupiah, Spinner } from "@/components/ui";
import { KagetAmplop, KagetKonfeti } from "@/components/KagetAmplop";
import { sisaWaktu, tautanKaget } from "@/lib/kagetUi";
import TombolBagikan from "@/components/KagetBagikan";

export const dynamic = "force-dynamic";

const CEPAT = [5000, 10000, 20000, 50000, 100000];
const LABEL_STATUS = { aktif: "Aktif", habis: "Habis diambil", berakhir: "Berakhir", dibatalkan: "Ditutup" };

function KartuPaket({ k, token, onTutup, sibuk }) {
  const pct = k.jumlah ? Math.round((k.diklaim / k.jumlah) * 100) : 0;
  return (
    <div className="card-shadow rounded-2xl border border-line bg-surface p-4" data-testid="kaget-kartu">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="kg-angka text-lg font-black text-ink">{rupiah(k.total)}</p>
          <p className="text-[11px] text-muted">{k.mode === "rata" ? "⚖️ Dibagi rata" : "🎲 Dibagi acak"} · {k.jumlah} orang · {fmtWIB(k.dibuat)}</p>
        </div>
        <span className={`kg-chip ${k.status}`}>{LABEL_STATUS[k.status] || k.status}</span>
      </div>
      {k.pesan && <p className="mt-2 truncate text-xs text-muted">“{k.pesan}”</p>}
      <div className="mt-3 kg-bar" aria-label={`${pct}% diambil`}><span style={{ width: `${pct}%` }} /></div>
      <p className="mt-1 text-[11px] font-semibold text-muted">
        {k.diklaim}/{k.jumlah} sudah mengambil{k.status === "aktif" ? ` · ${sisaWaktu(k.berakhirPada)}` : ""}
        {["berakhir", "dibatalkan"].includes(k.status) && k.refund != null ? ` · ${rupiah(k.refund)} dikembalikan` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={`/kaget/${k.kid}`} className="rounded-lg bg-amber px-3 py-1.5 text-xs font-black text-white">Buka</Link>
        {k.status === "aktif" && <CopyButton value={tautanKaget(k.kid)} label="Salin tautan" />}
        {k.status === "aktif" && (
          <button type="button" disabled={sibuk === k.kid} onClick={() => onTutup(k)} className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose hover:bg-rose-soft disabled:opacity-50">
            {sibuk === k.kid ? "Menutup…" : "Tutup & kembalikan sisa"}
          </button>
        )}
      </div>
    </div>
  );
}

function IsiHalaman() {
  const { token, balance, ready, refreshBalance } = useUser();
  const router = useRouter();
  const sp = useSearchParams();
  const [cfg, setCfg] = useState(null);
  const [tab, setTab] = useState(sp.get("tab") === "kagetku" ? "kagetku" : sp.get("tab") === "diterima" ? "diterima" : "buat");
  const [total, setTotal] = useState("");
  const [jumlah, setJumlah] = useState(5);
  const [mode, setMode] = useState("acak");
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [proses, setProses] = useState(false);
  const [sukses, setSukses] = useState(null);
  const [saya, setSaya] = useState(null);
  const [kode, setKode] = useState("");
  const [sibukTutup, setSibukTutup] = useState("");
  const [infoTutup, setInfoTutup] = useState("");

  useEffect(() => {
    fetch("/api/kaget/config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (!d?.error) setCfg(d); }).catch(() => {});
  }, []);

  const muatSaya = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/kaget/saya?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const d = await r.json();
      if (r.ok) setSaya(d);
    } catch {}
  }, [token]);
  useEffect(() => { muatSaya(); }, [muatSaya]);

  const nominal = Math.floor(Number(total) || 0);
  const biayaPersen = cfg?.biayaPersen || 0;
  const biaya = biayaPersen > 0 ? Math.ceil((nominal * biayaPersen) / 100) : 0;
  const bayar = nominal + biaya;
  const minPerOrang = cfg?.minPerOrang || 500;
  const rataRata = nominal > 0 && jumlah > 0 ? Math.floor(nominal / jumlah) : 0;

  const salahInput = useMemo(() => {
    if (!cfg) return "";
    if (!nominal) return "";
    if (nominal < cfg.minTotal) return `Total minimal ${rupiah(cfg.minTotal)}.`;
    if (nominal > cfg.maksTotal) return `Total maksimal ${rupiah(cfg.maksTotal)}.`;
    if (jumlah < 1 || jumlah > cfg.maksPenerima) return `Jumlah penerima 1–${cfg.maksPenerima}.`;
    if (nominal < jumlah * minPerOrang) return `Tiap orang minimal ${rupiah(minPerOrang)} — untuk ${jumlah} orang butuh ${rupiah(jumlah * minPerOrang)}.`;
    if (bayar > balance) return `Saldo kurang ${rupiah(bayar - balance)}.`;
    return "";
  }, [cfg, nominal, jumlah, minPerOrang, bayar, balance]);

  const siap = !!cfg && cfg.aktif && nominal > 0 && !salahInput && !!token;

  async function kirim() {
    setProses(true); setGalat("");
    try {
      const r = await fetch("/api/kaget/buat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, total: nominal, jumlah, mode, pesan }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal membuat Kaget.");
      setSukses({ kid: d.kid, total: nominal, jumlah, mode, pembuat: "kamu" });
      setKonfirmasi(false); setTotal(""); setPesan("");
      refreshBalance?.(); muatSaya();
    } catch (e) {
      setGalat(e.message); setKonfirmasi(false);
    } finally { setProses(false); }
  }

  async function tutup(k) {
    if (!window.confirm(`Tutup paket ${rupiah(k.total)}? Bagian yang belum diambil langsung kembali ke saldomu.`)) return;
    setSibukTutup(k.kid); setInfoTutup("");
    try {
      const r = await fetch("/api/kaget/tutup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, kid: k.kid }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal menutup.");
      setInfoTutup(d.dikembalikan > 0 ? `${rupiah(d.dikembalikan)} dikembalikan ke saldomu.` : "Paket ditutup.");
      refreshBalance?.(); muatSaya();
    } catch (e) { setInfoTutup(e.message); } finally { setSibukTutup(""); }
  }

  function bukaKode(e) {
    e.preventDefault();
    const m = String(kode).toUpperCase().match(/[2-9A-HJKMNP-Z]{10}/);
    if (!m) return setGalat("Kode / tautan Kaget tidak dikenali.");
    router.push(`/kaget/${m[0]}`);
  }

  const aktifCount = saya?.ringkasan?.paketAktif ?? 0;

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader
        icon={<span aria-hidden="true">🧧</span>}
        title="Saldo Kaget"
        desc="Bagikan sebagian saldomu ke teman lewat satu tautan. Siapa cepat dia dapat — nominalnya bisa acak atau rata. Yang tidak terambil kembali ke kamu."
      />

      {cfg && !cfg.aktif && (
        <div className="fade-up mt-6 rounded-2xl border border-amber/40 bg-amber-soft p-5 text-center" data-testid="kaget-tutup">
          <p className="text-3xl" aria-hidden="true">🔒</p>
          <p className="mt-2 text-sm font-bold text-ink">Saldo Kaget sedang ditutup</p>
          <p className="mt-1 text-xs text-muted">Admin menonaktifkan pembuatan paket baru. Paket yang sudah ada tetap bisa diambil sampai berakhir.</p>
        </div>
      )}

      <div className="fade-up mt-6 kg-hero p-5 sm:p-7">
        <div className="relative z-[1] flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <div className="shrink-0"><KagetAmplop goyang /></div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[11px] font-black uppercase tracking-widest text-white/70">Saldo kamu</p>
            <p className="kg-angka mt-0.5 break-words text-3xl font-black sm:text-4xl" data-testid="kaget-saldo">{ready ? rupiah(balance) : "…"}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-[11px] font-bold sm:justify-start">
              <span className="rounded-full bg-white/15 px-3 py-1">📦 {aktifCount} paket aktif</span>
              <span className="rounded-full bg-white/15 px-3 py-1">🎁 Diterima {rupiah(saya?.ringkasan?.totalDiterima || 0)}</span>
              <span className="rounded-full bg-white/15 px-3 py-1">⏳ Berlaku {cfg?.masaJam || 24} jam</span>
            </div>
          </div>
        </div>
        <form onSubmit={bukaKode} className="relative z-[1] mt-5 flex gap-2">
          <input value={kode} onChange={(e) => setKode(e.target.value)} placeholder="Punya tautan / kode Kaget? Tempel di sini" aria-label="Kode atau tautan Kaget" className="min-w-0 flex-1 rounded-xl border-0 bg-white/95 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-amber" />
          <button className="btn-3d shrink-0 rounded-xl bg-amber px-4 py-2.5 text-sm font-black text-white">Ambil</button>
        </form>
      </div>

      <div className="mt-6">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "buat", label: "Buat Kaget" },
            { value: "kagetku", label: "Kagetku", count: saya?.dibuat?.length },
            { value: "diterima", label: "Diterima", count: saya?.diterima?.length }
          ]}
        />
      </div>

      {tab === "buat" && (
        <div className="fade-up mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
          <form
            onSubmit={(e) => { e.preventDefault(); setGalat(""); if (siap) setKonfirmasi(true); }}
            className={`card-shadow flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 ${cfg && !cfg.aktif ? "pointer-events-none opacity-50" : ""}`}
          >
            <div>
              <label className="text-xs font-bold text-muted" htmlFor="kg-total">Total saldo yang dibagi</label>
              <input id="kg-total" type="number" inputMode="numeric" min={cfg?.minTotal || 1000} step="500" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={`Mis. 20000 (min ${rupiah(cfg?.minTotal || 2000)})`} className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-lg font-black text-ink outline-none focus:border-amber" data-testid="kaget-total" />
              <div className="mt-2 flex flex-wrap gap-2">
                {CEPAT.map((n) => (
                  <button key={n} type="button" onClick={() => setTotal(String(n))} className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${nominal === n ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-muted hover:border-amber"}`}>{rupiah(n)}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted">Jumlah penerima</label>
              <div className="mt-1.5 flex items-center gap-3">
                <button type="button" aria-label="Kurangi" onClick={() => setJumlah((j) => Math.max(1, j - 1))} className="btn-3d h-11 w-11 rounded-xl border border-line bg-surface2 text-xl font-black text-ink">−</button>
                <input type="number" inputMode="numeric" min={1} max={cfg?.maksPenerima || 100} value={jumlah} onChange={(e) => setJumlah(Math.max(1, Math.min(cfg?.maksPenerima || 100, Math.floor(Number(e.target.value) || 1))))} className="h-11 w-20 rounded-xl border border-line bg-surface2 text-center text-lg font-black text-ink outline-none focus:border-amber" data-testid="kaget-jumlah" />
                <button type="button" aria-label="Tambah" onClick={() => setJumlah((j) => Math.min(cfg?.maksPenerima || 100, j + 1))} className="btn-3d h-11 w-11 rounded-xl border border-line bg-surface2 text-xl font-black text-ink">+</button>
                <span className="text-xs text-muted">orang (maks {cfg?.maksPenerima || 100})</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted">Cara membagi</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {[
                  ["acak", "🎲", "Acak", "Ada yang dapat banyak, ada yang sedikit — seru!"],
                  ["rata", "⚖️", "Rata", "Semua dapat bagian yang sama."]
                ].map(([v, ik, nm, ket]) => (
                  <button key={v} type="button" onClick={() => setMode(v)} data-testid={`kaget-mode-${v}`} className={`rounded-xl border-2 p-3 text-left transition-colors ${mode === v ? "border-amber bg-amber-soft" : "border-line hover:border-amber/50"}`}>
                    <p className="text-sm font-black text-ink">{ik} {nm}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{ket}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex justify-between text-xs font-bold text-muted" htmlFor="kg-pesan"><span>Pesan (opsional)</span><span>{pesan.length}/{cfg?.pesanMaks || 80}</span></label>
              <input id="kg-pesan" value={pesan} maxLength={cfg?.pesanMaks || 80} onChange={(e) => setPesan(e.target.value)} placeholder="Mis. Selamat gajian, traktiran kopi ☕" className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-sm text-ink outline-none focus:border-amber" data-testid="kaget-pesan" />
            </div>

            {(salahInput || galat) && <p className="rounded-xl bg-rose-soft px-4 py-2.5 text-xs font-bold text-rose" role="alert" data-testid="kaget-galat">{galat || salahInput}</p>}
            {!token && ready && <p className="text-xs text-muted">Memuat akunmu…</p>}

            <button type="submit" disabled={!siap || proses} className="btn-3d rounded-xl bg-rose shadow-3d py-3.5 text-sm font-black text-white disabled:opacity-50" data-testid="kaget-lanjut">
              {proses ? "Memproses…" : nominal > 0 ? `Buat Kaget ${rupiah(nominal)} 🧧` : "Buat Kaget 🧧"}
            </button>
          </form>

          <aside className="card-shadow h-fit rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display text-base font-black text-ink">Ringkasan</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["Total dibagi", rupiah(nominal)],
                ["Penerima", `${jumlah} orang`],
                [mode === "rata" ? "Tiap orang" : "Rata-rata", rataRata ? rupiah(rataRata) : "—"],
                ...(biaya > 0 ? [[`Biaya admin ${biayaPersen}%`, rupiah(biaya)]] : []),
                ["Dipotong dari saldo", rupiah(bayar)]
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="font-black text-ink">{v}</dd></div>
              ))}
            </dl>
            <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
              <li>• Tiap akun hanya bisa mengambil <b>sekali</b>; kamu tidak bisa mengambil paketmu sendiri.</li>
              <li>• Berlaku <b>{cfg?.masaJam || 24} jam</b>. Sisa yang tidak terambil kembali otomatis ke saldomu{biayaPersen > 0 ? " (biaya admin ikut dikembalikan sebanding)" : ""}.</li>
              <li>• Saldo yang diterima lewat Kaget masuk sebagai saldo biasa (untuk beli nokos), tidak bisa ditarik ke e-wallet.</li>
              <li>• Kamu bisa menutup paket kapan saja untuk menarik sisanya.</li>
            </ul>
          </aside>
        </div>
      )}

      {tab === "kagetku" && (
        <div className="fade-up mt-4">
          {infoTutup && <p className="mb-3 rounded-xl bg-amber-soft px-4 py-2.5 text-xs font-bold text-amber-bright">{infoTutup}</p>}
          {!saya ? <div className="skeleton h-28 rounded-2xl" /> : saya.dibuat.length === 0 ? (
            <EmptyState icon="🧧" title="Belum ada Kaget yang kamu buat" desc="Buat paket pertamamu, lalu bagikan tautannya ke teman." action={<button onClick={() => setTab("buat")} className="rounded-xl bg-amber px-4 py-2 text-xs font-black text-white">Buat Kaget</button>} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">{saya.dibuat.map((k) => <KartuPaket key={k.kid} k={k} token={token} onTutup={tutup} sibuk={sibukTutup} />)}</div>
          )}
        </div>
      )}

      {tab === "diterima" && (
        <div className="fade-up mt-4">
          {!saya ? <div className="skeleton h-28 rounded-2xl" /> : saya.diterima.length === 0 ? (
            <EmptyState icon="🎁" title="Belum ada Kaget yang kamu ambil" desc="Kalau ada teman yang membagikan tautan Kaget, buka dan ambil bagianmu di sini." />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {saya.diterima.map((c) => (
                <li key={c.kid}>
                  <Link href={`/kaget/${c.kid}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">Dari {c.dari}</p>
                      <p className="truncate text-[11px] text-muted">{c.pesan ? `“${c.pesan}” · ` : ""}{fmtWIB(c.waktu)}</p>
                    </div>
                    <span className="kg-angka shrink-0 text-base font-black text-success">+{rupiah(c.jumlah)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {konfirmasi && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Konfirmasi Kaget" onClick={() => !proses && setKonfirmasi(false)}>
          <div className="fade-up w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="-mt-2 mb-2"><KagetAmplop kecil /></div>
            <h2 className="text-center font-display text-lg font-black text-ink">Bagikan {rupiah(nominal)}?</h2>
            <p className="mt-1 text-center text-xs text-muted">{jumlah} orang · {mode === "rata" ? "dibagi rata" : "dibagi acak"} · berlaku {cfg?.masaJam || 24} jam</p>
            <div className="mt-4 rounded-2xl bg-surface2 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted">Dipotong dari saldo</span><b className="text-ink">{rupiah(bayar)}</b></div>
              <div className="mt-1 flex justify-between"><span className="text-muted">Saldo setelahnya</span><b className="text-ink">{rupiah(balance - bayar)}</b></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={proses} onClick={() => setKonfirmasi(false)} className="rounded-xl border border-line py-3 text-sm font-bold text-muted">Batal</button>
              <button type="button" disabled={proses} onClick={kirim} data-testid="kaget-konfirmasi" className="btn-3d rounded-xl bg-rose shadow-3d py-3 text-sm font-black text-white disabled:opacity-60">{proses ? <Spinner className="mx-auto h-5 w-5" /> : "Ya, bagikan"}</button>
            </div>
          </div>
        </div>
      )}

      {sukses && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Kaget siap dibagikan">
          <div className="fade-up relative w-full max-w-sm overflow-hidden rounded-3xl bg-surface p-6 shadow-2xl" data-testid="kaget-sukses">
            <KagetKonfeti />
            <div className="relative">
              <KagetAmplop terbuka teks={rupiah(sukses.total)} />
              <h2 className="mt-3 text-center font-display text-xl font-black text-ink">Kaget siap dibagikan!</h2>
              <p className="mt-1 text-center text-xs text-muted">Kirim tautan ini ke teman — siapa cepat dia dapat.</p>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-amber bg-amber-soft px-3 py-2.5">
                <code className="min-w-0 flex-1 truncate text-xs font-bold text-ink" data-testid="kaget-tautan">{tautanKaget(sukses.kid)}</code>
                <CopyButton value={tautanKaget(sukses.kid)} />
              </div>
              <div className="mt-3"><TombolBagikan data={sukses} /></div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setSukses(null); setTab("kagetku"); }} className="rounded-xl border border-line py-2.5 text-sm font-bold text-ink">Lihat Kagetku</button>
                <Link href={`/kaget/${sukses.kid}`} className="rounded-xl bg-amber py-2.5 text-center text-sm font-black text-white">Buka paket</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KagetPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-content px-4 py-10"><div className="skeleton h-40 rounded-2xl" /></div>}>
      <IsiHalaman />
    </Suspense>
  );
}
