"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/app/providers";
import SimCard from "@/components/SimCard";
import AccountInfoModal from "@/components/AccountInfoModal";
import SpinWheelGame from "@/components/SpinWheelGame";
import { Icon, rupiah, EmptyState } from "@/components/ui";

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }));
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

function Bars({ data, keyName, className }) {
  const max = Math.max(1, ...data.map((d) => d[keyName]));
  return (
    <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={`Grafik ${keyName} 30 hari`}>
      {data.map((d) => (
        <span
          key={d.date}
          title={`${d.date}: ${keyName === "total" ? d[keyName] : rupiah(d[keyName])}`}
          className={`flex-1 rounded-t-[3px] ${d[keyName] > 0 ? className : "bg-surface2"}`}
          style={{ height: `${Math.max(4, (d[keyName] / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

const shortcuts = [
  { href: "/otp", label: "Beli nokos", icon: Icon.phone },
  { href: "/suntik", label: "Suntik sosmed", icon: Icon.rocket },
  { href: "/deposit", label: "Isi saldo", icon: Icon.qris },
  { href: "/transfer", label: "Transfer", icon: Icon.transfer },
  { href: "/mutasi", label: "Mutasi", icon: Icon.ledger },
  { href: "/referral", label: "Undang teman", icon: Icon.gift }
];

function WarrantyModal({ open, onClose, token }) {
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [description, setDescription] = useState("");
  const [screenshotData, setScreenshotData] = useState(null);
  const [screenshotName, setScreenshotName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [claims, setClaims] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open || !token) return;
    setOrdersLoading(true);
    setSelectedOrder(null);
    setDescription("");
    setScreenshotData(null);
    setScreenshotName("");
    setPurchasePrice("");
    setMsg({ text: "", ok: false });

    const t = encodeURIComponent(token);
    Promise.all([
      fetch(`/api/otp/history?token=${t}`).then((r) => r.json()),
      fetch(`/api/warranty/claim?token=${t}`).then((r) => r.json())
    ])
      .then(([hist, claimsData]) => {
        setOrders(Array.isArray(hist.items) ? hist.items : []);
        setClaims(Array.isArray(claimsData.items) ? claimsData.items : []);
      })
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [open, token]);

  if (!open) return null;

  const claimedIds = new Set(claims.map((c) => c.orderId));

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setMsg({ text: "Ukuran gambar maks 1.5 MB.", ok: false });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setScreenshotData(ev.target.result);
      setScreenshotName(file.name);
      setMsg({ text: "", ok: false });
    };
    reader.readAsDataURL(file);
  }

  async function submit(e) {
    e.preventDefault();
    if (!selectedOrder) { setMsg({ text: "Pilih nokos terlebih dahulu.", ok: false }); return; }
    if (!description.trim()) { setMsg({ text: "Isi deskripsi masalah.", ok: false }); return; }
    if (!purchasePrice || Number(purchasePrice) <= 0) { setMsg({ text: "Isi harga beli yang valid.", ok: false }); return; }

    setSubmitting(true);
    setMsg({ text: "", ok: false });
    try {
      const res = await fetch("/api/warranty/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          orderId: selectedOrder.orderId,
          description: description.trim(),
          screenshotData,
          purchasePrice: Number(purchasePrice)
        })
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ text: data.error || "Gagal mengirim klaim.", ok: false }); return; }
      setMsg({ text: "Klaim garansi berhasil dikirim! Admin akan memproses dalam 1x24 jam.", ok: true });
      setClaims((prev) => [
        { orderId: selectedOrder.orderId, status: "pending", createdAt: new Date() },
        ...prev
      ]);
      setSelectedOrder(null);
      setDescription("");
      setScreenshotData(null);
      setScreenshotName("");
      setPurchasePrice("");
    } finally {
      setSubmitting(false);
    }
  }

  const statusBadge = (s) => {
    if (s === "approved") return <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[10px] font-semibold text-teal-bright">Disetujui</span>;
    if (s === "rejected") return <span className="rounded-full bg-rose-soft px-2 py-0.5 text-[10px] font-semibold text-rose">Ditolak</span>;
    return <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-semibold text-amber-bright">Menunggu</span>;
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center px-0 sm:px-5">
      <button
        aria-label="Tutup"
        onClick={onClose}
        className="animate-fade-in absolute inset-0"
        style={{ background: "rgb(var(--c-ink) / 0.45)" }}
      />
      <div className="animate-scale-in relative w-full max-w-lg overflow-hidden rounded-t-2xl sm:rounded-2xl border border-line bg-surface shadow-lift flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between bg-rose px-5 py-4 text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-base">🛡️</span>
            <p className="text-sm font-semibold">Klaim Garansi Nokos</p>
          </div>
          <button onClick={onClose} className="press flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15" aria-label="Tutup">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Info */}
          <div className="rounded-xl border border-amber/30 bg-amber-soft p-3.5 text-xs text-amber-bright">
            Garansi hanya bisa diklaim <strong>1x per nokos</strong>. Klaim akan diproses admin dalam 1×24 jam. Jika disetujui, saldo dikembalikan sesuai harga beli.
          </div>

          {/* Riwayat klaim */}
          {claims.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted mb-2">Riwayat klaim kamu</p>
              <div className="space-y-1.5">
                {claims.map((c) => (
                  <div key={c.orderId} className="flex items-center justify-between rounded-xl border border-line bg-surface2 px-3 py-2.5 text-xs">
                    <span className="font-mono text-ink truncate max-w-[160px]">#{c.orderId}</span>
                    {statusBadge(c.status)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            {/* Pilih nokos */}
            <div>
              <p className="text-xs font-semibold text-ink mb-2">1. Pilih nokos yang bermasalah</p>
              {ordersLoading ? (
                <div className="skeleton h-20 rounded-xl" />
              ) : orders.length === 0 ? (
                <p className="text-sm text-muted">Belum ada riwayat nokos.</p>
              ) : (
                <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-xl border border-line p-2">
                  {orders.map((o) => {
                    const alreadyClaimed = claimedIds.has(o.orderId);
                    const isSelected = selectedOrder?.orderId === o.orderId;
                    return (
                      <button
                        key={o.orderId}
                        type="button"
                        disabled={alreadyClaimed}
                        onClick={() => {
                          setSelectedOrder(o);
                          setPurchasePrice(String(o.price || ""));
                        }}
                        className={`w-full text-left rounded-lg px-3 py-2.5 text-xs transition-colors ${
                          alreadyClaimed
                            ? "opacity-40 cursor-not-allowed bg-surface2"
                            : isSelected
                            ? "border border-rose/50 bg-rose-soft text-rose"
                            : "border border-transparent hover:border-line bg-surface hover:bg-surface2 text-ink"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold truncate">{o.serviceName} — {o.countryName}</span>
                          <span className="shrink-0 font-mono text-[10px] text-muted">#{o.orderId?.slice(-8)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-muted">
                          <span>{o.phoneNumber || "-"}</span>
                          <span>·</span>
                          <span>{rupiah(o.price)}</span>
                          {alreadyClaimed && <span className="text-rose ml-auto">Sudah diklaim</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Deskripsi */}
            <div>
              <label className="text-xs font-semibold text-ink">2. Deskripsi masalah</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan masalahnya, misal: nomor tidak menerima SMS / kode OTP tidak masuk..."
                rows={3}
                maxLength={1000}
                required
                className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-rose"
              />
            </div>

            {/* Screenshot */}
            <div>
              <label className="text-xs font-semibold text-ink">3. Screenshot bukti masalah (opsional, maks 1.5 MB)</label>
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-ghost px-3 py-2 text-xs"
                >
                  {screenshotName ? `✓ ${screenshotName}` : "Pilih gambar"}
                </button>
                {screenshotData && (
                  <button
                    type="button"
                    onClick={() => { setScreenshotData(null); setScreenshotName(""); }}
                    className="text-xs text-rose hover:underline"
                  >
                    Hapus
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              {screenshotData && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={screenshotData} alt="Preview" className="mt-2 max-h-32 rounded-lg object-contain border border-line" />
              )}
            </div>

            {/* Harga beli */}
            <div>
              <label className="text-xs font-semibold text-ink">4. Harga beli nokos (Rp)</label>
              <input
                type="number"
                min="1"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="Contoh: 3000"
                required
                className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-rose"
              />
            </div>

            {msg.text && (
              <p className={`text-xs font-medium ${msg.ok ? "text-teal-bright" : "text-rose"}`}>{msg.text}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedOrder}
              className="w-full rounded-xl bg-rose hover:opacity-90 px-5 py-3 text-sm font-bold text-white shadow-3d disabled:opacity-50 transition-opacity"
            >
              {submitting ? "Mengirim..." : "Kirim Klaim Garansi"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { token, name, balance, joinedAt, ready } = useUser();
  const [stats, setStats] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [board, setBoard] = useState(null);
  const [modal, setModal] = useState(false);
  const [warrantyModal, setWarrantyModal] = useState(false);
  const [checkin, setCheckin] = useState(null);
  const [checkinLoading, setCheckinLoading] = useState(true);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [balanceTarget, setBalanceTarget] = useState(0);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");

  useEffect(() => {
    if (!token) return;
    const t = encodeURIComponent(token);
    fetch(`/api/user/stats?token=${t}`)
      .then((r) => r.json())
      .then((d) => setStats(d.error ? { daily: [] } : d))
      .catch(() => setStats({ daily: [] }));
    fetch(`/api/loyalty/info?token=${t}`)
      .then((r) => r.json())
      .then((d) => setLoyalty(d.error ? null : d))
      .catch(() => {});
    fetch(`/api/checkin?token=${t}`)
      .then((r) => r.json())
      .then((d) => setCheckin(d.error ? null : d))
      .catch(() => {})
      .finally(() => setCheckinLoading(false));
  }, [token]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("artapedia_balance_target");
      if (saved) setBalanceTarget(Number(saved));
    } catch {}
  }, []);

  async function doCheckin() {
    if (!token || checkinBusy) return;
    setCheckinBusy(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      setCheckin(data);
    } catch {
    } finally {
      setCheckinBusy(false);
    }
  }

  function saveTarget() {
    const val = Number(targetInput);
    if (!val || val <= 0) return;
    setBalanceTarget(val);
    try { localStorage.setItem("artapedia_balance_target", String(val)); } catch {}
    setEditingTarget(false);
  }

  useEffect(() => {
    fetch("/api/leaderboard/orders")
      .then((r) => r.json())
      .then((d) => setBoard(d.items || []))
      .catch(() => setBoard([]));
  }, []);

  const hasOrders = useMemo(() => stats?.daily?.some((d) => d.total > 0), [stats]);
  const spend = useMemo(
    () => (stats?.daily || []).reduce((a, d) => ({ masuk: a.masuk + d.masuk, keluar: a.keluar + d.keluar }), { masuk: 0, keluar: 0 }),
    [stats]
  );
  const progress = loyalty?.next ? Math.min(100, Math.round((loyalty.totalSpent / loyalty.next.target) * 100)) : 100;

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{greeting()},</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {ready ? name || "Pelanggan Artapedia" : "…"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setWarrantyModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-rose/40 bg-rose-soft px-4 py-2.5 text-sm font-semibold text-rose transition-colors hover:bg-rose/10"
          >
            🛡️ Claim Garansi
          </button>
          <button onClick={() => setModal(true)} className="btn-ghost px-4 py-2.5">
            {name ? "Info akun" : "Atur nama & kode akun"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[440px_1fr]">
        <SimCard />

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3">
          {shortcuts.map((s) => {
            const I = s.icon;
            return (
              <Link key={s.href} href={s.href} className="card hover-lift flex flex-col items-center justify-center gap-2 px-2 py-4 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-soft text-amber-bright">
                  <I />
                </span>
                <span className="text-xs font-semibold text-ink">{s.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total transaksi", stats?.totalTransaksi],
          ["OTP berhasil", stats?.otpBerhasil],
          ["Suntik selesai", stats?.smmSelesai],
          ["Deposit sukses", stats?.depositSukses]
        ].map(([label, v]) => (
          <div key={label} className="card p-4">
            <p className="text-2xl font-extrabold tabular-nums text-ink">{stats ? v ?? 0 : "…"}</p>
            <p className="mt-0.5 text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      {/* Daily Check-in + Spin Wheel + Balance Target */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Check-in Card */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🗓️</span>
            <h2 className="text-base font-bold text-ink">Check-in Harian</h2>
          </div>
          {checkinLoading ? (
            <div className="skeleton h-16 rounded-xl" />
          ) : checkin?.alreadyDone ? (
            <div className="text-center">
              <p className="text-3xl font-extrabold text-amber-bright">🔥 {checkin.streak}</p>
              <p className="text-xs text-muted mt-1">hari berturut-turut</p>
              <div className="mt-3 rounded-xl bg-amber-soft px-4 py-2">
                <p className="text-xs font-semibold text-amber-bright">Sudah check-in hari ini ✓</p>
                <p className="text-xs text-muted mt-0.5">Total {checkin.points} poin terkumpul</p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted mb-1">Streak saat ini: <strong className="text-ink">{checkin?.streak || 0} hari</strong></p>
              <p className="text-xs text-muted mb-3">Check-in tiap hari = bonus poin berlipat!</p>
              <button
                onClick={doCheckin}
                disabled={checkinBusy}
                className="w-full rounded-xl bg-gradient-to-r from-amber to-amber-bright py-2.5 text-sm font-bold text-white shadow-3d disabled:opacity-50"
              >
                {checkinBusy ? "Memproses..." : "✅ Check-in Sekarang"}
              </button>
            </div>
          )}
          {checkin?.alreadyDone === false && checkin?.streak > 0 && (
            <p className="mt-2 text-center text-[11px] text-muted">Kembali besok untuk menjaga streak!</p>
          )}
        </div>

        {/* Spin Wheel */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎡</span>
            <h2 className="text-base font-bold text-ink">Putar Roda Keberuntungan</h2>
          </div>
          <SpinWheelGame />
        </div>

        {/* Balance Target */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎯</span>
            <h2 className="text-base font-bold text-ink">Target Saldo</h2>
          </div>
          {balanceTarget > 0 ? (
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-muted">Saldo sekarang</span>
                <span className="text-xs font-semibold text-ink">{rupiah(balance || 0)}</span>
              </div>
              <div className="h-3 rounded-full bg-surface2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal to-teal-bright transition-all"
                  style={{ width: `${Math.min(100, Math.round(((balance || 0) / balanceTarget) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[11px] text-muted">Rp0</span>
                <span className="text-[11px] font-semibold text-teal-bright">{rupiah(balanceTarget)}</span>
              </div>
              <p className="mt-2 text-xs text-center text-muted">
                {(balance || 0) >= balanceTarget
                  ? "🎉 Target tercapai!"
                  : `Kurang ${rupiah(balanceTarget - (balance || 0))} lagi`}
              </p>
              <button
                onClick={() => { setTargetInput(String(balanceTarget)); setEditingTarget(true); }}
                className="mt-3 w-full text-xs text-muted hover:text-ink"
              >
                Ubah target
              </button>
            </div>
          ) : editingTarget ? (
            <div>
              <p className="text-xs text-muted mb-2">Masukkan target saldo kamu:</p>
              <input
                type="number"
                min="1000"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTarget()}
                placeholder="Contoh: 50000"
                autoFocus
                className="w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={saveTarget} className="flex-1 rounded-xl bg-teal-bright py-2 text-xs font-bold text-white">Simpan</button>
                <button onClick={() => setEditingTarget(false)} className="flex-1 rounded-xl border border-line py-2 text-xs text-muted">Batal</button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted mb-3">Tetapkan target saldo untuk memantau progres tabunganmu.</p>
              <button
                onClick={() => { setTargetInput(""); setEditingTarget(true); }}
                className="rounded-xl border border-teal/30 bg-teal-soft px-5 py-2 text-sm font-semibold text-teal-bright hover:bg-teal/20"
              >
                + Set Target
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-ink">Pesanan 30 hari</h2>
            <span className="text-xs text-muted">nokos + suntik</span>
          </div>
          {!stats ? (
            <div className="skeleton mt-4 h-28 rounded-xl" />
          ) : hasOrders ? (
            <div className="mt-4">
              <Bars data={stats.daily} keyName="total" className="bg-amber" />
            </div>
          ) : (
            <EmptyState icon="📈" title="Belum ada pesanan bulan ini" />
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-ink">Arus saldo 30 hari</h2>
            <span className="text-xs">
              <span className="font-semibold text-success">+{rupiah(spend.masuk)}</span>
              <span className="text-muted"> / </span>
              <span className="font-semibold text-rose">−{rupiah(spend.keluar)}</span>
            </span>
          </div>
          {!stats ? (
            <div className="skeleton mt-4 h-28 rounded-xl" />
          ) : spend.masuk + spend.keluar > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <Bars data={stats.daily} keyName="masuk" className="bg-success" />
                <p className="mt-1.5 text-center text-[11px] text-muted">Masuk</p>
              </div>
              <div>
                <Bars data={stats.daily} keyName="keluar" className="bg-rose" />
                <p className="mt-1.5 text-center text-[11px] text-muted">Keluar</p>
              </div>
            </div>
          ) : (
            <EmptyState icon="💼" title="Belum ada pergerakan saldo" />
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Link href="/loyalitas" className="card hover-lift block p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">Level & poin</h2>
            <span className="text-2xl" aria-hidden="true">
              {loyalty?.badge?.icon || "🥉"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Level <span className="font-bold text-ink">{loyalty?.badge?.name || "Bronze"}</span> ·{" "}
            <span className="font-bold tabular-nums text-ink">{Number(loyalty?.points || 0).toLocaleString("id-ID")}</span> poin
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-amber" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            {loyalty?.next
              ? `Belanja ${rupiah(loyalty.next.remaining)} lagi untuk naik ke ${loyalty.next.name}.`
              : "Kamu sudah di level tertinggi."}
          </p>
        </Link>

        <div className="card p-5">
          <h2 className="text-base font-bold text-ink">10 pembeli teraktif</h2>
          <ol className="mt-3 divide-y divide-line">
            {board === null ? (
              Array.from({ length: 3 }).map((_, i) => <li key={i} className="skeleton my-2 h-9 rounded-lg" />)
            ) : board.length === 0 ? (
              <li className="py-4 text-sm text-muted">Belum ada data.</li>
            ) : (
              board.map((u) => (
                <li key={u.rank} className="flex items-center gap-3 py-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold ${
                      u.rank === 1 ? "bg-amber text-white" : u.rank <= 3 ? "bg-teal-bright text-white" : "bg-surface2 text-muted"
                    }`}
                  >
                    {u.rank}
                  </span>
                  <span className="flex-1 font-mono text-sm text-ink">{u.token}</span>
                  <span className="text-xs font-semibold tabular-nums text-muted">{u.successCount} sukses</span>
                </li>
              ))
            )}
          </ol>
        </div>
      </div>

      <AccountInfoModal open={modal} onClose={() => setModal(false)} token={token} balance={balance} joinedAt={joinedAt} />
      <WarrantyModal open={warrantyModal} onClose={() => setWarrantyModal(false)} token={token} />
    </div>
  );
}
