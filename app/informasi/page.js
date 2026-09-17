"use client";

import { useEffect, useMemo, useState } from "react";

const CATEGORIES = ["Semua", "Informasi", "Promo", "Penting"];

export default function InformasiPage() {
  const [tab, setTab] = useState("pengumuman"); // pengumuman | kotak-masuk
  const [category, setCategory] = useState("Semua");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/announcements/public")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (category === "Semua") return items;
    return items.filter((a) => a.category === category);
  }, [category, items]);

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <p className="fade-up text-sm font-semibold text-amber-bright">📣 Update Terkini</p>
      <h1 className="fade-up delay-1 mt-2 text-[26px] font-extrabold tracking-tight text-ink sm:text-[32px]">
        Pusat Informasi
      </h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Pantau pengumuman resmi dan status transaksi kamu di sini.
      </p>

      {/* Tabs */}
      <div className="fade-up delay-3 mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-line p-1">
        {[
          { key: "pengumuman", label: "PENGUMUMAN" },
          { key: "kotak-masuk", label: "KOTAK MASUK" }
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`press rounded-lg py-2 text-xs font-semibold tracking-wide transition-colors ${
              tab === t.key ? "bg-gradient-to-r from-amber to-teal text-white shadow-glow" : "text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pengumuman" ? (
        <>
          {/* Category chips */}
          <div className="fade-up delay-4 mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`press rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  category === c
                    ? "border-amber bg-amber-soft text-amber-bright"
                    : "border-line text-muted hover:text-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {loading ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-28 rounded-2xl border border-line" />
                ))}
              </div>
            ) : (
              <>
                {filtered.map((a, i) => (
                  <article
                    key={a.id}
                    className={`fade-up card-shadow rounded-2xl border border-line bg-surface p-5 delay-${Math.min(i + 5, 6)}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-soft text-lg">
                        {a.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-sm font-semibold text-ink">{a.title}</h3>
                          <span className="rounded bg-teal-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-bright">
                            {a.category}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted">🕒 {a.date}</p>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/90">{a.body}</p>
                    <div className="mt-4 flex items-center gap-4 border-t border-line pt-3 text-xs text-muted">
                      <span className="flex items-center gap-1">👁 {a.views}</span>
                      <span className="flex items-center gap-1">❤️ {a.likes}</span>
                      <span className="flex items-center gap-1">🔥 {a.fire}</span>
                    </div>
                  </article>
                ))}
                {filtered.length === 0 && (
                  <p className="py-10 text-center text-sm text-muted">Belum ada pengumuman untuk kategori ini.</p>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-surface py-16 text-center">
          <span className="text-3xl">📬</span>
          <p className="text-sm text-muted">Kotak masuk kosong. Notifikasi transaksi pribadi akan muncul di sini.</p>
        </div>
      )}
    </div>
  );
}
