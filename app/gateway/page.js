"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import { rupiah } from "@/components/ui";
import GatewayTerms from "@/components/GatewayTerms";

const TAB = [
  { id: "buat", label: "Buat QRIS", ikon: "⚡" },
  { id: "riwayat", label: "Tagihan", ikon: "🧾" },
  { id: "tarik", label: "Tarik & Konversi", ikon: "🏦" },
  { id: "api", label: "API Key", ikon: "🔑" }
];

const CEPAT = [5000, 10000, 25000, 50000, 100000, 500000];

function Uang({ nilai, besar = false, warna = "text-ink" }) {
  return (
    <span className={`${besar ? "text-3xl sm:text-4xl" : "text-lg"} font-black tabular-nums ${warna}`}>
      {rupiah(nilai)}
    </span>
  );
}

function Lencana({ status }) {
  const peta = {
    paid: { t: "LUNAS", c: "bg-success-soft text-success border-success" },
    pending: { t: "MENUNGGU", c: "bg-amber-soft text-amber-bright border-amber" },
    expired: { t: "KEDALUWARSA", c: "bg-rose-soft text-rose border-rose/60" },
    done: { t: "SELESAI", c: "bg-success-soft text-success border-success" },
    rejected: { t: "DITOLAK", c: "bg-rose-soft text-rose border-rose/60" }
  };
  const p = peta[status] || { t: String(status || "-").toUpperCase(), c: "bg-surface2 text-muted border-line" };
  return <span className={`shrink-0 rounded-full border-2 px-2 py-0.5 text-[10px] font-black ${p.c}`}>{p.t}</span>;
}

export default function GatewayPage() {
  const { token } = useUser();
  const [tab, setTab] = useState("buat");
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState({ teks: "", ok: true });

  const [nominal, setNominal] = useState("");
  const [ref, setRef] = useState("");
  const [membuat, setMembuat] = useState(false);
  const [tagihanAktif, setTagihanAktif] = useState(null);

  const [wdNominal, setWdNominal] = useState("");
  const [wdEwallet, setWdEwallet] = useState("dana");
  const [wdNomor, setWdNomor] = useState("");
  const [wdNama, setWdNama] = useState("");
  const [wdSibuk, setWdSibuk] = useState(false);

  const [konvNominal, setKonvNominal] = useState("");
  const [konvSibuk, setKonvSibuk] = useState(false);

  const [cbUrl, setCbUrl] = useState("");
  const [keySibuk, setKeySibuk] = useState(false);
  const [keyTampil, setKeyTampil] = useState(false);

  const kabar = (teks, ok = true) => {
    setPesan({ teks, ok });
    setTimeout(() => setPesan({ teks: "", ok: true }), 4000);
  };

  const muat = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/gateway?token=${encodeURIComponent(token)}`);
      const d = await r.json();
      if (r.ok) {
        setData(d);
        setCbUrl(d.callbackUrl || "");
      }
    } catch {}
    setMemuat(false);
  }, [token]);

  useEffect(() => { muat(); }, [muat]);

  // Tagihan yang sedang terbuka dicek berkala sampai lunas atau kedaluwarsa.
  useEffect(() => {
    if (!tagihanAktif || tagihanAktif.status !== "pending" || !token) return undefined;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/gateway/invoice?token=${encodeURIComponent(token)}&id=${tagihanAktif.invoiceId}`);
        const d = await r.json();
        if (d?.invoice) {
          setTagihanAktif(d.invoice);
          if (d.invoice.status === "paid") { kabar(`Pembayaran ${rupiah(d.invoice.diterima)} masuk!`); muat(); }
          if (d.invoice.status === "expired") muat();
        }
      } catch {}
    }, 4000);
    return () => clearInterval(t);
  }, [tagihanAktif, token, muat]);

  async function buatQris(e) {
    e.preventDefault();
    setMembuat(true);
    try {
      const r = await fetch("/api/gateway/invoice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amount: Number(nominal), ref })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal membuat QRIS.");
      setTagihanAktif(d.invoice);
      setNominal(""); setRef("");
      muat();
    } catch (err) { kabar(err.message, false); }
    finally { setMembuat(false); }
  }

  async function tarik(e) {
    e.preventDefault();
    setWdSibuk(true);
    try {
      const r = await fetch("/api/gateway/withdraw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amount: Number(wdNominal), ewallet: wdEwallet, nomor: wdNomor, atasNama: wdNama })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal mengajukan penarikan.");
      kabar("Penarikan diajukan. Admin memproses biasanya dalam 1×24 jam.");
      setWdNominal("");
      muat();
    } catch (err) { kabar(err.message, false); }
    finally { setWdSibuk(false); }
  }

  async function konversi(e) {
    e.preventDefault();
    setKonvSibuk(true);
    try {
      const r = await fetch("/api/gateway/convert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amount: Number(konvNominal) })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal mengonversi.");
      kabar(`${rupiah(d.amount)} masuk ke saldo Arta Pedia.`);
      setKonvNominal("");
      muat();
    } catch (err) { kabar(err.message, false); }
    finally { setKonvSibuk(false); }
  }

  async function kirimKey(aksi) {
    if (aksi === "ganti" && !confirm("Ganti API key? Kunci lama LANGSUNG tidak berlaku, dan semua bot/web yang memakainya akan berhenti bekerja sampai kamu perbarui kuncinya di sana.")) return;
    setKeySibuk(true);
    try {
      const r = await fetch("/api/gateway/apikey", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, aksi, callbackUrl: cbUrl })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal.");
      kabar(aksi === "ganti" ? "API key baru dibuat." : "Callback URL tersimpan.");
      muat();
    } catch (err) { kabar(err.message, false); }
    finally { setKeySibuk(false); }
  }

  if (!token) {
    return (
      <div className="gw-shell mx-auto max-w-content px-4 py-10">
        <div className="card p-8 text-center">
          <p className="text-4xl">🔒</p>
          <h1 className="font-display mt-3 text-xl font-black text-ink">Buka akunmu dulu</h1>
          <p className="mt-2 text-sm text-muted">QRIS Gateway memakai kode akun Arta Pedia yang sama.</p>
          <Link href="/" className="btn-primary press mt-5 inline-flex">← Ke Beranda</Link>
        </div>
      </div>
    );
  }

  const b = data?.batas;

  return (
    <div className="gw-shell panggung-3d mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-8">
      {/* Syarat & ketentuan, sekali per akun sebelum fiturnya dipakai. */}
      <GatewayTerms token={token} />
      {/* ── Kepala ── */}
      <div className="gw-hero card balok-3d tepi-tebal relative overflow-hidden p-5 sm:p-7">
        <span className="gw-hero-glow" aria-hidden="true" />
        <div className="relative timbul">
          <div className="flex items-center gap-2">
            <span className="rounded-full border-2 border-ink bg-amber px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
              Gateway
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Tanpa berkas usaha</span>
          </div>
          <h1 className="font-display mt-2 text-2xl font-black leading-tight tracking-tight text-ink sm:text-3xl">
            QRIS GATEWAY
          </h1>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">
            Terima pembayaran QRIS otomatis. Tinggal masukkan nominal, QR-nya jadi — atau sambungkan ke
            bot dan web kamu sendiri lewat API.
          </p>

          <div className="mt-5 rounded-2xl border-2 border-ink bg-surface2 p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-muted">Saldo gateway</p>
            {memuat ? (
              <div className="skeleton mt-1 h-9 w-40 rounded-lg" />
            ) : (
              <Uang nilai={data?.saldo} besar warna="text-success" />
            )}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Lunas", data?.jumlahLunas ?? 0],
                ["Menunggu", data?.jumlahPending ?? 0],
                ["Total masuk", rupiah(data?.totalMasuk ?? 0)]
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl border-2 border-ink/15 bg-surface p-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{l}</p>
                  <p className="mt-0.5 text-sm font-black tabular-nums text-ink">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {data?.dibekukan && (
            <p className="mt-3 rounded-xl border-2 border-rose bg-rose-soft px-3 py-2 text-xs font-bold text-rose">
              ⚠️ Akun gateway kamu sedang dibekukan admin. Tagihan baru dan penarikan tidak bisa dibuat.
            </p>
          )}
        </div>
      </div>

      {/* ── Tab ── */}
      <div className="mt-5 grid grid-cols-4 gap-1.5">
        {TAB.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`press rounded-2xl border-2 px-2 py-2.5 text-center transition ${
              tab === t.id ? "border-ink bg-amber text-white" : "border-line bg-surface text-muted"
            }`}
          >
            <span className="block text-base leading-none">{t.ikon}</span>
            <span className="mt-1 block text-[10px] font-black uppercase tracking-wide">{t.label}</span>
          </button>
        ))}
      </div>

      {pesan.teks && (
        <p className={`mt-4 rounded-xl border-2 px-3 py-2 text-xs font-bold ${
          pesan.ok ? "border-success bg-success-soft text-success" : "border-rose bg-rose-soft text-rose"
        }`}>{pesan.teks}</p>
      )}

      {/* ── BUAT QRIS ── */}
      {tab === "buat" && (
        <div className="mt-4 space-y-4">
          {tagihanAktif ? (
            <div className="card p-5 text-center">
              <Lencana status={tagihanAktif.status} />
              <p className="mt-3"><Uang nilai={tagihanAktif.amount} besar /></p>
              <p className="mt-1 text-xs text-muted">
                Diterima bersih {rupiah(tagihanAktif.diterima)} · biaya {rupiah(tagihanAktif.biaya)}
              </p>

              {tagihanAktif.status === "pending" && tagihanAktif.qrString && (
                <img
                  alt="QRIS pembayaran"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(tagihanAktif.qrString)}`}
                  className="mx-auto mt-4 h-60 w-60 rounded-2xl border-2 border-ink bg-white p-2"
                />
              )}
              {tagihanAktif.status === "paid" && <p className="mt-4 text-5xl">✅</p>}
              {tagihanAktif.status === "expired" && <p className="mt-4 text-5xl">⏰</p>}

              <p className="mt-3 text-[11px] text-muted">
                ID: <code className="font-bold text-ink">{tagihanAktif.invoiceId}</code>
              </p>
              {tagihanAktif.paymentUrl && tagihanAktif.status === "pending" && (
                <a href={tagihanAktif.paymentUrl} target="_blank" rel="noreferrer" className="btn-ghost press mt-3 w-full text-xs">
                  Buka halaman bayar ↗
                </a>
              )}
              <button onClick={() => setTagihanAktif(null)} className="btn-primary press mt-2 w-full">
                Buat tagihan baru
              </button>
            </div>
          ) : (
            <form onSubmit={buatQris} className="card p-5">
              <label className="text-xs font-black uppercase tracking-wide text-muted">Nominal tagihan</label>
              <div className="mt-1.5 flex items-center gap-2 rounded-2xl border-2 border-ink bg-surface px-3 py-3">
                <span className="text-lg font-black text-amber-bright">Rp</span>
                <input
                  type="number" inputMode="numeric" value={nominal}
                  onChange={(e) => setNominal(e.target.value)}
                  min={b?.invoiceMin} max={b?.invoiceMax} required
                  placeholder="0"
                  className="w-full bg-transparent text-2xl font-black tabular-nums text-ink outline-none"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                Min {rupiah(b?.invoiceMin ?? 2000)} · Maks {rupiah(b?.invoiceMax ?? 10000000)} ·
                biaya {rupiah(b?.biayaQris ?? 250)} per tagihan yang dibayar
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {CEPAT.map((v) => (
                  <button key={v} type="button" onClick={() => setNominal(String(v))}
                    className="press rounded-xl border-2 border-ink bg-surface py-2 text-xs font-black text-ink">
                    {rupiah(v)}
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-xs font-black uppercase tracking-wide text-muted">
                Catatan / nomor pesanan <span className="font-medium normal-case text-muted/70">(opsional)</span>
              </label>
              <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120}
                placeholder="ORDER-123" className="mt-1.5 input w-full text-sm" />

              <button type="submit" disabled={membuat || data?.dibekukan} className="btn-primary press mt-4 w-full">
                {membuat ? "Membuat QRIS…" : "⚡ Buat QRIS Sekarang"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── TAGIHAN ── */}
      {tab === "riwayat" && (
        <div className="mt-4 card p-4">
          <h2 className="font-display text-base font-black text-ink">Tagihan terakhir</h2>
          {memuat ? <div className="skeleton mt-3 h-24 rounded-xl" /> : !data?.tagihan?.length ? (
            <p className="mt-3 text-sm text-muted">Belum ada tagihan. Buat yang pertama di tab Buat QRIS.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {data.tagihan.map((t) => (
                <li key={t.invoiceId} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black tabular-nums text-ink">{rupiah(t.amount)}</p>
                    <p className="truncate text-[11px] text-muted">
                      <code>{t.invoiceId}</code>{t.merchantRef ? ` · ${t.merchantRef}` : ""}
                    </p>
                    {t.status === "paid" && (
                      <p className="text-[11px] font-bold text-success">+{rupiah(t.diterima)} masuk saldo</p>
                    )}
                  </div>
                  <Lencana status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── TARIK & KONVERSI ── */}
      {tab === "tarik" && (
        <div className="mt-4 space-y-4">
          <form onSubmit={tarik} className="card p-5">
            <h2 className="font-display text-base font-black text-ink">🏦 Tarik ke e-wallet</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Min {rupiah(b?.wdMin ?? 5000)} · biaya {rupiah(b?.biayaWd ?? 1000)} per penarikan.
              Diproses admin, biasanya 1×24 jam.
            </p>

            <label className="mt-3 block text-xs font-black uppercase tracking-wide text-muted">Nominal</label>
            <input type="number" inputMode="numeric" value={wdNominal} onChange={(e) => setWdNominal(e.target.value)}
              min={b?.wdMin} required placeholder={String(b?.wdMin ?? 5000)} className="mt-1.5 input w-full text-sm" />
            {Number(wdNominal) >= (b?.wdMin ?? 5000) && (
              <p className="mt-1 text-[11px] font-bold text-success">
                Sampai ke e-wallet: {rupiah(Number(wdNominal) - (b?.biayaWd ?? 1000))}
              </p>
            )}

            <label className="mt-3 block text-xs font-black uppercase tracking-wide text-muted">E-wallet</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(b?.ewallet || []).map((e) => (
                <button key={e.kode} type="button" onClick={() => setWdEwallet(e.kode)}
                  className={`press rounded-xl border-2 py-2 text-xs font-black ${
                    wdEwallet === e.kode ? "border-ink bg-amber text-white" : "border-line bg-surface text-ink"
                  }`}>{e.nama}</button>
              ))}
            </div>

            <label className="mt-3 block text-xs font-black uppercase tracking-wide text-muted">Nomor e-wallet</label>
            <input value={wdNomor} onChange={(e) => setWdNomor(e.target.value)} required
              placeholder={(b?.ewallet || []).find((x) => x.kode === wdEwallet)?.contoh || "08123456789"}
              className="mt-1.5 input w-full text-sm" />

            <label className="mt-3 block text-xs font-black uppercase tracking-wide text-muted">Atas nama</label>
            <input value={wdNama} onChange={(e) => setWdNama(e.target.value)} required maxLength={60}
              placeholder="Nama pemilik e-wallet" className="mt-1.5 input w-full text-sm" />

            <p className="mt-3 rounded-xl border-2 border-amber/40 bg-amber-soft px-3 py-2 text-[11px] leading-relaxed text-ink">
              ⚠️ Periksa nomornya dua kali. Uang yang terkirim ke nomor yang salah tidak bisa ditarik kembali.
            </p>

            <button type="submit" disabled={wdSibuk || data?.dibekukan} className="btn-primary press mt-3 w-full">
              {wdSibuk ? "Mengajukan…" : "Ajukan Penarikan"}
            </button>
          </form>

          <form onSubmit={konversi} className="card p-5">
            <h2 className="font-display text-base font-black text-ink">🔄 Jadikan saldo Arta Pedia</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Tanpa biaya — uangnya cuma pindah dompet, tidak keluar ke mana-mana. Langsung bisa dipakai beli nokos.
            </p>
            <p className="mt-2 text-xs text-muted">
              Saldo Arta Pedia sekarang: <b className="text-ink">{rupiah(data?.saldoArta ?? 0)}</b>
            </p>
            <input type="number" inputMode="numeric" value={konvNominal} onChange={(e) => setKonvNominal(e.target.value)}
              min={b?.konversiMin} required placeholder={String(b?.konversiMin ?? 1000)}
              className="mt-3 input w-full text-sm" />
            <button type="submit" disabled={konvSibuk} className="btn-ghost press mt-3 w-full">
              {konvSibuk ? "Memproses…" : "Konversi ke Saldo Arta Pedia"}
            </button>
          </form>

          {!!data?.penarikan?.length && (
            <div className="card p-4">
              <h2 className="font-display text-base font-black text-ink">Penarikan terakhir</h2>
              <ul className="mt-3 divide-y divide-line">
                {data.penarikan.map((w) => (
                  <li key={w.wdId} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black tabular-nums text-ink">{rupiah(w.diterima)}</p>
                      <p className="truncate text-[11px] text-muted">{w.ewalletNama} · {w.nomor}</p>
                      {w.alasan && <p className="text-[11px] text-rose">{w.alasan}</p>}
                    </div>
                    <Lencana status={w.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── API KEY ── */}
      {tab === "api" && (
        <div className="mt-4 space-y-4">
          <div className="card p-5">
            <h2 className="font-display text-base font-black text-ink">🔑 API Key</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Dipakai bot atau web kamu untuk membuat tagihan sendiri.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border-2 border-ink bg-surface2 px-3 py-2.5">
              <code className="min-w-0 flex-1 truncate text-xs font-bold text-ink">
                {keyTampil ? data?.apiKey : "apk_" + "•".repeat(28)}
              </code>
              <button onClick={() => setKeyTampil((v) => !v)} className="shrink-0 text-xs font-bold text-amber-bright">
                {keyTampil ? "Sembunyi" : "Lihat"}
              </button>
              <button onClick={() => { navigator.clipboard?.writeText(data?.apiKey || ""); kabar("API key disalin."); }}
                className="shrink-0 text-xs font-bold text-amber-bright">Salin</button>
            </div>
            <p className="mt-2 rounded-xl border-2 border-rose/40 bg-rose-soft px-3 py-2 text-[11px] leading-relaxed text-ink">
              🔒 Rahasiakan kunci ini. Siapa pun yang memegangnya bisa membuat tagihan atas namamu dan melihat saldomu.
              Jangan pernah menaruhnya di kode yang dijalankan di peramban.
            </p>
            <button onClick={() => kirimKey("ganti")} disabled={keySibuk}
              className="btn-ghost press mt-3 w-full text-xs">Ganti API Key</button>
          </div>

          <div className="card p-5">
            <h2 className="font-display text-base font-black text-ink">📡 Callback URL</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Kami kirim pemberitahuan ke alamat ini saat tagihan dibayar. Harus https://
            </p>
            <input value={cbUrl} onChange={(e) => setCbUrl(e.target.value)} maxLength={300}
              placeholder="https://botkamu.com/callback" className="mt-3 input w-full text-sm" />
            <button onClick={() => kirimKey("callback")} disabled={keySibuk}
              className="btn-primary press mt-3 w-full text-sm">Simpan Callback URL</button>
          </div>

          <Link href="/gateway/docs" className="card balok-3d press block p-5 text-center">
            <p className="text-3xl">📘</p>
            <p className="font-display mt-2 text-base font-black text-ink">Dokumentasi API Lengkap</p>
            <p className="mt-1 text-xs text-muted">Contoh siap salin untuk cURL, PHP, Node.js, dan Python.</p>
          </Link>
        </div>
      )}
    </div>
  );
}
