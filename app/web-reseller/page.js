"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser, useBrand } from "@/app/providers";
import { CopyButton, rupiah, Spinner, timeAgo } from "@/components/ui";
import { SLUG_RE, RESERVED, SYARAT_RW } from "@/lib/webResellerUi";

export const dynamic = "force-dynamic";

const kartu = "card-shadow rounded-2xl border border-line bg-surface";
const input = "mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-amber";

function Stat({ ikon, label, nilai, sub, tone = "" }) {
  return (
    <div className="rounded-xl border border-line bg-surface2 p-3">
      <p className="text-[11px] font-bold text-muted">{ikon} {label}</p>
      <p className={`mt-0.5 text-lg font-black ${tone || "text-ink"}`}>{nilai}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  );
}

function Grafik({ hari }) {
  const maks = Math.max(1, ...hari.map((h) => h.komisi));
  return (
    <div>
      <div className="flex h-28 items-end gap-1" role="img" aria-label="Komisi 14 hari terakhir">
        {hari.map((h) => (
          <div key={h.tanggal} className="group relative flex-1">
            <div className="w-full rounded-t bg-amber/80 transition-all group-hover:bg-amber" style={{ height: `${Math.max(3, (h.komisi / maks) * 100)}%` }} />
            <span className="pointer-events-none absolute -top-14 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[10px] font-bold text-bg group-hover:block">
              {h.tanggal.slice(5)} · {h.pesanan} pesanan · {rupiah(h.komisi)} · {h.kunjungan} kunjungan
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted"><span>{hari[0]?.tanggal.slice(5)}</span><span>hari ini</span></div>
    </div>
  );
}

function Syarat() {
  return (
    <details open className={`${kartu} group p-5`} data-testid="rw-syarat">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-black text-ink">
        <span>📜 Syarat &amp; Ketentuan Web Reseller</span>
        <span className="text-xs font-bold text-muted group-open:hidden">Buka</span>
        <span className="hidden text-xs font-bold text-muted group-open:inline">Tutup</span>
      </summary>
      <ol className="mt-3 space-y-3">
        {SYARAT_RW.map((s, i) => (
          <li key={s.judul}>
            <p className="text-xs font-black text-ink">{i + 1}. {s.judul}</p>
            {s.isi.map((t) => <p key={t} className="mt-1 text-xs leading-relaxed text-muted">{t}</p>)}
          </li>
        ))}
      </ol>
    </details>
  );
}

export default function WebResellerPage() {
  const brand = useBrand();
  const { token, ready, refreshBalance } = useUser();
  const [d, setD] = useState(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState("");

  const [slug, setSlug] = useState("");
  const [nama, setNama] = useState("");
  const [markup, setMarkup] = useState("10");
  const [eNama, setENama] = useState("");
  const [eMarkup, setEMarkup] = useState("");
  const [setuju, setSetuju] = useState(false);
  const [wd, setWd] = useState({ amount: "", ewallet: "", nomor: "", atasNama: "" });

  const muat = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/web-reseller?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal memuat.");
      setD(j);
      if (j.web) { setENama(j.web.nama); setEMarkup(String(j.web.markupPersen)); }
      setGalat("");
    } catch (e) { setGalat(e.message); }
  }, [token]);
  useEffect(() => { if (ready) muat(); }, [ready, muat]);

  async function kirim(aksi, body, pesanOk) {
    setSibuk(aksi); setGalat(""); setInfo("");
    try {
      const r = await fetch("/api/web-reseller", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, aksi, ...body }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal.");
      setD((x) => ({ ...x, ...j }));
      if (j.web) { setENama(j.web.nama); setEMarkup(String(j.web.markupPersen)); }
      setInfo(pesanOk);
      return j;
    } catch (e) { setGalat(e.message); } finally { setSibuk(""); }
  }

  const slugBersih = slug.trim().toLowerCase();
  const slugOk = SLUG_RE.test(slugBersih) && !RESERVED.has(slugBersih);
  const pratinjau = useMemo(() => {
    const s = slugBersih || "namamu";
    return d?.subdomain ? `${s}${d.contohDomain}` : `…/r/${s}`;
  }, [slugBersih, d]);

  if (!ready || (!d && !galat)) return <div className="mx-auto max-w-3xl px-4 py-10"><div className="skeleton h-64 rounded-3xl" /></div>;
  if (!d) return <div className="mx-auto max-w-md px-4 py-16 text-center"><p className="font-black text-ink">{galat}</p></div>;

  const w = d.web;
  const st = d.statistik;
  const nominal = Math.round(Number(wd.amount) || 0);
  const diterima = Math.max(0, nominal - d.wd.biaya);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:py-10">
      <div className="fade-up rounded-3xl bg-gradient-to-br from-amber to-blue p-6 text-white shadow-lift">
        <p className="text-xs font-bold uppercase tracking-widest text-white/80">Web Reseller</p>
        <h1 className="mt-1 font-display text-2xl font-black">Punya web {brand.nama} sendiri</h1>
        <p className="mt-1 max-w-xl text-sm text-white/90">
          Buat web jualan nokos bermerek sendiri — isinya sama persis dengan web utama, harganya kamu atur. Keuntungan dari markup
          masuk jadi komisimu dan bisa ditarik otomatis ke e-wallet.
        </p>
      </div>

      {galat && <p className="rounded-xl bg-rose-soft px-4 py-2.5 text-xs font-bold text-rose" role="alert" data-testid="rw-galat">{galat}</p>}
      {info && <p className="rounded-xl bg-success-soft px-4 py-2.5 text-xs font-bold text-success" role="status" data-testid="rw-info">{info}</p>}

      <Syarat />

      {!w && (
        <div className={`${kartu} p-5`} data-testid="rw-buat">
          {!d.aktif ? (
            <p className="text-sm text-muted">Fitur web reseller sedang dimatikan admin. Coba lagi nanti.</p>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); kirim("buat", { slug: slugBersih, nama, markupPersen: Number(markup), setuju }, "Web resellermu sudah jadi! 🎉"); }}
              className="space-y-4"
            >
              <h2 className="text-base font-black text-ink">Buat web resellermu</h2>
              <p className="text-xs text-muted">Satu akun hanya bisa membuat <b>satu</b> web reseller. Nama web tidak bisa diganti setelah dibuat.</p>
              <div>
                <label className="text-xs font-bold text-muted">Nama web (untuk alamat)</label>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="contoh: tokobudi" maxLength={24} className={input} data-testid="rw-slug" autoCapitalize="none" autoCorrect="off" />
                <p className={`mt-1 text-[11px] ${slugBersih && !slugOk ? "font-bold text-rose" : "text-muted"}`}>
                  {slugBersih && !slugOk ? "3–24 karakter: huruf kecil, angka, dan tanda - (tidak di awal/akhir); beberapa nama dilarang." : <>Alamat webmu: <b className="text-ink">{pratinjau}</b></>}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Nama brand / merek web</label>
                <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="contoh: Budi Nokos" maxLength={40} className={input} data-testid="rw-nama" />
                <p className="mt-1 text-[11px] text-muted">Tampil sebagai nama web, judul tab, dan sapaan di seluruh webmu.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Markup keuntungan (%) — maks {d.markupMaks}%</label>
                <input type="number" min="0" max={d.markupMaks} step="0.5" value={markup} onChange={(e) => setMarkup(e.target.value)} className={input} data-testid="rw-markup" />
                <p className="mt-1 text-[11px] text-muted">Contoh: harga nokos {rupiah(10000)} dengan markup {Number(markup) || 0}% dijual {rupiah(Math.ceil(10000 * (1 + (Number(markup) || 0) / 100)))} — komisimu {rupiah(Math.ceil(10000 * (1 + (Number(markup) || 0) / 100)) - 10000)} per pesanan.</p>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface2 px-3 py-3 text-xs text-ink">
                <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} data-testid="rw-setuju" className="mt-0.5 h-4 w-4 accent-[rgb(var(--c-orange))]" />
                <span>Saya sudah membaca dan menyetujui <b>Syarat &amp; Ketentuan Web Reseller</b> di atas.</span>
              </label>
              <button type="submit" disabled={!slugOk || nama.trim().length < 2 || !setuju || sibuk === "buat"} data-testid="rw-buat-btn" className="btn-3d w-full rounded-2xl bg-amber py-3.5 text-sm font-black text-white disabled:opacity-50">
                {sibuk === "buat" ? <span className="inline-flex items-center gap-2"><Spinner className="h-4 w-4" /> Membuat…</span> : "🚀 Buat web reseller"}
              </button>
            </form>
          )}
        </div>
      )}

      {w && (
        <>
          <div className={`${kartu} p-5`} data-testid="rw-web">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-muted">Web resellermu</p>
                <p className="text-lg font-black text-ink" data-testid="rw-nama-web">{w.nama}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${w.dibekukan ? "bg-rose-soft text-rose" : w.aktif ? "bg-success-soft text-success" : "bg-surface2 text-muted"}`}>
                {w.dibekukan ? "Dibekukan admin" : w.aktif ? "Aktif" : "Dimatikan"}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-amber bg-amber-soft px-3 py-2.5">
              <code className="min-w-0 flex-1 truncate text-xs font-bold text-ink" data-testid="rw-tautan">{w.tautan}</code>
              <CopyButton value={w.tautan} />
              <a href={w.tautan} target="_blank" rel="noreferrer" className="rounded-lg bg-ink px-3 py-1.5 text-[11px] font-bold text-bg">Buka</a>
            </div>
            {d.subdomain && <p className="mt-2 text-[11px] text-muted">Tautan cadangan (jika subdomain belum aktif): <code>{d.tautanAlt}</code></p>}
            <p className="mt-2 text-[11px] text-muted">Pembeli yang membuka tautan ini tetap berada di webmu — tidak dialihkan ke web utama.</p>

            <form
              onSubmit={(e) => { e.preventDefault(); kirim("ubah", { nama: eNama, markupPersen: Number(eMarkup) }, "Perubahan tersimpan."); }}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <div>
                <label className="text-xs font-bold text-muted">Nama brand / merek</label>
                <input value={eNama} onChange={(e) => setENama(e.target.value)} maxLength={40} className={input} data-testid="rw-edit-nama" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Markup (%) — maks {d.markupMaks}%</label>
                <input type="number" min="0" max={d.markupMaks} step="0.5" value={eMarkup} onChange={(e) => setEMarkup(e.target.value)} className={input} data-testid="rw-edit-markup" />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="submit" disabled={!!sibuk} data-testid="rw-simpan" className="rounded-xl bg-ink px-4 py-2 text-xs font-bold text-bg disabled:opacity-60">{sibuk === "ubah" ? "Menyimpan…" : "Simpan"}</button>
                <button type="button" disabled={!!sibuk || w.dibekukan} onClick={() => kirim("ubah", { aktif: !w.aktif }, w.aktif ? "Web dimatikan sementara — pengunjung melihat web utama." : "Web diaktifkan lagi.")} className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-muted disabled:opacity-60">
                  {w.aktif ? "Matikan sementara" : "Aktifkan"}
                </button>
              </div>
            </form>
          </div>

          <div className={`${kartu} p-5`} data-testid="rw-statistik">
            <h2 className="text-sm font-black text-ink">📊 Statistik web</h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat ikon="👀" label="Kunjungan" nilai={st.kunjungan.toLocaleString("id-ID")} sub="sesi pengunjung" />
              <Stat ikon="🛒" label="Pesanan" nilai={st.pesananTotal.toLocaleString("id-ID")} sub={`${st.pesananSelesai} selesai`} />
              <Stat ikon="💵" label="Omzet" nilai={rupiah(st.omzet)} sub="pesanan selesai" />
              <Stat ikon="💰" label="Komisi total" nilai={rupiah(st.komisiTotal)} tone="text-success" sub={st.komisiTertunda ? `${rupiah(st.komisiTertunda)} menunggu OTP` : "semua sudah cair"} />
            </div>
            <div className="mt-4"><Grafik hari={st.hari} /></div>
            <h3 className="mt-5 text-xs font-black text-ink">Pesanan terbaru</h3>
            {st.terbaru.length === 0 ? (
              <p className="mt-2 text-xs text-muted">Belum ada pesanan. Bagikan tautan webmu ke calon pembeli!</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {st.terbaru.map((o, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0"><p className="truncate text-xs font-bold text-ink">{o.layanan} · {o.negara}</p><p className="text-[10px] text-muted">{timeAgo(o.waktu)} · {o.selesai ? "OTP masuk" : "menunggu OTP"}</p></div>
                    <span className={`shrink-0 text-xs font-black ${o.selesai ? "text-success" : "text-muted"}`}>+{rupiah(o.komisi)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`${kartu} p-5`} data-testid="rw-tarik">
            <h2 className="text-sm font-black text-ink">💸 Tarik komisi ke e-wallet</h2>
            <p className="mt-1 text-xs text-muted">Komisi cair saat kode OTP pembeli masuk. Penarikan otomatis lewat AustinPay.</p>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-surface2 px-4 py-3">
              <span className="text-xs font-bold text-muted">Saldo bisa ditarik</span>
              <span className="text-xl font-black text-ink" data-testid="rw-saldo">{rupiah(st.saldo)}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted">Minimal tarik {rupiah(d.wd.min)} · biaya admin {rupiah(d.wd.biaya)} dipotong dari nominal yang ditarik. Saldo ini juga dipakai QRIS Gateway-mu (kalau ada).</p>
            <form
              onSubmit={async (e) => { e.preventDefault(); const j = await kirim("tarik", { amount: nominal, ewallet: wd.ewallet, nomor: wd.nomor, atasNama: wd.atasNama }, "Penarikan diajukan. Dana dikirim otomatis ke e-walletmu, biasanya dalam beberapa menit."); if (j) { setWd((x) => ({ ...x, amount: "" })); refreshBalance?.(); } }}
              className="mt-3 grid gap-3 sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-muted">Nominal yang ditarik (Rp)</label>
                <input type="number" min={d.wd.min} value={wd.amount} onChange={(e) => setWd((x) => ({ ...x, amount: e.target.value }))} className={input} data-testid="rw-wd-nominal" placeholder={String(d.wd.min)} />
                {nominal > 0 && <p className="mt-1 text-[11px] text-muted">E-wallet menerima <b className="text-ink">{rupiah(diterima)}</b> (biaya {rupiah(d.wd.biaya)})</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-muted">E-wallet</label>
                <select value={wd.ewallet} onChange={(e) => setWd((x) => ({ ...x, ewallet: e.target.value }))} className={input} data-testid="rw-wd-ewallet">
                  <option value="">Pilih…</option>
                  {d.wd.dompet.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Nomor e-wallet</label>
                <input value={wd.nomor} onChange={(e) => setWd((x) => ({ ...x, nomor: e.target.value }))} inputMode="numeric" placeholder="08123456789" className={input} data-testid="rw-wd-nomor" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-muted">Atas nama</label>
                <input value={wd.atasNama} onChange={(e) => setWd((x) => ({ ...x, atasNama: e.target.value }))} maxLength={60} className={input} data-testid="rw-wd-nama" />
              </div>
              <button type="submit" disabled={!!sibuk || nominal < d.wd.min || nominal > st.saldo} data-testid="rw-wd-btn" className="btn-3d rounded-2xl bg-rose py-3 text-sm font-black text-white disabled:opacity-50 sm:col-span-2">
                {sibuk === "tarik" ? "Memproses…" : "Tarik sekarang"}
              </button>
            </form>
            <p className="mt-2 text-[11px] text-muted">Riwayat penarikan lengkap ada di <Link href="/gateway" className="font-bold text-amber-bright underline">QRIS Gateway</Link>.</p>
          </div>
        </>
      )}
    </div>
  );
}
