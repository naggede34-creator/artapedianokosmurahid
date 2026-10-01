"use client";

// Panel admin AustinPay (QRIS FAST + penarikan otomatis):
//  • isi API key / API secret / webhook secret / proxy (tersimpan terenkripsi; tidak pernah dikirim balik utuh)
//  • lihat SALDO akun AustinPay, cek koneksi, transaksi terbaru
//  • atur WD otomatis (saklar, minimal, biaya, batas harian, keamanan)
//  • TARIK saldo AustinPay (instant ke e-wallet / withdraw biasa) — wajib konfirmasi kode admin
//  • riwayat penarikan pengguna & admin
import { useCallback, useEffect, useState } from "react";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const KUNCI = [
  { nama: "AUSTINPAY_APIKEY", judul: "API key", ket: "Dari AustinPay → Profil → API Key (apg_live_…).", contoh: "apg_live_…" },
  { nama: "AUSTINPAY_APISECRET", judul: "API secret (HMAC)", ket: "Dari Profil → API Secret (aps_…). Sangat disarankan.", contoh: "aps_…" },
  { nama: "AUSTINPAY_WEBHOOK_SECRET", judul: "Webhook secret", ket: "Dari menu Webhook AustinPay. Dipakai memverifikasi notifikasi deposit.", contoh: "secret webhook" },
  { nama: "AUSTINPAY_PROXY", judul: "Proxy keluar (opsional)", ket: "http://user:pass@host:port — untuk IP tetap bila whitelist IP dipakai.", contoh: "http://…" }
];
const SAKLAR = [
  { nama: "WD_NOKOS_AKTIF", judul: "Tarik saldo nokos → e-wallet", ket: "Pengguna menarik saldo hasil deposit ke e-wallet (otomatis)." },
  { nama: "GAME_TARIK_OTOMATIS", judul: "Tarik poin game otomatis", ket: "Mati = antrean admin manual seperti dulu." },
  { nama: "GAME_TARIK_AKTIF", judul: "Tarik poin game (semua)", ket: "Saklar utama penarikan poin game." }
];
const ANGKA = [
  { nama: "WD_NOKOS_MIN_RP", judul: "Nokos — minimal diterima (Rp)" },
  { nama: "WD_NOKOS_FEE_RP", judul: "Nokos — biaya admin (Rp)" },
  { nama: "WD_NOKOS_MAKS_HARI", judul: "Nokos — maks penarikan / akun / hari (×)" },
  { nama: "WD_NOKOS_MAKS_RP", judul: "Nokos — maks per penarikan (Rp)" },
  { nama: "WD_NOKOS_MAKS_RP_HARI", judul: "Nokos — maks total / akun / hari (Rp)" },
  { nama: "GAME_TARIK_MIN_RP", judul: "Poin game — minimal tarik (Rp)" },
  { nama: "GAME_TARIK_FEE_RP", judul: "Poin game — biaya tarik (Rp)" },
  { nama: "WD_AKUN_PER_NOMOR", judul: "Keamanan — maks akun per nomor tujuan" },
  { nama: "WD_UMUR_AKUN_JAM", judul: "Keamanan — umur akun minimal (jam)" },
  { nama: "WD_ALERT_RP", judul: "Keamanan — kabari admin bila ≥ (Rp)" }
];
const STATUS = { sukses: ["✅ sukses", "text-teal-bright"], proses: ["⏳ proses", "text-amber-bright"], baru: ["⏳ baru", "text-amber-bright"], dikirim: ["⏳ dikirim", "text-amber-bright"], "tidak-pasti": ["❓ tidak pasti", "text-amber-bright"], gagal: ["❌ gagal", "text-rose"] };

async function api(url, opsi) {
  const r = await fetch(url, { cache: "no-store", ...opsi });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Gagal (${r.status})`);
  return d;
}

export default function AdminAustinPay() {
  const [data, setData] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [isi, setIsi] = useState({});
  const [angka, setAngka] = useState({});
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [tarik, setTarik] = useState({ mode: "instant", wallet: "DANA", nomor: "", nominal: "", method: "", nama: "", kode: "" });
  const [konfirmasi, setKonfirmasi] = useState(false);

  const muat = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([api("/api/admin/austinpay"), api("/api/admin/config")]);
      setData(a);
      const peta = Object.fromEntries(c.item.map((i) => [i.nama, i]));
      setCfg(peta);
      setAngka(Object.fromEntries(ANGKA.map((x) => [x.nama, String(peta[x.nama]?.tampil ?? "")])));
      setGalat("");
    } catch (e) { setGalat(e.message); }
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const info = (m) => { setPesan(m); setTimeout(() => setPesan(""), 5000); };
  async function simpan(nama, nilai, kunci = nama) {
    setSibuk(kunci); setGalat("");
    try {
      const d = await api("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "simpan", nama, nilai: String(nilai) }) });
      info(d.pesan || "Tersimpan.");
      if (KUNCI.some((k) => k.nama === nama)) setIsi((x) => ({ ...x, [nama]: "" }));
      await muat();
    } catch (e) { setGalat(e.message); } finally { setSibuk(""); }
  }
  async function hapus(nama) {
    if (!confirm("Hapus isian ini dari web?")) return;
    setSibuk(nama);
    try { await api("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "hapus", nama }) }); info("Dihapus."); await muat(); } catch (e) { setGalat(e.message); } finally { setSibuk(""); }
  }
  async function cek() {
    setSibuk("cek"); setGalat("");
    try { const d = await api("/api/admin/austinpay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "cek" }) }); info(d.ok ? `Terhubung. Saldo ${rp(d.saldo)}` : d.pesan || "Gagal"); await muat(); } catch (e) { setGalat(e.message); } finally { setSibuk(""); }
  }
  async function sinkron(wid) {
    setSibuk(wid);
    try { const d = await api("/api/admin/austinpay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "sinkron", wid }) }); info(`Status: ${d.status}`); await muat(); } catch (e) { setGalat(e.message); } finally { setSibuk(""); }
  }
  async function jalankanTarik() {
    setSibuk("tarik"); setGalat("");
    try {
      const body = tarik.mode === "instant"
        ? { aksi: "tarik", wallet: tarik.wallet, nomor: tarik.nomor, nominal: Number(tarik.nominal), kode: tarik.kode }
        : { aksi: "tarik-biasa", method: tarik.method, nomor: tarik.nomor, nama: tarik.nama, nominal: Number(tarik.nominal), kode: tarik.kode };
      const d = await api("/api/admin/austinpay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      info(tarik.mode === "instant" ? `Penarikan ${d.wd?.status || "diproses"}.` : d.pesan || "Withdraw diajukan.");
      setTarik((t) => ({ ...t, nominal: "", kode: "" })); setKonfirmasi(false);
      await muat();
    } catch (e) { setGalat(e.message); setTarik((t) => ({ ...t, kode: "" })); setKonfirmasi(false); } finally { setSibuk(""); }
  }

  if (!data || !cfg) return <div className="mt-5 card p-4 text-sm text-muted">{galat || "Memuat AustinPay…"}</div>;
  const nyala = (n) => String(cfg[n]?.tampil ?? "1") !== "0";
  const sudahIsi = (n) => !!cfg[n]?.terisi;

  return (
    <div className="mt-5 space-y-5" data-testid="admin-austinpay">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-ink">⚡ AustinPay — QRIS FAST & Tarik Otomatis</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">Deposit QRIS FAST, penarikan otomatis saldo nokos & poin game, serta saldo AustinPay milikmu.</p>
          </div>
          <button onClick={cek} disabled={sibuk === "cek"} className="btn-3d rounded-xl bg-amber px-3 py-2 text-xs font-black text-white disabled:opacity-60" data-testid="ap-cek">{sibuk === "cek" ? "…" : "Cek koneksi"}</button>
        </div>
        {galat && <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-xs font-bold text-rose" data-testid="ap-galat">{galat}</p>}
        {pesan && <p className="mt-3 rounded-lg bg-teal-soft px-3 py-2 text-xs font-bold text-teal-bright" data-testid="ap-pesan">{pesan}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-3"><p className="text-[11px] font-bold uppercase text-muted">Saldo AustinPay</p><b className="text-2xl tabular-nums text-ink" data-testid="ap-saldo">{data.ok ? rp(data.saldo) : "—"}</b></div>
          <div className="rounded-xl border border-line bg-surface p-3"><p className="text-[11px] font-bold uppercase text-muted">Koneksi</p><b className={data.ok ? "text-teal-bright" : "text-rose"}>{data.ok ? `✅ ${data.akun?.username || "terhubung"}` : "❌ belum"}</b>{!data.ok && data.pesan && <p className="mt-1 text-[11px] text-muted">{data.pesan}</p>}</div>
          <div className="rounded-xl border border-line bg-surface p-3"><p className="text-[11px] font-bold uppercase text-muted">HMAC signature</p><b className={data.hmac ? "text-teal-bright" : "text-amber-bright"}>{data.hmac ? "🔒 aktif" : "⚠️ mati"}</b></div>
          <div className="rounded-xl border border-line bg-surface p-3"><p className="text-[11px] font-bold uppercase text-muted">Proxy IP tetap</p><b className="text-ink">{data.proxy ? "aktif" : "tidak"}</b></div>
        </div>
        <div className="mt-3 rounded-xl border border-amber/40 bg-amber-soft px-3 py-2 text-[11px] leading-relaxed text-amber-bright">
          <b>Penting — IP whitelist:</b> AustinPay hanya menerima request dari IP yang didaftarkan di Profil → Whitelist IP. Vercel tidak punya IP keluar tetap: aktifkan <b>Static IPs</b> Vercel, atau isi <b>Proxy keluar</b> (VPS ber-IP tetap), lalu daftarkan IP-nya. Webhook URL: <code className="select-all break-all">{data.webhook}</code>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-base font-extrabold text-ink">🔑 Kunci API</h3>
        <p className="mt-1 text-xs text-muted">Tersimpan terenkripsi (AES-256). Setelah disimpan tidak pernah ditampilkan lagi — hanya tanda terisi.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {KUNCI.map((k) => (
            <div key={k.nama} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center justify-between gap-2"><label className="text-xs font-bold text-ink">{k.judul}</label><span className={`text-[10px] font-black ${sudahIsi(k.nama) ? "text-teal-bright" : "text-muted"}`}>{sudahIsi(k.nama) ? `✔ terisi (${cfg[k.nama]?.sumber || "web"})` : "belum diisi"}</span></div>
              <div className="mt-1.5 flex gap-2">
                <input type="password" autoComplete="off" value={isi[k.nama] || ""} onChange={(e) => setIsi((x) => ({ ...x, [k.nama]: e.target.value }))} placeholder={sudahIsi(k.nama) ? cfg[k.nama]?.tampil || "•••• tersimpan — ketik untuk mengganti" : k.contoh} data-testid={`ap-in-${k.nama}`} className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-amber" />
                <button type="button" disabled={!isi[k.nama] || sibuk === k.nama} onClick={() => simpan(k.nama, isi[k.nama])} data-testid={`ap-simpan-${k.nama}`} className="btn-3d shrink-0 rounded-lg bg-amber px-3 py-2 text-xs font-black text-white disabled:opacity-50">{sibuk === k.nama ? "…" : "Simpan"}</button>
                {cfg[k.nama]?.adaWeb || cfg[k.nama]?.sumber === "web" ? <button type="button" onClick={() => hapus(k.nama)} className="shrink-0 rounded-lg border border-rose/40 px-2 text-[11px] font-bold text-rose">Hapus</button> : null}
              </div>
              <p className="mt-1 text-[11px] text-muted">{k.ket}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-base font-extrabold text-ink">⚙️ Pengaturan penarikan otomatis</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {SAKLAR.map((s) => (
            <div key={s.nama} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-3">
              <div className="min-w-0"><b className="block text-xs text-ink">{s.judul}</b><span className="text-[11px] leading-snug text-muted">{s.ket}</span></div>
              <button type="button" role="switch" aria-checked={nyala(s.nama)} aria-label={s.judul} data-testid={`ap-saklar-${s.nama}`} disabled={sibuk === s.nama} onClick={() => simpan(s.nama, nyala(s.nama) ? "0" : "1")} className={`btn-3d relative h-7 w-12 shrink-0 rounded-full transition-colors ${nyala(s.nama) ? "bg-teal" : "bg-rose"}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${nyala(s.nama) ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ANGKA.map((a) => (
            <div key={a.nama} className="rounded-xl border border-line bg-surface p-3">
              <label className="text-xs font-bold text-ink">{a.judul}</label>
              <div className="mt-1.5 flex gap-2">
                <input inputMode="numeric" value={angka[a.nama] ?? ""} onChange={(e) => setAngka((x) => ({ ...x, [a.nama]: e.target.value.replace(/[^\d.]/g, "") }))} data-testid={`ap-ang-${a.nama}`} className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-amber" />
                <button type="button" onClick={() => simpan(a.nama, angka[a.nama] || 0)} disabled={sibuk === a.nama} className="btn-3d shrink-0 rounded-lg bg-amber px-3 py-2 text-xs font-black text-white disabled:opacity-60">{sibuk === a.nama ? "…" : "Simpan"}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5" data-testid="ap-tarik-admin">
        <h3 className="text-base font-extrabold text-ink">🏦 Tarik saldo AustinPay</h3>
        <p className="mt-1 text-xs text-muted">Memindahkan uang pemilik web keluar dari akun AustinPay. Setiap penarikan wajib konfirmasi <b>kode admin</b>.</p>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1 sm:max-w-sm">
          {[["instant", "⚡ Instant e-wallet"], ["biasa", "🏦 Withdraw biasa"]].map(([m, l]) => (
            <button key={m} type="button" onClick={() => setTarik((t) => ({ ...t, mode: m }))} className={`rounded-lg px-2 py-1.5 text-xs font-extrabold ${tarik.mode === m ? "bg-ink text-bg" : "text-muted"}`}>{l}</button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {tarik.mode === "instant" ? (
            <select value={tarik.wallet} onChange={(e) => setTarik((t) => ({ ...t, wallet: e.target.value }))} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink" aria-label="E-wallet">
              {(data.dompet || ["DANA"]).map((w) => <option key={w}>{w}</option>)}
            </select>
          ) : (
            <input value={tarik.method} onChange={(e) => setTarik((t) => ({ ...t, method: e.target.value }))} placeholder="Metode (Dana, BCA, …)" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink" aria-label="Metode" />
          )}
          <input value={tarik.nomor} onChange={(e) => setTarik((t) => ({ ...t, nomor: e.target.value.replace(/[^\d]/g, "") }))} placeholder="Nomor tujuan" inputMode="numeric" data-testid="ap-t-nomor" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink" />
          {tarik.mode === "biasa" && <input value={tarik.nama} onChange={(e) => setTarik((t) => ({ ...t, nama: e.target.value }))} placeholder="Nama pemilik" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink" />}
          <input value={tarik.nominal} onChange={(e) => setTarik((t) => ({ ...t, nominal: e.target.value.replace(/\D/g, "") }))} placeholder="Nominal (Rp)" inputMode="numeric" data-testid="ap-t-nominal" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink" />
          <button type="button" onClick={() => setKonfirmasi(true)} disabled={!tarik.nomor || Number(tarik.nominal) < 10000} className="btn-3d rounded-lg bg-rose px-3 py-2 text-xs font-black text-white disabled:opacity-50" data-testid="ap-t-lanjut">Tarik…</button>
        </div>
        {data.ok && <button type="button" className="mt-2 text-[11px] font-bold text-amber-bright" onClick={() => setTarik((t) => ({ ...t, nominal: String(Math.max(0, data.saldo - 100)) }))}>Isi dengan semua saldo ({rp(data.saldo)})</button>}
        {konfirmasi && (
          <div className="mt-3 rounded-xl border-2 border-rose/50 bg-rose-soft p-3" role="alertdialog" data-testid="ap-konfirmasi">
            <p className="text-sm font-extrabold text-rose">Konfirmasi: kirim {rp(tarik.nominal)} ke {tarik.mode === "instant" ? tarik.wallet : tarik.method} {tarik.nomor}?</p>
            <p className="mt-1 text-xs text-muted">Uang yang sudah terkirim tidak bisa ditarik kembali. Masukkan kode admin untuk melanjutkan.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input type="password" autoComplete="off" value={tarik.kode} onChange={(e) => setTarik((t) => ({ ...t, kode: e.target.value }))} placeholder="Kode admin" data-testid="ap-t-kode" className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink" />
              <button type="button" onClick={jalankanTarik} disabled={!tarik.kode || sibuk === "tarik"} className="btn-3d rounded-lg bg-rose px-4 py-2 text-xs font-black text-white disabled:opacity-50" data-testid="ap-t-kirim">{sibuk === "tarik" ? "Mengirim…" : "Ya, kirim"}</button>
              <button type="button" onClick={() => setKonfirmasi(false)} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink">Batal</button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="text-base font-extrabold text-ink">📜 Riwayat penarikan otomatis</h3>
        {!data.penarikan?.length ? <p className="mt-2 text-xs text-muted">Belum ada.</p> : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs" data-testid="ap-riwayat">
              <thead className="text-[10px] uppercase text-muted"><tr><th className="py-1 pr-2">ID</th><th className="pr-2">Jenis</th><th className="pr-2">Tujuan</th><th className="pr-2">Nominal</th><th className="pr-2">Status</th><th className="pr-2">Waktu</th><th /></tr></thead>
              <tbody className="divide-y divide-line">
                {data.penarikan.map((w) => {
                  const [lbl, warna] = STATUS[w.status] || [w.status, "text-muted"];
                  return (
                    <tr key={w.id}>
                      <td className="py-1.5 pr-2 font-mono text-[10px]">{w.id}</td>
                      <td className="pr-2">{w.jenis}{w.nama ? <span className="block text-[10px] text-muted">{w.nama} {w.token || ""}</span> : null}</td>
                      <td className="pr-2">{w.wallet} {w.nomor}</td>
                      <td className="pr-2 tabular-nums">{rp(w.nominal)}</td>
                      <td className={`pr-2 font-bold ${warna}`}>{lbl}{w.pesan ? <span className="block text-[10px] font-normal text-muted">{w.pesan}</span> : null}</td>
                      <td className="pr-2 text-[10px] text-muted">{new Date(w.dibuat).toLocaleString("id-ID")}</td>
                      <td>{["proses", "tidak-pasti", "baru", "dikirim"].includes(w.status) && <button type="button" onClick={() => sinkron(w.id)} disabled={sibuk === w.id} className="rounded-lg border border-line px-2 py-1 text-[10px] font-bold text-ink">{sibuk === w.id ? "…" : "Sinkron"}</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data.transaksi?.length > 0 && (
          <>
            <h4 className="mt-5 text-sm font-extrabold text-ink">Transaksi terbaru di AustinPay</h4>
            <ul className="mt-2 divide-y divide-line text-xs">
              {data.transaksi.map((t) => <li key={t.id} className="flex justify-between py-1.5"><span>{t.type} · {t.status}</span><b className="tabular-nums">{rp(t.amount)}</b></li>)}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
