"use client";

// Gerbang daftar / masuk. Tampil hanya saat admin menyalakan WEB_LOGIN_WAJIB dan
// pengunjung belum punya akun aktif. Menutup seluruh halaman (kecuali halaman
// informasi yang dikecualikan di SiteChrome).
//
// Daftar cukup NAMA. Kode akun dibuat sistem dan ditampilkan SEKALI di layar
// "simpan kode akun": tanpa email/password, kode itu satu-satunya jalan masuk
// dari perangkat lain — makanya tombol Lanjut baru menyala setelah pengguna
// menyatakan sudah menyimpannya.
import { useState } from "react";
import { useUser } from "@/app/providers";

function unduhKode(nama, kode) {
  try {
    const isi = `ARTA PEDIA — KODE AKUN\n\nNama : ${nama || "-"}\nKode : ${kode}\n\nSimpan baik-baik. Kode ini dipakai untuk masuk lagi di website maupun bot Telegram.\nJangan dibagikan ke siapa pun.\n`;
    const url = URL.createObjectURL(new Blob([isi], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kode-akun-artapedia.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {}
}

export default function AuthGate() {
  const { daftar, masuk } = useUser();
  const [tab, setTab] = useState("daftar"); // daftar | masuk
  const [nama, setNama] = useState("");
  const [kode, setKode] = useState("");
  const [baru, setBaru] = useState(null); // { token, name } setelah daftar
  const [sudahSimpan, setSudahSimpan] = useState(false);
  const [tersalin, setTersalin] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [err, setErr] = useState("");

  async function kirimDaftar(e) {
    e.preventDefault();
    setSibuk(true);
    setErr("");
    try {
      setBaru(await daftar(nama));
    } catch (x) {
      setErr(x.message);
    } finally {
      setSibuk(false);
    }
  }

  async function kirimMasuk(e) {
    e.preventDefault();
    setSibuk(true);
    setErr("");
    try {
      await masuk(kode);
    } catch (x) {
      setErr(x.status === 404 ? "Kode akun tidak ditemukan. Cek lagi, ya." : x.message);
    } finally {
      setSibuk(false);
    }
  }

  async function lanjut() {
    setSibuk(true);
    setErr("");
    try {
      await masuk(baru.token);
    } catch (x) {
      setErr(x.message);
      setSibuk(false);
    }
  }

  async function salin() {
    try {
      await navigator.clipboard.writeText(baru.token);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-bg/95 px-4 py-8 backdrop-blur-sm">
      <div className="panel-3d w-full max-w-sm rounded-3xl border-2 border-ink/10 bg-surface p-6 shadow-lift">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" width={56} height={56} className="h-14 w-14 rounded-2xl" />
          <h1 className="judul-timbul mt-3 font-display text-xl font-black text-ink">ARTA PEDIA ID</h1>
          <p className="mt-0.5 text-xs text-muted">Nokos termurah dan fast</p>
        </div>

        {baru ? (
          <div className="mt-5">
            <p className="text-center text-sm font-black text-ink">🎉 Akun dibuat, {baru.name}!</p>
            <p className="mt-2 text-center text-xs leading-relaxed text-muted">
              Ini <b className="text-ink">kode akun</b> kamu. Kode inilah yang dipakai untuk <b className="text-ink">masuk lagi</b> kalau
              ganti HP, hapus data browser, atau ada masalah. Tanpa kode ini akunmu (dan saldonya) tidak bisa dibuka.
            </p>

            <div className="mt-4 rounded-2xl border-2 border-dashed border-amber/60 bg-amber-soft px-3 py-4 text-center">
              <p className="select-all break-all font-mono text-xl font-black tracking-wider text-ink">{baru.token}</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={salin} className="btn-3d rounded-xl border-2 border-blue bg-blue-soft px-3 py-2.5 text-xs font-black text-blue-bright">
                {tersalin ? "✅ Tersalin" : "📋 Salin kode"}
              </button>
              <button type="button" onClick={() => unduhKode(baru.name, baru.token)} className="btn-3d rounded-xl border-2 border-line bg-surface px-3 py-2.5 text-xs font-black text-ink">
                💾 Unduh .txt
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-rose/30 bg-rose-soft px-3 py-2 text-[11px] font-bold leading-relaxed text-rose">
              ⚠️ Simpan baik-baik & jangan dibagikan. Siapa pun yang tahu kode ini bisa masuk ke akunmu.
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs font-bold text-ink">
              <input
                type="checkbox"
                checked={sudahSimpan}
                onChange={(e) => setSudahSimpan(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber"
              />
              Saya sudah menyimpan kode akun ini di tempat yang aman.
            </label>

            {err && <p className="mt-3 text-center text-xs font-bold text-rose">{err}</p>}
            <button
              type="button"
              onClick={lanjut}
              disabled={!sudahSimpan || sibuk}
              className="btn-3d mt-4 w-full rounded-xl border-2 border-blue bg-blue-bright py-3 text-sm font-black text-white disabled:opacity-40"
            >
              {sibuk ? "Masuk…" : "🚀 Lanjut ke Artapedia"}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-2xl bg-surface2/60 p-1">
              {[["daftar", "✨ Daftar"], ["masuk", "🔑 Masuk"]].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setTab(k); setErr(""); }}
                  className={`rounded-xl py-2 text-sm font-black transition-colors ${tab === k ? "bg-surface text-amber-bright shadow-soft" : "text-muted"}`}
                >
                  {l}
                </button>
              ))}
            </div>

            {tab === "daftar" ? (
              <form onSubmit={kirimDaftar} className="mt-4">
                <label htmlFor="ag-nama" className="text-xs font-black uppercase tracking-wide text-muted">Nama kamu</label>
                <input
                  id="ag-nama"
                  className="field mt-1.5"
                  placeholder="Contoh: Budi"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  maxLength={24}
                  autoComplete="nickname"
                  autoFocus
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  Cukup nama — tanpa email, tanpa password. Setelah daftar kamu dapat <b className="text-ink">kode akun</b> untuk masuk lagi.
                </p>
                {err && <p className="mt-2 text-xs font-bold text-rose">{err}</p>}
                <button
                  disabled={sibuk || nama.trim().length < 2}
                  className="btn-3d mt-4 w-full rounded-xl border-2 border-blue bg-blue-bright py-3 text-sm font-black text-white disabled:opacity-40"
                >
                  {sibuk ? "Membuat akun…" : "Daftar Sekarang"}
                </button>
              </form>
            ) : (
              <form onSubmit={kirimMasuk} className="mt-4">
                <label htmlFor="ag-kode" className="text-xs font-black uppercase tracking-wide text-muted">Kode akun</label>
                <input
                  id="ag-kode"
                  className="field mt-1.5 font-mono uppercase"
                  placeholder="AP-1A2B-3C4D-5E6F"
                  value={kode}
                  onChange={(e) => setKode(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  autoFocus
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  Kode yang kamu dapat saat daftar. Kode akun dari bot Telegram juga bisa dipakai — saldonya sama.
                </p>
                {err && <p className="mt-2 text-xs font-bold text-rose">{err}</p>}
                <button
                  disabled={sibuk || kode.trim().length < 6}
                  className="btn-3d mt-4 w-full rounded-xl border-2 border-blue bg-blue-bright py-3 text-sm font-black text-white disabled:opacity-40"
                >
                  {sibuk ? "Memeriksa…" : "Masuk"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
