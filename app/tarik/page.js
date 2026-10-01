"use client";

// Tarik SALDO NOKOS ke e-wallet — otomatis lewat AustinPay (tanpa menunggu admin).
// Hanya saldo hasil DEPOSIT yang bisa ditarik; ada batas harian & biaya admin yang diatur admin.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/app/providers";
import { PageHeader, Alert, Spinner, rupiah, fmtWIB } from "@/components/ui";

const STATUS = {
  sukses: ["✅ Berhasil", "text-success"],
  proses: ["⏳ Diproses", "text-amber-bright"],
  baru: ["⏳ Diproses", "text-amber-bright"],
  dikirim: ["⏳ Diproses", "text-amber-bright"],
  "tidak-pasti": ["⏳ Memastikan…", "text-amber-bright"],
  gagal: ["❌ Gagal (saldo kembali)", "text-rose"]
};
const AKTIF = ["proses", "baru", "dikirim", "tidak-pasti"];

export default function TarikPage() {
  const { token, refreshBalance } = useUser();
  const [info, setInfo] = useState(null);
  const [wallet, setWallet] = useState("DANA");
  const [nomor, setNomor] = useState("");
  const [nama, setNama] = useState("");
  const [nominal, setNominal] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState(null);
  const poll = useRef(null);

  const muat = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/tarik?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const d = await r.json();
      if (r.ok) { setInfo(d); setWallet((w) => (d.dompet?.includes(w) ? w : d.dompet?.[0] || w)); }
    } catch {}
  }, [token]);
  useEffect(() => { muat(); }, [muat]);
  // Selama ada penarikan yang masih berjalan, segarkan otomatis.
  useEffect(() => {
    clearInterval(poll.current);
    if (info?.riwayat?.some((x) => AKTIF.includes(x.status))) poll.current = setInterval(() => { muat(); refreshBalance?.(); }, 6000);
    return () => clearInterval(poll.current);
  }, [info, muat, refreshBalance]);

  const n = Math.floor(Number(nominal) || 0);
  const fee = info?.feeRp || 0;
  const total = n > 0 ? n + fee : 0;
  const sisaRp = info ? Math.max(0, info.maksRpHari - info.terpakaiRpHariIni) : 0;

  async function ajukan(e) {
    e.preventDefault();
    if (sibuk) return;
    setSibuk(true); setPesan(null);
    try {
      const r = await fetch("/api/tarik", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, wallet, nomor, nama, nominal: n }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal mengajukan penarikan.");
      const s = d.wd?.status;
      setPesan(
        s === "sukses" ? { ok: true, teks: `Berhasil! ${rupiah(n)} sudah dikirim ke ${wallet} ${nomor}.` }
        : s === "gagal" ? { ok: false, teks: `Penarikan gagal${d.wd?.pesan ? ` (${d.wd.pesan})` : ""}. Saldo kamu sudah dikembalikan.` }
        : { ok: true, teks: `Penarikan ${rupiah(n)} sedang diproses. Status akan berubah otomatis — kamu juga dapat notifikasi.` }
      );
      setNominal("");
      refreshBalance?.(); muat();
    } catch (err) { setPesan({ ok: false, teks: err.message }); } finally { setSibuk(false); }
  }

  const dapat = info?.dapatDitarik || 0;
  const maksNominal = info ? Math.max(0, Math.min(info.maksRp, dapat - fee, sisaRp)) : 0;

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader title="Tarik Saldo" icon={<span className="text-xl">💸</span>} desc="Cairkan saldo nokos ke e-wallet. Otomatis, tanpa menunggu admin." />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="manga-card p-5 sm:p-6" data-testid="halaman-tarik">
          <div className="mb-5 rounded-2xl border border-line bg-surface2 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Bisa ditarik sekarang</p>
            <b className="text-3xl tabular-nums text-ink" data-testid="tarik-dapat">{info ? rupiah(dapat) : "…"}</b>
            <p className="mt-1 text-[11px] text-muted">Saldo nokos total {info ? rupiah(info.saldo) : "…"}{info && info.saldo > dapat ? <> · tidak bisa ditarik <b>{rupiah(info.saldo - dapat)}</b></> : null}. Hanya saldo hasil <b>deposit</b> yang bisa ditarik. Saldo dari voucher, hadiah, misi, spin, poin, cashback, referral, transfer masuk, hasil tukar poin game, atau tambahan admin <b>tidak bisa ditarik</b> (tetap bisa dipakai belanja nokos). Saat belanja, saldo bonus dipakai lebih dulu.</p>
          </div>

          {info && !info.aktif ? <Alert>Penarikan saldo sedang dinonaktifkan atau belum tersedia. Coba lagi nanti.</Alert> : (
            <form onSubmit={ajukan} className="space-y-3">
              <div>
                <p className="label">E-wallet tujuan</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="E-wallet tujuan">
                  {(info?.dompet || ["DANA", "GoPay", "ShopeePay"]).map((w) => (
                    <button key={w} type="button" role="radio" aria-checked={wallet === w} onClick={() => setWallet(w)} data-testid={`wd-${w}`} className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${wallet === w ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-ink"}`}>{w}</button>
                  ))}
                </div>
              </div>
              <input value={nomor} onChange={(e) => setNomor(e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 20))} inputMode="tel" placeholder="Nomor e-wallet (mis. 081234567890)" className="field w-full" aria-label="Nomor e-wallet" data-testid="wd-nomor" />
              <input value={nama} onChange={(e) => setNama(e.target.value.slice(0, 60))} placeholder="Nama pemilik e-wallet (opsional, untuk catatan)" className="field w-full" aria-label="Nama pemilik e-wallet" />
              <div>
                <label className="label" htmlFor="wd-nominal">Nominal yang DITERIMA</label>
                <div className="field-3d flex items-center px-4">
                  <span className="text-lg font-extrabold text-amber-bright">Rp</span>
                  <input id="wd-nominal" inputMode="numeric" value={nominal} onChange={(e) => setNominal(e.target.value.replace(/\D/g, ""))} placeholder={String(info?.minRp || 10000)} className="w-full bg-transparent px-2 py-3 text-2xl font-extrabold tabular-nums text-ink outline-none" data-testid="wd-nominal" />
                  <button type="button" onClick={() => setNominal(String(maksNominal))} className="rounded-lg border border-line px-2 py-1 text-[11px] font-black text-ink">Maks</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[10000, 20000, 50000, 100000].filter((x) => !info || x >= info.minRp).map((x) => (
                    <button key={x} type="button" onClick={() => setNominal(String(x))} className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${n === x ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-ink"}`}>{rupiah(x)}</button>
                  ))}
                </div>
              </div>
              <div className="panel-3d divide-y divide-line px-4 text-sm">
                <div className="flex justify-between py-2"><span className="text-muted">Kamu terima</span><b className="text-success" data-testid="wd-terima">{n ? rupiah(n) : "—"}</b></div>
                <div className="flex justify-between py-2"><span className="text-muted">Biaya admin</span><b>{info ? rupiah(fee) : "—"}</b></div>
                <div className="flex justify-between py-2"><span className="text-muted">Saldo dipotong</span><b data-testid="wd-total">{n ? rupiah(total) : "—"}</b></div>
              </div>
              {pesan && <Alert tone={pesan.ok ? "green" : "red"}><span data-testid="wd-pesan">{pesan.teks}</span></Alert>}
              <button type="submit" disabled={sibuk || !info?.aktif || n < (info?.minRp || 10000) || !nomor} className="btn-primary w-full" data-testid="wd-kirim">{sibuk ? <Spinner /> : null}{sibuk ? "Memproses… (jangan tutup halaman)" : "Tarik sekarang"}</button>
              <p className="text-center text-[11px] text-muted">Minimal {info ? rupiah(info.minRp) : "Rp10.000"} · maks {info ? rupiah(info.maksRp) : "—"} per penarikan · sisa kuota hari ini {info ? `${info.sisaHariIni}× / ${rupiah(sisaRp)}` : "…"}</p>
            </form>
          )}

          <p className="mt-6 text-sm font-extrabold text-ink">Riwayat penarikan</p>
          {!info?.riwayat?.length ? <p className="mt-2 text-xs text-muted">Belum ada penarikan.</p> : (
            <ul className="mt-2 divide-y divide-line" data-testid="wd-riwayat">
              {info.riwayat.map((x) => {
                const [label, warna] = STATUS[x.status] || [x.status, "text-muted"];
                return (
                  <li key={x.id} className="py-2.5 text-xs" data-testid="wd-baris">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0"><b className="text-ink">{rupiah(x.nominal)}</b> ke {x.wallet} {x.nomor}<span className="block text-[10px] text-muted">{x.id} · {fmtWIB(x.dibuat)}{x.total ? ` · dipotong ${rupiah(x.total)}` : ""}</span></span>
                      <span className={`shrink-0 font-bold ${warna}`}>{label}</span>
                    </div>
                    {x.pesan && <p className="mt-1 text-[11px] text-muted">{x.pesan}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="space-y-4">
          <div className="panel-3d p-4">
            <p className="text-sm font-extrabold text-ink">Ketentuan penarikan</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
              <li>Minimal <b>{info ? rupiah(info.minRp) : "Rp10.000"}</b>, biaya admin <b>{info ? rupiah(info.feeRp) : "Rp2.000"}</b> per penarikan.</li>
              <li>Maksimal <b>{info?.maksHari ?? 5}× per hari</b> (reset 00.00 WIB){info ? `, total ${rupiah(info.maksRpHari)}/hari` : ""}.</li>
              <li>Dikirim <b>otomatis</b> — biasanya masuk dalam hitungan detik–menit. Bila gagal, saldo dikembalikan otomatis.</li>
              <li>Pastikan nomor e-wallet benar. Uang yang sudah terkirim tidak bisa ditarik kembali.</li>
              <li>Satu nomor tujuan tidak boleh dipakai banyak akun.</li>
            </ul>
            <Link href="/riwayat" className="btn-ghost mt-3 block text-center">Lihat mutasi saldo</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
