"use client";

// POIN GAME: isi poin (QRIS manual + OCR), tukar poin ke saldo nokos, tarik poin ke e-wallet, dan riwayat.
// 2 poin = Rp1.000 (1 poin = Rp500). Poin terpisah dari saldo nokos.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/app/providers";
import { PageHeader, Alert, CopyButton, Spinner, rupiah, fmtWIB } from "@/components/ui";
import { POIN_RP, keRupiah, teksPoin, teksPoinRp } from "@/lib/poinGame";

const CEPAT_ISI = [2, 20, 50, 100, 200, 500];
const FINAL = ["completed", "canceled", "expired", "failed"];
const restoredMetode = { current: false };
const PROOF_MAX_SIDE = 2400;
const PROOF_MAX_CHARS = 780_000;
const STATUS_TARIK = { menunggu: ["⏳ Menunggu admin", "text-amber-bright"], diproses: ["⏳ Diproses otomatis", "text-amber-bright"], dibayar: ["✅ Sudah dibayar", "text-success"], ditolak: ["❌ Ditolak (poin kembali)", "text-rose"], batal: ["↩ Dibatalkan (poin kembali)", "text-muted"] };

export default function PoinGamePage() {
  const { token, refreshBalance } = useUser();
  const [info, setInfo] = useState(null);
  const [tab, setTab] = useState("isi");
  const [manual, setManual] = useState(null);
  const [cepat, setCepat] = useState(false); // QRIS FAST (otomatis) tersedia?

  const muat = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/game/dompet?token=${encodeURIComponent(token)}`);
      const d = await r.json();
      if (r.ok) setInfo(d);
    } catch {}
  }, [token]);
  useEffect(() => { muat(); }, [muat]);
  useEffect(() => {
    fetch("/api/settings/public").then((r) => r.json()).then((d) => { setManual(d.manualDeposit || null); setCepat(d.depositProviders?.qrisfast === true); }).catch(() => {});
    const t = new URLSearchParams(window.location.search).get("tab");
    if (["isi", "tukar", "tarik", "riwayat"].includes(t)) setTab(t);
  }, []);
  const segarkan = useCallback(() => { muat(); refreshBalance?.(); }, [muat, refreshBalance]);

  const sy = info?.syarat;
  const persen = sy && sy.wajib > 0 ? Math.min(100, Math.round((sy.putar / sy.wajib) * 100)) : 100;

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader title="Poin Game" icon={<span className="text-xl">🎲</span>} desc="2 poin = Rp1.000. Dipakai untuk duel & game solo — terpisah dari saldo nokos. Bisa ditukar ke saldo nokos atau ditarik ke e-wallet." />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="manga-card p-5 sm:p-6" data-testid="game-deposit">
          <div className="mb-5 rounded-2xl border border-line bg-surface2 px-4 py-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Poin game kamu</p>
                <b className="text-3xl tabular-nums text-ink" data-testid="saldo-game-nilai">{info ? teksPoin(info.saldoRp) : "…"}</b>
              </div>
              <p className="pb-1 text-sm font-semibold text-muted" data-testid="saldo-game-rp">{info ? `≈ ${rupiah(info.saldoRp)}` : ""}</p>
            </div>
            {sy && sy.kali > 0 && sy.wajib > 0 && (
              <div className="mt-3" data-testid="syarat-putar">
                <div className="flex justify-between text-[11px] font-semibold text-muted"><span>Perputaran untuk tukar/tarik</span><span>{teksPoin(sy.putar)} / {teksPoin(sy.wajib)}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full ${sy.terpenuhi ? "bg-success" : "bg-amber"}`} style={{ width: `${persen}%` }} /></div>
                <p className="mt-1 text-[11px] text-muted">{sy.terpenuhi ? "✅ Syarat terpenuhi — poin bisa ditukar atau ditarik." : `Mainkan game hingga total taruhan ${teksPoin(sy.wajib)} (kurang ${teksPoin(sy.kurang)}) sebelum poin bisa ditukar/ditarik.`}</p>
              </div>
            )}
          </div>

          <div className="mb-5 grid grid-cols-4 gap-1 rounded-2xl border border-line bg-surface p-1" role="tablist">
            {[["isi", "➕ Isi"], ["tukar", "🔁 Tukar"], ["tarik", "💸 Tarik"], ["riwayat", "📜 Riwayat"]].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} data-testid={`tab-${id}`}
                className={`rounded-xl px-2 py-2 text-xs font-extrabold transition-colors ${tab === id ? "bg-ink text-bg" : "text-muted hover:bg-surface2"}`}>{label}</button>
            ))}
          </div>

          {tab === "isi" && <TabIsi token={token} info={info} manual={manual} cepat={cepat} segarkan={segarkan} />}
          {tab === "tukar" && <TabTukar token={token} info={info} segarkan={segarkan} />}
          {tab === "tarik" && <TabTarik token={token} info={info} segarkan={segarkan} />}
          {tab === "riwayat" && <TabRiwayat token={token} info={info} />}
        </div>

        <aside className="space-y-4">
          <div className="panel-3d p-4">
            <p className="text-sm font-extrabold text-ink">Tentang Poin Game</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
              <li><b>2 poin = Rp1.000.</b> Isi minimal {info?.topup.minPoin ?? 2} poin, maksimal {(info?.topup.maksPoin ?? 20000).toLocaleString("id-ID")} poin sekali isi.</li>
              <li>Tukar <b>dua arah</b>: poin → saldo nokos (dipakai beli nomor) atau saldo nokos → poin — instan.</li>
              <li>Tarik poin ke <b>e-wallet</b> minimal {info ? rupiah(info.tarik.minRp) : "Rp15.000"}, biaya {info ? rupiah(info.tarik.feeRp) : "Rp2.000"}. {info?.tarik.jam}</li>
              <li>Ada syarat perputaran (harus main dulu) supaya aman dari penyalahgunaan.</li>
              <li>Main dengan bijak — ada batas taruhan dan batas rugi harian.</li>
            </ul>
            <Link href="/chat?game=1" className="btn-ghost mt-3 block text-center">Buka menu game</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ───────────────────────── ISI POIN (QRIS manual) ─────────────────────────
function TabIsi({ token, info, manual, cepat, segarkan }) {
  const [metode, setMetode] = useState("manual"); // "qrisfast" | "manual"
  useEffect(() => { if (cepat) setMetode((m) => (m === "manual" && !restoredMetode.current ? "qrisfast" : m)); }, [cepat]);
  const [step, setStep] = useState("amount");
  const [poin, setPoin] = useState("");
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
  const pollRef = useRef(null);
  const restored = useRef(false);

  const cek = useCallback(async (orderId) => {
    if (!token || !orderId) return null;
    try {
      const r = await fetch(`/api/deposit/status?order_id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`);
      const d = await r.json();
      if (!r.ok) return null;
      setStatus(d.status);
      if (FINAL.includes(d.status)) { clearInterval(pollRef.current); if (d.status === "completed") segarkan(); }
      return d.status;
    } catch { return null; }
  }, [token, segarkan]);
  const mulaiPoll = useCallback((orderId, tiap = 8000) => { clearInterval(pollRef.current); pollRef.current = setInterval(() => cek(orderId), tiap); }, [cek]);
  useEffect(() => () => clearInterval(pollRef.current), []);

  useEffect(() => {
    if (!token || restored.current) return;
    restored.current = true;
    fetch(`/api/deposit/detail?token=${encodeURIComponent(token)}&wallet=game`).then((r) => r.json()).then((d) => {
      if (d.item && ["pending", "review"].includes(d.item.status)) { restoredMetode.current = true; setMetode(d.item.provider === "qrisfast" ? "qrisfast" : "manual"); setOrder(d.item); setStatus(d.item.status); setStep("payment"); mulaiPoll(d.item.orderId, d.item.provider === "qrisfast" ? 4000 : 8000); }
    }).catch(() => {});
  }, [token, mulaiPoll]);
  useEffect(() => {
    if (step !== "payment" || FINAL.includes(status)) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step, status]);

  const p = Math.floor(Number(poin) || 0);
  const min = info?.topup.minPoin ?? 2, maks = info?.topup.maksPoin ?? 20000;
  const fast = metode === "qrisfast" && cepat;
  const tutup = !fast && (manual ? manual.open === false : false);

  async function buat(e) {
    e?.preventDefault();
    if (loading) return;
    if (p < min || p > maks) { setError(`Isi poin antara ${min} dan ${maks.toLocaleString("id-ID")} poin.`); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/deposit/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, amount: keRupiah(p), provider: fast ? "qrisfast" : "manual", wallet: "game" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal membuat tagihan.");
      setOrder(d); setStatus("pending"); setStep("payment"); setAlasan([]); setProof(null); setConfirmOpen(false);
      mulaiPoll(d.orderId, fast ? 4000 : 8000);
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
      if (d.status === "completed") { clearInterval(pollRef.current); segarkan(); }
    } catch (err) { setError(err.message); } finally { setConfirming(false); }
  }
  async function batalkan() {
    if (order) { try { await fetch("/api/deposit/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, orderId: order.orderId }) }); } catch {} }
    ulang();
  }
  function ulang() { clearInterval(pollRef.current); setOrder(null); setStatus("pending"); setStep("amount"); setPoin(""); setProof(null); setProofNote(""); setAlasan([]); setError(""); setConfirmOpen(false); }

  const sisa = order?.expiredAt ? Math.max(0, Math.ceil((new Date(order.expiredAt).getTime() - now) / 1000)) : null;
  const bayar = order ? Number(order.totalAmount || order.amount) : 0;
  const kode = order?.manualInfo?.kodeUnik || 0;

  if (step === "amount") {
    return (
      <form onSubmit={buat}>
        <label className="label" htmlFor="gd-amount">Mau isi berapa poin?</label>
        <div className="field-3d flex items-center px-4">
          <input id="gd-amount" inputMode="numeric" value={poin} onChange={(e) => setPoin(e.target.value.replace(/\D/g, ""))} placeholder="0" className="w-full bg-transparent px-2 py-3 text-2xl font-extrabold tabular-nums text-ink outline-none" />
          <span className="text-lg font-extrabold text-amber-bright">poin</span>
        </div>
        <p className="mt-1 text-xs font-semibold text-muted" data-testid="gd-setara">{p > 0 ? `= ${rupiah(keRupiah(p))}` : `1 poin = Rp${POIN_RP}`}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CEPAT_ISI.filter((n) => n >= min && n <= maks).map((n) => (
            <button key={n} type="button" onClick={() => setPoin(String(n))} className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${p === n ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-ink"}`}>{n} poin</button>
          ))}
        </div>
        {cepat && (
          <div className="mt-4" data-testid="gd-metode">
            <p className="label">Metode bayar</p>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Metode bayar">
              <button type="button" role="radio" aria-checked={metode === "qrisfast"} onClick={() => setMetode("qrisfast")} data-testid="gd-metode-fast" className={`rounded-xl border px-3 py-2 text-left ${metode === "qrisfast" ? "border-amber bg-amber-soft" : "border-line"}`}>
                <b className="block text-xs text-ink">⚡ QRIS FAST <span className="ml-1 rounded-full bg-rose px-1.5 py-0.5 text-[9px] font-black text-white">CEPAT</span></b>
                <span className="text-[11px] text-muted">Otomatis — poin masuk begitu dibayar, tanpa bukti.</span>
              </button>
              <button type="button" role="radio" aria-checked={metode === "manual"} onClick={() => setMetode("manual")} data-testid="gd-metode-manual" className={`rounded-xl border px-3 py-2 text-left ${metode === "manual" ? "border-amber bg-amber-soft" : "border-line"}`}>
                <b className="block text-xs text-ink">🧾 QRIS Manual</b>
                <span className="text-[11px] text-muted">Unggah bukti transfer, dicek otomatis/admin.</span>
              </button>
            </div>
          </div>
        )}
        {fast && <p className="mt-3 rounded-xl border border-amber/40 bg-amber-soft px-3 py-2 text-[11px] font-semibold text-amber-bright" data-testid="info-fast">⚡ Bayar persis sesuai total yang tampil (sudah termasuk kode unik). Poin masuk otomatis dalam hitungan detik — tidak perlu unggah bukti.</p>}
        {!fast && manual?.ocrAktif && (
          <p className="mt-4 rounded-xl border border-amber/40 bg-amber-soft px-3 py-2 text-[11px] font-semibold text-amber-bright" data-testid="info-otomatis">
            ⚡ Verifikasi otomatis aktif: nominal transfer ditambah <b>kode unik Rp1–99</b> (biaya verifikasi, tidak jadi poin). Bayar persis sesuai total lalu unggah tangkapan layar bukti — bila cocok, poin masuk dalam hitungan detik.
          </p>
        )}
        {!fast && manual && !manual.ocrAktif && <p className="mt-4 text-[11px] text-muted">Poin masuk setelah admin mencocokkan pembayaranmu (biasanya 5–15 menit).</p>}
        {tutup && <Alert className="mt-4">QRIS manual sedang tutup{manual?.hoursLabel ? ` (jam layanan ${manual.hoursLabel})` : ""}. Coba lagi nanti.</Alert>}
        {error && <Alert className="mt-4">{error}</Alert>}
        <button type="submit" disabled={loading || tutup || p < min} className="btn-primary mt-5 w-full" data-testid="gd-lanjut">
          {loading ? <Spinner /> : null}{loading ? "Membuat tagihan…" : "Lanjut bayar"}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted">Minimal {min} poin · maksimal {maks.toLocaleString("id-ID")} poin</p>
      </form>
    );
  }

  if (!order) return null;
  if (status === "completed") {
    return (
      <div className="py-6 text-center" data-testid="gd-sukses">
        <span className="bounce-in mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-3xl">🎮</span>
        <h2 className="mt-4 text-xl font-extrabold text-ink">+{teksPoin(order.amount)} masuk!</h2>
        <p className="mt-1 text-sm text-muted">Poin game kamu sekarang {info ? teksPoin(info.saldoRp) : "…"}.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/chat?game=1" className="btn-primary">Main sekarang</Link>
          <button onClick={ulang} className="btn-ghost">Isi lagi</button>
        </div>
      </div>
    );
  }
  if (status === "review") {
    return (
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
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">Konfirmasi {teksPoin(order.amount)} sudah masuk. Poin bertambah otomatis begitu disetujui — halaman ini ikut berubah sendiri.</p>
        <button type="button" onClick={() => cek(order.orderId)} className="btn-primary mt-4">Cek sekarang</button>
      </div>
    );
  }
  if (FINAL.includes(status) || sisa === 0) {
    return (
      <div className="py-6 text-center">
        <h2 className="text-xl font-extrabold text-ink">{status === "canceled" ? "Tagihan dibatalkan" : status === "failed" ? "Pembayaran ditolak" : "Tagihan kedaluwarsa"}</h2>
        <p className="mt-2 text-sm text-muted">Buat tagihan baru kalau masih mau mengisi poin.</p>
        <button onClick={ulang} className="btn-primary mt-4">Buat tagihan baru</button>
      </div>
    );
  }
  return (
    <div>
      <div className="panel-3d glow-3d p-5 text-center">
        <p className="text-xs font-semibold text-muted">Total yang harus dibayar ({teksPoin(order.amount)})</p>
        <div className="mt-1 flex items-center justify-center gap-1">
          <p className="text-3xl font-extrabold tabular-nums tracking-tight text-ink" data-testid="gd-total">{rupiah(bayar)}</p>
          <CopyButton value={bayar} label="" />
        </div>
        {order.provider === "qrisfast" && bayar > order.amount && <p className="mt-1 text-xs font-semibold text-amber-bright" data-testid="gd-kode-fast">Termasuk kode unik/biaya Rp{(bayar - order.amount).toLocaleString("id-ID")} — tidak jadi poin.</p>}
        {kode > 0 && <p className="mt-1 text-xs font-semibold text-amber-bright" data-testid="gd-kode">Termasuk kode unik Rp{kode} (biaya verifikasi — tidak jadi poin).</p>}
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
      {order.provider === "qrisfast" ? (
        <>
          <p className="mt-4 rounded-xl border border-line bg-surface2 px-3 py-2 text-center text-xs text-muted" data-testid="gd-menunggu-fast">⚡ Menunggu pembayaran… poin masuk otomatis begitu QRIS dibayar. Halaman ini ikut berubah sendiri.</p>
          <button type="button" onClick={() => cek(order.orderId)} className="btn-primary mt-3 w-full" data-testid="gd-cek-fast">Cek pembayaran</button>
        </>
      ) : confirmOpen ? (
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
  );
}

// ───────────────────────── TUKAR: POIN ⇄ SALDO NOKOS ─────────────────────────
function TabTukar({ token, info, segarkan }) {
  const [arah, setArah] = useState("keNokos"); // keNokos: poin → saldo nokos | keGame: saldo nokos → poin
  const [poin, setPoin] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState(null);
  const p = Math.floor(Number(poin) || 0);
  const kotor = keRupiah(p);
  const keNokos = arah === "keNokos";
  const feeNokos = info ? Math.floor((kotor * info.tukar.feePersen) / 100) : 0;
  const feeGame = info ? Math.ceil((kotor * info.isiNokos.feePersen) / 100) : 0;
  const aktif = info ? (keNokos ? info.tukar.aktif : info.isiNokos.aktif) : true;
  async function kirim(e) {
    e.preventDefault();
    if (sibuk) return;
    setSibuk(true); setPesan(null);
    try {
      const r = await fetch("/api/game/dompet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, aksi: keNokos ? "tukar" : "isi-nokos", poin: p }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal menukar.");
      setPesan({ ok: true, teks: keNokos ? `Berhasil! ${teksPoin(d.rp)} → ${rupiah(d.bersih)} masuk ke saldo nokos.` : `Berhasil! ${rupiah(d.bayar)} saldo nokos → ${teksPoin(d.rp)} masuk ke poin game.` });
      setPoin(""); segarkan();
    } catch (err) { setPesan({ ok: false, teks: err.message }); } finally { setSibuk(false); }
  }
  const semua = () => info && setPoin(String(keNokos ? Math.floor(info.saldoRp / POIN_RP) : Math.floor(info.saldoNokos / (POIN_RP * (1 + info.isiNokos.feePersen / 100)))));
  return (
    <form onSubmit={kirim} data-testid="form-tukar">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1" role="radiogroup" aria-label="Arah penukaran">
        <button type="button" role="radio" aria-checked={keNokos} onClick={() => { setArah("keNokos"); setPesan(null); }} data-testid="arah-ke-nokos" className={`rounded-xl px-2 py-2 text-xs font-extrabold ${keNokos ? "bg-ink text-bg" : "text-muted"}`}>🎲 Poin → Saldo nokos</button>
        <button type="button" role="radio" aria-checked={!keNokos} onClick={() => { setArah("keGame"); setPesan(null); }} data-testid="arah-ke-game" className={`rounded-xl px-2 py-2 text-xs font-extrabold ${!keNokos ? "bg-ink text-bg" : "text-muted"}`}>📱 Saldo nokos → Poin</button>
      </div>
      {!aktif ? <Alert>{keNokos ? "Tukar poin ke saldo nokos" : "Ubah saldo nokos ke poin"} sedang dinonaktifkan admin.</Alert> : (
        <>
          <p className="text-sm text-muted">
            {keNokos
              ? <>Ubah poin game jadi <b>saldo nokos</b> untuk membeli nomor. Kurs: 1 poin = Rp{POIN_RP}{info?.tukar.feePersen ? `, potongan ${info.tukar.feePersen}%` : ", tanpa potongan"}.</>
              : <>Ubah <b>saldo nokos</b> jadi poin game. Kurs: Rp{POIN_RP} = 1 poin{info?.isiNokos.feePersen ? `, potongan ${info.isiNokos.feePersen}%` : ", tanpa potongan"}. Poin hasil ubahan harus <b>diputar dulu</b> di game sebelum bisa ditukar balik atau ditarik.</>}
          </p>
          <label className="label mt-4" htmlFor="tk-poin">{keNokos ? "Poin yang ditukar" : "Poin yang ingin didapat"}</label>
          <div className="field-3d flex items-center px-4">
            <input id="tk-poin" inputMode="numeric" value={poin} onChange={(e) => setPoin(e.target.value.replace(/\D/g, ""))} placeholder="0" className="w-full bg-transparent px-2 py-3 text-2xl font-extrabold tabular-nums text-ink outline-none" />
            <button type="button" onClick={semua} className="rounded-lg border border-line px-2 py-1 text-[11px] font-black text-ink">Maks</button>
          </div>
          <div className="panel-3d mt-3 divide-y divide-line px-4 text-sm">
            {keNokos ? (
              <>
                <div className="flex justify-between py-2"><span className="text-muted">Poin ditukar</span><b>{p ? teksPoinRp(kotor) : "—"}</b></div>
                {feeNokos > 0 && <div className="flex justify-between py-2"><span className="text-muted">Potongan</span><b>−{rupiah(feeNokos)}</b></div>}
                <div className="flex justify-between py-2"><span className="text-muted">Masuk saldo nokos</span><b className="text-success" data-testid="tukar-bersih">{p ? rupiah(kotor - feeNokos) : "—"}</b></div>
              </>
            ) : (
              <>
                <div className="flex justify-between py-2"><span className="text-muted">Saldo nokos dipotong</span><b data-testid="isi-nokos-bayar">{p ? rupiah(kotor + feeGame) : "—"}</b></div>
                {feeGame > 0 && <div className="flex justify-between py-2"><span className="text-muted">Termasuk potongan</span><b>{rupiah(feeGame)}</b></div>}
                <div className="flex justify-between py-2"><span className="text-muted">Poin diterima</span><b className="text-success" data-testid="isi-nokos-poin">{p ? teksPoin(kotor) : "—"}</b></div>
              </>
            )}
          </div>
          {pesan && <Alert tone={pesan.ok ? "green" : "red"} className="mt-3"><span data-testid="tukar-pesan">{pesan.teks}</span></Alert>}
          <button type="submit" disabled={sibuk || p < 2} className="btn-primary mt-4 w-full" data-testid={keNokos ? "tukar-kirim" : "isi-nokos-kirim"}>{sibuk ? <Spinner /> : null}{sibuk ? "Memproses…" : keNokos ? "Tukar ke saldo nokos" : "Ubah ke poin game"}</button>
          <p className="mt-2 text-center text-[11px] text-muted">Minimal 2 poin (Rp1.000). Saldo nokos saat ini {info ? rupiah(info.saldoNokos) : "…"} · poin game {info ? teksPoin(info.saldoRp) : "…"}.</p>
        </>
      )}
    </form>
  );
}

// ───────────────────────── TARIK KE E-WALLET ─────────────────────────
function TabTarik({ token, info, segarkan }) {
  const [poin, setPoin] = useState("");
  const [ewallet, setEwallet] = useState("DANA");
  const [nomor, setNomor] = useState("");
  const [nama, setNama] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState(null);
  const p = Math.floor(Number(poin) || 0);
  const kotor = keRupiah(p);
  const fee = info?.tarik.feeRp || 0;
  const minPoin = info?.tarik.minPoin ?? 30;
  const otomatis = !!info?.tarik.otomatis;
  // Selama ada penarikan otomatis yang masih berjalan, segarkan tiap 6 detik.
  useEffect(() => {
    if (!info?.tarikan?.some((t) => t.otomatis && t.status === "menunggu")) return undefined;
    const iv = setInterval(() => segarkan(), 6000);
    return () => clearInterval(iv);
  }, [info, segarkan]);

  async function ajukan(e) {
    e.preventDefault();
    if (sibuk) return;
    setSibuk(true); setPesan(null);
    try {
      const r = await fetch("/api/game/dompet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, aksi: "tarik", poin: p, ewallet, nomor, nama }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal mengajukan.");
      if (d.otomatis) {
        const st = d.tarikan?.status;
        setPesan(st === "dibayar" ? { ok: true, teks: `Berhasil! ${rupiah(d.tarikan.bersih)} sudah dikirim ke ${ewallet} ${d.tarikan.nomor}.` }
          : st === "ditolak" ? { ok: false, teks: `Penarikan gagal${d.tarikan.catatan ? ` (${d.tarikan.catatan})` : ""}. Poin kamu sudah dikembalikan.` }
          : { ok: true, teks: `Penarikan ${rupiah(d.tarikan.bersih)} sedang diproses otomatis. Statusnya berubah sendiri.` });
      } else setPesan({ ok: true, teks: `Pengajuan terkirim (${d.tarikan.id}). ${info?.tarik.jam}.` });
      setPoin(""); segarkan();
    } catch (err) { setPesan({ ok: false, teks: err.message }); } finally { setSibuk(false); }
  }
  async function batal(id) {
    if (!confirm("Batalkan pengajuan ini? Poin akan dikembalikan.")) return;
    const r = await fetch("/api/game/dompet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, aksi: "batal", id }) });
    const d = await r.json();
    setPesan(r.ok ? { ok: true, teks: "Pengajuan dibatalkan, poin dikembalikan." } : { ok: false, teks: d.error || "Gagal membatalkan." });
    segarkan();
  }
  if (info && !info.tarik.aktif) return <Alert>Penarikan poin sedang dinonaktifkan admin.</Alert>;
  return (
    <div data-testid="form-tarik">
      <p className="text-sm text-muted">{otomatis ? <>Tarik poin ke <b>e-wallet</b> — dikirim <b>otomatis</b> (tanpa menunggu admin), biasanya masuk dalam hitungan detik–menit. Bila gagal, poin dikembalikan.</> : <>Tarik poin ke <b>e-wallet</b>. Poin langsung ditahan, lalu admin mengirim rupiahnya. <b>{info?.tarik.jam}</b>.</>} Minimal {teksPoinRp(info?.tarik.minRp || 15000)}.</p>
      <form onSubmit={ajukan} className="mt-4 space-y-3">
        <div>
          <label className="label" htmlFor="tr-poin">Poin yang ditarik</label>
          <div className="field-3d flex items-center px-4">
            <input id="tr-poin" inputMode="numeric" value={poin} onChange={(e) => setPoin(e.target.value.replace(/\D/g, ""))} placeholder={String(minPoin)} className="w-full bg-transparent px-2 py-3 text-2xl font-extrabold tabular-nums text-ink outline-none" />
            <button type="button" onClick={() => info && setPoin(String(Math.floor(info.saldoRp / POIN_RP)))} className="rounded-lg border border-line px-2 py-1 text-[11px] font-black text-ink">Semua</button>
          </div>
        </div>
        <div>
          <p className="label">E-wallet tujuan</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="E-wallet tujuan">
            {(info?.tarik.ewallet || ["DANA", "GoPay", "ShopeePay", "LinkAja"]).map((e) => (
              <button key={e} type="button" role="radio" aria-checked={ewallet === e} onClick={() => setEwallet(e)} data-testid={`ew-${e}`} className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${ewallet === e ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-ink"}`}>{e}</button>
            ))}
          </div>
        </div>
        <input value={nomor} onChange={(e) => setNomor(e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 20))} inputMode="tel" placeholder="Nomor e-wallet (mis. 08123456789)" className="field w-full" aria-label="Nomor e-wallet" data-testid="tr-nomor" />
        <input value={nama} onChange={(e) => setNama(e.target.value.slice(0, 60))} placeholder={otomatis ? "Nama pemilik e-wallet (opsional)" : "Nama pemilik e-wallet"} className="field w-full" aria-label="Nama pemilik e-wallet" data-testid="tr-nama" />
        <div className="panel-3d divide-y divide-line px-4 text-sm">
          <div className="flex justify-between py-2"><span className="text-muted">Poin ditahan</span><b>{p ? teksPoinRp(kotor) : "—"}</b></div>
          {fee > 0 && <div className="flex justify-between py-2"><span className="text-muted">Biaya tarik</span><b>−{rupiah(fee)}</b></div>}
          <div className="flex justify-between py-2"><span className="text-muted">Kamu terima</span><b className="text-success" data-testid="tarik-bersih">{p ? rupiah(Math.max(0, kotor - fee)) : "—"}</b></div>
        </div>
        {pesan && <Alert tone={pesan.ok ? "green" : "red"}><span data-testid="tarik-pesan">{pesan.teks}</span></Alert>}
        <button type="submit" disabled={sibuk || p < minPoin} className="btn-primary w-full" data-testid="tarik-kirim">{sibuk ? <Spinner /> : null}{sibuk ? "Mengajukan…" : "Ajukan penarikan"}</button>
      </form>

      <p className="mt-6 text-sm font-extrabold text-ink">Pengajuan kamu</p>
      {!info?.tarikan.length ? <p className="mt-2 text-xs text-muted">Belum ada pengajuan.</p> : (
        <ul className="mt-2 divide-y divide-line" data-testid="daftar-tarikan">
          {info.tarikan.map((t) => {
            const [label, warna] = STATUS_TARIK[t.otomatis && t.status === "menunggu" ? "diproses" : t.status] || [t.status, "text-muted"];
            return (
              <li key={t.id} className="py-2.5 text-xs" data-testid="baris-tarikan">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0"><b className="text-ink">{teksPoin(t.rp)}</b> → {rupiah(t.bersih)} ke {t.ewallet} {t.nomor}<span className="block text-[10px] text-muted">{t.id} · {fmtWIB(t.dibuat)}</span></span>
                  <span className={`shrink-0 font-bold ${warna}`}>{label}</span>
                </div>
                {t.catatan && <p className="mt-1 text-[11px] text-muted">Catatan admin: {t.catatan}</p>}
                {t.status === "menunggu" && !t.otomatis && <button type="button" onClick={() => batal(t.id)} className="mt-1 rounded-lg border border-rose/40 px-2 py-1 text-[11px] font-bold text-rose">Batalkan</button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────── RIWAYAT ─────────────────────────
function TabRiwayat({ token }) {
  const [riwayat, setRiwayat] = useState([]);
  useEffect(() => {
    if (!token) return;
    fetch(`/api/mutasi?token=${encodeURIComponent(token)}&dompet=game`).then((r) => r.json()).then((d) => setRiwayat((d.items || []).slice(0, 40))).catch(() => {});
  }, [token]);
  return (
    <div data-testid="riwayat-game">
      <p className="text-sm font-extrabold text-ink">Riwayat poin game</p>
      {riwayat.length === 0 ? <p className="mt-2 text-xs text-muted">Belum ada transaksi.</p> : (
        <ul className="mt-2 divide-y divide-line">
          {riwayat.map((x) => (
            <li key={x.id} className="flex items-start justify-between gap-2 py-2 text-xs">
              <span className="min-w-0"><span className="block truncate font-semibold text-ink">{x.title}</span><span className="text-[10px] text-muted">{fmtWIB(x.createdAt)}{x.balanceAfter != null ? ` · saldo ${teksPoin(x.balanceAfter)}` : ""}</span></span>
              <b className={`shrink-0 tabular-nums ${x.amount >= 0 ? "text-success" : "text-rose"}`}>{x.amount >= 0 ? "+" : "−"}{teksPoin(Math.abs(x.amount))}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
