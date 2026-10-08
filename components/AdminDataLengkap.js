"use client";

// Kartu admin: Ekspor & Impor DATA LENGKAP (pengguna, saldo nokos, saldo QRIS gateway,
// web reseller, bot reseller, transaksi, pengaturan). Unduh = satu berkas JSON;
// Unggah = pulihkan, dikirim per batch supaya aman untuk berkas besar.
import { useCallback, useEffect, useRef, useState } from "react";

const rp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const angka = (n) => (Number(n) || 0).toLocaleString("id-ID");
const UKURAN_BATCH = 500;

const MODE = [
  { v: "gabung", l: "Gabung", d: "Perbarui data yang ada + tambah yang baru. Saldo pengguna yang ada ditimpa nilai dari backup." },
  { v: "aman", l: "Aman (hanya yang belum ada)", d: "Hanya menambah data yang hilang; yang sudah ada tidak disentuh." },
  { v: "ganti", l: "⚠️ Ganti total", d: "KOSONGKAN koleksi terpilih lalu isi ulang dari backup. Untuk pemulihan setelah data hilang/rusak." }
];

async function bacaJson(res) {
  try { return await res.json(); } catch { return null; }
}

export default function AdminDataLengkap() {
  const [info, setInfo] = useState(null);
  const [galatInfo, setGalatInfo] = useState("");
  const [pilihEkspor, setPilihEkspor] = useState({});
  const [kredensial, setKredensial] = useState(false);
  const [mengunduh, setMengunduh] = useState(false);

  const [berkas, setBerkas] = useState(null);
  const [isiBerkas, setIsiBerkas] = useState(null); // { koleksi, kelompokDiBerkas, ... }
  const [pilihImpor, setPilihImpor] = useState({}); // nama koleksi -> bool
  const [mode, setMode] = useState("gabung");
  const [cadangDulu, setCadangDulu] = useState(true);
  const [galatImpor, setGalatImpor] = useState("");
  const [berjalan, setBerjalan] = useState(false);
  const [progres, setProgres] = useState(null);
  const [hasil, setHasil] = useState(null);
  const inputRef = useRef(null);
  const batalRef = useRef(false);

  const muat = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/data-lengkap", { cache: "no-store" });
      const d = await bacaJson(res);
      if (!res.ok || !d?.ok) { setGalatInfo(d?.error || "Gagal memuat ringkasan."); return; }
      setInfo(d);
      setGalatInfo("");
      setPilihEkspor((prev) => {
        if (Object.keys(prev).length) return prev;
        const awal = {};
        for (const [k, g] of Object.entries(d.kelompok)) awal[k] = !g.besar;
        return awal;
      });
    } catch (e) {
      setGalatInfo("Gagal memuat: " + (e?.message || e));
    }
  }, []);
  useEffect(() => { muat(); }, [muat]);

  // ── Unduh ────────────────────────────────────────────────────────────────
  async function unduh(kelompokDipilih, namaTambahan = "") {
    const url = `/api/admin/data-lengkap?unduh=1&kelompok=${encodeURIComponent(kelompokDipilih.join(","))}${kredensial ? "&kredensial=1" : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error((await bacaJson(res))?.error || `Gagal mengunduh (HTTP ${res.status})`);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `artapedia-data-lengkap${namaTambahan}-${new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }

  async function klikUnduh() {
    const dipilih = Object.keys(pilihEkspor).filter((k) => pilihEkspor[k]);
    if (!dipilih.length) { alert("Pilih minimal satu kelompok data."); return; }
    if (kredensial && !window.confirm("Berkas akan memuat TOKEN BOT & KUNCI API gateway (selain token akun pengguna). Siapa pun yang memegangnya bisa mengambil alih bot dan akun. Lanjutkan?")) return;
    setMengunduh(true);
    try { await unduh(dipilih); } catch (e) { alert(e.message || "Gagal mengunduh."); } finally { setMengunduh(false); }
  }

  // ── Pilih berkas ─────────────────────────────────────────────────────────
  async function pilihBerkas(f) {
    setBerkas(f); setIsiBerkas(null); setHasil(null); setGalatImpor(""); setPilihImpor({});
    if (!f) return;
    try {
      const teks = await f.text();
      const data = JSON.parse(teks);
      if (data?.format !== "artapedia-data-lengkap" || typeof data.koleksi !== "object") {
        setGalatImpor("Bukan berkas Data Lengkap Artapedia. Ekspor dulu dari kartu di atas.");
        return;
      }
      setIsiBerkas(data);
      const awal = {};
      for (const [nama, daftar] of Object.entries(data.koleksi)) awal[nama] = Array.isArray(daftar) && daftar.length > 0;
      setPilihImpor(awal);
    } catch {
      setGalatImpor("Berkas tidak bisa dibaca (JSON rusak atau terpotong).");
    }
  }

  async function panggil(body) {
    const res = await fetch("/api/admin/data-lengkap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await bacaJson(res);
    if (!res.ok || !d?.ok) throw new Error(d?.error || `HTTP ${res.status}`);
    return d;
  }

  // ── Impor ────────────────────────────────────────────────────────────────
  async function mulaiImpor() {
    if (!isiBerkas) return;
    const terpilih = Object.keys(pilihImpor).filter((n) => pilihImpor[n]);
    if (!terpilih.length) { setGalatImpor("Pilih minimal satu koleksi."); return; }
    const totalDok = terpilih.reduce((a, n) => a + (isiBerkas.koleksi[n]?.length || 0), 0);

    const peringatan =
      mode === "ganti"
        ? `⚠️ GANTI TOTAL\n\n${terpilih.length} koleksi akan DIKOSONGKAN lalu diisi ulang dari backup (${angka(totalDok)} dokumen).\nSemua transaksi/saldo yang terjadi SETELAH backup dibuat akan HILANG.\n\nLanjutkan?`
        : mode === "gabung"
          ? `Gabungkan ${angka(totalDok)} dokumen dari ${terpilih.length} koleksi.\nPengguna/akun yang sudah ada akan DITIMPA nilai dari backup (termasuk saldo).\n\nLanjutkan?`
          : `Tambahkan data yang belum ada (${angka(totalDok)} dokumen diperiksa dari ${terpilih.length} koleksi). Data yang sudah ada tidak diubah.\n\nLanjutkan?`;
    if (!window.confirm(peringatan)) return;
    if (mode === "ganti" && window.prompt("Ketik GANTI untuk memastikan:") !== "GANTI") return;

    setBerjalan(true); setHasil(null); setGalatImpor(""); batalRef.current = false;
    const ringkas = { koleksi: {}, ditambah: 0, diperbarui: 0, sama: 0, dilewati: 0, gagal: 0, contoh: [] };

    try {
      if (cadangDulu) {
        setProgres({ tahap: "Mengunduh cadangan kondisi sekarang…", persen: 0 });
        // Cadangan hanya untuk kelompok yang menyentuh koleksi terpilih.
        const kelompokTerkena = Object.entries(info?.kelompok || {})
          .filter(([, g]) => Object.keys(g.koleksi).some((n) => terpilih.includes(n)))
          .map(([k]) => k);
        if (kelompokTerkena.length) await unduh(kelompokTerkena, "-sebelum-pulih");
      }

      let selesaiDok = 0;
      for (const nama of terpilih) {
        if (batalRef.current) throw new Error("Dibatalkan admin.");
        const daftar = isiBerkas.koleksi[nama] || [];
        const r = { ditambah: 0, diperbarui: 0, sama: 0, dilewati: 0, gagal: 0 };

        if (mode === "ganti") {
          setProgres({ tahap: `Mengosongkan ${nama}…`, persen: Math.round((selesaiDok / Math.max(1, totalDok)) * 100) });
          await panggil({ aksi: "kosongkan", koleksi: nama });
        }
        for (let i = 0; i < daftar.length; i += UKURAN_BATCH) {
          if (batalRef.current) throw new Error("Dibatalkan admin.");
          const potong = daftar.slice(i, i + UKURAN_BATCH);
          setProgres({ tahap: `${nama} (${angka(Math.min(i + UKURAN_BATCH, daftar.length))}/${angka(daftar.length)})`, persen: Math.round((selesaiDok / Math.max(1, totalDok)) * 100) });
          const d = await panggil({ aksi: "isi", koleksi: nama, mode, dokumen: potong });
          for (const k of ["ditambah", "diperbarui", "sama", "dilewati", "gagal"]) r[k] += d[k] || 0;
          for (const c of d.contohGagal || []) if (ringkas.contoh.length < 5) ringkas.contoh.push(`${nama}: ${c}`);
          selesaiDok += potong.length;
        }
        ringkas.koleksi[nama] = r;
        for (const k of ["ditambah", "diperbarui", "sama", "dilewati", "gagal"]) ringkas[k] += r[k];
      }
      setProgres({ tahap: "Selesai", persen: 100 });
      setHasil(ringkas);
      muat();
    } catch (e) {
      setGalatImpor(`Berhenti di tengah jalan: ${e?.message || e}. Yang sudah masuk tetap tersimpan; ulangi dengan mode Gabung/Aman untuk melanjutkan.`);
      setHasil(ringkas);
    } finally {
      setBerjalan(false);
    }
  }

  const saldo = info?.ringkasan?.saldo || {};
  const jumlah = info?.ringkasan?.jumlah || {};

  return (
    <div className="glass rounded-2xl p-5 shadow-soft border border-teal/30 space-y-4" data-testid="data-lengkap">
      <div>
        <h2 className="text-base font-bold text-ink">🗃️ Ekspor &amp; Impor Data Lengkap</h2>
        <p className="mt-1 text-xs text-muted">
          Unduh seluruh data toko dalam satu berkas, dan unggah lagi untuk memulihkannya: pengguna (web utama, web reseller, bot reseller),
          saldo nokos, saldo QRIS gateway, web &amp; bot reseller, transaksi, dan pengaturan.
        </p>
      </div>

      {galatInfo && <p className="text-xs font-semibold text-rose">{galatInfo}</p>}

      {info && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            ["👥 Pengguna", angka(jumlah.pengguna)],
            ["🌐 Pengguna web reseller", angka(jumlah.penggunaWebReseller)],
            ["🤖 Pengguna bot reseller", angka(jumlah.penggunaBotReseller)],
            ["💰 Saldo nokos (semua)", rp(saldo.nokosSemuaPengguna)],
            ["📲 Saldo QRIS gateway", rp(saldo.qrisGateway)],
            ["📥 Saldo Stor Gmail", rp(saldo.stor)],
            ["🏪 Web reseller", angka(jumlah.webReseller)],
            ["🤖 Bot reseller", angka(jumlah.botReseller)],
            ["💸 Komisi reseller (web+bot)", rp((saldo.komisiWebResellerTertunda || 0) + (saldo.komisiBotReseller || 0))]
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-line bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{l}</p>
              <p className="text-sm font-black text-ink">{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Ekspor ── */}
      <div className="rounded-xl border border-line p-3 space-y-2">
        <p className="text-sm font-bold text-ink">⬇️ Ekspor (download)</p>
        <div className="space-y-1">
          {info && Object.entries(info.kelompok).map(([k, g]) => (
            <label key={k} className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer ${pilihEkspor[k] ? "border-teal/50 bg-teal-soft" : "border-line"}`}>
              <input type="checkbox" className="mt-0.5" checked={!!pilihEkspor[k]} onChange={(e) => setPilihEkspor((p) => ({ ...p, [k]: e.target.checked }))} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink">{g.label} <span className="font-normal text-muted">· {angka(g.total)} dokumen</span></p>
                <p className="text-[10px] text-muted">{g.catatan}</p>
              </div>
            </label>
          ))}
        </div>
        <label className="flex items-start gap-2 rounded-lg border border-amber/30 bg-amber/5 px-3 py-2 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={kredensial} onChange={(e) => setKredensial(e.target.checked)} />
          <div>
            <p className="text-xs font-bold text-ink">Sertakan kredensial (token bot reseller &amp; kunci API gateway)</p>
            <p className="text-[10px] text-muted">
              Dimatikan secara bawaan. Perlu dinyalakan kalau ingin bot &amp; API merchant langsung jalan setelah restore di database baru. Kunci API
              pengaturan (menu Konfigurasi) tidak pernah ikut.
            </p>
          </div>
        </label>
        <button onClick={klikUnduh} disabled={mengunduh || !info}
          className="w-full rounded-xl bg-teal-bright text-white py-2.5 text-sm font-bold press disabled:opacity-50 border border-teal">
          {mengunduh ? "Menyiapkan berkas…" : "📦 Download Data Lengkap (.json)"}
        </button>
        <p className="text-[10px] text-muted">⚠️ Berkas memuat token akun semua pengguna (kredensial). Simpan di tempat aman, jangan dibagikan.</p>
      </div>

      {/* ── Impor ── */}
      <div className="rounded-xl border border-rose/30 p-3 space-y-2">
        <p className="text-sm font-bold text-ink">⬆️ Impor (upload &amp; pulihkan)</p>
        <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => pilihBerkas(e.target.files?.[0] || null)} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={berjalan}
          className="w-full rounded-xl border-2 border-dashed border-line py-3 text-xs text-muted hover:border-amber/50 press">
          {berkas ? `📄 ${berkas.name} (${(berkas.size / 1024 / 1024).toFixed(2)} MB)` : "Pilih berkas data lengkap .json…"}
        </button>

        {isiBerkas && (
          <>
            <p className="text-[11px] text-muted">
              Dibuat {isiBerkas.dibuat ? new Date(isiBerkas.dibuat).toLocaleString("id-ID") : "—"}
              {isiBerkas.kredensialDisertakan ? " · memuat kredensial" : ""}
            </p>
            <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-line p-2">
              {Object.entries(isiBerkas.koleksi).map(([nama, daftar]) => (
                <label key={nama} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={!!pilihImpor[nama]} disabled={berjalan || !daftar?.length}
                    onChange={(e) => setPilihImpor((p) => ({ ...p, [nama]: e.target.checked }))} />
                  <span className="font-mono text-ink">{nama}</span>
                  <span className="text-muted">{angka(daftar?.length)} dokumen</span>
                </label>
              ))}
            </div>

            <div className="space-y-1">
              {MODE.map((m) => (
                <label key={m.v} className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer ${mode === m.v ? "border-amber/60 bg-amber/10" : "border-line"}`}>
                  <input type="radio" name="modeDataLengkap" className="mt-0.5" checked={mode === m.v} disabled={berjalan} onChange={() => setMode(m.v)} />
                  <div>
                    <p className="text-xs font-bold text-ink">{m.l}</p>
                    <p className="text-[10px] text-muted">{m.d}</p>
                  </div>
                </label>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs text-ink">
              <input type="checkbox" checked={cadangDulu} disabled={berjalan} onChange={(e) => setCadangDulu(e.target.checked)} />
              Unduh cadangan kondisi sekarang dulu (disarankan)
            </label>
          </>
        )}

        {galatImpor && <p className="text-xs font-semibold text-rose whitespace-pre-line">{galatImpor}</p>}

        {progres && berjalan && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface2">
              <div className="h-full bg-teal-bright transition-all" style={{ width: `${progres.persen}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-muted">{progres.tahap} · {progres.persen}%</p>
          </div>
        )}

        {hasil && (
          <div className="rounded-xl border border-teal/30 bg-teal-soft px-3 py-2 text-xs space-y-0.5">
            <p className="font-bold text-teal-bright">{hasil.gagal ? "Selesai dengan catatan" : "✅ Impor selesai"}</p>
            <p className="text-muted">
              Ditambah <b className="text-ink">{angka(hasil.ditambah)}</b> · Diperbarui <b className="text-ink">{angka(hasil.diperbarui)}</b> ·
              Sama <b className="text-ink">{angka(hasil.sama)}</b> · Dilewati <b className="text-ink">{angka(hasil.dilewati)}</b> ·
              Gagal <b className={hasil.gagal ? "text-rose" : "text-ink"}>{angka(hasil.gagal)}</b>
            </p>
            {hasil.contoh.map((c, i) => <p key={i} className="text-[10px] text-rose">{c}</p>)}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={mulaiImpor} disabled={!isiBerkas || berjalan}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold press disabled:opacity-50 border ${mode === "ganti" ? "bg-rose text-white border-rose/60" : "bg-amber text-white border-amber-bright"}`}>
            {berjalan ? "Memulihkan…" : mode === "ganti" ? "🔄 Ganti Total dari Backup" : "📤 Mulai Impor"}
          </button>
          {berjalan && (
            <button onClick={() => { batalRef.current = true; }} className="rounded-xl border border-line px-4 text-xs font-bold press">Batal</button>
          )}
        </div>
      </div>
    </div>
  );
}
