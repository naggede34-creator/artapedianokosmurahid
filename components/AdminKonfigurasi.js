"use client";

// Tab Konfigurasi di dasbor admin.
//
// Aturannya satu: isi di sini ATAU di Environment Variables Vercel — salah satu
// cukup. Kalau dua-duanya terisi, yang dari web dipakai. Tidak ada tombol
// "terapkan"/"deploy ulang": nilainya langsung berlaku.
import { useCallback, useEffect, useState } from "react";
import { GRUP, KONFIG } from "@/lib/configRegistry";

const LENCANA = {
  web: { teks: "🌐 Web", cls: "bg-blue-soft text-blue" },
  vercel: { teks: "▲ Vercel", cls: "bg-success-soft text-success" },
  bawaan: { teks: "Bawaan", cls: "bg-surface2 text-muted" },
  kosong: { teks: "Belum diisi", cls: "bg-amber-soft text-amber-bright" }
};

function Lencana({ sumber }) {
  const l = LENCANA[sumber] || LENCANA.kosong;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${l.cls}`}>{l.teks}</span>;
}


/** Diagnosa rute deposit otomatis: tiap penyedia siap/tidak, berapa kali dipilih, dan galat terakhirnya. */
function PanelRuteDeposit() {
  const [d, setD] = useState(null);
  const [galat, setGalat] = useState("");
  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/rute-deposit", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Gagal memuat");
      setD(j); setGalat("");
    } catch (e) { setGalat(e.message); }
  }, []);
  useEffect(() => { muat(); }, [muat]);
  const modeTeks = { utama: "QRIS UTAMA (acak semua nominal)", nominal: "Rute per nominal", mati: "Rute mati (pembeli memilih sendiri)" };
  return (
    <section className="rounded-2xl border-2 border-ink/10 bg-surface p-4 shadow-soft sm:p-5" data-testid="panel-rute">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-black text-ink">🔀 Diagnosa rute deposit</h3>
        <button type="button" onClick={muat} className="rounded-lg border border-line px-3 py-1 text-[11px] font-bold text-ink" data-testid="rute-muat">Segarkan</button>
      </div>
      {galat && <p className="mt-2 text-xs font-bold text-rose">{galat}</p>}
      {d && (
        <>
          <p className="mt-1 text-[11px] text-muted">Mode: <b className="text-ink">{modeTeks[d.mode]}</b> · {d.total24} percobaan dalam 24 jam terakhir. Penyedia yang tidak siap otomatis dilewati — itu sebabnya pembeli bisa selalu jatuh ke satu penyedia saja.</p>
          <div className="mt-3 space-y-2">
            {d.penyedia.map((p) => (
              <div key={p.key} className={`rounded-xl border px-3 py-2 ${p.siap ? "border-success/30 bg-success-soft" : "border-rose/30 bg-rose-soft"}`} data-testid={`rute-${p.key}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-sm text-ink">{p.nama}</b>
                  <span className={`text-[11px] font-black ${p.siap ? "text-success" : "text-rose"}`}>{p.siap ? "✅ siap ikut acak" : "⛔ DILEWATI"}</span>
                </div>
                {!p.siap && <p className="mt-1 text-[11px] font-bold text-rose">{p.alasan}</p>}
                <p className="mt-1 text-[11px] text-muted">24 jam: {p.sukses} berhasil · {p.gagal} gagal</p>
                {p.galatTerakhir && (
                  <p className="mt-1 break-words text-[11px] font-semibold text-amber-bright">
                    Galat terakhir ({new Date(p.galatTerakhir.at).toLocaleString("id-ID")}, Rp{Number(p.galatTerakhir.nominal).toLocaleString("id-ID")}): {p.galatTerakhir.alasan}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Bilah peringatan yang dipasang di atas dasbor kalau panel masih memakai kode bawaan yang publik. */
export function PeringatanKodeAdmin({ onBuka }) {
  const [bawaan, setBawaan] = useState(false);
  useEffect(() => {
    let batal = false;
    fetch("/api/admin/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!batal && d?.kodeAdmin?.bawaan) setBawaan(true);
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, []);
  if (!bawaan) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-rose/50 bg-rose-soft px-4 py-3">
      <p className="min-w-0 flex-1 text-xs font-bold leading-relaxed text-rose">
        ⚠️ Panel admin masih memakai <b>kode bawaan yang tertulis di repositori</b>. Siapa pun yang membaca repositori
        bisa masuk, termasuk menyetujui penarikan uang. Ganti sekarang.
      </p>
      <button onClick={onBuka} className="btn-3d shrink-0 rounded-xl bg-rose px-4 py-2 text-xs font-black text-white">
        Ganti kode admin
      </button>
    </div>
  );
}

export default function AdminKonfigurasi() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [nilai, setNilai] = useState({});
  const [lanjutan, setLanjutan] = useState(false);
  const [kode, setKode] = useState({ sekarang: "", baru: "", ulang: "" });
  const [riwayat, setRiwayat] = useState(false);

  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/config");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal memuat.");
      setData(d);
      setErr("");
    } catch (e) {
      setErr(e.message || "Gagal memuat.");
    }
  }, []);
  useEffect(() => {
    muat();
  }, [muat]);

  function kabar(pesan, galat = false) {
    if (galat) {
      setErr(pesan);
      setMsg("");
    } else {
      setMsg(pesan);
      setErr("");
    }
    setTimeout(() => {
      setMsg("");
      setErr("");
    }, 6000);
  }

  async function kirim(badan, kunci) {
    setBusy(kunci);
    try {
      const r = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badan)
      });
      const d = await r.json();
      if (!r.ok) {
        kabar(d.error || "Gagal.", true);
        return false;
      }
      setData((lama) => ({ ...lama, ...d }));
      kabar(d.pesan || "Tersimpan.");
      return true;
    } catch {
      kabar("Jaringan bermasalah, coba lagi.", true);
      return false;
    } finally {
      setBusy("");
    }
  }

  async function simpan(nama) {
    const ok = await kirim({ aksi: "simpan", nama, nilai: nilai[nama] ?? "" }, nama);
    // Isiannya dikosongkan dari layar sesudah tersimpan: nilai rahasia yang
    // tertinggal di kolom input ikut terbawa ke tangkapan layar dan berbagi layar.
    if (ok) setNilai((n) => ({ ...n, [nama]: "" }));
  }

  async function gantiKode() {
    if (kode.baru !== kode.ulang) return kabar("Kode baru dan pengulangannya tidak sama.", true);
    const ok = await kirim({ aksi: "kode-admin", kodeSekarang: kode.sekarang, kodeBaru: kode.baru }, "ADMIN_CODE");
    if (ok) setKode({ sekarang: "", baru: "", ulang: "" });
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
        {err || "Memuat konfigurasi…"}
      </div>
    );
  }

  const status = Object.fromEntries(data.item.map((i) => [i.nama, i]));
  const kodeAdmin = data.kodeAdmin || {};

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-ink/10 bg-surface p-4 shadow-soft sm:p-5">
        <h2 className="font-display text-lg font-black text-ink">🔑 Konfigurasi</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Isi di sini <b>atau</b> di Environment Variables Vercel — salah satu cukup, tidak perlu dua-duanya. Yang
          diisi di web langsung berlaku tanpa deploy ulang. Kalau dua-duanya terisi, yang dari web dipakai.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Lencana sumber="web" />
          <Lencana sumber="vercel" />
          <Lencana sumber="bawaan" />
          <Lencana sumber="kosong" />
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-bold text-ink">
          <input type="checkbox" checked={lanjutan} onChange={(e) => setLanjutan(e.target.checked)} />
          Tampilkan pengaturan lanjutan
        </label>
        {!data.terbaca && (
          <p className="mt-3 rounded-xl border border-rose/30 bg-rose-soft px-3 py-2 text-xs font-bold text-rose">
            Database belum terjangkau, jadi yang tampil hanya dari Vercel. Simpan dinonaktifkan sampai tersambung.
          </p>
        )}
      </div>

      {msg && <p className="rounded-xl border border-success/30 bg-success-soft px-3 py-2.5 text-sm font-bold text-success">{msg}</p>}
      {err && <p className="rounded-xl border border-rose/30 bg-rose-soft px-3 py-2.5 text-sm font-bold text-rose">{err}</p>}

      {GRUP.map((g) => {
        const baris = KONFIG.filter((k) => k.grup === g.id && (lanjutan || !k.lanjutan || status[k.nama]?.adaWeb));
        if (!baris.length) return null;
        return (
          <div key={g.id} className="space-y-4">
          {g.id === "bayar" && <PanelRuteDeposit />}
          <section className="rounded-2xl border-2 border-ink/10 bg-surface p-4 shadow-soft sm:p-5">
            <h3 className="font-display text-base font-black text-ink">{g.judul}</h3>
            <div className="mt-3 divide-y divide-line">
              {baris.map((k) => {
                const st = status[k.nama] || {};
                const kunciBusy = busy === k.nama;
                return (
                  <div key={k.nama} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-ink">{k.label}</p>
                      <Lencana sumber={st.sumber} />
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-muted">{k.nama}</p>
                    {k.bantuan && <p className="mt-1 text-[11px] leading-relaxed text-muted">{k.bantuan}</p>}

                    {k.hanyaEnv ? (
                      <p className="mt-2 rounded-lg bg-surface2 px-3 py-2 text-[11px] font-bold text-muted">
                        {st.terisi ? "✅ Terisi di Vercel." : "Belum diisi di Vercel."} Hanya bisa diubah lewat Vercel.
                      </p>
                    ) : k.saklar ? (
                      <div className="mt-2 flex items-center gap-3">
                        {(() => {
                          const nyala = String(st.tampil || k.bawaan || "0") === "1";
                          return (
                            <>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={nyala}
                                disabled={busy !== "" || !data.terbaca}
                                onClick={() => kirim({ aksi: "simpan", nama: k.nama, nilai: nyala ? "0" : "1" }, k.nama)}
                                className={`relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors disabled:opacity-50 ${
                                  nyala ? "border-success bg-success" : "border-line bg-surface2"
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${nyala ? "left-[26px]" : "left-0.5"}`}
                                />
                              </button>
                              <span className={`text-sm font-black ${nyala ? "text-success" : "text-muted"}`}>
                                {kunciBusy ? "Menyimpan…" : nyala ? "NYALA" : "MATI"}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    ) : k.khusus === "kodeAdmin" ? (
                      <div className="mt-2 space-y-2">
                        <p className="text-[11px] font-bold text-muted">
                          {kodeAdmin.web ? "✅ Kode dari web aktif." : "Belum ada kode dari web."}{" "}
                          {kodeAdmin.env ? "Kode dari Vercel juga aktif (kunci cadangan)." : "Vercel tidak punya ADMIN_CODE."}
                          {kodeAdmin.bawaan && " ⚠️ Sedang memakai kode bawaan yang publik."}
                        </p>
                        <input
                          type="password"
                          autoComplete="off"
                          placeholder="Kode admin yang sekarang"
                          value={kode.sekarang}
                          onChange={(e) => setKode((f) => ({ ...f, sekarang: e.target.value }))}
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm"
                        />
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Kode baru (minimal 8 karakter)"
                          value={kode.baru}
                          onChange={(e) => setKode((f) => ({ ...f, baru: e.target.value }))}
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm"
                        />
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Ulangi kode baru"
                          value={kode.ulang}
                          onChange={(e) => setKode((f) => ({ ...f, ulang: e.target.value }))}
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={gantiKode}
                            disabled={busy !== "" || !kode.sekarang || !kode.baru || !data.terbaca}
                            className="btn-3d flex-1 rounded-xl bg-blue px-4 py-2 text-xs font-black text-white disabled:opacity-40"
                          >
                            {kunciBusy ? "Menyimpan…" : "Simpan kode baru"}
                          </button>
                          {kodeAdmin.web && kodeAdmin.env && (
                            <button
                              onClick={() => {
                                if (!kode.sekarang) return kabar("Isi kode admin yang sekarang dulu.", true);
                                if (confirm("Hapus kode dari web? Kode dari Vercel yang dipakai lagi.")) {
                                  kirim({ aksi: "kode-admin-hapus", kodeSekarang: kode.sekarang }, "ADMIN_CODE");
                                }
                              }}
                              disabled={busy !== ""}
                              className="btn-3d rounded-xl border border-rose/40 bg-rose-soft px-4 py-2 text-xs font-black text-rose disabled:opacity-40"
                            >
                              Hapus kode web
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted">
                          Mengganti kode mengeluarkan semua sesi admin lain. Sesi ini tetap masuk.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2">
                        {st.tampil && (
                          <p className="mb-1.5 text-[11px] font-bold text-muted">
                            Sekarang: <span className="font-mono text-ink">{st.tampil}</span>
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <input
                            type={k.rahasia ? "password" : "text"}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder={k.rahasia ? (st.terisi ? "Isi untuk mengganti" : "Tempel di sini") : k.contoh || k.bawaan || ""}
                            value={nilai[k.nama] ?? (k.rahasia ? "" : st.sumber === "web" ? st.tampil : "")}
                            onChange={(e) => setNilai((n) => ({ ...n, [k.nama]: e.target.value }))}
                            className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 font-mono text-xs"
                          />
                          <button
                            onClick={() => simpan(k.nama)}
                            disabled={busy !== "" || !data.terbaca || !(nilai[k.nama] ?? "").trim()}
                            className="btn-3d rounded-xl bg-blue px-4 py-2 text-xs font-black text-white disabled:opacity-40"
                          >
                            {kunciBusy ? "…" : "Simpan"}
                          </button>
                          {st.adaWeb && (
                            <button
                              onClick={() => {
                                if (confirm(`Hapus ${k.label} dari web?${st.adaEnv ? " Nilai dari Vercel dipakai lagi." : " Isian ini jadi kosong."}`)) {
                                  kirim({ aksi: "hapus", nama: k.nama }, k.nama);
                                }
                              }}
                              disabled={busy !== ""}
                              className="btn-3d rounded-xl border border-rose/40 bg-rose-soft px-3 py-2 text-xs font-black text-rose disabled:opacity-40"
                              title="Hapus dari web"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                        {st.adaWeb && st.adaEnv && (
                          <p className="mt-1 text-[10px] text-muted">Vercel juga punya nilai; yang dari web dipakai.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          </div>
        );
      })}

      <section className="rounded-2xl border border-line bg-surface p-4">
        <button onClick={() => setRiwayat((v) => !v)} className="text-xs font-black text-ink">
          {riwayat ? "▾" : "▸"} Riwayat perubahan ({data.riwayat?.length || 0})
        </button>
        {riwayat && (
          <ul className="mt-2 space-y-1">
            {(data.riwayat || []).map((r, i) => (
              <li key={i} className="text-[11px] text-muted">
                <span className="font-mono text-ink">{r.nama}</span> · {r.aksi} ·{" "}
                {new Date(r.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </li>
            ))}
            {!data.riwayat?.length && <li className="text-[11px] text-muted">Belum ada perubahan dari web.</li>}
          </ul>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          Nilai rahasia disimpan terenkripsi dan tidak ikut ke berkas backup. Riwayat hanya mencatat nama isian dan
          waktu, tidak pernah nilainya.
        </p>
      </section>
    </div>
  );
}
