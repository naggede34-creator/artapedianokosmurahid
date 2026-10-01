"use client";

// Panel admin ringkas untuk dompet Poin Game: saklar tukar saldo nokos ↔ poin, penarikan, dan batas minimal.
// Menyimpan lewat /api/admin/config (nilai langsung berlaku, tanpa deploy ulang).
import { useCallback, useEffect, useState } from "react";
import { POIN_RP } from "@/lib/poinGame";

const SAKLAR = [
  { nama: "GAME_ISI_NOKOS_AKTIF", judul: "Saldo nokos → Poin game", ket: "Pengguna boleh mengubah saldo nokos jadi poin game." },
  { nama: "GAME_TUKAR_AKTIF", judul: "Poin game → Saldo nokos", ket: "Pengguna boleh menukar poin game kembali ke saldo nokos." },
  { nama: "GAME_TARIK_AKTIF", judul: "Tarik poin ke e-wallet", ket: "Pengguna boleh mengajukan penarikan poin ke DANA/OVO/GoPay/dll." }
];

export default function AdminPengaturanPoin() {
  const [nilai, setNilai] = useState(null);
  const [form, setForm] = useState({});
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState("");

  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/config", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal memuat.");
      const peta = Object.fromEntries(d.item.map((i) => [i.nama, i.tampil]));
      setNilai(peta);
      setForm({
        tarikMinPoin: String(Math.round(Number(peta.GAME_TARIK_MIN_RP || 10000) / POIN_RP)),
        tarikFeePoin: String(Math.round(Number(peta.GAME_TARIK_FEE_RP || 0) / POIN_RP)),
        isiMinPoin: String(peta.GAME_POIN_TOPUP_MIN || "2"),
        tukarFee: String(peta.GAME_TUKAR_FEE_PERSEN || "0"),
        isiNokosFee: String(peta.GAME_ISI_NOKOS_FEE_PERSEN || "0"),
        putar: String(peta.GAME_SYARAT_PUTAR_KALI ?? "1"),
        jam: String(peta.GAME_TARIK_JAM || "")
      });
      setGalat("");
    } catch (e) { setGalat(e.message); }
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const simpan = async (nama, nilaiBaru, kunci = nama) => {
    setSibuk(kunci); setPesan(""); setGalat("");
    try {
      const r = await fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "simpan", nama, nilai: String(nilaiBaru) }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal menyimpan.");
      setPesan(d.pesan || "Tersimpan."); await muat();
    } catch (e) { setGalat(e.message); } finally { setSibuk(""); setTimeout(() => setPesan(""), 4000); }
  };

  if (!nilai) return <div className="card p-4 text-sm text-muted">{galat || "Memuat pengaturan poin…"}</div>;
  const nyala = (n) => String(nilai[n] ?? "1") !== "0";
  const f = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  const kolom = (judul, kunci, ket, kirim, satuan) => (
    <div className="rounded-xl border border-line bg-surface p-3">
      <label className="text-xs font-bold text-ink">{judul}</label>
      <div className="mt-1.5 flex gap-2">
        <input value={form[kunci] ?? ""} onChange={(e) => f(kunci, e.target.value.replace(/[^\d.]/g, ""))} inputMode="numeric" data-testid={`pp-${kunci}`} className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-amber" />
        <button type="button" onClick={() => kirim()} disabled={sibuk === kunci} className="btn-3d shrink-0 rounded-lg bg-amber px-3 py-2 text-xs font-black text-white disabled:opacity-60" data-testid={`pp-simpan-${kunci}`}>{sibuk === kunci ? "…" : "Simpan"}</button>
      </div>
      <p className="mt-1 text-[11px] text-muted">{satuan}{ket ? ` · ${ket}` : ""}</p>
    </div>
  );

  return (
    <div className="card p-4" data-testid="admin-pengaturan-poin">
      <h3 className="text-base font-extrabold text-ink">⚙️ Pengaturan Poin Game</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">Semua saklar & batas di bawah langsung berlaku. 1 poin = Rp{POIN_RP.toLocaleString("id-ID")}.</p>
      {galat && <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-xs font-bold text-rose">{galat}</p>}
      {pesan && <p className="mt-3 rounded-lg bg-teal-soft px-3 py-2 text-xs font-bold text-teal-bright">{pesan}</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {SAKLAR.map((s) => (
          <div key={s.nama} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-3">
            <div className="min-w-0"><b className="block text-xs text-ink">{s.judul}</b><span className="text-[11px] leading-snug text-muted">{s.ket}</span></div>
            <button type="button" role="switch" aria-checked={nyala(s.nama)} aria-label={s.judul} data-testid={`pp-saklar-${s.nama}`} disabled={sibuk === s.nama} onClick={() => simpan(s.nama, nyala(s.nama) ? "0" : "1")} className={`btn-3d relative h-7 w-12 shrink-0 rounded-full transition-colors ${nyala(s.nama) ? "bg-teal" : "bg-rose"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${nyala(s.nama) ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {kolom("Minimal penarikan (poin)", "tarikMinPoin", `≈ Rp${(Number(form.tarikMinPoin || 0) * POIN_RP).toLocaleString("id-ID")}`, () => simpan("GAME_TARIK_MIN_RP", Number(form.tarikMinPoin || 0) * POIN_RP, "tarikMinPoin"), "Pengajuan di bawah angka ini ditolak.")}
        {kolom("Biaya tarik per pengajuan (poin)", "tarikFeePoin", `≈ Rp${(Number(form.tarikFeePoin || 0) * POIN_RP).toLocaleString("id-ID")}`, () => simpan("GAME_TARIK_FEE_RP", Number(form.tarikFeePoin || 0) * POIN_RP, "tarikFeePoin"), "0 = gratis.")}
        {kolom("Minimal isi poin (poin)", "isiMinPoin", "", () => simpan("GAME_POIN_TOPUP_MIN", form.isiMinPoin || 2, "isiMinPoin"), "Berlaku untuk isi poin lewat QRIS & saldo nokos.")}
        {kolom("Potongan saldo nokos → poin (%)", "isiNokosFee", "", () => simpan("GAME_ISI_NOKOS_FEE_PERSEN", form.isiNokosFee || 0, "isiNokosFee"), "0 = tanpa potongan.")}
        {kolom("Potongan poin → saldo nokos (%)", "tukarFee", "", () => simpan("GAME_TUKAR_FEE_PERSEN", form.tukarFee || 0, "tukarFee"), "0 = tanpa potongan.")}
        {kolom("Syarat perputaran (× total isi)", "putar", "", () => simpan("GAME_SYARAT_PUTAR_KALI", form.putar || 0, "putar"), "Anti cuci uang; 0 = tanpa syarat (tidak disarankan).")}
      </div>
    </div>
  );
}
