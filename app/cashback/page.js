"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/app/providers";
import { PageHeader, rupiah } from "@/components/ui";
import "@/components/kaget.css";

export const dynamic = "force-dynamic";

const CEPAT = [10000, 50000, 100000, 250000, 500000];
const pct = (n) => `${Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;

export default function CashbackPage() {
  const { token, ready } = useUser();
  const [info, setInfo] = useState(null);
  const [amount, setAmount] = useState("50000");
  const [galat, setGalat] = useState("");

  const nominal = Math.max(0, Math.min(100_000_000, Math.floor(Number(amount) || 0)));

  useEffect(() => {
    if (!ready || !token) return;
    let hidup = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/cashback/info?token=${encodeURIComponent(token)}&amount=${nominal}`, { cache: "no-store" });
        const d = await r.json();
        if (!hidup) return;
        if (!r.ok) throw new Error(d.error || "Gagal memuat.");
        setInfo(d); setGalat("");
      } catch (e) { if (hidup) setGalat(e.message); }
    }, 200);
    return () => { hidup = false; clearTimeout(t); };
  }, [ready, token, nominal]);

  const sim = info?.simulasi;
  const tier = info?.tier;
  const next = info?.next;

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader
        icon={<span aria-hidden="true">🎁</span>}
        title="Cashback & Tingkat"
        desc="Tiap deposit berhasil dapat cashback langsung ke saldo. Makin sering belanja nokos, tingkatmu naik dan cashback makin besar."
        action={<Link href="/deposit" className="btn-3d rounded-xl bg-amber px-4 py-2.5 text-sm font-black text-white">Isi saldo</Link>}
      />

      {galat && <p className="mt-4 rounded-xl bg-rose-soft px-4 py-2.5 text-xs font-bold text-rose">{galat}</p>}

      <div className="fade-up mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="kg-hero p-5 sm:p-6" style={{ background: "radial-gradient(120% 140% at 10% 0%, #fbbf24 0%, #d97706 50%, #7c2d12 100%)" }} data-testid="cashback-tingkat">
          <div className="relative z-[1]">
            <p className="text-[11px] font-black uppercase tracking-widest text-white/75">Tingkatmu</p>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-5xl" aria-hidden="true">{tier?.ikon || "🥉"}</span>
              <div>
                <p className="font-display text-3xl font-black">{tier?.nama || "…"}</p>
                <p className="text-xs font-bold text-white/80">{tier ? (tier.tambahan > 0 ? `+${pct(tier.tambahan)} cashback ekstra` : "Tingkat awal") : ""}</p>
              </div>
            </div>
            {info && (next ? (
              <div className="mt-5">
                <div className="flex justify-between text-xs font-bold text-white/85"><span>Menuju {next.ikon} {next.nama} (+{pct(next.tambahan)})</span><span>{rupiah(next.kurang)} lagi</span></div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${next.persen}%` }} /></div>
                <p className="mt-1.5 text-[11px] text-white/75">Dihitung dari total belanja nokosmu: {rupiah(info.totalSpent)}</p>
              </div>
            ) : (
              <p className="mt-5 text-sm font-black">🎉 Kamu sudah di tingkat tertinggi!</p>
            ))}
            <div className="mt-5 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-black/20 p-3"><p className="text-[10px] font-bold uppercase text-white/70">Total belanja</p><p className="kg-angka text-lg font-black">{rupiah(info?.totalSpent || 0)}</p></div>
              <div className="rounded-xl bg-black/20 p-3"><p className="text-[10px] font-bold uppercase text-white/70">Cashback didapat</p><p className="kg-angka text-lg font-black">{rupiah(info?.cashbackTotal || 0)}</p></div>
            </div>
          </div>
        </section>

        <section className="card-shadow rounded-2xl border border-line bg-surface p-5" data-testid="cashback-simulasi">
          <h2 className="font-display text-base font-black text-ink">Hitung cashback depositmu</h2>
          <label className="mt-3 block text-xs font-bold text-muted" htmlFor="cb-nominal">Nominal deposit</label>
          <input id="cb-nominal" type="number" inputMode="numeric" min="0" step="1000" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-lg font-black text-ink outline-none focus:border-amber" />
          <div className="mt-2 flex flex-wrap gap-2">
            {CEPAT.map((n) => (
              <button key={n} type="button" onClick={() => setAmount(String(n))} className={`rounded-full border px-3 py-1 text-xs font-bold ${nominal === n ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-muted hover:border-amber"}`}>{rupiah(n)}</button>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-surface2 p-4">
            {sim && nominal > 0 ? (
              <>
                <div className="flex items-baseline justify-between"><span className="text-xs font-bold text-muted">Cashback</span><span className="kg-angka text-2xl font-black text-success" data-testid="cashback-hasil">+{rupiah(sim.cashback)}</span></div>
                <ul className="mt-3 space-y-1.5 text-xs">
                  {sim.rincian.map((r) => <li key={r.kunci} className="flex justify-between"><span className="text-muted">{r.label}</span><b className="text-ink">+{pct(r.persen)}</b></li>)}
                  <li className="flex justify-between border-t border-line pt-1.5"><span className="font-bold text-ink">Total</span><b className="text-ink">{pct(sim.persen)}</b></li>
                </ul>
                {sim.dibatasiPersen && <p className="mt-2 text-[11px] text-amber-bright">Dibatasi maksimal {pct(info.maksPersen)} per deposit.</p>}
                {sim.terpotong && <p className="mt-2 text-[11px] text-amber-bright">Dibatasi maksimal {rupiah(info.maksRupiah)} per deposit.</p>}
              </>
            ) : <p className="text-xs text-muted">Isi nominal untuk melihat cashback-nya.</p>}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">Angka sungguhan dihitung server saat deposit berhasil. Deposit manual bisa punya persen dasar sendiri ({pct(info?.manualPersen)}).</p>
        </section>
      </div>

      <div className="fade-up mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card-shadow rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-base font-black text-ink">Tingkat & bonusnya</h2>
          <ul className="mt-3 divide-y divide-line" data-testid="cashback-daftar-tingkat">
            {(info?.tiers || []).map((t) => (
              <li key={t.key} className={`flex items-center gap-3 py-2.5 ${tier?.key === t.key ? "rounded-xl bg-amber-soft px-3" : ""}`}>
                <span className="text-2xl" aria-hidden="true">{t.ikon}</span>
                <div className="min-w-0 flex-1"><p className="text-sm font-black text-ink">{t.nama}{tier?.key === t.key && <span className="ml-2 rounded-full bg-amber px-2 py-0.5 text-[10px] text-white">kamu</span>}</p><p className="text-[11px] text-muted">Belanja nokos ≥ {rupiah(t.minBelanja)}</p></div>
                <b className="text-sm text-success">{t.tambahan > 0 ? `+${pct(t.tambahan)}` : "—"}</b>
              </li>
            ))}
          </ul>
        </section>
        <section className="card-shadow rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-base font-black text-ink">Bonus deposit besar</h2>
          {info?.nominal?.length ? (
            <ul className="mt-3 divide-y divide-line">
              {info.nominal.map((n) => <li key={n.min} className="flex justify-between py-2.5 text-sm"><span className="text-muted">Deposit ≥ <b className="text-ink">{rupiah(n.min)}</b></span><b className="text-success">+{pct(n.tambahan)}</b></li>)}
            </ul>
          ) : <p className="mt-3 text-xs text-muted">Belum ada bonus nominal.</p>}
          <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
            <p>• Cashback dasar <b>{pct(info?.dasarPersen)}</b> + tingkat + bonus nominal{info?.event > 0 ? <> + <b>event {info.eventNama || "musiman"} +{pct(info.event)}</b></> : ""}.</p>
            <p>• Maksimal <b>{pct(info?.maksPersen)}</b> dan <b>{info?.maksRupiah > 0 ? rupiah(info.maksRupiah) : "tanpa batas rupiah"}</b> per deposit.</p>
            <p>• Cashback masuk otomatis begitu deposit berhasil, tercatat di <Link href="/mutasi" className="font-bold text-amber-bright underline">Mutasi Saldo</Link>.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
