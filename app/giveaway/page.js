"use client";

import { SkelHalaman, SkelBaris, Skel } from "@/components/Skeleton";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/app/providers";

export const dynamic = "force-dynamic";

const FASE = {
  akan: { label: "Belum dibuka", cls: "bg-amber" },
  buka: { label: "DIBUKA", cls: "bg-success" },
  tutup: { label: "Menunggu undian", cls: "bg-blue" },
  selesai: { label: "Selesai", cls: "bg-muted" },
  batal: { label: "Dibatalkan", cls: "bg-rose" }
};

export default function GiveawayPage() {
  const { token } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/giveaway${token ? `?token=${encodeURIComponent(token)}` : ""}`);
      const d = await res.json();
      if (res.ok) setItems(d.items || []);
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Satu fungsi untuk dua arah, tapi arahnya dikirim eksplisit dari tombolnya
  // masing-masing — bukan ditebak dari keadaan yang ada di layar. Keadaan di
  // layar bisa basi (peserta lain baru mendaftar, giveaway baru ditutup), dan
  // yang basi jangan sampai menentukan apa yang terjadi pada tiket orang.
  async function kirim(giveawayId, aksi) {
    setBusy(giveawayId); setMsg(""); setErr("");
    try {
      const res = await fetch("/api/giveaway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, giveawayId, aksi })
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || (aksi === "batal" ? "Gagal membatalkan." : "Gagal ikut."));
        // Pesan galatnya sendiri sudah menandakan layarnya tidak sesuai
        // kenyataan, jadi dimuat ulang apa pun galatnya.
        load();
        return;
      }
      setMsg(d.pesan || "Berhasil!");
      load();
    } catch {
      setErr("Jaringan bermasalah, coba lagi.");
    } finally {
      setBusy("");
      setTimeout(() => { setMsg(""); setErr(""); }, 6000);
    }
  }

  const hadiah = (ev) =>
    ev.jenisHadiah === "poin"
      ? `${Number(ev.nilaiHadiah).toLocaleString("id-ID")} poin`
      : `Rp${Number(ev.nilaiHadiah).toLocaleString("id-ID")}`;

  const jam = (d) =>
    new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <div className="panggung-3d rounded-3xl border-2 border-ink/10 bg-surface p-5 shadow-lift sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="judul-timbul font-display text-2xl font-black tracking-tight text-ink sm:text-3xl">
              🎁 GIVEAWAY
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
              Ikut gratis, pemenangnya diundi acak, hadiahnya masuk otomatis ke akunmu.
            </p>
          </div>
          <Link href="/dashboard" className="btn-ghost shrink-0 px-4 py-2.5 text-sm">← Beranda</Link>
        </div>
      </div>

      {msg && <p className="mt-4 rounded-xl border border-success/30 bg-success-soft px-3 py-2.5 text-sm font-bold text-success">{msg}</p>}
      {err && <p className="mt-4 rounded-xl border border-rose/30 bg-rose-soft px-3 py-2.5 text-sm font-bold text-rose">{err}</p>}

      {loading ? (
        <SkelBaris jumlah={3} tinggi="h-24" className="mt-5" />
      ) : items.length === 0 ? (
        <div className="mt-5 rounded-2xl border-2 border-dashed border-line p-10 text-center">
          <p className="text-4xl">🎁</p>
          <p className="mt-3 text-sm font-bold text-ink">Belum ada giveaway</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Pantau terus — kalau ada yang dibuka, diumumkan juga di channel.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {items.map((ev) => {
            const f = FASE[ev.fase] || FASE.selesai;
            const penuh = ev.maksPeserta > 0 && ev.jumlahPeserta >= ev.maksPeserta;
            const bisaIkut = ev.fase === "buka" && !ev.sudahIkut && !penuh && token;
            return (
              <div key={ev.giveawayId} className="balok-3d rounded-2xl border-2 border-ink/10 bg-surface p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-display text-lg font-black leading-tight text-ink">{ev.judul}</h2>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black text-white ${f.cls}`}>
                    {f.label}
                  </span>
                </div>
                {ev.keterangan && <p className="mt-1.5 text-xs leading-relaxed text-muted">{ev.keterangan}</p>}

                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    ["🏆", "Hadiah", hadiah(ev)],
                    ["👥", "Pemenang", `${ev.jumlahPemenang} orang`],
                    ["🎟", "Peserta", ev.maksPeserta > 0 ? `${ev.jumlahPeserta} / ${ev.maksPeserta}` : String(ev.jumlahPeserta)],
                    ["🕐", ev.fase === "akan" ? "Dibuka" : "Ditutup", jam(ev.fase === "akan" ? ev.mulaiAt : ev.selesaiAt)]
                  ].map(([i, l, v]) => (
                    <div key={l} className="rounded-xl border border-line bg-surface2/60 p-2.5">
                      <p className="text-[10px] text-muted">{i} {l}</p>
                      <p className="mt-0.5 text-sm font-black leading-tight text-ink">{v}</p>
                    </div>
                  ))}
                </div>

                {ev.pemenang.length > 0 && (
                  <div className="mt-4 rounded-xl border-2 border-amber/40 bg-amber-soft p-3.5">
                    <p className="text-xs font-black text-amber-bright">🎉 Pemenang</p>
                    <ol className="mt-1.5 space-y-0.5">
                      {ev.pemenang.map((p, i) => (
                        <li key={p.token + i} className="text-[11px] text-ink">
                          {i + 1}. <b>{p.nama}</b> <span className="font-mono text-muted">{p.token}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="mt-4">
                  {!token ? (
                    <p className="text-xs font-bold text-muted">Buka web dari akunmu dulu untuk bisa ikut.</p>
                  ) : ev.sudahIkut ? (
                    <div className="space-y-2.5">
                      <div className="rounded-xl border-2 border-success/40 bg-success-soft px-4 py-3 text-center text-sm font-black text-success">
                        ✅ Kamu sudah ikut — tunggu pengumumannya
                      </div>
                      {/* Tombol mundur hanya selama pendaftarannya masih buka.
                          Sesudah ditutup, daftar pesertanya adalah dasar
                          undian; menariknya di situ sama saja mengubah hasil
                          yang sudah ditunggu orang. */}
                      {/* tekan-isi, bukan press: yang bergeser saat ditekan
                          adalah isinya, bukan kotak tombolnya. Dengan `press`,
                          geseran 4px itu jatuh di antara tekan dan lepas pada
                          tata letak ini, dan tombolnya jadi tidak bisa ditekan
                          sama sekali. */}
                      {ev.fase === "buka" && (
                        <button
                          onClick={() => kirim(ev.giveawayId, "batal")}
                          disabled={busy === ev.giveawayId}
                          className="tekan-isi w-full rounded-xl border-2 border-rose/40 bg-rose-soft py-2.5 text-sm font-black text-rose disabled:opacity-50"
                        >
                          <span className="tekan-geser">
                            {busy === ev.giveawayId ? "Membatalkan…" : "❌ TIDAK IKUT"}
                          </span>
                        </button>
                      )}
                    </div>
                  ) : bisaIkut ? (
                    <button
                      onClick={() => kirim(ev.giveawayId, "ikut")}
                      disabled={busy === ev.giveawayId}
                      className="btn-3d w-full rounded-xl bg-amber py-3 text-sm font-black text-white disabled:opacity-50"
                    >
                      {busy === ev.giveawayId ? "Mendaftar…" : "🎁 IKUT GIVEAWAY"}
                    </button>
                  ) : (
                    <p className="text-center text-xs font-bold text-muted">
                      {penuh ? "Kuota peserta sudah penuh." : ev.fase === "akan" ? `Dibuka ${jam(ev.mulaiAt)} WIB` : "Pendaftaran sudah ditutup."}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
