"use client";

// WEARTA CHAT — cangkang aplikasi: daftar obrolan, status, panggilan, profil.
// Dua panel di layar lebar, satu panel bertumpuk di ponsel.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/providers";
import { Ik, Avatar, NamaLencana, Lembar, Konfirmasi, WaCtx, useWa, bikinApi, useInterval, waktuDaftar, jam, durasiTeks, tautanKontak, bagikanTautan } from "@/components/wa/kit";
import Percakapan from "@/components/wa/Percakapan";
import TabStatus from "@/components/wa/Status";
import LayarPanggilan from "@/components/wa/Panggilan";
import { TabGame, LayarGame, DialogDuel, BannerGame } from "@/components/wa/Game";
import { LayarPlinko, LayarSlot } from "@/components/wa/GameSolo";
import { LayarDadu, LayarKeno, LayarRoda } from "@/components/wa/GameSolo2";
import dynamic from "next/dynamic";
// Arena Pendekar dimuat terpisah (berkas besar: mesin tarung, sprite, efek) hanya saat dibuka.
const LayarTarung = dynamic(() => import("@/components/tarung/Tarung").then((m) => m.LayarTarung), { ssr: false, loading: () => <div className="wg-layar tr-memuat"><span className="wa-spin" /> Memuat Arena Pendekar…</div> });
import { SheetKontak, SheetGrupBaru, SheetProfilSaya, SheetUser, SheetRoom, SheetTambahAnggota, SheetTeruskan } from "@/components/wa/Lembaran";
import "@/components/wa/wa.css";

const fotoDari = (p) => (p?.fotoV ? `/api/wa/foto/${p.pid}?v=${p.fotoV}` : null);

function previewTeks(r) {
  const p = r.preview;
  if (!p) return "Belum ada pesan";
  const awal = p.saya && p.jenis !== "sistem" && p.jenis !== "call" ? "Kamu: " : "";
  return awal + (p.teks || "");
}

export default function WaApp() {
  const router = useRouter();
  const { token, ready, updateName } = useUser();
  const api = useMemo(() => (token ? bikinApi(token) : null), [token]);

  const [saya, setSaya] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [perluNama, setPerluNama] = useState(false);
  // Halaman dibuka lewat tautan game (?game=…): gerbang nama memakai kalimat khusus game.
  const [maksudGame, setMaksudGame] = useState(false);
  useEffect(() => { try { if (new URLSearchParams(window.location.search).get("game")) setMaksudGame(true); } catch {} }, []);
  const [gameInfo, setGameInfo] = useState({ undangan: [], berjalan: [], selesai: [] });
  const [gameAktif, setGameAktif] = useState(null);
  const gameTerlihat = useRef(null);
  const [rooms, setRooms] = useState([]);
  const [statusBaru, setStatusBaru] = useState(0);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [tab, setTab] = useState("chat");
  const [aktif, setAktif] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("semua");
  const [arsip, setArsip] = useState(false);
  const [menuUtama, setMenuUtama] = useState(false);
  const [menuRoom, setMenuRoom] = useState(null);
  const [tanya, setTanya] = useState(null);
  const [notif, setNotif] = useState(null);
  const [panggilan, setPanggilan] = useState(null);
  const [toasts, setToasts] = useState([]);
  const ditolak = useRef(new Set());
  const panggilanRef = useRef(null);
  const toastN = useRef(0);
  panggilanRef.current = panggilan;

  // `teks` boleh berupa string atau kartu kaya: { ikon, judul, isi, warna, buka }.
  const toast = useCallback((teks) => {
    if (!teks) return;
    const id = ++toastN.current;
    const kaya = typeof teks === "object";
    setToasts((t) => [...t.slice(-2), { id, teks, kaya }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kaya ? 6000 : 3200);
  }, []);

  // ───────────── sinkron ─────────────
  const sinkron = useCallback(async () => {
    if (!api) return;
    const r = await api.get("/api/wa/sinkron");
    if (r.ok) {
      setGalat("");
      setSaya(r.data.saya);
      setAdmin(!!r.data.admin);
      setPerluNama(!!r.data.perluNama);
      // Notifikasi dalam aplikasi: tantangan baru, duel dimulai, giliranku.
      const gi = r.data.game || { undangan: [], berjalan: [] };
      setGameInfo(gi);
      const lalu = gameTerlihat.current;
      const peta = { u: new Set(gi.undangan.map((x) => x.id)), b: new Map(gi.berjalan.map((x) => [x.id, x.giliranSaya])), s: new Set((gi.selesai || []).map((x) => x.id)) };
      if (lalu) {
        const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
        for (const u of gi.undangan) if (!lalu.u.has(u.id)) {
          toast({ ikon: "⚔️", warna: "#f43f5e", judul: `${u.dari} menantangmu main ${u.nama}!`, isi: u.taruhan ? `Taruhan ${rp(u.taruhan)} per pemain. Ketuk untuk menjawab.` : "Main santai tanpa taruhan. Ketuk untuk menjawab.", buka: u.id });
          navigator.vibrate?.(60);
        }
        for (const b of gi.berjalan) {
          if (!lalu.b.has(b.id)) toast({ ikon: b.ikon, warna: "#38bdf8", judul: `Duel ${b.nama} dimulai!`, isi: `Kamu 🆚 ${b.lawan}${b.taruhan ? ` · taruhan ${rp(b.taruhan)}` : " · tanpa taruhan"}. ${b.giliranSaya ? "Kamu jalan duluan!" : `${b.lawan} jalan duluan.`}`, buka: b.id });
          else if (b.giliranSaya && !lalu.b.get(b.id)) toast({ ikon: "⏱", warna: "#f59e0b", judul: `Giliranmu di ${b.nama}`, isi: `Lawanmu ${b.lawan} sudah jalan — jangan sampai kehabisan waktu.`, buka: b.id });
        }
        for (const s of gi.selesai || []) if (!lalu.s.has(s.id)) {
          const T = { menang: ["🏆", "#22c55e", `Kamu menang lawan ${s.lawan}!`], kalah: ["😵", "#f43f5e", `Kamu kalah dari ${s.lawan}`], seri: ["🤝", "#f59e0b", `Seri melawan ${s.lawan}`] }[s.saya];
          toast({ ikon: T[0], warna: T[1], judul: `${s.nama}: ${T[2]}`, isi: `${s.alasan}.${s.saya === "menang" && s.hadiah ? ` Hadiah ${rp(s.hadiah)} masuk saldo.` : s.saya === "kalah" && s.taruhan ? ` Taruhan ${rp(s.taruhan)} hangus.` : s.saya === "seri" && s.taruhan ? " Taruhan dikembalikan." : ""}`, buka: s.id });
        }
      }
      gameTerlihat.current = peta;
      setRooms(r.data.rooms || []);
      setStatusBaru(r.data.statusBaru || 0);
      const masuk = r.data.panggilanMasuk;
      if (masuk && !panggilanRef.current && !ditolak.current.has(masuk.callId)) {
        setPanggilan({ arah: "masuk", callId: masuk.callId, jenis: masuk.jenis, lawan: masuk.dari });
      }
    } else if (r.status === 401) {
      setGalat("Sesi akunmu tidak dikenali. Masuk ulang lewat halaman utama.");
    } else if (!saya) {
      setGalat(r.error || "Gagal memuat.");
    }
    setMuat(false);
  }, [api, saya]);

  useEffect(() => { if (api) sinkron(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);
  useInterval(() => { if (document.visibilityState !== "hidden") sinkron(); }, panggilan ? 3000 : 3500, !!api);
  useEffect(() => {
    const f = () => { if (document.visibilityState === "visible") sinkron(); };
    document.addEventListener("visibilitychange", f);
    window.addEventListener("focus", f);
    return () => { document.removeEventListener("visibilitychange", f); window.removeEventListener("focus", f); };
  }, [sinkron]);

  // ───────────── navigasi / tautan dalam ─────────────
  const bacaUrl = useCallback(() => {
    const u = new URLSearchParams(window.location.search);
    setAktif(u.get("room") || null);
  }, []);
  useEffect(() => {
    bacaUrl();
    window.addEventListener("popstate", bacaUrl);
    return () => window.removeEventListener("popstate", bacaUrl);
  }, [bacaUrl]);

  const bukaRoom = useCallback((id) => {
    setAktif(id);
    try { window.history.pushState({ wa: 1 }, "", `/chat?room=${encodeURIComponent(id)}`); } catch {}
  }, []);
  const tutupRoom = useCallback(() => {
    setAktif(null);
    try {
      if (window.history.state?.wa) window.history.back();
      else window.history.replaceState({}, "", "/chat");
    } catch {}
  }, []);

  // ?profil=1 (dari halaman Profil Akun)
  useEffect(() => {
    if (!api) return;
    if (new URLSearchParams(window.location.search).get("profil")) {
      window.history.replaceState({}, "", "/chat");
      setSheet({ tipe: "profil-saya" });
    }
  }, [api]);

  // Tautan dalam: ?u=<id kontak> (buka chat dengannya) dan ?gabung=<kode> (undangan grup).
  // Diproses setelah nama diatur; tautan dari pesan lain dikirim lewat event "wa-tautan".
  const prosesTautan = useCallback(async (search) => {
    if (!api) return;
    const u = new URLSearchParams(search);
    const pid = u.get("u");
    const kode = u.get("gabung");
    const game = u.get("game");
    if (game) {
      try { window.history.replaceState({}, "", "/chat"); } catch {}
      if (game === "1") setTab("game"); else setGameAktif(game);
      return;
    }
    if (!pid && !kode) return;
    try { window.history.replaceState({}, "", "/chat"); } catch {}
    if (pid) {
      if (pid === saya?.pid) { toast("Ini tautan chat-mu sendiri."); return; }
      const r = await api.get(`/api/wa/profil?pid=${encodeURIComponent(pid)}`);
      if (!r.ok) { toast(r.error || "Kontak tidak ditemukan."); return; }
      const p = r.data.profil;
      setTanya({
        judul: `Mulai chat dengan ${p.nama}?`,
        isi: p.bio || "Kamu membuka tautan kontak.",
        tombol: [{ label: "Mulai chat", gaya: "utama", onClick: async () => { setTanya(null); const g = await api.post("/api/wa/room", { aksi: "private", pid }); if (g.ok) { sinkron(); bukaRoom(g.data.roomId); } else toast(g.error || "Gagal membuka obrolan."); } }]
      });
      return;
    }
    const r = await api.get(`/api/wa/room?kode=${encodeURIComponent(kode)}`);
    if (!r.ok) { toast(r.error || "Tautan undangan tidak berlaku."); return; }
    if (r.data.sudah) { toast("Kamu sudah ada di grup ini."); }
    setTanya({
      judul: `Gabung ke “${r.data.nama}”?`,
      isi: `${r.data.anggota} anggota${r.data.deskripsi ? ` · ${r.data.deskripsi}` : ""}`,
      tombol: [{ label: "Gabung grup", gaya: "utama", onClick: async () => { setTanya(null); const g = await api.post("/api/wa/room", { aksi: "gabung", kode }); if (g.ok) { sinkron(); bukaRoom(g.data.roomId); toast("Kamu bergabung ke grup."); } else toast(g.error || "Gagal bergabung."); } }]
    });
  }, [api, saya, toast, sinkron, bukaRoom]);

  // Saat halaman dibuka lewat tautan: tunggu profil termuat dan nama sudah diatur.
  const tautanAwal = useRef(true);
  useEffect(() => {
    if (!api || !saya || perluNama || !tautanAwal.current) return;
    tautanAwal.current = false;
    prosesTautan(window.location.search);
  }, [api, saya, perluNama, prosesTautan]);
  // Tautan yang diketuk dari dalam pesan.
  useEffect(() => {
    const f = (e) => { if (!perluNama) prosesTautan(String(e.detail || "")); };
    window.addEventListener("wa-tautan", f);
    return () => window.removeEventListener("wa-tautan", f);
  }, [prosesTautan, perluNama]);

  // ───────────── panggilan ─────────────
  const telepon = useCallback((lawan, jenis) => {
    if (panggilanRef.current) { toast("Kamu sedang dalam panggilan."); return; }
    if (typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast("Peramban ini belum mendukung panggilan. Gunakan Chrome/Safari terbaru lewat https.");
      return;
    }
    setPanggilan({ arah: "keluar", jenis, lawan });
  }, [toast]);

  const selesaiPanggilan = useCallback(() => {
    const p = panggilanRef.current;
    if (p?.callId) ditolak.current.add(p.callId);
    setPanggilan(null);
    sinkron();
  }, [sinkron]);

  // Bagikan tautan chat pribadiku (pengganti kartu kontak).
  const bagikanSaya = useCallback(async () => {
    if (!saya) return;
    const r = await bagikanTautan({ judul: "Chat denganku di WEARTA CHAT", teks: `Chat denganku (${saya.nama}) di WEARTA CHAT:`, url: tautanKontak(saya.pid) });
    if (r === "salin") toast("Tautan chat-mu disalin. Tempel ke mana saja untuk dibagikan.");
    else if (r === "gagal") toast("Gagal menyalin tautan.");
  }, [saya, toast]);

  // ───────────── sheet ─────────────
  const buka = useCallback((s) => setSheet(s), []);
  const bukaGame = useCallback((id) => { setSheet(null); setGameAktif(id); }, []);
  const tutupSheet = useCallback(() => setSheet(null), []);

  const ctx = useMemo(() => ({ token, api, perluNama, me: saya, saya, admin, rooms, toast, bukaRoom, tutupRoom, buka, telepon, muatUlang: sinkron, bagikanSaya, bukaGame }), [token, api, perluNama, saya, admin, rooms, toast, bukaRoom, tutupRoom, buka, telepon, sinkron, bagikanSaya, bukaGame]);

  // ───────────── daftar ─────────────
  const diarsip = rooms.filter((r) => r.archived);
  const daftar = useMemo(() => {
    const k = cari.trim().toLowerCase();
    return rooms.filter((r) => {
      if (arsip ? !r.archived : r.archived) return false;
      if (saring === "belum" && !r.belumBaca) return false;
      if (saring === "grup" && r.jenis === "private") return false;
      if (k && !(r.nama.toLowerCase().includes(k) || (r.preview?.teks || "").toLowerCase().includes(k))) return false;
      return true;
    });
  }, [rooms, cari, saring, arsip]);
  const totalBelum = rooms.filter((r) => !r.muted && !r.archived).reduce((a, r) => a + (r.belumBaca || 0), 0);

  useEffect(() => {
    const dasar = "WEARTA CHAT";
    document.title = totalBelum ? `(${totalBelum}) ${dasar}` : dasar;
    return () => { document.title = "ARTA PEDIA ID"; };
  }, [totalBelum]);

  async function pref(r, kunci) {
    const nilai = !r[kunci];
    const x = await api.post("/api/wa/room", { aksi: "pref", roomId: r.roomId, [kunci]: nilai });
    setMenuRoom(null);
    if (x.ok) { toast({ pinned: nilai ? "Chat disematkan." : "Sematan dilepas.", muted: nilai ? "Notifikasi dibisukan." : "Notifikasi diaktifkan.", archived: nilai ? "Chat diarsipkan." : "Chat dikeluarkan dari arsip." }[kunci]); sinkron(); } else toast(x.error || "Gagal.");
  }

  // ───────────── penjaga ─────────────
  if (!ready || (token && muat && !saya && !galat)) {
    return (
      <div className="wa wa-layar-tengah">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/maskot-sm.webp" alt="" className="wa-maskot-tunggu" />
        <p>Menyiapkan WEARTA CHAT…</p>
      </div>
    );
  }
  if (!token) {
    return (
      <div className="wa wa-layar-tengah">
        <span style={{ fontSize: 52 }}>🔒</span>
        <p>Masuk dulu untuk memakai WEARTA CHAT.</p>
        <button className="wa-tombol utama" onClick={() => router.push("/")}>Ke beranda</button>
      </div>
    );
  }
  if (galat && !saya) {
    return (
      <div className="wa wa-layar-tengah">
        <span style={{ fontSize: 52 }}>🦅</span>
        <p>{galat}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="wa-tombol utama" onClick={() => { setMuat(true); sinkron(); }}>Coba lagi</button>
          <button className="wa-tombol polos" onClick={() => router.push("/")}>Beranda</button>
        </div>
      </div>
    );
  }

  const roomAktif = aktif ? rooms.find((r) => r.roomId === aktif) : null;

  return (
    <WaCtx.Provider value={ctx}>
      <div className={`wa${aktif ? " ada-room" : ""}`}>
        <div className="wa-latar" aria-hidden><i className="rays" /><i className="tone" /></div>

        {/* ───────── panel kiri ───────── */}
        <aside className="wa-kiri">
          <header className="wa-kepala wa-kepala-utama">
            <button className="wa-ikon" onClick={() => router.push("/")} aria-label="Kembali ke beranda"><Ik n="back" s={22} /></button>
            <h1 className="wa-judul">WEARTA <span>CHAT</span></h1>
            <div className="wa-kepala-aksi">
              <div className="wa-menu-jangkar">
                <button className="wa-ikon" onClick={() => setMenuUtama((v) => !v)} aria-label="Menu" aria-expanded={menuUtama}><Ik n="more" s={22} /></button>
                {menuUtama && (
                  <>
                    <div className="wa-menu-tutup" onClick={() => setMenuUtama(false)} />
                    <div className="wa-menu-pop" role="menu">
                      <button onClick={() => { setMenuUtama(false); buka({ tipe: "grup-baru" }); }}><Ik n="users" s={18} /> Grup baru</button>
                      <button onClick={() => { setMenuUtama(false); bagikanSaya(); }}><Ik n="link" s={18} /> Bagikan tautan chat-ku</button>
                      <button onClick={() => { setMenuUtama(false); buka({ tipe: "profil-saya" }); }}><Ik n="user" s={18} /> Profil saya</button>
                      <button onClick={() => { setMenuUtama(false); setArsip(true); setTab("chat"); }}><Ik n="archive" s={18} /> Chat diarsipkan{diarsip.length ? ` (${diarsip.length})` : ""}</button>
                      <button onClick={() => { setMenuUtama(false); sinkron(); toast("Diperbarui."); }}><Ik n="refresh" s={18} /> Segarkan</button>
                      {admin && <button onClick={() => router.push("/admin/dashboard")}><Ik n="gear" s={18} /> Dasbor admin</button>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <BannerGame game={gameInfo} />

          {tab === "chat" && (
            <div className="wa-tab-isi ada-fab">
              {arsip ? (
                <button className="wa-arsip-kepala" onClick={() => setArsip(false)}><Ik n="back" s={20} /> Chat diarsipkan</button>
              ) : (
                <>
                  <div className="wa-cari-bar solid">
                    <Ik n="search" s={18} />
                    <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari obrolan atau pesan" aria-label="Cari obrolan" />
                    {cari && <button className="wa-ikon kecil" onClick={() => setCari("")} aria-label="Hapus"><Ik n="close" s={16} /></button>}
                  </div>
                  <div className="wa-saring">
                    {[["semua", "Semua"], ["belum", "Belum dibaca"], ["grup", "Grup"]].map(([k, l]) => (
                      <button key={k} className={saring === k ? "aktif" : ""} onClick={() => setSaring(k)}>{l}</button>
                    ))}
                  </div>
                  {diarsip.length > 0 && !cari && (
                    <button className="wa-baris-daftar arsip-baris" onClick={() => setArsip(true)}>
                      <span className="wa-ikon-bulat"><Ik n="archive" s={20} /></span>
                      <span className="wa-baris-teks"><b className="wa-nama-teks">Diarsipkan</b></span>
                      <b className="wa-arsip-n">{diarsip.length}</b>
                    </button>
                  )}
                </>
              )}
              {!daftar.length && (
                <div className="wa-kosong">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/maskot-sm.webp" alt="" />
                  <b>{cari ? "Tidak ada hasil" : arsip ? "Tidak ada chat diarsipkan" : saring === "belum" ? "Semua sudah dibaca" : "Belum ada obrolan"}</b>
                  <p>{cari ? "Coba kata lain." : "Ketuk tombol chat di kanan bawah untuk memulai obrolan."}</p>
                </div>
              )}
              {daftar.map((r) => (
                <BarisRoom key={r.roomId} r={r} aktif={aktif === r.roomId} onBuka={() => bukaRoom(r.roomId)} onMenu={() => setMenuRoom(r)} />
              ))}
              <button className="wa-fab" onClick={() => buka({ tipe: "kontak" })} aria-label="Chat baru"><Ik n="chat" s={26} /><b>+</b></button>
            </div>
          )}
          {tab === "status" && <TabStatus />}
          {tab === "panggilan" && <TabPanggilan />}
          {tab === "game" && <TabGame />}

          <nav className="wa-tab-bawah" aria-label="Navigasi">
            <button className={tab === "chat" ? "aktif" : ""} onClick={() => setTab("chat")}>
              <span><Ik n="chat" s={24} />{totalBelum > 0 && <b>{totalBelum > 99 ? "99+" : totalBelum}</b>}</span>Obrolan
            </button>
            <button className={tab === "status" ? "aktif" : ""} onClick={() => setTab("status")}>
              <span><Ik n="status" s={24} />{statusBaru > 0 && <i className="titik" />}</span>Status
            </button>
            <button className={tab === "panggilan" ? "aktif" : ""} onClick={() => setTab("panggilan")}>
              <span><Ik n="phone" s={22} /></span>Panggilan
            </button>
            <button className={tab === "game" ? "aktif" : ""} onClick={() => setTab("game")}>
              <span><Ik n="game" s={24} />{(gameInfo.undangan.length + gameInfo.berjalan.filter((x) => x.giliranSaya).length) > 0 && <b>{gameInfo.undangan.length + gameInfo.berjalan.filter((x) => x.giliranSaya).length}</b>}</span>Game
            </button>
            <button onClick={() => buka({ tipe: "profil-saya" })}>
              <span><Avatar nama={saya?.nama} foto={fotoDari(saya)} ada={!!saya?.fotoV} size={26} /></span>Saya
            </button>
          </nav>
        </aside>

        {/* ───────── panel kanan ───────── */}
        <main className="wa-kanan">
          {aktif ? (
            <Percakapan key={aktif} roomId={aktif} />
          ) : (
            <div className="wa-selamat">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/maskot-sm.webp" alt="" />
              <h2>WEARTA CHAT</h2>
              <p>Kirim pesan, foto, suara, dan telepon teman langsung dari web. Pilih obrolan di kiri atau mulai yang baru.</p>
              <button className="wa-tombol utama" onClick={() => buka({ tipe: "kontak" })}><Ik n="chat" s={18} /> Chat baru</button>
              <small><Ik n="lock" s={12} /> Kode akunmu tidak pernah terlihat pengguna lain.</small>
            </div>
          )}
        </main>

        {/* ───────── lapisan ───────── */}
        {sheet?.tipe === "kontak" && <SheetKontak mode={sheet.mode} onPilih={sheet.onPilih} onTutup={tutupSheet} />}
        {sheet?.tipe === "grup-baru" && <SheetGrupBaru onTutup={tutupSheet} />}
        {sheet?.tipe === "profil-saya" && <SheetProfilSaya onTutup={tutupSheet} />}
        {sheet?.tipe === "user" && <SheetUser pid={sheet.pid} onTutup={tutupSheet} />}
        {sheet?.tipe === "room" && <SheetRoom roomId={sheet.roomId} onTutup={tutupSheet} />}
        {sheet?.tipe === "duel-baru" && <DialogDuel jenis={sheet.jenis} undang={sheet.undang} onBuat={sheet.onBuat} onTutup={tutupSheet} />}
        {sheet?.tipe === "tambah-anggota" && <SheetTambahAnggota roomId={sheet.roomId} sudah={sheet.sudah} onTutup={tutupSheet} />}
        {sheet?.tipe === "teruskan" && <SheetTeruskan room={sheet.room} msg={sheet.msg} onTutup={tutupSheet} />}

        {menuRoom && (
          <Lembar judul={menuRoom.nama} onTutup={() => setMenuRoom(null)} lebar={360}>
            <button className="wa-baris-daftar aksi" onClick={() => pref(menuRoom, "pinned")}><Ik n="pin" s={20} /><span className="wa-baris-teks"><b className="wa-nama-teks">{menuRoom.pinned ? "Lepas sematan" : "Sematkan chat"}</b></span></button>
            <button className="wa-baris-daftar aksi" onClick={() => pref(menuRoom, "muted")}><Ik n={menuRoom.muted ? "bell" : "mute"} s={20} /><span className="wa-baris-teks"><b className="wa-nama-teks">{menuRoom.muted ? "Aktifkan notifikasi" : "Bisukan notifikasi"}</b></span></button>
            {menuRoom.jenis !== "umum" && <button className="wa-baris-daftar aksi" onClick={() => pref(menuRoom, "archived")}><Ik n="archive" s={20} /><span className="wa-baris-teks"><b className="wa-nama-teks">{menuRoom.archived ? "Keluarkan dari arsip" : "Arsipkan chat"}</b></span></button>}
          </Lembar>
        )}
        {tanya && <Konfirmasi judul={tanya.judul} isi={tanya.isi} tombol={tanya.tombol} onTutup={() => setTanya(null)} />}

        {gameAktif === "plinko" && <LayarPlinko onTutup={() => setGameAktif(null)} />}
        {gameAktif === "slot" && <LayarSlot onTutup={() => setGameAktif(null)} />}
        {gameAktif === "dadu" && <LayarDadu onTutup={() => setGameAktif(null)} />}
        {gameAktif === "keno" && <LayarKeno onTutup={() => setGameAktif(null)} />}
        {gameAktif === "roda" && <LayarRoda onTutup={() => setGameAktif(null)} />}
        {gameAktif === "tarung" && <LayarTarung onTutup={() => setGameAktif(null)} onDuel={() => { setGameAktif(null); setTab("game"); buka({ tipe: "duel-baru", jenis: "tarung" }); }} />}
        {gameAktif && !["plinko", "slot", "dadu", "keno", "roda", "tarung"].includes(gameAktif) && <LayarGame key={gameAktif} id={gameAktif} onTutup={() => { setGameAktif(null); sinkron(); }} />}

        {panggilan && <LayarPanggilan key={panggilan.callId || "keluar"} sesi={panggilan} onSelesai={selesaiPanggilan} />}

        {perluNama && (
          <GerbangNama
            untukGame={maksudGame || tab === "game" || !!gameAktif}
            awal=""
            onKeluar={() => router.push("/")}
            onSimpan={async (nama) => {
              const r = await api.post("/api/wa/profil", { nama });
              if (!r.ok) return r.error || "Gagal menyimpan nama.";
              try { await updateName(nama); } catch {}
              await sinkron();
              return null;
            }}
          />
        )}

        <div className="wa-toasts" aria-live="polite">
          {toasts.map((t) => t.kaya ? (
            <button key={t.id} type="button" className="wa-toast wa-toast-kaya" data-testid="toast-game" style={{ "--tw": t.teks.warna || "#38bdf8" }}
              onClick={() => { setToasts((x) => x.filter((y) => y.id !== t.id)); if (t.teks.buka) bukaGame(t.teks.buka); }}>
              <span className="wa-toast-ikon">{t.teks.ikon}</span>
              <span className="wa-toast-teks"><b>{t.teks.judul}</b>{t.teks.isi && <em>{t.teks.isi}</em>}</span>
            </button>
          ) : <div key={t.id} className="wa-toast">{t.teks}</div>)}
        </div>
      </div>
    </WaCtx.Provider>
  );
}

// Gerbang nama: chat tidak bisa dipakai sebelum nama diatur.
function GerbangNama({ onSimpan, onKeluar, untukGame = false }) {
  const [nama, setNama] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [err, setErr] = useState("");
  const sah = nama.trim().length >= 2;
  async function kirim(e) {
    e.preventDefault();
    if (!sah || sibuk) return;
    setSibuk(true);
    setErr("");
    const hasil = await onSimpan(nama.trim());
    if (hasil) { setErr(hasil); setSibuk(false); }
  }
  return (
    <div className="wa-lembar-latar wa-gerbang" role="dialog" aria-modal="true" aria-label="Atur nama">
      <form className="wa-konfirmasi wa-gerbang-kartu" onSubmit={kirim}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/maskot-sm.webp" alt="" className="wa-gerbang-maskot" />
        <h3>Siapa namamu?</h3>
        <p>{untukGame
          ? "Atur nama dulu sebelum masuk Game. Nama ini tampil ke lawanmu di duel, lobi, dan papan hasil. Cukup sekali — kalau sudah diisi, kamu langsung masuk."
          : "Atur nama dulu sebelum masuk WEARTA CHAT. Nama ini tampil ke teman-temanmu di chat, grup, dan status."}</p>
        <input
          id="wa-nama-awal"
          className="wa-gerbang-input"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          maxLength={24}
          placeholder="Contoh: Budi"
          autoComplete="nickname"
          autoFocus
          aria-label="Nama kamu"
        />
        <small className="wa-gerbang-catatan">2–24 karakter. Bisa diganti kapan saja di Profil.</small>
        {err && <p className="wa-gerbang-galat" role="alert">{err}</p>}
        <div className="wa-konfirmasi-tombol">
          <button type="submit" className="wa-tombol utama" disabled={!sah || sibuk}>{sibuk ? "Menyimpan…" : untukGame ? "Simpan & masuk game" : "Simpan & mulai chat"}</button>
          <button type="button" className="wa-tombol polos" onClick={onKeluar}>Nanti saja, kembali</button>
        </div>
      </form>
    </div>
  );
}

function BarisRoom({ r, aktif, onBuka, onMenu }) {
  const tahan = useRef(null);
  const privat = r.jenis === "private";
  const mengetikTeks = r.mengetik ? (privat ? "sedang mengetik…" : "ada yang sedang mengetik…") : null;
  return (
    <button
      className={`wa-baris-daftar wa-chat${aktif ? " aktif" : ""}${r.belumBaca ? " belum" : ""}`}
      onClick={onBuka}
      onContextMenu={(e) => { e.preventDefault(); onMenu(); }}
      onPointerDown={(e) => { if (e.pointerType !== "mouse") tahan.current = setTimeout(() => { navigator.vibrate?.(12); onMenu(); }, 520); }}
      onPointerUp={() => clearTimeout(tahan.current)}
      onPointerLeave={() => clearTimeout(tahan.current)}
      onPointerMove={() => clearTimeout(tahan.current)}
    >
      <Avatar nama={r.nama} foto={r.foto} ada={r.fotoAda} size={52} online={privat && !!r.lawan?.online} umum={r.jenis === "umum" && !r.fotoAda} />
      <span className="wa-baris-teks">
        <span className="wa-baris-atas">
          <NamaLencana nama={r.nama} lencana={r.lencana} />
          <time className={r.belumBaca ? "baru" : ""}>{waktuDaftar(r.lastAt)}</time>
        </span>
        <span className="wa-baris-bawah">
          <small className={mengetikTeks ? "mengetik" : ""}>{mengetikTeks || previewTeks(r)}</small>
          <span className="wa-baris-ikon">
            {r.muted && <Ik n="mute" s={15} />}
            {r.pinned && <Ik n="pin" s={14} />}
            {r.belumBaca > 0 && <b className={`wa-belum-n${r.muted ? " bisu" : ""}`}>{r.belumBaca > 99 ? "99+" : r.belumBaca}</b>}
          </span>
        </span>
      </span>
    </button>
  );
}

// ─────────────────────────── TAB PANGGILAN ───────────────────────────
function TabPanggilan() {
  const wa = useWa();
  const { api, telepon } = wa;
  const [daftar, setDaftar] = useState(null);
  const muat = useCallback(async () => {
    const r = await api.get("/api/wa/call?riwayat=1");
    setDaftar(r.ok ? r.data.riwayat || [] : []);
  }, [api]);
  useEffect(() => { muat(); }, [muat]);
  useInterval(() => { if (document.visibilityState === "visible") muat(); }, 8000);

  const ket = (c) => {
    if (c.status === "selesai") return `${c.arah === "keluar" ? "↗" : "↙"} ${durasiTeks(c.durasi || 0)}`;
    if (c.status === "ditolak") return c.arah === "keluar" ? "↗ Ditolak" : "↙ Ditolak";
    if (c.status === "sibuk") return "↗ Sibuk";
    return c.arah === "keluar" ? "↗ Tidak dijawab" : "↙ Terlewat";
  };
  const merah = (c) => c.arah === "masuk" && ["tak-terjawab", "ditolak"].includes(c.status);

  return (
    <div className="wa-tab-isi ada-fab">
      {daftar === null && <div className="wa-memuat"><span className="wa-spin" /> Memuat riwayat…</div>}
      {daftar && !daftar.length && (
        <div className="wa-kosong">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/maskot-sm.webp" alt="" />
          <b>Belum ada panggilan</b>
          <p>Telepon temanmu lewat tombol di bawah. Panggilan suara & video langsung antar perangkat.</p>
        </div>
      )}
      {(daftar || []).map((c) => (
        <div key={c.callId} className="wa-baris-daftar wa-panggilan-baris">
          <button className="wa-baris-klik" onClick={() => wa.buka({ tipe: "user", pid: c.lawan.pid })}>
            <Avatar nama={c.lawan.nama} foto={fotoDari(c.lawan)} ada={!!c.lawan.fotoV} size={48} />
            <span className="wa-baris-teks">
              <NamaLencana nama={c.lawan.nama} lencana={c.lawan.lencana} />
              <small className={merah(c) ? "merah" : ""}>{ket(c)} · {waktuDaftar(c.at) || jam(c.at)}</small>
            </span>
          </button>
          <button className="wa-ikon-bulat" onClick={() => telepon(c.lawan, c.jenis)} aria-label={c.jenis === "video" ? "Telepon video lagi" : "Telepon lagi"}><Ik n={c.jenis === "video" ? "video" : "phone"} s={20} /></button>
        </div>
      ))}
      <button className="wa-fab" onClick={() => wa.buka({ tipe: "kontak", mode: "panggil" })} aria-label="Panggilan baru"><Ik n="phone" s={24} /><b>+</b></button>
    </div>
  );
}

