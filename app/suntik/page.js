"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/app/providers";
import { platformIcon } from "@/components/PlatformIcon";
import SmmOrderCard from "@/components/SmmOrderCard";
import { PageHeader, Icon, Alert, Badge, EmptyState, Spinner, rupiah } from "@/components/ui";
import { SMM_TARGET_HINT } from "@/lib/paymentProviders";

export default function SuntikPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-content px-5 py-10 text-sm text-muted">Memuat…</div>}>
      <SuntikInner />
    </Suspense>
  );
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

function SuntikInner() {
  const { token, balance, refreshBalance, setBalance } = useUser();
  const params = useSearchParams();

  const [enabled, setEnabled] = useState(true);
  const [platforms, setPlatforms] = useState([]);
  const [platformsLoading, setPlatformsLoading] = useState(true);
  const [platform, setPlatform] = useState(params.get("platform") || "");
  const [kinds, setKinds] = useState([]);
  const [kind, setKind] = useState("");
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("rekomendasi");

  const [selected, setSelected] = useState(null);
  const [target, setTarget] = useState("");
  const [qty, setQty] = useState("");
  const [comments, setComments] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(null);

  const [orders, setOrders] = useState([]);
  const formRef = useRef(null);

  useEffect(() => {
    fetch("/api/smm/platforms")
      .then((r) => r.json())
      .then((d) => {
        if (d.enabled === false) setEnabled(false);
        const list = Array.isArray(d.items) ? d.items : [];
        setPlatforms(list);
        if (d.error) setLoadError(d.error);
        setPlatform((p) => p || list[0]?.platform || "");
      })
      .catch(() => setLoadError("Daftar platform belum bisa dimuat."))
      .finally(() => setPlatformsLoading(false));
  }, []);

  useEffect(() => {
    if (!platform) return;
    setKinds([]);
    setKind("");
    setServices([]);
    setSelected(null);
    fetch(`/api/smm/kinds?platform=${encodeURIComponent(platform)}`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.items) ? d.items : [];
        setKinds(list);
        const preferred = list.find((k) => /follower/i.test(k.kind)) || list[0];
        setKind(preferred?.kind || "");
      })
      .catch(() => setKinds([]));
  }, [platform]);

  useEffect(() => {
    if (!platform || !kind) return;
    setServicesLoading(true);
    setLoadError("");
    setSelected(null);
    fetch(`/api/smm/services?platform=${encodeURIComponent(platform)}&kind=${encodeURIComponent(kind)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setLoadError(d.error);
        setServices(Array.isArray(d.items) ? d.items : []);
      })
      .catch(() => setLoadError("Layanan belum bisa dimuat."))
      .finally(() => setServicesLoading(false));
  }, [platform, kind]);

  const loadOrders = useCallback(() => {
    if (!token) return;
    fetch(`/api/smm/orders?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setOrders(Array.isArray(d.items) ? d.items : []))
      .catch(() => {});
  }, [token]);

  useEffect(() => loadOrders(), [loadOrders]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? services.filter((s) => `${s.title} ${s.name}`.toLowerCase().includes(q)) : services;
    list = [...list];
    if (sort === "murah") list.sort((a, b) => a.price - b.price);
    else if (sort === "cepat") list.sort((a, b) => (a.startMinutes ?? 1e9) - (b.startMinutes ?? 1e9));
    return list;
  }, [services, query, sort]);

  function choose(s) {
    setSelected(s);
    setQty(String(Math.max(s.min, Math.min(1000, s.max || 1000))));
    setComments("");
    setFormError("");
    setSuccess(null);
    setAgree(false);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const commentLines = comments.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const quantity = selected?.customComments ? commentLines.length : Math.floor(Number(qty) || 0);
  const total = selected ? Math.max(1, Math.ceil((selected.price * quantity) / (selected.pricePer || 1000))) : 0;
  const hint = SMM_TARGET_HINT[selected?.targetType] || SMM_TARGET_HINT.profile;

  async function submit(e) {
    e.preventDefault();
    if (!selected) return;
    setFormError("");
    if (target.trim().length < 3) return setFormError(`${hint.label} wajib diisi.`);
    if (quantity < selected.min || (selected.max && quantity > selected.max)) {
      return setFormError(`Jumlah harus ${fmtNum(selected.min)} – ${fmtNum(selected.max)}.`);
    }
    if (total > balance) return setFormError("Saldo kamu tidak cukup untuk pesanan ini.");
    if (!agree) return setFormError("Centang pernyataan akun/postingan dalam mode publik dulu.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/smm/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          serviceId: selected.id,
          target: target.trim(),
          quantity,
          comments: selected.customComments ? comments : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pesanan gagal dibuat.");
      setSuccess(data);
      if (typeof data.balance === "number") setBalance(data.balance);
      else refreshBalance();
      setTarget("");
      loadOrders();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-content px-4 py-10 sm:px-5">
        <PageHeader icon={<Icon.rocket />} title="Suntik sosmed" />
        <div className="card mt-6">
          <EmptyState icon="🛠️" title="Fitur suntik sedang dinonaktifkan" desc="Admin sedang melakukan perawatan. Coba lagi nanti." />
        </div>
      </div>
    );
  }

  const activeOrders = orders.filter((o) => !o.settled && o.status !== "failed");

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader
        icon={<Icon.rocket />}
        title="Suntik sosmed"
        desc="Tambah followers, likes, views, dan lainnya. Pesanan batal atau hanya masuk sebagian? Sisa saldonya dikembalikan otomatis."
      />

      {/* 1. Platform */}
      <section className="mt-6" aria-label="Pilih platform">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {platformsLoading
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[52px] w-36 shrink-0 rounded-2xl" />)
            : platforms.map((p) => {
                const on = p.platform === platform;
                return (
                  <button
                    key={p.platform}
                    onClick={() => setPlatform(p.platform)}
                    aria-pressed={on}
                    className={`flex shrink-0 items-center gap-2.5 rounded-2xl border py-2 pl-2 pr-4 text-left transition-colors ${
                      on ? "border-amber bg-amber-soft/70 ring-4 ring-amber/10" : "border-line bg-surface hover:border-amber/40"
                    }`}
                  >
                    {platformIcon(p.platform, 34)}
                    <span>
                      <span className="block text-sm font-bold text-ink">{p.platform}</span>
                      <span className="block text-[11px] text-muted">mulai {rupiah(p.minPrice)}/1rb</span>
                    </span>
                  </button>
                );
              })}
        </div>
      </section>

      {loadError && <Alert className="mt-4">{loadError}</Alert>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        {/* 2. Layanan */}
        <section className="card overflow-hidden" aria-label="Pilih layanan">
          <div className="border-b border-line p-4">
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {kinds.length === 0 && platform && <div className="skeleton h-9 w-full rounded-xl" />}
              {kinds.map((k) => (
                <button
                  key={k.kind}
                  onClick={() => setKind(k.kind)}
                  className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                    kind === k.kind ? "bg-ink text-bg" : "bg-surface2 text-muted hover:text-ink"
                  }`}
                >
                  {k.kind}
                  <span className="ml-1.5 text-[11px] font-medium opacity-70">{k.total}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Icon.search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari: real, indonesia, refill…"
                  className="field pl-10"
                  aria-label="Cari layanan"
                />
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="field w-auto pr-8" aria-label="Urutkan">
                <option value="rekomendasi">Rekomendasi</option>
                <option value="murah">Termurah</option>
                <option value="cepat">Tercepat mulai</option>
              </select>
            </div>
          </div>

          <div className="max-h-[640px] divide-y divide-line overflow-y-auto">
            {servicesLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4">
                  <div className="skeleton h-14 rounded-xl" />
                </div>
              ))
            ) : shown.length === 0 ? (
              <EmptyState icon="🔎" title="Belum ada layanan" desc="Coba kategori lain atau ubah kata kunci pencarian." />
            ) : (
              shown.map((s) => {
                const on = selected?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => choose(s)}
                    className={`flex w-full items-start gap-3 p-4 text-left transition-colors ${on ? "bg-amber-soft/60" : "hover:bg-surface2/60"}`}
                  >
                    <span
                      className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 ${
                        on ? "border-amber bg-amber shadow-[inset_0_0_0_3px_rgb(var(--c-surface))]" : "border-line"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-ink">{s.title}</span>
                        {s.recommended && <Badge tone="blue">Rekomendasi</Badge>}
                        {s.refill && <Badge tone="green">Garansi refill</Badge>}
                        {(s.qualityTags || []).slice(0, 3).map((t) => (
                          <Badge key={t} tone="gray">
                            {t}
                          </Badge>
                        ))}
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        ID {s.id} · min {fmtNum(s.min)} · maks {fmtNum(s.max)}
                        {s.speedLabel ? ` · ${s.speedLabel}` : ""}
                        {s.completionRate != null ? ` · ${s.completionRate}% tuntas` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-extrabold tabular-nums text-ink">{rupiah(s.price)}</span>
                      <span className="block text-[11px] text-muted">per {fmtNum(s.pricePer)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* 3. Form pesanan */}
        <section ref={formRef} className="card scroll-mt-24 p-5 lg:sticky lg:top-24" aria-label="Detail pesanan">
          {!selected ? (
            <div className="py-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface2 text-amber-bright">
                <Icon.rocket />
              </span>
              <p className="mt-3 text-sm font-bold text-ink">Pilih layanan dulu</p>
              <p className="mt-1 text-xs text-muted">Ketuk salah satu layanan di daftar untuk mengisi detail pesanan.</p>
            </div>
          ) : success ? (
            <div className="py-4 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
                <Icon.check width={26} height={26} />
              </span>
              <p className="mt-3 text-lg font-extrabold text-ink">Pesanan diproses</p>
              <p className="mt-1 text-sm text-muted">
                {fmtNum(success.quantity)} {selected.kind?.toLowerCase()} · {rupiah(success.charge)}
              </p>
              <p className="mt-1 font-mono text-xs text-muted">#{success.id}</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button onClick={() => setSuccess(null)} className="btn-ghost">
                  Pesan lagi
                </button>
                <Link href="/riwayat?tab=suntik" className="btn-dark">
                  Lihat progres
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="flex items-start gap-3">
                {platformIcon(selected.platform, 38)}
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug text-ink">{selected.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {selected.platform} · {selected.kind} · {rupiah(selected.price)}/{fmtNum(selected.pricePer)}
                  </p>
                </div>
              </div>

              {selected.note && <Alert tone="blue">{selected.note}</Alert>}

              <div>
                <label className="label" htmlFor="target">
                  {hint.label}
                </label>
                <input
                  id="target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={hint.placeholder}
                  className="field"
                  autoComplete="off"
                  inputMode="url"
                />
              </div>

              {selected.customComments ? (
                <div>
                  <label className="label" htmlFor="comments">
                    Daftar komentar <span className="font-normal text-muted">(satu baris = satu komentar)</span>
                  </label>
                  <textarea
                    id="comments"
                    rows={5}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="field resize-y"
                    placeholder={"Mantap kak!\nKeren banget 🔥\nSukses terus"}
                  />
                  <p className="mt-1 text-xs text-muted">
                    {commentLines.length} komentar · min {fmtNum(selected.min)}, maks {fmtNum(selected.max)}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="label" htmlFor="qty">
                    Jumlah
                  </label>
                  <input
                    id="qty"
                    inputMode="numeric"
                    value={qty ? fmtNum(qty) : ""}
                    onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    className="field text-lg font-bold tabular-nums"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[100, 500, 1000, 5000, 10000]
                      .filter((v) => v >= selected.min && v <= (selected.max || Infinity))
                      .map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setQty(String(v))}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold tabular-nums ${
                            quantity === v ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-muted hover:text-ink"
                          }`}
                        >
                          {fmtNum(v)}
                        </button>
                      ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    Min {fmtNum(selected.min)} · maks {fmtNum(selected.max)}
                  </p>
                </div>
              )}

              <div className="rounded-2xl bg-surface2 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Total bayar</span>
                  <span className="text-xl font-extrabold tabular-nums text-ink">{rupiah(total)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-muted">Saldo kamu</span>
                  <span className={`font-semibold tabular-nums ${total > balance ? "text-rose" : "text-ink"}`}>{rupiah(balance)}</span>
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--c-blue))]" />
                Akun/postingan target dalam mode publik, username tidak akan diganti selama proses, dan saya tidak memesan layanan yang sama ke link ini sebelum selesai.
              </label>

              {formError && <Alert>{formError}</Alert>}

              {total > balance ? (
                <Link href="/deposit" className="btn-primary w-full">
                  Isi saldo dulu ({rupiah(total - balance)} lagi)
                </Link>
              ) : (
                <button type="submit" disabled={submitting || !token} className="btn-primary w-full">
                  {submitting ? <Spinner /> : null}
                  {submitting ? "Memproses…" : `Pesan sekarang · ${rupiah(total)}`}
                </button>
              )}
            </form>
          )}
        </section>
      </div>

      {/* Pesanan berjalan */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Pesanan berjalan</h2>
          <Link href="/riwayat?tab=suntik" className="text-sm font-semibold text-amber-bright">
            Semua riwayat
          </Link>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {activeOrders.length === 0 ? (
            <div className="card md:col-span-2">
              <EmptyState icon="🚀" title="Belum ada pesanan berjalan" desc="Pesanan suntik yang sedang diproses akan tampil di sini." />
            </div>
          ) : (
            activeOrders.slice(0, 6).map((o) => (
              <SmmOrderCard key={o.id} order={o} token={token} onSettled={() => (refreshBalance(), loadOrders())} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
