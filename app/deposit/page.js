"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser, useBrand } from "@/app/providers";
import { DEPOSIT_PROVIDERS, providerName } from "@/lib/paymentProviders";
import { PageHeader, Icon, Alert, Row, CopyButton, Spinner, Badge, rupiah, fmtWIB } from "@/components/ui";
import BannerRail from "@/components/BannerRail";
import "@/components/deposit.css";

const QUICK = [10000, 20000, 50000, 100000, 200000, 500000];
const FINAL = ["completed", "canceled", "expired", "failed"];
// Bukti bayar dikecilkan di browser dulu. Mengirim foto 4 MB apa adanya lewat
// koneksi seluler adalah cara paling mudah membuat konfirmasi gagal di tengah.
// Bukti dibaca mesin (OCR), jadi resolusinya dijaga setinggi mungkin selama muat di batas ukuran server.
const PROOF_MAX_SIDE = 2400;
const PROOF_MAX_CHARS = 780_000;

function countdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Timer QRIS: cincin sisa waktu + hitung mundur besar. Hijau → kuning (separuh waktu lewat) → merah berdenyut (≤ 5 menit).
 * `totalMs` = masa berlaku penuh (dibuat → kedaluwarsa); bila tak diketahui, cincin memakai sisa awal yang pertama terlihat.
 */
function TimerQris({ sisaMs, totalMs }) {
  const awal = useRef(0);
  awal.current = Math.max(awal.current, sisaMs, totalMs || 0);
  const total = Math.max(awal.current, 1);
  const frac = Math.max(0, Math.min(1, sisaMs / total));
  const kritis = sisaMs <= 5 * 60_000;
  const warna = kritis ? "rgb(var(--c-danger, 225 29 72))" : frac <= 0.5 ? "rgb(var(--c-amber, 245 158 11))" : "rgb(var(--c-success, 16 185 129))";
  const R = 22, K = 2 * Math.PI * R;
  return (
    <div className={`flex items-center gap-2.5 ${kritis ? "animate-pulse" : ""}`} data-testid="timer-qris" data-kritis={kritis ? "1" : "0"} role="timer" aria-label="Sisa waktu pembayaran">
      <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r={R} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="5" />
        <circle cx="26" cy="26" r={R} fill="none" stroke={warna} strokeWidth="5" strokeLinecap="round" strokeDasharray={K} strokeDashoffset={K * (1 - frac)} transform="rotate(-90 26 26)" style={{ transition: "stroke-dashoffset 1s linear, stroke .4s" }} />
      </svg>
      <div className="leading-tight">
        <span className="block font-mono text-xl font-extrabold tabular-nums text-ink" data-testid="timer-qris-angka">{countdown(sisaMs)}</span>
        <span className="block text-[10px] font-bold uppercase tracking-wide" style={{ color: warna }}>{kritis ? "Segera bayar!" : "sisa waktu bayar"}</span>
      </div>
    </div>
  );
}

export default function DepositPage() {
  const brand = useBrand();
  const { token, balance, refreshBalance } = useUser();

  // Nama, label, keterangan, dan estimasi waktu metode deposit datang dari
  // pengaturan admin. DEPOSIT_PROVIDERS hanya cadangan sebelum API menjawab.
  const [methods, setMethods] = useState(() =>
    DEPOSIT_PROVIDERS.map((p) => ({ key: p.key, name: p.name, badge: "", desc: p.desc, speed: p.speed }))
  );
  const [cfg, setCfg] = useState({
    providers: { warungnokos: false, pakasir: true, rumahotp: false },
    fees: { warungnokos: 0, pakasir: 0, rumahotp: 0.7 },
    min: 2000,
    max: 1000000,
    manual: null
  });
  const [step, setStep] = useState("amount"); // amount | method | payment
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState(null);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("pending");
  const [cashback, setCashback] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef(null);

  // Biaya pasti dari Pakasir untuk nominal yang sedang dipilih; null = belum/gagal.
  const [exactFee, setExactFee] = useState(null);

  // Deposit manual: user sendiri yang bilang sudah bayar, lalu admin yang
  // memutuskan. Tidak ada provider yang bisa ditanya.
  const [manualInfoOpen, setManualInfoOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Alasan verifikasi otomatis (OCR) belum lolos — ditampilkan di layar "sedang dicek admin".
  const [ocrAlasan, setOcrAlasan] = useState([]);
  const [proof, setProof] = useState(null);
  const [proofNote, setProofNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Nominal yang paling sering kamu pakai (dari deposit lunas sebelumnya).
  const [biasa, setBiasa] = useState([]);
  useEffect(() => {
    if (!token) return;
    fetch(`/api/deposit/kebiasaan?token=${encodeURIComponent(token)}`).then((r) => r.json()).then((d) => setBiasa(Array.isArray(d.items) ? d.items : [])).catch(() => {});
  }, [token]);

  const [voucher, setVoucher] = useState("");
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [voucherMsg, setVoucherMsg] = useState(null);

  // Datang dari tombol "Top-up sekarang" di lembar beli: nominalnya sudah terisi.
  useEffect(() => {
    try {
      const n = Math.floor(Number(new URLSearchParams(window.location.search).get("nominal")));
      if (Number.isFinite(n) && n > 0 && n <= 100000000) setAmount(String(n));
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        const providers = d.depositProviders || {};
        setCfg({
          providers,
          fees: d.depositFeePercent || {},
          min: d.depositMin || 2000,
          max: d.depositMax || 1000000,
          manual: d.manualDeposit || null
        });
        if (Array.isArray(d.depositMethods) && d.depositMethods.length) setMethods(d.depositMethods);
        const first = DEPOSIT_PROVIDERS.find((p) => providers[p.key]);
        setProvider(first ? first.key : null);
      })
      .catch(() => {});
  }, []);

  const pollStatus = useCallback(
    async (orderId) => {
      if (!token || !orderId) return null;
      try {
        const res = await fetch(`/api/deposit/status?order_id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) return null;
        setStatus(data.status);
        if (data.cashback) setCashback(data.cashback);
        if (FINAL.includes(data.status)) {
          clearInterval(pollRef.current);
          if (data.status === "completed") {
            refreshBalance();
          }
        }
        return data.status;
      } catch {
        return null;
      }
    },
    [token, refreshBalance]
  );

  const startPolling = useCallback(
    (orderId, { slow = false } = {}) => {
      clearInterval(pollRef.current);
      // QRIS otomatis biasanya lunas dalam hitungan detik, jadi dicek sering.
      // Deposit manual menunggu admin membuka panelnya — mengetuk server tiap
      // 4 detik selama belasan menit tidak membuatnya lebih cepat.
      pollRef.current = setInterval(() => pollStatus(orderId), slow ? 12000 : 4000);
    },
    [pollStatus]
  );

  // Pulihkan QRIS yang masih aktif kalau halaman di-refresh.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!token || restoredRef.current) return;
    restoredRef.current = true;
    const wanted = new URLSearchParams(window.location.search).get("order");
    fetch(`/api/deposit/detail?token=${encodeURIComponent(token)}${wanted ? `&order_id=${encodeURIComponent(wanted)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.item && ["pending", "review"].includes(d.item.status)) {
          setOrder(d.item);
          setStatus(d.item.status);
          setStep("payment");
          startPolling(d.item.orderId, { slow: Boolean(d.item.manual) });
        }
      })
      .catch(() => {});
  }, [token, startPolling]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  useEffect(() => {
    if (step !== "payment" || FINAL.includes(status)) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step, status]);

  const amt = Math.floor(Number(amount) || 0);
  // Cashback sungguhan untuk nominal ini (dihitung server: dasar + tingkat + bonus nominal + event).
  const [cb, setCb] = useState(null);
  useEffect(() => {
    if (!token) return;
    let hidup = true;
    const t = setTimeout(() => {
      fetch(`/api/cashback/info?token=${encodeURIComponent(token)}&amount=${Math.min(amt, 100000000)}&provider=${provider === "manual" ? "manual" : "qris"}`, { cache: "no-store" })
        .then((r) => r.json()).then((d) => { if (hidup && !d?.error) setCb(d); }).catch(() => {});
    }, 250);
    return () => { hidup = false; clearTimeout(t); };
  }, [token, amt, provider]);
  // Nama metode yang dipakai di ringkasan & layar sukses — ikut nama dari admin.
  const methodName = (key) => methods.find((m) => m.key === key)?.name || providerName(key);
  const enabled = DEPOSIT_PROVIDERS.filter((p) => cfg.providers?.[p.key]);

  // Tanya biaya pasti ke Pakasir begitu user berhenti mengetik nominal.
  useEffect(() => {
    if (provider !== "pakasir" || !amt || amt < cfg.min) {
      setExactFee(null);
      return undefined;
    }
    let alive = true;
    const t = setTimeout(() => {
      fetch(`/api/deposit/fee?amount=${amt}`)
        .then((r) => r.json())
        .then((d) => {
          if (alive) setExactFee(Number.isFinite(Number(d?.pakasir)) ? Number(d.pakasir) : null);
        })
        .catch(() => {
          if (alive) setExactFee(null);
        });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [provider, amt, cfg.min]);

  function toMethod(e) {
    e.preventDefault();
    setError("");
    if (!amt || amt < cfg.min || amt > cfg.max) {
      setError(`Nominal harus antara ${rupiah(cfg.min)} dan ${rupiah(cfg.max)}.`);
      return;
    }
    if (!enabled.length) {
      setError("Semua metode pembayaran sedang nonaktif. Coba lagi nanti atau hubungi admin.");
      return;
    }
    if (!provider || !cfg.providers[provider]) setProvider(enabled[0].key);
    setStep("method");
  }

  async function createDeposit() {
    if (!token || !provider) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/deposit/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amount: amt, provider })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat QRIS.");
      setOrder(data);
      setStatus("pending");
      setCashback(0);
      setStep("payment");
      setConfirmOpen(false);
      setProof(null);
      setProofNote("");
      startPolling(data.orderId, { slow: Boolean(data.manual) });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkNow() {
    if (!order) return;
    setChecking(true);
    const s = await pollStatus(order.orderId);
    setChecking(false);
    if (s === "pending") setError("Pembayaran belum terdeteksi. Tunggu beberapa detik lalu cek lagi.");
    else setError("");
  }

  async function cancelOrder() {
    if (!order) return;
    if (!window.confirm("Batalkan QRIS ini? Jangan batalkan kalau kamu sudah membayar.")) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch("/api/deposit/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, orderId: order.orderId })
      });
      const data = await res.json();
      if (res.ok) {
        clearInterval(pollRef.current);
        setStatus(data.status || "canceled");
      } else if (data.status === "completed") {
        clearInterval(pollRef.current);
        setStatus("completed");
        refreshBalance();
      } else {
        setError(data.error || "Gagal membatalkan.");
      }
    } catch {
      setError("Koneksi terputus. Coba lagi.");
    } finally {
      setCancelling(false);
    }
  }

  function pickProof(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("Foto bukti terlalu besar. Maksimal 8MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        // Coba resolusi & kualitas tertinggi dulu; turunkan bertahap sampai muat di batas server.
        let hasil = null;
        for (const [sisi, mutu] of [[PROOF_MAX_SIDE, 0.85], [PROOF_MAX_SIDE, 0.7], [1800, 0.75], [1400, 0.75], [1100, 0.7], [900, 0.6]]) {
          const ratio = Math.min(sisi / img.width, sisi / img.height, 1);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          hasil = canvas.toDataURL("image/jpeg", mutu);
          if (hasil.length <= PROOF_MAX_CHARS) break;
        }
        setProof(hasil);
        setError("");
      };
      img.onerror = () => setError("Berkas itu bukan gambar yang bisa dibaca.");
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function confirmManual() {
    if (!order || !token) return;
    if (!proof) {
      setError("Unggah bukti transfernya dulu ya.");
      return;
    }
    setConfirming(true);
    setError("");
    try {
      const res = await fetch("/api/deposit/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, orderId: order.orderId, proofImage: proof, note: proofNote })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim konfirmasi.");
      setOcrAlasan(Array.isArray(data.alasan) ? data.alasan : []);
      setStatus(data.status || "review");
      setConfirmOpen(false);
      // Lolos verifikasi otomatis → sama seperti pembayaran otomatis lain: ambil cashback,
      // segarkan saldo, dan buka kartu gores.
      if (data.status === "completed") pollStatus(order.orderId);
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    clearInterval(pollRef.current);
    setOrder(null);
    setStatus("pending");
    setAmount("");
    setError("");
    setConfirmOpen(false);
    setOcrAlasan([]);
    setProof(null);
    setProofNote("");
    setStep("amount");
  }

  function downloadQr() {
    if (!order?.qrImage) return;
    const a = document.createElement("a");
    a.href = order.qrImage;
    a.download = `qris-${order.orderId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function redeemVoucher(e) {
    e.preventDefault();
    if (!voucher.trim() || !token) return;
    setVoucherBusy(true);
    setVoucherMsg(null);
    try {
      const res = await fetch("/api/voucher/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code: voucher.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Voucher gagal diklaim.");
      setVoucherMsg({ ok: true, text: `${rupiah(data.amount)} masuk ke saldo kamu.` });
      setVoucher("");
      refreshBalance();
    } catch (err) {
      setVoucherMsg({ ok: false, text: err.message });
    } finally {
      setVoucherBusy(false);
    }
  }

  // Jam buka datang dari server (sudah dihitung dalam WIB). Menghitungnya di
  // browser berarti ikut jam perangkat yang membukanya, dan itu bisa apa saja.
  const manualTutup = cfg.manual ? cfg.manual.open === false : false;
  const manualCashback = Number(cfg.manual?.cashbackPercent || 0);
  const manualCashbackLebih = manualCashback > Number(cfg.manual?.normalCashbackPercent || 0);

  const feePct = provider ? Number(cfg.fees?.[provider] || 0) : 0;
  // Untuk Pakasir, biaya pastinya bisa ditanya langsung ke API penghitung biaya
  // mereka. Kalau gagal, jatuh ke estimasi persen dari pengaturan admin.
  const estFee = provider === "pakasir" && exactFee != null ? exactFee : Math.ceil((amt * feePct) / 100);
  const feeIsExact = provider === "pakasir" && exactFee != null;
  const expiresIn = order?.expiredAt ? new Date(order.expiredAt).getTime() - now : null;
  const timeUp = status === "pending" && expiresIn !== null && expiresIn <= 0;
  const payTotal = order ? Number(order.totalAmount || order.amount) : 0;
  // Langkah ke-4 "Selesai" menyala saat pembayaran terkonfirmasi (saldo sudah masuk).
  const stepIndex = status === "completed" && step === "payment" ? 3 : { amount: 0, method: 1, payment: 2 }[step];

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <section className="dp-hero fade-up" data-testid="deposit-hero">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <p className="text-[11px] font-black uppercase tracking-widest text-white/75">Isi saldo nokos</p>
            <h1 className="comic-head mt-1 text-[30px] leading-tight sm:text-[38px]">Isi saldo, langsung jajan nomor ⚡</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              Bayar pakai QRIS dari e-wallet atau m-banking apa pun. Minimal {rupiah(cfg.min)}, maksimal {rupiah(cfg.max)} per transaksi.
            </p>
          </div>
          <div className="dp-saldo" data-testid="deposit-saldo-hero">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Saldo kamu</p>
            <p className="kg-angka text-2xl font-black tabular-nums">{rupiah(balance)}</p>
            {cb?.tier && <p className="mt-0.5 text-[11px] font-bold text-white/80">{cb.tier.ikon} Tingkat {cb.tier.nama}</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="dp-lencana">🔒 Pembayaran aman</span>
          <span className="dp-lencana">⚡ Saldo masuk otomatis</span>
          <span className="dp-lencana">🎁 Dapat cashback</span>
        </div>
      </section>

      {/* items-start: tanpa ini panel langkah ikut diregangkan setinggi kolom
          kanan, dan di langkah pertama yang isinya pendek jadi ada ruang
          kosong sepanjang layar di bawah tombolnya. */}
      {/* Penjelasan sebelum memilih QRIS manual. Sifat metodenya benar-benar
          berbeda dari yang lain, dan satu-satunya waktu yang tepat untuk
          mengatakannya adalah sebelum uangnya berpindah. */}
      {manualInfoOpen && (
        <div
          // Garis bawah "_" di dalam calc() bukan salah ketik: Tailwind
          // menerjemahkannya jadi spasi, dan calc() TANPA spasi di sekitar
          // tanda + adalah CSS tidak sah yang dibuang diam-diam peramban.
          //
          // Ruang untuk bilah menu bawah yang menempel di layar. Tanpa ini
          // lembarnya memanjang sampai dasar layar dan dua tombol terakhirnya
          // berada TEPAT di bawah bilah menu — terlihat, tapi tidak bisa
          // ditekan. Menambah padding di dalam lembarnya tidak menyelesaikan
          // ini: itu cuma menolong kalau orangnya kebetulan menggulir sampai
          // habis dulu.
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 pb-[calc(5.5rem_+_env(safe-area-inset-bottom))] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Tentang QRIS manual"
          onClick={() => setManualInfoOpen(false)}
        >
          <div
            className="scale-in max-h-[78vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-2 border-line bg-bg p-5 sm:max-h-[92vh] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold text-ink">Sebelum lanjut ke QRIS manual</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Metode ini bukan QRIS otomatis. Baca sebentar supaya tidak salah harap.
            </p>

            <div className="mt-4 rounded-2xl border-2 border-success/30 bg-success-soft/40 p-4">
              <p className="text-sm font-extrabold text-success">✓ Keunggulan</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink">
                <li>💸 <b>Tanpa biaya admin</b> — yang kamu bayar persis sama dengan saldo yang masuk.</li>
                <li>
                  🎁 <b>Cashback lebih besar{manualCashback > 0 ? ` — ${manualCashback}%` : ""}</b>
                  {manualCashbackLebih ? ` (metode lain ${Number(cfg.manual?.normalCashbackPercent || 0)}%)` : ""}, masuk otomatis begitu disetujui.
                </li>
                <li>🏦 Bisa dari e-wallet atau m-banking mana pun, sama seperti QRIS biasa.</li>
              </ul>
            </div>

            <div className="mt-3 rounded-2xl border-2 border-warn/30 bg-warn-soft/40 p-4">
              <p className="text-sm font-extrabold text-warn">! Kekurangan</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink">
                {cfg.manual?.ocrAktif ? (
                  <li>⚡ <b>Bisa otomatis.</b> Bukti transfermu dibaca mesin: bila nama penerima, nominal (termasuk kode unik), jam, dan nomor referensi cocok, saldo masuk dalam hitungan detik. Kalau ada yang tidak cocok, admin mengeceknya manual (5–15 menit).</li>
                ) : (
                  <li>⏳ <b>Tidak otomatis.</b> Saldo masuk setelah admin mencocokkan pembayaranmu — biasanya 5–15 menit, bukan hitungan detik.</li>
                )}
                <li>📎 <b>Wajib unggah bukti transfer.</b> Tanpa bukti, konfirmasinya tidak bisa dikirim.</li>
                {cfg.manual?.hoursLabel && (
                  <li>🕘 <b>Ada jam layanan:</b> {cfg.manual.hoursLabel}. Di luar jam itu metodenya tutup.</li>
                )}
                <li>🙍 Dicek manusia, jadi kalau nominalnya tidak cocok dengan mutasi, deposit bisa ditolak.</li>
              </ul>
            </div>

            <p className="mt-3 text-center text-[11px] text-muted">
              Butuh saldo detik ini juga? Pilih QRIS otomatis — ada biaya admin, tapi langsung masuk.
            </p>

            {/* Menempel di dasar lembarnya. Isi popup ini lebih tinggi daripada
                layar ponsel, jadi kalau tombolnya ikut mengalir di bawah teks,
                ia berada di luar bagian yang terlihat sampai orangnya menggulir
                sampai habis — dan yang tidak sadar harus menggulir akan
                mengira popupnya buntu. Margin negatifnya supaya latar tombol
                menutup penuh sampai tepi lembaran. */}
            <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 flex gap-2 border-t border-line bg-bg px-5 pb-5 pt-3">
              <button type="button" onClick={() => setManualInfoOpen(false)} className="btn-ghost flex-1">
                Pilih metode lain
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualInfoOpen(false);
                  createDeposit();
                }}
                disabled={loading}
                className="btn-primary flex-[2]"
              >
                Saya mengerti, lanjut
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="manga-card manga-rush halftone hd-paper anim-drop p-5 sm:p-6">
          <ol className="dp-steps" aria-label="Langkah deposit">
            {["Nominal", "Metode", "Bayar", "Selesai"].map((label, i) => (
              <li key={label} className="dp-step" data-state={i < stepIndex ? "done" : i === stepIndex ? "now" : "next"} aria-current={i === stepIndex ? "step" : undefined}>
                <i />
                {i < stepIndex ? "✓ " : ""}{label}
              </li>
            ))}
          </ol>

          {step === "amount" && (
            <form onSubmit={toMethod}>
              <label className="label" htmlFor="amount">
                Mau isi berapa?
              </label>
              <div className="dp-amount">
                <span className="rp">Rp</span>
                <input
                  id="amount"
                  inputMode="numeric"
                  autoComplete="off"
                  value={amount ? Number(amount).toLocaleString("id-ID") : ""}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="0"
                />
              </div>
              {amt > 0 && (amt < cfg.min || amt > cfg.max) && (
                <p className="mt-2 text-xs font-bold text-rose">Nominal harus antara {rupiah(cfg.min)} dan {rupiah(cfg.max)}.</p>
              )}
              {cb?.simulasi && amt >= cfg.min && amt <= cfg.max && cb.simulasi.cashback > 0 && (
                <div className="dp-estimasi" data-testid="deposit-estimasi">
                  <span className="text-xl" aria-hidden="true">🎁</span>
                  <span>Kamu dapat cashback <b>+{rupiah(cb.simulasi.cashback)}</b> ({cb.simulasi.persen}%) — total saldo masuk ≈ <b>{rupiah(amt + cb.simulasi.cashback)}</b></span>
                </div>
              )}
              {biasa.filter((b) => b.amount >= cfg.min && b.amount <= cfg.max).length > 0 && (
                <div className="mt-3" data-testid="deposit-biasa">
                  <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">⚡ Biasa kamu</p>
                  <div className="grid grid-cols-2 gap-2">
                    {biasa.filter((b) => b.amount >= cfg.min && b.amount <= cfg.max).map((b) => (
                      <button key={b.amount} type="button" onClick={() => setAmount(String(b.amount))} data-on={amt === b.amount} data-testid="deposit-biasa-chip"
                        className="dp-chip">
                        {rupiah(b.amount)}{b.n > 1 && <span className="ml-1 text-[10px] font-bold text-muted">{b.n}×</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="anim-stagger mt-4 grid grid-cols-3 gap-3">
                {QUICK.filter((v) => v >= cfg.min && v <= cfg.max).map((v, i, arr) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(String(v))}
                    data-on={amt === v}
                    className="dp-chip"
                  >
                    {i === Math.min(2, arr.length - 1) && <span className="hot">POPULER</span>}
                    {rupiah(v)}
                  </button>
                ))}
              </div>
              <div className="dp-jaminan">
                <div><b>⚡</b>Masuk otomatis dalam detik</div>
                <div><b>🔒</b>Dilindungi, tanpa kode OTP</div>
                <div><b>🕒</b>QRIS aktif 24 jam</div>
              </div>

              {error && <Alert className="mt-4">{error}</Alert>}

              <button type="submit" disabled={!token} className="btn-primary anim-sheen mt-6 w-full">
                Pilih metode pembayaran
              </button>
              <p className="mt-3 text-center text-xs text-muted">
                Saldo sekarang <span className="font-bold tabular-nums text-ink">{rupiah(balance)}</span>
              </p>
            </form>
          )}

          {step === "method" && (
            <div>
              <div className="panel-3d flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted">Nominal deposit</span>
                <button type="button" onClick={() => setStep("amount")} className="text-right">
                  <span className="block text-lg font-extrabold tabular-nums text-ink">{rupiah(amt)}</span>
                  <span className="block text-[11px] font-semibold text-amber-bright">Ubah</span>
                </button>
              </div>

              <p className="label mt-5">Bayar pakai QRIS mana?</p>
              <div className="anim-stagger space-y-2" role="radiogroup">
                {/* Hanya metode yang menyala. Metode mati yang tetap terpampang
                    cuma memanjangkan daftar dengan pilihan yang tidak bisa
                    dipakai. Yang sedang TUTUP tetap tampil, karena itu keadaan
                    sementara dan jamnya perlu terbaca. */}
                {methods.filter((m) => cfg.providers?.[m.key]).map((p) => {
                  const tutup = p.key === "manual" && manualTutup;
                  const on = true;
                  const selected = provider === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!on}
                      onClick={() => setProvider(p.key)}
                      data-on={selected}
                      className="pick-3d flex w-full items-center gap-3 p-3.5 text-left"
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform ${
                          selected ? "scale-105 bg-amber text-white shadow-[0_3px_0_rgb(var(--c-orange-bright))]" : "bg-surface2 text-ink"
                        }`}
                      >
                        <Icon.qris />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-ink">{p.name}</span>
                          {/* Label bebas dari admin, mis. "TERCEPAT" atau "PALING LARIS". */}
                          {on && p.badge ? <span className="comic-burst">{p.badge}</span> : null}
                          {!on ? (
                            <Badge tone="red">nonaktif</Badge>
                          ) : tutup ? (
                            <Badge tone="red">tutup sekarang</Badge>
                          ) : p.speed ? (
                            <Badge tone="gray">{p.speed}</Badge>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {p.desc}
                          {Number(cfg.fees?.[p.key] || 0) > 0 ? ` Biaya admin ${Number(cfg.fees[p.key])}%.` : ""}
                          {p.key === "manual" && cfg.manual?.hoursLabel ? ` Jam layanan ${cfg.manual.hoursLabel}.` : ""}
                        </span>
                      </span>
                      <span
                        className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                          selected ? "border-amber bg-amber shadow-[inset_0_0_0_3px_rgb(var(--c-surface))]" : "border-line"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="panel-3d mt-5 divide-y divide-line px-4">
                <Row label="Metode">{methodName(provider)}</Row>
                <Row label="Saldo masuk">{rupiah(amt)}</Row>
                <Row label={feeIsExact ? "Biaya admin" : "Perkiraan biaya admin"}>{rupiah(estFee)}</Row>
                <Row label={feeIsExact ? "Total bayar" : "Perkiraan total bayar"} strong>
                  {rupiah(amt + estFee)}
                </Row>
              </div>
              {provider === "manual" && cfg.manual?.ocrAktif && (
                <p className="mt-2 rounded-xl border border-amber/40 bg-amber-soft px-3 py-2 text-[11px] font-semibold text-amber-bright" data-testid="info-kode-unik">
                  ⚡ Verifikasi otomatis aktif: nominal transfer ditambah <b>kode unik 1–999</b> (ikut jadi saldomu) supaya
                  pembayaranmu dikenali. Bayar persis sesuai total, lalu unggah tangkapan layar bukti yang menampilkan
                  nama penerima{cfg.manual?.accountName ? ` (${cfg.manual.accountName})` : ""}, nominal, jam, dan nomor referensi.
                </p>
              )}
              <p className="mt-2 text-[11px] text-muted">
                {feeIsExact
                  ? "Biaya ini diambil langsung dari Pakasir, jadi sudah angka pasti."
                  : "Total pasti tampil di layar pembayaran setelah QRIS dibuat."}
              </p>

              {error && <Alert className="mt-4">{error}</Alert>}

              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setStep("amount")} className="btn-ghost flex-1">
                  Kembali
                </button>
                <button
                  type="button"
                  // Untuk QRIS manual, tombol ini TIDAK langsung membuat
                  // tagihan. Metodenya berbeda sifat dari yang lain — tidak
                  // otomatis, wajib unggah bukti, ada jam bukanya — dan orang
                  // yang baru tahu itu setelah membayar akan merasa ditipu.
                  onClick={() => (provider === "manual" ? setManualInfoOpen(true) : createDeposit())}
                  disabled={loading || !provider || (provider === "manual" && manualTutup)}
                  className="btn-primary flex-[2]"
                >
                  {loading ? <Spinner /> : null}
                  {loading ? "Membuat QRIS…" : provider === "manual" ? "Lanjut bayar manual" : "Buat QRIS"}
                </button>
              </div>
            </div>
          )}

          {step === "payment" && order && (
            <div className="scale-in">
              {status === "completed" ? (
                <div className="py-6 text-center">
                  <span className="bounce-in mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success shadow-[0_4px_0_rgb(var(--c-success)/0.35)]">
                    <Icon.check width={30} height={30} />
                  </span>
                  <h2 className="mt-4 text-xl font-extrabold text-ink">Saldo masuk {rupiah(order.amount)}</h2>
                  {cashback > 0 && <p className="mt-1 text-sm font-semibold text-success">+ cashback {rupiah(cashback)}</p>}
                  <p className="mt-2 text-sm text-muted">Pembayaran via {order.rute ? "QRIS" : methodName(order.provider)} sudah terkonfirmasi.</p>
                  <button onClick={() => setScratchOpen(true)} className="mt-4 flex items-center gap-2 mx-auto rounded-2xl border-2 border-amber/60 bg-amber/10 px-5 py-2.5 text-sm font-extrabold text-amber-bright press animate-pulse hover:animate-none hover:bg-amber/20">
                    🎫 Buka Kartu Gores Kamu!
                  </button>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Link href="/otp" className="btn-primary">
                      Beli nokos
                    </Link>
                    <button onClick={reset} className="btn-ghost">
                      Isi lagi
                    </button>
                  </div>
                </div>
              ) : status === "review" ? (
                // Deposit manual yang sudah dikonfirmasi user. Tidak ada yang
                // bisa dia lakukan lagi selain menunggu, jadi layarnya tidak
                // memberi tombol yang seolah-olah mempercepat.
                <div className="py-6 text-center">
                  <span className="bounce-in mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-soft text-amber-bright shadow-[0_4px_0_rgb(var(--c-orange)/0.3)]">
                    <span className="text-2xl">🔎</span>
                  </span>
                  <h2 className="mt-4 text-xl font-extrabold text-ink">Sedang dicek admin</h2>
                  {ocrAlasan.length > 0 && (
                    <div className="mx-auto mt-3 max-w-sm rounded-xl border border-amber/40 bg-amber-soft px-3 py-2 text-left text-xs text-amber-bright" data-testid="alasan-ocr">
                      <p className="font-extrabold">Belum bisa diverifikasi otomatis:</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">{ocrAlasan.map((a) => <li key={a}>{a}</li>)}</ul>
                      <p className="mt-1 text-[11px] font-semibold">Tenang — admin akan mengeceknya manual.</p>
                    </div>
                  )}
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                    Konfirmasi kamu sudah masuk. Admin mencocokkan pembayaran {rupiah(order.amount)} dengan mutasi QRIS,
                    biasanya dalam 5–15 menit. Saldo masuk otomatis begitu disetujui — halaman ini ikut berubah sendiri.
                  </p>
                  <div className="panel-3d mx-auto mt-5 max-w-sm divide-y divide-line px-4 text-left">
                    <Row label="ID deposit">
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        {order.orderId}
                        <CopyButton value={order.orderId} label="" />
                      </span>
                    </Row>
                    <Row label="Nominal" strong>
                      {rupiah(order.amount)}
                    </Row>
                  </div>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Link href="/riwayat?tab=deposit" className="btn-ghost">
                      Lihat di Riwayat
                    </Link>
                    <button type="button" onClick={checkNow} disabled={checking} className="btn-primary">
                      {checking ? <Spinner /> : null}
                      {checking ? "Mengecek…" : "Cek sekarang"}
                    </button>
                  </div>
                </div>
              ) : FINAL.includes(status) || timeUp ? (
                <div className="py-6 text-center">
                  <span className="bounce-in mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-soft text-rose shadow-[0_4px_0_rgb(var(--c-danger)/0.3)]">
                    <Icon.x width={28} height={28} />
                  </span>
                  <h2 className="mt-4 text-xl font-extrabold text-ink">
                    {status === "canceled" ? "QRIS dibatalkan" : status === "failed" ? "Pembayaran gagal" : "QRIS kedaluwarsa"}
                  </h2>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
                    Tidak ada saldo yang terpotong. Kalau kamu sempat membayar, saldo tetap masuk otomatis dalam beberapa menit.
                  </p>
                  <button onClick={reset} className="btn-primary mt-6">
                    Buat QRIS baru
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between">
                    <Badge tone="blue" pulse>
                      Menunggu pembayaran
                    </Badge>
                    {expiresIn !== null && (
                      <TimerQris sisaMs={expiresIn} totalMs={order?.createdAt && order?.expiredAt ? new Date(order.expiredAt).getTime() - new Date(order.createdAt).getTime() : 0} />
                    )}
                  </div>

                  <div className="panel-3d glow-3d mt-4 p-5 text-center">
                    <p className="text-xs font-semibold text-muted">Total yang harus dibayar</p>
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <p className="text-3xl font-extrabold tabular-nums tracking-tight text-ink">{rupiah(payTotal)}</p>
                      <CopyButton value={payTotal} label="" />
                    </div>
                    {order.manualInfo?.kodeUnik > 0 && (
                      <p className="mt-1 text-xs font-semibold text-amber-bright" data-testid="kode-unik">
                        Sudah termasuk kode unik Rp{order.manualInfo.kodeUnik} — ikut masuk ke saldomu.
                      </p>
                    )}
                    {payTotal !== Number(order.amount) && !(order.manualInfo?.kodeUnik > 0) && (
                      <p className="mt-1 text-xs text-warn">Bayar persis sesuai nominal ini supaya terdeteksi otomatis.</p>
                    )}
                    {order.qrImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={order.qrImage}
                        alt="Kode QRIS pembayaran"
                        className="mx-auto mt-4 aspect-square w-full max-w-[260px] rounded-2xl bg-white p-3 shadow-soft"
                      />
                    ) : order.paymentUrl ? (
                      <a href={order.paymentUrl} target="_blank" rel="noreferrer" className="btn-primary mt-4">
                        Buka halaman pembayaran
                      </a>
                    ) : (
                      <Alert className="mt-4">QR tidak tersedia. Batalkan lalu buat ulang.</Alert>
                    )}
                    <p className="mt-3 text-xs text-muted">
                      Scan dengan GoPay, OVO, DANA, ShopeePay, LinkAja, atau m-banking. Berlaku sampai {fmtWIB(order.expiredAt)}.
                    </p>
                    {order.manual && (order.manualInfo?.accountLabel || order.manualInfo?.accountName) && (
                      <div className="mt-3 rounded-xl border border-line bg-surface2 px-3 py-2 text-left">
                        {order.manualInfo.accountLabel && (
                          <p className="text-[11px] font-semibold text-muted">{order.manualInfo.accountLabel}</p>
                        )}
                        {order.manualInfo.accountName && (
                          <p className="text-sm font-extrabold text-ink">a.n. {order.manualInfo.accountName}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {error && (
                    <Alert tone="amber" className="mt-4">
                      {error}
                    </Alert>
                  )}

                  {order.manual ? (
                    // Metode manual tidak punya provider yang bisa ditanya, jadi
                    // "Saya sudah bayar" di sini bukan tombol cek — ia mengirim
                    // kabar ke admin, dan itu harus terasa berbeda.
                    <>
                      {order.manualInfo?.instructions && !confirmOpen && (
                        <div className="panel-3d mt-4 p-4">
                          <p className="text-xs font-extrabold text-ink">Cara bayar</p>
                          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted">
                            {order.manualInfo.instructions}
                          </p>
                        </div>
                      )}

                      {confirmOpen ? (
                        <div className="panel-3d mt-4 p-4">
                          <p className="text-sm font-extrabold text-ink">Kirim konfirmasi ke admin</p>
                          <p className="mt-1 text-xs text-muted">
                            Unggah bukti transfermu dulu. Tanpa bukti, admin tidak bisa mencocokkan pembayaran dan
                            saldonya tidak bisa diproses.
                          </p>

                          <label
                            className={`mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-3 text-xs font-bold hover:border-amber ${
                              proof ? "border-success/50 text-success" : "border-amber/60 text-amber-bright"
                            }`}
                          >
                            📎 {proof ? "Ganti bukti transfer" : "Unggah bukti transfer (wajib)"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                pickProof(e.target.files?.[0]);
                                e.target.value = "";
                              }}
                            />
                          </label>

                          {proof && (
                            <div className="relative mt-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={proof} alt="Bukti bayar" className="mx-auto max-h-48 rounded-xl border border-line" />
                              <button
                                type="button"
                                onClick={() => setProof(null)}
                                className="absolute right-2 top-2 rounded-full bg-rose px-2 py-0.5 text-xs font-bold text-white"
                              >
                                Hapus
                              </button>
                            </div>
                          )}

                          <input
                            value={proofNote}
                            onChange={(e) => setProofNote(e.target.value.slice(0, 200))}
                            placeholder="Catatan untuk admin (opsional)"
                            className="field mt-3 w-full"
                            aria-label="Catatan untuk admin"
                          />

                          <div className="mt-3 flex gap-2">
                            <button type="button" onClick={() => setConfirmOpen(false)} className="btn-ghost flex-1">
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={confirmManual}
                              disabled={confirming || !proof}
                              className="btn-primary flex-[2]"
                            >
                              {confirming ? <Spinner /> : null}
                              {confirming ? (cfg.manual?.ocrAktif ? "Memeriksa bukti…" : "Mengirim…") : proof ? "Saya sudah TF, kirim" : "Unggah bukti dulu"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmOpen(true)} className="btn-primary mt-4 w-full">
                          Saya sudah TF — kirim bukti
                        </button>
                      )}
                    </>
                  ) : (
                    <button type="button" onClick={checkNow} disabled={checking} className="btn-primary mt-4 w-full">
                      {checking ? <Spinner /> : null}
                      {checking ? "Mengecek…" : "Saya sudah bayar"}
                    </button>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={downloadQr} disabled={!order.qrImage} className="btn-ghost">
                      Simpan QR
                    </button>
                    <button type="button" onClick={cancelOrder} disabled={cancelling} className="btn-danger">
                      {cancelling ? "Membatalkan…" : "Batalkan"}
                    </button>
                  </div>
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
                    {order.manual
                      ? "Saldo masuk setelah admin mencocokkan pembayaranmu. Jangan membatalkan kalau sudah membayar."
                      : "Status dicek otomatis tiap beberapa detik. Jangan membatalkan kalau sudah membayar."}
                  </p>

                  <div className="mt-5 divide-y divide-line rounded-2xl border border-line px-4">
                    <Row label="Metode">{order.rute ? "QRIS" : methodName(order.provider)}</Row>
                    <Row label="ID deposit">
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        {order.orderId}
                        <CopyButton value={order.orderId} label="" />
                      </span>
                    </Row>
                    {order.providerRef && (
                      <Row label="Ref provider">
                        <span className="font-mono text-xs">{order.providerRef}</span>
                      </Row>
                    )}
                    <Row label="Saldo masuk">{rupiah(order.amount)}</Row>
                    {order.adminFee ? <Row label="Biaya admin">{rupiah(order.adminFee)}</Row> : null}
                    <Row label="Total bayar" strong>
                      {rupiah(payTotal)}
                    </Row>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {/* Banner di kolom samping, bukan di atas borangnya: yang membuka
              halaman ini sedang di tengah membayar, dan menyisipkan iklan di
              jalur itu membuat orang salah tekan. */}
          <BannerRail placement="deposit" kompak />

          <div className="panel-3d p-5">
            <h2 className="title-3d text-base font-extrabold text-ink">Punya kode voucher?</h2>
            <p className="mt-1 text-xs text-muted">Tukar kode voucher jadi saldo gratis.</p>
            <form onSubmit={redeemVoucher} className="mt-3 flex gap-2">
              <input
                value={voucher}
                onChange={(e) => setVoucher(e.target.value.toUpperCase())}
                placeholder="ARTA-XXXXXX"
                className="field min-w-0 flex-1 font-mono uppercase"
                aria-label="Kode voucher"
              />
              <button type="submit" disabled={voucherBusy || !token || !voucher.trim()} className="btn-dark shrink-0 px-4">
                {voucherBusy ? <Spinner /> : "Klaim"}
              </button>
            </form>
            {voucherMsg && (
              <Alert tone={voucherMsg.ok ? "green" : "red"} className="mt-3">
                {voucherMsg.text}
              </Alert>
            )}
          </div>

          <div className="panel-3d p-5" data-testid="deposit-cashback">
            <div className="flex items-center justify-between gap-2">
              <h2 className="title-3d text-base font-extrabold text-ink">🎁 Cashback Deposit</h2>
              <Link href="/cashback" className="text-[11px] font-bold text-amber-bright underline">Detail</Link>
            </div>
            <p className="mt-1 text-xs text-muted">
              {cb?.tier ? <>Tingkatmu <b className="text-ink">{cb.tier.ikon} {cb.tier.nama}</b>{cb.tier.tambahan > 0 ? ` (+${cb.tier.tambahan}%)` : ""}. Makin besar deposit, makin besar cashback.</> : "Makin besar deposit, makin besar cashback."}
            </p>
            {cb?.simulasi && amt > 0 ? (
              <div className="mt-3 rounded-xl bg-teal-soft px-3 py-3" data-testid="deposit-cashback-hasil">
                <p className="text-[11px] font-bold text-muted">Untuk deposit {rupiah(amt)}</p>
                <p className="text-xl font-black text-teal-bright">+{rupiah(cb.simulasi.cashback)} <span className="text-xs font-bold">({cb.simulasi.persen}%)</span></p>
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted">
                  {cb.simulasi.rincian.map((r) => <li key={r.kunci} className="flex justify-between"><span>{r.label}</span><b className="text-ink">+{r.persen}%</b></li>)}
                </ul>
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-surface2 px-3 py-3 text-xs text-muted">Isi nominal deposit untuk melihat cashback-mu.</p>
            )}
            {cb?.nominal?.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {cb.nominal.map((n) => {
                  const aktif = amt >= n.min && !cb.nominal.some((x) => x.min > n.min && amt >= x.min);
                  return (
                    <div key={n.min} className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all ${aktif ? "bg-amber-soft text-amber-bright ring-2 ring-amber/50" : "bg-surface2 text-muted opacity-75"}`}>
                      <span>Deposit ≥ {rupiah(n.min)}</span>
                      <span>+{n.tambahan}% ekstra{aktif ? " ✓" : ""}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card-flat p-5">
            <h2 className="text-base font-bold text-ink">Perlu diketahui</h2>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted">
              <li>Saldo masuk otomatis setelah QRIS dibayar, biasanya dalam hitungan detik.</li>
              <li>Saldo hanya bisa dipakai di {brand.nama} dan tidak bisa ditarik tunai.</li>
              <li>QRIS kedaluwarsa? Buat yang baru — belum ada saldo yang terpotong.</li>
              <li>
                Status semua deposit ada di{" "}
                <Link href="/riwayat?tab=deposit" className="font-semibold text-amber-bright">
                  Riwayat
                </Link>
                .
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
