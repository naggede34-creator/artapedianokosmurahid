"use client";

// Isi SALDO GAME: dompet terpisah dari saldo nokos, dipakai untuk duel & game solo di WEARTA CHAT.
// Hanya lewat QRIS manual; bukti transfer dibaca otomatis (OCR) bila admin menyalakannya, selain itu dicek admin.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/app/providers";
import { PageHeader, Alert, CopyButton, Spinner, rupiah, fmtWIB } from "@/components/ui";

const QUICK = [10000, 20000, 50000, 100000, 200000];
const FINAL = ["completed", "canceled", "expired", "failed"];
const PROOF_MAX_SIDE = 2400;
const PROOF_MAX_CHARS = 780_000;

export default function GameDepositPage() {
  const { token, gameBalance, refreshBalance } = useUser();
  const [cfg, setCfg] = useState({ manual: null, min: 2000, max: 1000000 });
  const [step, setStep] = useState("amount");
  const [amount, setAmount] = useState("");
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [proof, setProof] = useState(null);
  const [proofNote, setProofNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [alasan, setAlasan] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [riwayat, setRiwayat] = useState([]);
  const pollRef = useRef(null);
  const restored = useRef(false);

  useEffect(() => {
    fetch("/api/settings/public").then((r) => r.json()).then((d) => setCfg({ manual: d.manualDeposit || null, min: d.depositMin || 2000, max: d.depositMax || 1000000 })).catch(() => {});
  }, []);

  const muatRiwayat = useCallback(() => {
    if (!token) return;
    fetch(`/api/mutasi?token=${encodeURIComponent(token)}&dompet=game`).then((r) => r.json()).then((d) => setRiwayat((d.items || []).slice(0, 12))).catch(() => {});
  }, [token]);
  useEffect(() => { muatRiwayat(); }, [muatRiwayat]);

  const cek = useCallback(async (orderId) => {
    if (!token || !orderId) return null;
    try {
      const r = await fetch(`/api/deposit/status?order_id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`);
      const d = await r.json();
      if (!r.ok) return null;
      setStatus(d.status);
      if (FINAL.includes(d.status)) { clearInterval(pollRef.current); if (d.status === "completed") { refreshBalance(); muatRiwayat(); } }
      return d.status;
    } catch { return null; }
  }, [token, refreshBalance, muatRiwayat]);

  const mulaiPoll = useCallback((orderId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => cek(orderId), 8000);
  }, [cek]);
  useEffect(() => () => clearInterval(pollRef.current), []);

  // Pulihkan tagihan game yang masih aktif setelah halaman dimuat ulang.
  useEffect(() => {
    if (!token || restored.current) return;
    restored.current = true;
    fetch(`/api/deposit/detail?token=${encodeURIComponent(token)}&wallet=game`).then((r) => r.json()).then((d) => {
      if (d.item && ["pending", "review"].includes(d.item.status)) {
        setOrder(d.item); setStatus(d.item.status); setStep("payment"); mulaiPoll(d.item.orderId);
      }
    }).catch(() => {});
  }, [token, mulaiPoll]);

  useEffect(() => {
    if (step !== "payment" || FINAL.includes(status)) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step, status]);

  const amt = Math.floor(Number(amount) || 0);
  const manual = cfg.manual;
  const tutup = manual ? manual.open === false : false;

  async function buat(e) {
    e?.preventDefault();
    if (loading) return;
    if (amt < cfg.min || amt > cfg.max) { setError(`Nominal harus antara ${rupiah(cfg.min)} dan ${rupiah(cfg.max)}.`); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/deposit/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, amount: amt, provider: "manual", wallet: "game" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal membuat tagihan.");
      setOrder(d); setStatus("pending"); setStep("payment"); setAlasan([]); setProof(null); setConfirmOpen(false);
      mulaiPoll(d.orderId);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  function pilihBukti(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError("Foto bukti terlalu besar. Maksimal 8MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        let hasil = null;
        for (const [sisi, mutu] of [[PROOF_MAX_SIDE, 0.85], [PROOF_MAX_SIDE, 0.7], [1800, 0.75], [1400, 0.75], [1100, 0.7], [900, 0.6]]) {
          const ratio = Math.min(sisi / img.width, sisi / img.height, 1);
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * ratio); c.height = Math.round(img.height * ratio);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          hasil = c.toDataURL("image/jpeg", mutu);
          if (hasil.length <= PROOF_MAX_CHARS) break;
        }
        setProof(hasil); setError("");
      };
      img.onerror = () => setError("Berkas itu bukan gambar yang bisa dibaca.");
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function kirim() {
    if (!order || !proof) { setError("Unggah bukti transfernya dulu ya."); return; }
    setConfirming(true); setError("");
    try {
      const r = await fetch("/api/deposit/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, orderId: order.orderId, proofImage: proof, note: proofNote }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal mengirim konfirmasi.");
      setAlasan(Array.isArray(d.alasan) ? d.alasan : []);
      setStatus(d.status || "review"); setConfirmOpen(false);
      if (d.status === "completed") { clearInterval(pollRef.current); refreshBalance(); muatRiwayat(); }
    } catch (err) { setError(err.message); } finally { setConfirming(false); }
  }

  async function batalkan() {
    if (!order) return;
    try {
      await fetch("/api/deposit/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, orderId: order.orderId }) });
    } catch {}
    ulang();
  }
  function ulang() {
    clearInterval(pollRef.current);
    setOrder(null); setStatus("pending"); setStep("amount"); setAmount(""); setProof(null); setProofNote(""); setAlasan([]); setError(""); setConfirmOpen(false);
  }

  const sisa = order?.expiredAt ? Math.max(0, Math.ceil((new Date(order.expiredAt).getTime() - now) / 1000)) : null;
  const bayar = order ? Number(order.totalAmount || order.amount) : 0;
  const kode = order?.manualInfo?.kodeUnik || 0;

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader title="Isi Saldo Game" icon={<span className="text-xl">🎮</span>} desc="Saldo game dipakai untuk duel dan game solo di WEARTA CHAT — terpisah dari saldo nokos." />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="manga-card p-5 sm:p-6" data-testid="game-deposit">
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-line bg-surface2 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Saldo game kamu</span>
            <b className="text-xl tabular-nums text-ink" data-testid="saldo-game-nilai">{rupiah(gameBalance || 0)}</b>
          </div>

          {step === "amount" && (
            <form onSubmit={buat}>
              <label className="label" htmlFor="gd-amount">Mau isi berapa?</label>
              <div className="field-3d flex items-center px-4">
                <span className="text-lg font-extrabold text-amber-bright">Rp</span>
                <input id="gd-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="0" className="w-full bg-transparent px-2 py-3 text-2xl font-extrabold tabular-nums text-ink outline-none" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK.filter((n) => n >= cfg.min && n <= cfg.max).map((n) => (
                  <button key={n} type="button" onClick={() => setAmount(String(n))} className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${amt === n ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-ink"}`}>{rupiah(n)}</button>
                ))}
              </div>
              {manual?.ocrAktif && (
                <p className="mt-4 rounded-xl border border-amber/40 bg-amber-soft px-3 py-2 text-[11px] font-semibold text-amber-bright" data-testid="info-otomatis">
                  ⚡ Verifikasi otomatis aktif: nominal ditambah <b>kode unik 1–999</b> (ikut jadi saldo game). Bayar persis sesuai total lalu unggah tangkapan layar bukti — bila cocok, saldo game masuk dalam hitungan detik.
                </p>
              )}
              {manual && !manual.ocrAktif && <p className="mt-4 text-[11px] text-muted">Saldo masuk setelah admin mencocokkan pembayaranmu (biasanya 5–15 menit).</p>}
              {tutup && <Alert className="mt-4">QRIS manual sedang tutup{manual?.hoursLabel ? ` (jam layanan ${manual.hoursLabel})` : ""}. Coba lagi nanti.</Alert>}
              {error && <Alert className="mt-4">{error}</Alert>}
              <button type="submit" disabled={loading || tutup || amt < cfg.min} className="btn-primary mt-5 w-full" data-testid="gd-lanjut">
                {loading ? <Spinner /> : null}{loading ? "Membuat tagihan…" : "Lanjut bayar"}
              </button>
              <p className="mt-2 text-center text-[11px] text-muted">Minimal {rupiah(cfg.min)} · maksimal {rupiah(cfg.max)}</p>
            </form>
          )}

          {step === "payment" && order && (
            status === "completed" ? (
              <div className="py-6 text-center" data-testid="gd-sukses">
                <span className="bounce-in mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-3xl">🎮</span>
                <h2 className="mt-4 text-xl font-extrabold text-ink">Saldo game masuk {rupiah(order.amount)}</h2>
                <p className="mt-1 text-sm text-muted">Saldo game kamu sekarang {rupiah(gameBalance || 0)}.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Link href="/chat?game=1" className="btn-primary">Main sekarang</Link>
                  <button onClick={ulang} className="btn-ghost">Isi lagi</button>
                </div>
              </div>
            ) : status === "review" ? (
              <div className="py-6 text-center" data-testid="gd-review">
                <span className="bounce-in mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-soft text-2xl">🔎</span>
                <h2 className="mt-4 text-xl font-extrabold text-ink">Sedang dicek admin</h2>
                {alasan.length > 0 && (
                  <div className="mx-auto mt-3 max-w-sm rounded-xl border border-amber/40 bg-amber-soft px-3 py-2 text-left text-xs text-amber-bright" data-testid="gd-alasan">
                    <p className="font-extrabold">Belum bisa diverifikasi otomatis:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">{alasan.map((a) => <li key={a}>{a}</li>)}</ul>
                    <p className="mt-1 text-[11px] font-semibold">Tenang — admin akan mengeceknya manual.</p>
                  </div>
                )}
                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">Konfirmasi {rupiah(order.amount)} sudah masuk. Saldo game bertambah otomatis begitu disetujui — halaman ini ikut berubah sendiri.</p>
                <button type="button" onClick={() => cek(order.orderId)} className="btn-primary mt-4">Cek sekarang</button>
              </div>
            ) : FINAL.includes(status) || sisa === 0 ? (
              <div className="py-6 text-center">
                <h2 className="text-xl font-extrabold text-ink">{status === "canceled" ? "Tagihan dibatalkan" : status === "failed" ? "Pembayaran ditolak" : "Tagihan kedaluwarsa"}</h2>
                <p className="mt-2 text-sm text-muted">Buat tagihan baru kalau masih mau mengisi saldo game.</p>
                <button onClick={ulang} className="btn-primary mt-4">Buat tagihan baru</button>
              </div>
            ) : (
              <div>
                <div className="panel-3d glow-3d p-5 text-center">
                  <p className="text-xs font-semibold text-muted">Total yang harus dibayar</p>
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <p className="text-3xl font-extrabold tabular-nums tracking-tight text-ink" data-testid="gd-total">{rupiah(bayar)}</p>
                    <CopyButton value={bayar} label="" />
                  </div>
                  {kode > 0 && <p className="mt-1 text-xs font-semibold text-amber-bright" data-testid="gd-kode">Sudah termasuk kode unik Rp{kode} — ikut masuk ke saldo game.</p>}
                  {order.qrImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={order.qrImage} alt="Kode QRIS pembayaran" className="mx-auto mt-4 aspect-square w-full max-w-[260px] rounded-2xl bg-white p-3 shadow-soft" />
                  ) : <Alert className="mt-4">QRIS tidak tersedia. Batalkan lalu buat ulang.</Alert>}
                  <p className="mt-3 text-xs text-muted">Scan dengan GoPay, OVO, DANA, ShopeePay, LinkAja, atau m-banking.{sisa != null ? ` Sisa waktu ${String(Math.floor(sisa / 60)).padStart(2, "0")}:${String(sisa % 60).padStart(2, "0")}.` : ""}</p>
                  {(order.manualInfo?.accountLabel || order.manualInfo?.accountName) && (
                    <div className="mt-3 rounded-xl border border-line bg-surface2 px-3 py-2 text-left">
                      {order.manualInfo.accountLabel && <p className="text-[11px] font-semibold text-muted">{order.manualInfo.accountLabel}</p>}
                      {order.manualInfo.accountName && <p className="text-sm font-extrabold text-ink">a.n. {order.manualInfo.accountName}</p>}
                    </div>
                  )}
                </div>
                {error && <Alert tone="amber" className="mt-4">{error}</Alert>}
                {confirmOpen ? (
                  <div className="panel-3d mt-4 p-4">
                    <p className="text-sm font-extrabold text-ink">Kirim bukti transfer</p>
                    <p className="mt-1 text-xs text-muted">Gunakan tangkapan layar utuh yang menampilkan nama penerima, nominal, jam, dan nomor referensi.</p>
                    <label className={`mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-3 text-xs font-bold hover:border-amber ${proof ? "border-success/50 text-success" : "border-amber/60 text-amber-bright"}`}>
                      📎 {proof ? "Ganti bukti transfer" : "Unggah bukti transfer (wajib)"}
                      <input type="file" accept="image/*" className="hidden" data-testid="gd-file" onChange={(e) => { pilihBukti(e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                    {proof && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={proof} alt="Bukti bayar" className="mx-auto mt-3 max-h-48 rounded-xl border border-line" />
                    )}
                    <input value={proofNote} onChange={(e) => setProofNote(e.target.value.slice(0, 200))} placeholder="Catatan untuk admin (opsional)" className="field mt-3 w-full" aria-label="Catatan untuk admin" />
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => setConfirmOpen(false)} className="btn-ghost flex-1">Batal</button>
                      <button type="button" onClick={kirim} disabled={confirming || !proof} className="btn-primary flex-[2]" data-testid="gd-kirim">
                        {confirming ? <Spinner /> : null}{confirming ? (manual?.ocrAktif ? "Memeriksa bukti…" : "Mengirim…") : proof ? "Saya sudah TF, kirim" : "Unggah bukti dulu"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmOpen(true)} className="btn-primary mt-4 w-full" data-testid="gd-sudah-tf">Saya sudah TF — kirim bukti</button>
                )}
                <button type="button" onClick={batalkan} className="btn-danger mt-2 w-full">Batalkan</button>
              </div>
            )
          )}
        </div>

        <aside className="space-y-4">
          <div className="panel-3d p-4">
            <p className="text-sm font-extrabold text-ink">Tentang saldo game</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
              <li>Terpisah dari saldo nokos: saldo game tidak bisa beli nomor, dan sebaliknya.</li>
              <li>Dipakai untuk taruhan duel (UNO, Remi, Mahjong, Catur) dan game solo mode saldo.</li>
              <li>Bermainlah dengan bijak — ada batas taruhan dan batas rugi harian.</li>
            </ul>
            <Link href="/chat?game=1" className="btn-ghost mt-3 block text-center">Buka menu game</Link>
          </div>
          <div className="panel-3d p-4" data-testid="riwayat-game">
            <p className="text-sm font-extrabold text-ink">Riwayat saldo game</p>
            {riwayat.length === 0 ? <p className="mt-2 text-xs text-muted">Belum ada transaksi.</p> : (
              <ul className="mt-2 divide-y divide-line">
                {riwayat.map((x) => (
                  <li key={x.id} className="flex items-start justify-between gap-2 py-2 text-xs">
                    <span className="min-w-0"><span className="block truncate font-semibold text-ink">{x.title}</span><span className="text-[10px] text-muted">{fmtWIB(x.createdAt)}</span></span>
                    <b className={`shrink-0 tabular-nums ${x.amount >= 0 ? "text-success" : "text-rose"}`}>{x.amount >= 0 ? "+" : "−"}{rupiah(Math.abs(x.amount))}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
