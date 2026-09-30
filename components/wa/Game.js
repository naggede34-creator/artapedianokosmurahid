"use client";

// Tab Game & layar duel: lobi, buat duel (dengan/ tanpa taruhan), bermain, hasil.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/app/providers";
import { Ik, Avatar, NamaLencana, Lembar, Konfirmasi, useWa, useInterval, salin, waktuDaftar } from "@/components/wa/kit";
import { KatalogSolo } from "@/components/wa/GameSolo";
import { teksPoinRp, POIN_RP } from "@/lib/poinGame";
import { TombolSuara, useMusik, bunyiKlik } from "@/components/wa/Suara";
import { efek as bunyi } from "@/lib/suara";
import { PapanCatur, PapanUno, PapanRemi, PapanMahjong, HasilRemi, HasilMahjong } from "@/components/wa/GameBoards";

// Nominal game tampil sebagai poin + padanan rupiah (2 poin = Rp1.000).
const rupiah = (n) => teksPoinRp(n);
const fotoDari = (p) => (p?.fotoV ? `/api/wa/foto/${p.pid}?v=${p.fotoV}` : null);
export const tautanGame = (id) => `${typeof window !== "undefined" ? window.location.origin : ""}/chat?game=${id}`;

export const ATURAN = {
  catur: {
    judul: "Catur",
    ringkas: "Skakmat raja lawan. Aturan lengkap.",
    poin: [
      "Dua pemain, giliran bergantian. Putih/hitam diacak adil.",
      "Semua aturan resmi: rokade, en passant, promosi pion, skak, skakmat, dan pat.",
      "Remis: pat, material tak cukup, aturan 50 langkah, posisi berulang 3×, atau disepakati (tombol Tawar remis).",
      "Batas waktu 3 menit per langkah — lewat batas, kamu kalah."
    ]
  },
  uno: {
    judul: "UNO",
    ringkas: "Habiskan kartumu lebih dulu.",
    poin: [
      "Tiap pemain 7 kartu. Mainkan kartu yang warna atau angka/simbolnya sama dengan kartu teratas.",
      "⊘ Lewati & ⇄ Balik: lawan kehilangan giliran. +2: lawan ambil 2 kartu & lewat. 🌈 Liar: pilih warna. +4: pilih warna, lawan ambil 4 (hanya boleh bila tak punya warna aktif).",
      "Tak punya kartu cocok? Ketuk tumpukan untuk mengambil satu, lalu mainkan atau lewati.",
      "Kartu habis = menang. Batas waktu 60 detik per giliran."
    ]
  },
  remi: {
    judul: "Remi",
    ringkas: "Susun kartu, tutup dengan poin sisa ≤ 10.",
    poin: [
      "10 kartu per pemain. Tiap giliran: AMBIL satu kartu (tumpukan tertutup atau buangan teratas), lalu BUANG satu.",
      "Susunan sah: 3–4 kartu senilai, atau 3+ kartu berurutan sejenis (As hanya rendah: A-2-3).",
      "Nilai sisa: As 1, 2–9 angkanya, 10/J/Q/K = 10. Bila poin sisa ≤ 10, kamu boleh TUTUP (buang satu kartu & buka tangan). Sisa 0 = Gin.",
      "Poin sisamu lebih kecil dari lawan (setelah lawan menempelkan kartunya ke susunanmu) → kamu menang. Sama atau lebih besar → lawan menang (undercut).",
      "Batas waktu 90 detik per giliran."
    ]
  },
  mahjong: {
    judul: "Mahjong",
    ringkas: "Susun 4 set + 1 pasang, atau 7 pasang.",
    poin: [
      "136 ubin: bambu (竹), lingkaran (筒), karakter (萬), angin (東南西北), naga (中發白). Mulai 13 ubin.",
      "Giliran: AMBIL satu ubin dari dinding, lalu BUANG satu — atau TSUMO bila 14 ubin sudah membentuk tangan menang.",
      "Saat lawan membuang: RON (melengkapi tanganmu), PON (tiga sama), CHI (urutan tiga ubin sejenis), atau Lewat. PON/CHI membuka satu set.",
      "Tangan menang: 4 set (tiga sama / urutan tiga; honor hanya tiga sama) + 1 pasang, atau 7 pasang berbeda (jika belum membuka set).",
      "Dinding habis tanpa pemenang = seri. Batas waktu 60 detik."
    ]
  }
};

function DialogAturan({ jenis, onTutup }) {
  const a = ATURAN[jenis];
  return (
    <Lembar judul={`Cara main ${a.judul}`} onTutup={onTutup} lebar={440}>
      <ul className="wg-aturan">{a.poin.map((p, i) => <li key={i}>{p}</li>)}</ul>
      <p className="wa-kosong-kecil" style={{ textAlign: "left" }}>Semua aturan dijaga server — curang tidak mungkin. Pemenang mendapat total taruhan dikurangi potongan admin; seri atau batal mengembalikan taruhan utuh.</p>
    </Lembar>
  );
}

// ═════════════════════════ DIALOG BUAT DUEL ═════════════════════════
export function DialogDuel({ jenis: jenisAwal = "catur", undang: undangAwal = null, onTutup, onBuat }) {
  const wa = useWa();
  const { api, toast } = wa;
  const { refreshBalance } = useUser();
  const [jenis, setJenis] = useState(jenisAwal);
  const [saldoGame, setSaldoGame] = useState(0);
  const [undang, setUndang] = useState(undangAwal);
  const [taruhan, setTaruhan] = useState("0");
  const [konfig, setKonfig] = useState(null);
  const [kirim, setKirim] = useState(false);
  const [cari, setCari] = useState("");
  const [hasil, setHasil] = useState([]);
  const [tampilCari, setTampilCari] = useState(false);

  useEffect(() => { api.get("/api/game").then((r) => { if (r.ok) { setKonfig(r.data.konfig); setSaldoGame(r.data.saldoGame ?? 0); } }); refreshBalance?.(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!tampilCari) return undefined;
    const t = setTimeout(async () => { const r = await api.get(`/api/wa/kontak?q=${encodeURIComponent(cari)}`); if (r.ok) setHasil((r.data.items || []).slice(0, 8)); }, cari ? 250 : 0);
    return () => clearTimeout(t);
  }, [cari, tampilCari, api]);

  // Taruhan diketik dalam POIN (1 poin = Rp500); server memakai rupiah.
  const poinTaruhan = Math.max(0, Math.floor(Number(taruhan) || 0));
  const S = poinTaruhan * POIN_RP;
  const feePersen = konfig?.feePersen ?? 5;
  const hadiah = S ? S * 2 - Math.floor((S * 2 * feePersen) / 100) : 0;
  const boleh = konfig?.taruhanAktif !== false;
  const salah = S > 0 && konfig ? (S < konfig.min ? `Minimal ${rupiah(konfig.min)}` : S > konfig.maks ? `Maksimal ${rupiah(konfig.maks)}` : S > saldoGame ? "Poin game tidak cukup" : "") : "";
  const pilihanCepat = [0, 2, 10, 20, 50, 100].filter((n) => !konfig || n === 0 || (n * POIN_RP >= konfig.min && n * POIN_RP <= konfig.maks));

  async function buat() {
    if (kirim || salah) return;
    setKirim(true);
    const r = await api.post("/api/game", { aksi: "buat", jenis, taruhan: S, undang: undang?.pid || null });
    setKirim(false);
    if (!r.ok) { toast(r.error || "Gagal membuat duel."); return; }
    refreshBalance?.();
    onTutup();
    onBuat?.({ gameId: r.data.gameId, jenis, taruhan: S, undang });
    wa.bukaGame(r.data.gameId);
    wa.muatUlang?.();
  }

  return (
    <Lembar judul="Buat duel" onTutup={onTutup} lebar={460}>
      <div className="wa-form">
        <div className="wa-form-grup">
          <span>Pilih permainan</span>
          <div className="wg-pilih-game">
            {Object.entries(ATURAN).map(([k, a]) => (
              <button key={k} type="button" className={jenis === k ? "aktif" : ""} onClick={() => setJenis(k)} aria-pressed={jenis === k}>
                <b>{IKON[k]}</b><span>{a.judul}</span><small>{a.ringkas}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="wa-form-grup">
          <span>Lawan</span>
          {undang ? (
            <div className="wa-baris-daftar dipilih">
              <Avatar nama={undang.nama} foto={fotoDari(undang)} ada={!!undang.fotoV} size={40} />
              <span className="wa-baris-teks"><NamaLencana nama={undang.nama} lencana={undang.lencana} /><small>Tantangan pribadi</small></span>
              {!undangAwal && <button type="button" className="wa-tombol polos kecil" onClick={() => setUndang(null)}>Ganti</button>}
            </div>
          ) : (
            <>
              <div className="wg-mode">
                <button type="button" className="wa-tombol kecil aktif" style={{ flex: 1 }}>🌐 Lobi terbuka (siapa saja)</button>
                <button type="button" className="wa-tombol kecil" style={{ flex: 1 }} onClick={() => setTampilCari((v) => !v)}>👤 Tantang teman</button>
              </div>
              {tampilCari && (
                <div className="wg-cari-teman">
                  <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama teman…" aria-label="Cari teman" autoFocus />
                  {hasil.map((p) => (
                    <button type="button" key={p.pid} className="wa-baris-daftar" onClick={() => { setUndang(p); setTampilCari(false); }}>
                      <Avatar nama={p.nama} foto={fotoDari(p)} ada={!!p.fotoV} size={34} online={p.online} />
                      <span className="wa-baris-teks"><NamaLencana nama={p.nama} lencana={p.lencana} /></span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="wa-form-grup">
          <span>Taruhan per pemain {boleh ? "" : "(dinonaktifkan admin)"}</span>
          <div className="wg-chip-taruhan">
            {pilihanCepat.map((n) => <button type="button" key={n} className={poinTaruhan === n ? "aktif" : ""} onClick={() => setTaruhan(String(n))} disabled={!boleh && n > 0}>{n ? `${n} poin` : "Santai"}</button>)}
          </div>
          <input type="number" inputMode="numeric" min={0} value={taruhan} onChange={(e) => setTaruhan(e.target.value)} disabled={!boleh} aria-label="Taruhan (poin)" placeholder="Taruhan dalam poin" />
          <small className="wg-catatan">Poin game: <b>{rupiah(saldoGame)}</b>{konfig ? ` · batas ${rupiah(konfig.min)}–${rupiah(konfig.maks)}` : ""}{S > saldoGame ? <> · <a href="/game-deposit" style={{ color: "inherit", fontWeight: 900 }}>Isi poin</a></> : null}</small>
          {S > 0 && (
            <div className="wg-ringkas-taruhan">
              <span>Taruhan kedua pemain <b>{rupiah(S * 2)}</b></span>
              <span>Potongan admin {feePersen}% <b>−{rupiah(S * 2 - hadiah)}</b></span>
              <span className="besar">Pemenang mendapat <b>{rupiah(hadiah)}</b></span>
              <small>Saldo game dipotong {rupiah(S)} sekarang. Duel dibatalkan/seri = dikembalikan utuh.</small>
            </div>
          )}
          {salah && <small className="wa-gerbang-galat" role="alert">{salah}</small>}
        </div>

        <button className="wa-tombol utama" disabled={kirim || !!salah || (konfig && konfig.aktif === false)} onClick={buat}>
          {kirim ? "Membuat…" : undang ? `Tantang ${undang.nama}` : "Buka di lobi"}
        </button>
        {konfig && konfig.aktif === false && <small className="wa-gerbang-galat">Duel permainan sedang ditutup admin.</small>}
      </div>
    </Lembar>
  );
}

const IKON = { catur: "♟", uno: "🃏", remi: "🂡", mahjong: "🀄" };

// ═════════════════════════ TAB GAME (LOBI) ═════════════════════════
export function TabGame() {
  const wa = useWa();
  const { api, toast } = wa;
  const { refreshBalance } = useUser();
  const [d, setD] = useState(null);
  const [aturan, setAturan] = useState(null);
  const [sibuk, setSibuk] = useState("");
  useMusik("lounge"); // musik latar santai selama di dasbor game

  const muat = useCallback(async () => {
    const r = await api.get("/api/game");
    if (r.ok) setD(r.data); else if (!d) setD({ konfig: {}, permainan: [], lobi: [], milik: [], riwayat: [], galat: r.error });
  }, [api, d]);
  useEffect(() => { muat(); refreshBalance?.(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useInterval(() => { if (document.visibilityState === "visible") muat(); }, 4000);

  async function terima(g) {
    setSibuk(g.id);
    const r = await api.post("/api/game", { aksi: "gabung", id: g.id });
    setSibuk("");
    if (!r.ok) { toast(r.error || "Gagal bergabung."); muat(); return; }
    refreshBalance?.();
    wa.bukaGame(r.data.gameId);
  }

  const k = d?.konfig || {};
  return (
    <div className="wa-tab-isi wg-lobi" onClickCapture={bunyiKlik}>
      <div className="wg-bar-suara"><span>🎰 Dasbor Game</span><TombolSuara /></div>
      <div className="wg-saldo" data-testid="wg-saldo-game">
        <span>Poin game</span><b>{rupiah(d?.saldoGame ?? 0)}</b>
        <a className="wg-isi-saldo" href="/game-deposit" data-testid="isi-saldo-game">➕ Isi poin</a>
        {k.taruhanAktif === false ? <em>Taruhan dimatikan admin — main santai</em> : <em>Potongan admin {k.feePersen ?? 5}% dari total taruhan</em>}
      </div>

      <h3 className="wa-subjudul">Main sekarang</h3>
      <div className="wg-katalog">
        {(d?.permainan?.length ? d.permainan : Object.keys(ATURAN).map((kode) => ({ kode, nama: ATURAN[kode].judul, ikon: IKON[kode] }))).map((p) => (
          <div key={p.kode} className="wg-kartu-game">
            <button className="wg-kartu-utama" onClick={() => wa.buka({ tipe: "duel-baru", jenis: p.kode })} disabled={k.aktif === false}>
              <span className="ikon">{IKON[p.kode]}</span>
              <b>{p.nama}</b>
              <small>{ATURAN[p.kode].ringkas}</small>
            </button>
            <button className="wg-info" onClick={() => setAturan(p.kode)} aria-label={`Cara main ${p.nama}`}>?</button>
          </div>
        ))}
      </div>
      {k.aktif === false && <p className="wa-kosong-kecil">Duel permainan sedang ditutup admin.</p>}

      <h3 className="wa-subjudul">Game solo <small className="ws-kecil">main sendiri · koin latihan</small></h3>
      <KatalogSolo onBuka={(kode) => wa.bukaGame(kode)} />

      {d?.milik?.length > 0 && (
        <>
          <h3 className="wa-subjudul">Duel kamu</h3>
          {d.milik.map((g) => (
            <button key={g.id} className={`wa-baris-daftar wg-baris${g.giliranSaya ? " giliran" : ""}`} onClick={() => wa.bukaGame(g.id)}>
              <span className="wg-ikon-bulat">{IKON[g.jenis]}</span>
              <span className="wa-baris-teks">
                <b className="wa-nama-teks">{g.nama}{g.lawan ? ` vs ${g.lawan.nama}` : g.undang ? " · tantangan pribadi" : " · menunggu lawan"}</b>
                <small>{g.status === "main" ? (g.giliranSaya ? "🔔 Giliranmu!" : "Menunggu giliran lawan") : g.diundangSaya ? "Kamu ditantang" : "Menunggu lawan bergabung"}{g.taruhan ? ` · ${rupiah(g.taruhan)}` : " · santai"}</small>
              </span>
              <Ik n="back" s={18} style={{ transform: "rotate(180deg)", opacity: 0.5 }} />
            </button>
          ))}
        </>
      )}

      <h3 className="wa-subjudul">Lobi terbuka ({d?.lobi?.length || 0})</h3>
      {d && !d.lobi.length && (
        <div className="wa-kosong">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/maskot-sm.webp" alt="" />
          <b>Belum ada yang menunggu lawan</b>
          <p>Buka duel baru di atas — temanmu dan pengguna lain akan melihatnya di sini dan mendapat notifikasi.</p>
        </div>
      )}
      {d?.lobi?.map((g) => (
        <div key={g.id} className="wa-baris-daftar wg-baris">
          <span className="wg-ikon-bulat">{IKON[g.jenis]}</span>
          <span className="wa-baris-teks">
            <NamaLencana nama={`${g.pemain[0]?.nama || "Pemain"} · ${g.nama}`} lencana={g.pemain[0]?.lencana} />
            <small>{g.diundangSaya ? "🎯 Menantangmu · " : ""}{g.taruhan ? `Taruhan ${rupiah(g.taruhan)} → menang ${rupiah(g.hadiah)}` : "Main santai"} · {waktuDaftar(g.dibuat)}</small>
          </span>
          <button className="wa-tombol kecil utama" onClick={() => terima(g)} disabled={sibuk === g.id}>{sibuk === g.id ? "…" : g.diundangSaya ? "Terima" : "Lawan"}</button>
        </div>
      ))}

      {d?.riwayat?.length > 0 && (
        <>
          <h3 className="wa-subjudul">Riwayat</h3>
          {d.riwayat.map((g) => (
            <button key={g.id} className="wa-baris-daftar wg-baris" onClick={() => wa.bukaGame(g.id)}>
              <span className="wg-ikon-bulat">{IKON[g.jenis]}</span>
              <span className="wa-baris-teks">
                <b className="wa-nama-teks">{g.nama}{g.lawan ? ` vs ${g.lawan.nama}` : ""}</b>
                <small>{waktuDaftar(g.dibuat)}{g.taruhan ? ` · taruhan ${rupiah(g.taruhan)}` : ""}</small>
              </span>
              <span className={`wg-hasil-chip ${g.hasil?.saya || ""}`}>
                {g.hasil?.saya === "menang" ? `+${rupiah((g.hasil.dibayar || 0) - (g.taruhan || 0))}` : g.hasil?.saya === "kalah" ? (g.taruhan ? `−${rupiah(g.taruhan)}` : "Kalah") : g.hasil?.saya === "seri" ? "Seri" : "Batal"}
              </span>
            </button>
          ))}
        </>
      )}
      {aturan && <DialogAturan jenis={aturan} onTutup={() => setAturan(null)} />}
    </div>
  );
}

// ═════════════════════════ LAYAR DUEL ═════════════════════════
export function LayarGame({ id, onTutup }) {
  const wa = useWa();
  const { api, toast } = wa;
  const { refreshBalance } = useUser();
  const [g, setG] = useState(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [tick, setTick] = useState(0);
  const [tanya, setTanya] = useState(null);
  const [aturan, setAturan] = useState(false);
  const batas = useRef(0);
  const statusAwal = useRef(null);
  const sebelum = useRef(null);
  useMusik("lounge");

  const terapkan = useCallback((data) => {
    // Suara: langkah lawan/saya, giliran, lawan bergabung, dan hasil akhir.
    const sig = data.papan ? JSON.stringify(data.papan) : "";
    const prev = sebelum.current;
    if (prev) {
      if (prev.status === "menunggu" && data.status === "main") bunyi("notif");
      else if (data.status === "main" && sig !== prev.sig) bunyi({ catur: "langkah", uno: "kartu", remi: "kartu", mahjong: "ubin" }[data.jenis] || "klik");
      if (data.status === "main" && data.giliranSaya && !prev.giliran) setTimeout(() => bunyi("giliran"), 220);
      if (["selesai", "batal"].includes(data.status) && prev.status !== data.status) {
        const h = data.hasil?.saya;
        bunyi(h === "menang" ? (data.taruhan > 0 ? "menangBesar" : "menang") : h === "kalah" ? "kalah" : "seri");
      }
    }
    sebelum.current = { sig, giliran: !!data.giliranSaya, status: data.status };
    setG(data);
    batas.current = data.sisaMs != null ? Date.now() + data.sisaMs : 0;
    if (statusAwal.current === null) statusAwal.current = data.status;
    if (["selesai", "batal"].includes(data.status) && statusAwal.current !== data.status) { statusAwal.current = data.status; refreshBalance?.(); wa.muatUlang?.(); }
  }, [refreshBalance, wa]);

  const muat = useCallback(async () => {
    const r = await api.get(`/api/game?id=${encodeURIComponent(id)}`);
    if (r.ok) { setGalat(""); terapkan(r.data); }
    else if (r.status === 404) setGalat(r.error || "Duel tidak ditemukan.");
  }, [api, id, terapkan]);

  useEffect(() => { muat(); }, [muat]);
  const hidup = !g || g.status === "menunggu" || g.status === "main";
  useInterval(() => { if (document.visibilityState === "visible") muat(); }, 1500, hidup);
  useInterval(() => setTick((x) => x + 1), 250, g?.status === "main");
  useEffect(() => { const f = () => document.visibilityState === "visible" && muat(); document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, [muat]);

  async function aksi(langkah) {
    if (sibuk) return;
    setSibuk(true);
    const r = await api.post("/api/game", { aksi: "main", id, langkah });
    setSibuk(false);
    if (r.ok) terapkan(r.data.game); else { toast(r.error || "Langkah gagal."); muat(); }
  }
  async function cepat(nama, extra = {}) {
    setSibuk(true);
    const r = await api.post("/api/game", { aksi: nama, id, ...extra });
    setSibuk(false);
    if (!r.ok) { toast(r.error || "Gagal."); muat(); return null; }
    if (r.data.game) terapkan(r.data.game); else muat();
    refreshBalance?.();
    return r;
  }
  async function revans() {
    if (!g?.lawan) return;
    const r = await api.post("/api/game", { aksi: "buat", jenis: g.jenis, taruhan: g.taruhan, undang: g.lawan.pid });
    if (!r.ok) { toast(r.error || "Gagal membuat revans."); return; }
    refreshBalance?.();
    wa.bukaGame(r.data.gameId);
    toast("Tantangan revans terkirim.");
  }

  const sisa = batas.current ? Math.max(0, Math.ceil((batas.current - Date.now()) / 1000)) : null;
  void tick;
  const main = g?.status === "main";
  const selesai = g && (g.status === "selesai" || g.status === "batal");
  const saya = g?.pemain?.find((p) => p.pid === wa.saya?.pid);
  const lawan = g?.lawan;
  const Papan = { catur: PapanCatur, uno: PapanUno, remi: PapanRemi, mahjong: PapanMahjong }[g?.jenis];

  return (
    <div className="wg-layar" role="dialog" aria-label="Duel permainan" onClickCapture={bunyiKlik}>
      <header className="wa-kepala wg-kepala">
        <button className="wa-ikon" onClick={onTutup} aria-label="Kembali"><Ik n="back" s={22} /></button>
        <div className="wg-judul">
          <b>{g ? `${g.ikon} ${g.nama}` : "Duel"}</b>
          <small>{g ? (g.taruhan ? `Taruhan ${rupiah(g.taruhan)} · hadiah ${rupiah(g.hadiah)}` : "Main santai") : "Memuat…"}</small>
        </div>
        <TombolSuara />
        {g && <button className="wa-ikon" onClick={() => setAturan(true)} aria-label="Cara main"><Ik n="info" s={22} /></button>}
      </header>

      {galat && <div className="wa-galat-blok"><span>🎮</span><p>{galat}</p><button className="wa-tombol" onClick={onTutup}>Kembali</button></div>}
      {!g && !galat && <div className="wa-memuat"><span className="wa-spin" /> Memuat duel…</div>}

      {g && (
        <div className="wg-isi">
          <div className="wg-pemain">
            <div className={`wg-chip-pemain${main && g.giliranSaya ? " aktif" : ""}`}>
              <Avatar nama={saya?.nama || "Kamu"} foto={fotoDari(saya)} ada={!!saya?.fotoV} size={36} />
              <span><NamaLencana nama={saya?.nama || "Kamu"} lencana={saya?.lencana} size={13} /><small>{main ? (g.giliranSaya ? "Giliranmu" : "Menunggu") : "Kamu"}</small></span>
            </div>
            {main && sisa !== null && <div className={`wg-waktu${sisa <= 10 ? " kritis" : ""}`} role="timer" aria-label={`Sisa waktu ${sisa} detik`}>{sisa}s</div>}
            {!main && <div className="wg-vs">VS</div>}
            <div className={`wg-chip-pemain kanan${main && !g.giliranSaya ? " aktif" : ""}`}>
              {lawan ? (
                <>
                  <span><NamaLencana nama={lawan.nama} lencana={lawan.lencana} size={13} /><small>{main ? (!g.giliranSaya ? "Giliran lawan" : "Lawan") : lawan.online ? "online" : "Lawan"}</small></span>
                  <Avatar nama={lawan.nama} foto={fotoDari(lawan)} ada={!!lawan.fotoV} size={36} online={lawan.online} />
                </>
              ) : <span className="wg-menunggu-lawan"><small>Menunggu lawan…</small></span>}
            </div>
          </div>

          {g.status === "menunggu" && (
            <div className="wg-tunggu">
              <div className="wg-denyut" aria-hidden>{g.ikon}</div>
              {g.tuanRumah ? (
                <>
                  <b>{g.undang ? "Tantangan terkirim!" : "Duel terbuka di lobi"}</b>
                  <p>{g.undang ? "Lawanmu sudah mendapat notifikasi." : "Pengguna lain melihatnya di tab Game."} Kamu akan diberi tahu begitu ada yang menerima.</p>
                  <div className="wg-aksi">
                    <button className="wa-tombol kecil" onClick={async () => toast((await salin(tautanGame(g.id))) ? "Tautan duel disalin." : "Gagal menyalin.")}><Ik n="link" s={16} /> Salin tautan</button>
                    <button className="wa-tombol kecil bahaya" onClick={async () => { const r = await cepat("batal"); if (r) { toast("Duel dibatalkan, taruhan dikembalikan."); onTutup(); } }} disabled={sibuk}>Batalkan</button>
                  </div>
                </>
              ) : (
                <>
                  <b>{g.diundangSaya ? `${g.pemain[0]?.nama} menantangmu!` : `Duel ${g.nama} dari ${g.pemain[0]?.nama}`}</b>
                  <p>{g.taruhan ? `Taruhan ${rupiah(g.taruhan)} per pemain. Menang = ${rupiah(g.hadiah)}. Saldo game dipotong ${rupiah(g.taruhan)} saat menerima.` : "Main santai tanpa taruhan."}</p>
                  <div className="wg-aksi">
                    <button className="wa-tombol utama" onClick={async () => { const r = await cepat("gabung"); if (r) { muat(); } }} disabled={sibuk}>Terima & main</button>
                    {g.diundangSaya && <button className="wa-tombol bahaya" onClick={async () => { const r = await cepat("tolak"); if (r) onTutup(); }} disabled={sibuk}>Tolak</button>}
                  </div>
                </>
              )}
            </div>
          )}

          {g.papan && Papan && (
            <div className={`wg-papan wg-game-${g.jenis}`}>
              <Papan papan={g.papan} onAksi={aksi} sibuk={sibuk || !main} />
            </div>
          )}

          {selesai && (
            <div className={`wg-hasil ${g.hasil?.saya || ""}`} role="status" data-testid="wg-hasil">
              {g.hasil.saya === "menang" && <div className="wg-konfeti" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ "--i": i }} />)}</div>}
              {g.hasil.saya === "menang" && g.taruhan > 0 && <div className="sl-hujan dalam" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <span key={i} style={{ "--i": i, "--x": `${(i * 43) % 100}%`, "--d": `${(i % 7) * 0.15}s` }}>🪙</span>)}</div>}
              <div className="wg-hasil-judul">
                {g.hasil.saya === "menang" ? "🏆 KAMU MENANG!" : g.hasil.saya === "kalah" ? "😵 Kamu kalah" : g.hasil.saya === "seri" ? "🤝 Seri" : "Duel dibatalkan"}
              </div>
              <p>{g.hasil.alasan}</p>
              {g.taruhan > 0 && (
                <p className="wg-hasil-uang">
                  {g.hasil.saya === "menang" ? <>+{rupiah(g.hasil.dibayar)} masuk ke saldo game <small>(potongan admin {rupiah(g.hasil.fee)})</small></> : g.hasil.saya === "kalah" ? <>Taruhan {rupiah(g.taruhan)} hangus</> : <>Taruhan {rupiah(g.taruhan)} dikembalikan utuh</>}
                </p>
              )}
              {["menang", "kalah", "seri"].includes(g.hasil.saya) && (
                <div className="wg-hasil-rincian">
                  {lawan && <span><small>Lawan</small><b>{lawan.nama}</b></span>}
                  {g.taruhan > 0 && <span><small>Taruhan</small><b>{rupiah(g.taruhan)}</b></span>}
                  {g.taruhan > 0 && g.hasil.saya === "menang" && <span><small>Hadiah</small><b>{rupiah(g.hasil.dibayar)}</b></span>}
                  {g.taruhan > 0 && g.hasil.saya === "kalah" && <span><small>Kehilangan</small><b>−{rupiah(g.taruhan)}</b></span>}
                </div>
              )}
              {g.papan?.selesai?.tanganPenutup && <HasilRemi selesai={g.papan.selesai} />}
              {g.papan?.selesai?.tanganMenang && <HasilMahjong selesai={g.papan.selesai} />}
              <div className="wg-aksi">
                {lawan && g.status === "selesai" && <button className="wa-tombol utama" onClick={revans}>🔁 Revans</button>}
                <button className="wa-tombol" onClick={onTutup}>Tutup</button>
              </div>
            </div>
          )}

          {main && (
            <div className="wg-kaki">
              <button className="wa-tombol kecil bahaya" onClick={() => setTanya({ judul: "Menyerah?", isi: g.taruhan ? `Kamu akan kalah dan taruhan ${rupiah(g.taruhan)} hangus.` : "Kamu akan dianggap kalah.", tombol: [{ label: "Ya, menyerah", gaya: "bahaya", onClick: async () => { setTanya(null); await cepat("menyerah"); } }] })} disabled={sibuk}>🏳 Menyerah</button>
            </div>
          )}
        </div>
      )}
      {tanya && <Konfirmasi judul={tanya.judul} isi={tanya.isi} tombol={tanya.tombol} onTutup={() => setTanya(null)} />}
      {aturan && g && <DialogAturan jenis={g.jenis} onTutup={() => setAturan(false)} />}
    </div>
  );
}

// ═════════════════════════ BANNER DUEL (di atas daftar chat) ═════════════════════════
export function BannerGame({ game }) {
  const wa = useWa();
  const n = useMemo(() => ({ u: game?.undangan || [], b: (game?.berjalan || []).filter((x) => x.giliranSaya) }), [game]);
  if (!n.u.length && !n.b.length) return null;
  return (
    <div className="wg-banner" role="region" aria-label="Duel permainan">
      {n.u.slice(0, 2).map((u) => (
        <button key={u.id} onClick={() => wa.bukaGame(u.id)}>
          <span>{u.ikon}</span>
          <b>{u.dari} menantangmu main {u.nama}{u.taruhan ? ` · ${rupiah(u.taruhan)}` : ""}</b>
          <em>Lihat</em>
        </button>
      ))}
      {n.b.slice(0, 2).map((b) => (
        <button key={b.id} className="giliran" onClick={() => wa.bukaGame(b.id)}>
          <span>{b.ikon}</span>
          <b>Giliranmu di {b.nama} vs {b.lawan}</b>
          <em>Main</em>
        </button>
      ))}
    </div>
  );
}
