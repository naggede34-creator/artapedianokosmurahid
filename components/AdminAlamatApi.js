"use client";

// Kartu "Alamat API (Base URL)" di Pengaturan Umum.
//
// Dua alamat yang tampil di dokumentasi dan bisa dikopi developer:
//   • API Developer (nokos)  → halaman /api-docs dan /apikey
//   • QRIS Gateway           → halaman /gateway/docs
//
// Kartu ini sengaja berdiri sendiri (memuat dan menyimpan sendiri) supaya tidak
// menambah state di dasbor admin yang sudah sangat besar.
import { useCallback, useEffect, useState } from "react";
import { Bantuan } from "@/components/AdminPanduan";
import { SITE_URL } from "@/lib/links";

const BARIS = [
  {
    kunci: "apiBaseUrl",
    jenis: "api",
    judul: "📱 API Developer (nokos)",
    jalur: "/api/v1",
    dipakaiDi: "/api-docs dan /apikey",
    contoh: "https://api.tokomu.com",
    fungsi:
      "Alamat dasar yang ditampilkan di dokumentasi API Developer. Semua contoh kode (curl, JavaScript, Python) di halaman itu otomatis memakai alamat ini.",
    isi: "Domain saja, diawali https://, tanpa path di belakangnya. Path /api/v1 ditambahkan sendiri oleh dokumentasi."
  },
  {
    kunci: "gatewayBaseUrl",
    jenis: "gateway",
    judul: "💸 QRIS Gateway",
    jalur: "/api/gw/v1",
    dipakaiDi: "/gateway/docs",
    contoh: "https://pay.tokomu.com",
    fungsi:
      "Alamat dasar yang ditampilkan di dokumentasi QRIS Gateway untuk merchant. Semua contoh kode di halaman itu otomatis memakai alamat ini.",
    isi: "Domain saja, diawali https://, tanpa path di belakangnya. Path /api/gw/v1 ditambahkan sendiri oleh dokumentasi."
  }
];

function Hasil({ h }) {
  if (!h) return null;
  return (
    <p className={`mt-2 rounded-lg border px-3 py-2 text-[11px] font-medium leading-relaxed ${h.ok ? "border-success/40 bg-success-soft text-success" : "border-rose/40 bg-rose-soft text-rose"}`}>
      {h.ok ? "✅ " : "⚠️ "}
      {h.pesan}
    </p>
  );
}

export default function AdminAlamatApi() {
  const [nilai, setNilai] = useState({ apiBaseUrl: "", gatewayBaseUrl: "" });
  const [tersimpan, setTersimpan] = useState({ apiBaseUrl: "", gatewayBaseUrl: "", siteUrl: "" });
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState("");
  const [pesan, setPesan] = useState("");
  const [cek, setCek] = useState({}); // jenis → hasil
  const [mengecek, setMengecek] = useState("");

  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/settings", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal memuat.");
      const t = { apiBaseUrl: d.apiBaseUrl || "", gatewayBaseUrl: d.gatewayBaseUrl || "", siteUrl: d.siteUrl || "" };
      setTersimpan(t);
      setNilai({ apiBaseUrl: t.apiBaseUrl, gatewayBaseUrl: t.gatewayBaseUrl });
    } catch (e) {
      setPesan(e.message || "Gagal memuat.");
    } finally {
      setMemuat(false);
    }
  }, []);
  useEffect(() => { muat(); }, [muat]);

  // Alamat yang BENAR-BENAR tampil di dokumentasi saat ini (kolom khusus →
  // URL Situs → alamat bawaan). Ditampilkan supaya admin tidak menebak.
  const efektif = (b) => tersimpan[b.kunci] || tersimpan.siteUrl || SITE_URL;

  async function simpan(b) {
    setMenyimpan(b.kunci);
    setPesan("");
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [b.kunci]: nilai[b.kunci] })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal menyimpan.");
      const baru = d[b.kunci] || "";
      setTersimpan((t) => ({ ...t, [b.kunci]: baru }));
      setNilai((n) => ({ ...n, [b.kunci]: baru }));
      setCek((c) => ({ ...c, [b.jenis]: null }));
      // normalkanBase di server bisa mengubah yang diketik (menambah https://,
      // membuang path). Dikabari supaya admin tahu apa yang tersimpan.
      setPesan(
        nilai[b.kunci] && !baru
          ? `${b.judul}: alamat tidak valid sehingga dikosongkan — dokumentasi memakai URL Situs.`
          : baru
          ? `${b.judul}: tersimpan sebagai ${baru}`
          : `${b.judul}: dikosongkan — dokumentasi memakai URL Situs.`
      );
    } catch (e) {
      setPesan(e.message);
    } finally {
      setMenyimpan("");
    }
  }

  async function periksa(b) {
    setMengecek(b.jenis);
    setCek((c) => ({ ...c, [b.jenis]: null }));
    try {
      // Yang diperiksa adalah isi kolom SAAT INI (boleh belum disimpan), atau
      // alamat yang sedang berlaku kalau kolomnya kosong.
      const url = nilai[b.kunci].trim() || efektif(b);
      const r = await fetch("/api/admin/cek-alamat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jenis: b.jenis, url })
      });
      const d = await r.json();
      setCek((c) => ({ ...c, [b.jenis]: r.ok ? d : { ok: false, pesan: d.error || "Gagal memeriksa." } }));
    } catch {
      setCek((c) => ({ ...c, [b.jenis]: { ok: false, pesan: "Gagal menghubungi server. Coba lagi." } }));
    } finally {
      setMengecek("");
    }
  }

  return (
    <div className="glass rounded-2xl p-5 shadow-soft sm:p-6" data-testid="admin-alamat-api">
      <h2 className="font-display text-base font-semibold text-ink">🔗 Alamat API (Base URL)</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Alamat yang dilihat dan disalin developer di halaman dokumentasi. Ubah di sini — dokumentasi ikut berubah
        <b> tanpa deploy ulang</b>.
      </p>

      <div className="mt-3 rounded-xl border border-blue/30 bg-blue-soft px-3 py-2.5 text-[11px] leading-relaxed text-ink">
        <b>Penting — alamat baru harus hidup dulu.</b> Kolom ini hanya mengubah apa yang <i>ditampilkan</i>. Agar developer bisa benar-benar
        memakainya, domainnya harus sudah ditambahkan di hosting (mis. Vercel → Settings → Domains) dan DNS-nya mengarah ke web ini.
        Setelah mengisi, tekan <b>Cek alamat</b>: tombol itu menghubungi alamatnya dan memastikan jawabannya memang berasal dari web ini.
      </div>

      {memuat ? (
        <div className="skeleton mt-4 h-28 rounded-xl" />
      ) : (
        <div className="mt-4 space-y-4">
          {BARIS.map((b) => (
            <div key={b.kunci} className="rounded-2xl border border-line bg-surface p-4">
              <label className="text-sm font-bold text-ink" htmlFor={`alamat-${b.kunci}`}>{b.judul}</label>
              <Bantuan
                fungsi={b.fungsi}
                isi={b.isi}
                contoh={b.contoh}
                dimana={`Tampil di halaman ${b.dipakaiDi}.`}
                kosong="Dikosongkan = ikut URL Situs di kartu Pengaturan Situs (kalau itu juga kosong, memakai alamat bawaan web)."
              />

              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id={`alamat-${b.kunci}`}
                  value={nilai[b.kunci]}
                  onChange={(e) => setNilai((n) => ({ ...n, [b.kunci]: e.target.value }))}
                  placeholder={b.contoh}
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  className="input w-full flex-1 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => simpan(b)}
                    disabled={menyimpan === b.kunci}
                    className="btn-3d shrink-0 rounded-lg bg-amber px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {menyimpan === b.kunci ? "…" : "Simpan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => periksa(b)}
                    disabled={mengecek === b.jenis}
                    className="shrink-0 rounded-lg border border-line px-4 py-2.5 text-sm font-bold text-ink press disabled:opacity-60"
                  >
                    {mengecek === b.jenis ? "Mengecek…" : "Cek alamat"}
                  </button>
                </div>
              </div>

              <p className="mt-2 text-[11px] text-muted">
                Yang tampil di dokumentasi sekarang:{" "}
                <code className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-ink">{efektif(b)}{b.jalur}</code>
              </p>
              <Hasil h={cek[b.jenis]} />
            </div>
          ))}
        </div>
      )}

      {pesan && <p className="mt-3 text-xs font-medium text-teal-bright">{pesan}</p>}
    </div>
  );
}
