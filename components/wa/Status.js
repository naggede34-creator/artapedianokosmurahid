"use client";

// Status (SW): daftar pembaruan, penonton layar penuh, dan pembuat status.
import { useCallback, useEffect, useRef, useState } from "react";
import { Ik, Avatar, NamaLencana, Lembar, useWa, useInterval, kecilkanGambar, waktuDaftar, jam } from "@/components/wa/kit";

const fotoDari = (p) => (p?.fotoV ? `/api/wa/foto/${p.pid}?v=${p.fotoV}` : null);
const LATAR_BAWAAN = ["#f77c22", "#2e86ff", "#ec4899", "#16a34a", "#8b5cf6", "#ef4444", "#14b8a6", "#eab308", "#171717"];

export default function TabStatus() {
  const wa = useWa();
  const { api, toast, saya } = wa;
  const [daftar, setDaftar] = useState(null);
  const [latar, setLatar] = useState(LATAR_BAWAAN);
  const [penonton, setPenonton] = useState(null); // { pos } | null
  const [buat, setBuat] = useState(null); // "teks" | "gambar"
  const fileRef = useRef(null);
  const [gambarDipilih, setGambarDipilih] = useState(null);

  const muat = useCallback(async () => {
    const r = await api.get("/api/wa/status");
    if (r.ok) { setDaftar(r.data.daftar || []); if (r.data.latar?.length) setLatar(r.data.latar); }
    else if (!daftar) setDaftar([]);
  }, [api, daftar]);

  useEffect(() => { muat(); wa.muatUlang?.(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useInterval(() => { if (document.visibilityState === "visible" && !penonton) muat(); }, 15000);

  const milik = daftar?.find((d) => d.saya) || null;
  const lain = (daftar || []).filter((d) => !d.saya);
  const baru = lain.filter((d) => d.belumDilihat);
  const dilihat = lain.filter((d) => !d.belumDilihat);
  const urutan = daftar || [];

  async function pilihGambar(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast("Pilih berkas gambar."); return; }
    try {
      setGambarDipilih(await kecilkanGambar(f, { sisi: 1280, maksBytes: 820_000 }));
      setBuat("gambar");
    } catch (err) { toast(err.message || "Gambar tidak bisa diproses."); }
  }

  async function buka(d) {
    if (d.saya) await muat(); // hitungan "dilihat" harus yang terbaru
    const pos = urutan.findIndex((x) => x.pid === d.pid);
    if (pos >= 0) setPenonton({ pos });
  }

  const Baris = ({ d, judul, sub }) => {
    const ring = d.saya ? "saya" : d.belumDilihat ? "baru" : "lihat";
    return (
      <button className="wa-baris-daftar" onClick={() => buka(d)}>
        <Avatar nama={d.profil.nama} foto={fotoDari(d.profil)} ada={!!d.profil.fotoV} size={52} ring={ring} />
        <span className="wa-baris-teks">
          <NamaLencana nama={judul || d.profil.nama} lencana={d.profil.lencana} />
          <small>{sub}</small>
        </span>
      </button>
    );
  };

  return (
    <div className="wa-tab-isi">
      <div className="wa-status-saya">
        <button className="wa-baris-daftar" onClick={() => (milik ? buka(milik) : setBuat("teks"))}>
          <span className="wa-avatar-plus">
            <Avatar nama={saya?.nama} foto={fotoDari(saya)} ada={!!saya?.fotoV} size={52} ring={milik ? "saya" : null} />
            <i><Ik n="plus" s={14} /></i>
          </span>
          <span className="wa-baris-teks">
            <b className="wa-nama-teks">Status saya</b>
            <small>{milik ? `${milik.statuses.length} status · ${waktuDaftar(milik.terbaru) || jam(milik.terbaru)}` : "Ketuk untuk menambah status"}</small>
          </span>
        </button>
        <div className="wa-status-aksi">
          <button className="wa-ikon-bulat" onClick={() => setBuat("teks")} aria-label="Status teks"><Ik n="edit" s={20} /></button>
          <button className="wa-ikon-bulat" onClick={() => fileRef.current?.click()} aria-label="Status foto"><Ik n="camera" s={20} /></button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pilihGambar} />
      </div>

      {daftar === null && <div className="wa-memuat"><span className="wa-spin" /> Memuat status…</div>}
      {daftar && !lain.length && (
        <div className="wa-kosong">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/maskot-sm.webp" alt="" />
          <b>Belum ada status dari pengguna lain</b>
          <p>Status hilang otomatis setelah 24 jam. Jadilah yang pertama membuat!</p>
        </div>
      )}
      {baru.length > 0 && <h3 className="wa-subjudul">Pembaruan terbaru</h3>}
      {baru.map((d) => <Baris key={d.pid} d={d} sub={`${d.statuses.length} status · ${waktuDaftar(d.terbaru) || jam(d.terbaru)}`} />)}
      {dilihat.length > 0 && <h3 className="wa-subjudul">Sudah dilihat</h3>}
      {dilihat.map((d) => <Baris key={d.pid} d={d} sub={`${d.statuses.length} status · ${waktuDaftar(d.terbaru) || jam(d.terbaru)}`} />)}

      {penonton && <PenontonStatus urutan={urutan} awal={penonton.pos} onMuat={muat} onTutup={() => { setPenonton(null); muat(); wa.muatUlang?.(); }} />}
      {buat && <PembuatStatus mode={buat} gambar={gambarDipilih} latar={latar} onTutup={() => { setBuat(null); setGambarDipilih(null); }} onSelesai={() => { setBuat(null); setGambarDipilih(null); muat(); toast("Status terkirim."); }} />}
    </div>
  );
}

// ─────────────────────────── PENONTON ───────────────────────────
function PenontonStatus({ urutan, awal, onMuat, onTutup }) {
  const wa = useWa();
  const { api, toast, saya } = wa;
  const [u, setU] = useState(awal);
  const [s, setS] = useState(() => {
    const d = urutan[awal];
    const pertama = d && !d.saya ? d.statuses.findIndex((x) => !x.dilihatSaya) : 0;
    return Math.max(0, pertama);
  });
  const [prog, setProg] = useState(0);
  const [jeda, setJeda] = useState(false);
  const [balas, setBalas] = useState("");
  const [lihatOrang, setLihatOrang] = useState(null);
  const [hapusMode, setHapusMode] = useState(false);
  const [dihapus, setDihapus] = useState({});

  useInterval(() => { if (urutan[u]?.saya) onMuat?.(); }, 6000);

  const d = urutan[u];
  const daftarSt = d ? d.statuses.filter((x) => !dihapus[x.id]) : [];
  const st = daftarSt[s];
  const lama = st?.jenis === "gambar" ? 6000 : Math.min(9000, 4500 + (st?.teks?.length || 0) * 35);
  const tampilRef = useRef({});
  tampilRef.current = { u, s, jeda, lihatOrang, balas };

  const maju = useCallback(() => {
    const cur = tampilRef.current;
    const dd = urutan[cur.u];
    const n = dd ? dd.statuses.filter((x) => !dihapus[x.id]).length : 0;
    if (cur.s + 1 < n) { setS(cur.s + 1); setProg(0); return; }
    if (cur.u + 1 < urutan.length) { setU(cur.u + 1); const nx = urutan[cur.u + 1]; setS(nx.saya ? 0 : Math.max(0, nx.statuses.findIndex((x) => !x.dilihatSaya))); setProg(0); return; }
    onTutup();
  }, [urutan, dihapus, onTutup]);
  const mundur = () => {
    if (s > 0) { setS(s - 1); setProg(0); return; }
    if (u > 0) { const pv = urutan[u - 1]; setU(u - 1); setS(Math.max(0, pv.statuses.length - 1)); setProg(0); return; }
    setProg(0);
  };

  // Tandai dilihat.
  useEffect(() => {
    if (st && d && !d.saya && !st.dilihatSaya) { st.dilihatSaya = true; api.post("/api/wa/status", { aksi: "lihat", statusId: st.id }); }
    setProg(0);
  }, [st?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bilah kemajuan.
  useEffect(() => {
    if (!st) return undefined;
    let terakhir = performance.now();
    const id = setInterval(() => {
      const skrg = performance.now();
      const dt = skrg - terakhir;
      terakhir = skrg;
      const cur = tampilRef.current;
      if (cur.jeda || cur.lihatOrang || cur.balas) return;
      setProg((p) => {
        const n = p + dt / lama;
        if (n >= 1) { setTimeout(maju, 0); return 1; }
        return n;
      });
    }, 60);
    return () => clearInterval(id);
  }, [st?.id, lama, maju]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onTutup(); if (e.key === "ArrowRight") maju(); if (e.key === "ArrowLeft") mundur(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!st && d) { if (daftarSt.length === 0) onTutup(); } }, [st, d]); // eslint-disable-line react-hooks/exhaustive-deps

  async function bukaPenonton() {
    const r = await api.get(`/api/wa/status?penonton=${encodeURIComponent(st.id)}`);
    if (r.ok) setLihatOrang(r.data.penonton || []); else toast(r.error || "Gagal memuat.");
  }
  async function hapusIni() {
    setHapusMode(false);
    const r = await api.post("/api/wa/status", { aksi: "hapus", statusId: st.id });
    if (r.ok) { setDihapus((x) => ({ ...x, [st.id]: true })); toast("Status dihapus."); if (daftarSt.length <= 1) onTutup(); else { setProg(0); } } else toast(r.error || "Gagal menghapus.");
  }
  async function kirimBalasan() {
    const t = balas.trim();
    if (!t || !d) return;
    setBalas("");
    const p = await api.post("/api/wa/room", { aksi: "private", pid: d.pid });
    if (!p.ok) { toast(p.error || "Gagal."); return; }
    const preview = st.jenis === "gambar" ? "📷 status" : `“${(st.teks || "").slice(0, 40)}”`;
    const r = await api.post("/api/wa/pesan", { aksi: "kirim", room: p.data.roomId, jenis: "teks", teks: `↩ Membalas status ${preview}\n${t}` });
    toast(r.ok ? "Balasan terkirim." : r.error || "Gagal mengirim.");
  }

  if (!d || !st) return null;
  return (
    <div className="wa-svr" role="dialog" aria-label="Status">
      <div className="wa-svr-isi" style={{ background: st.jenis === "teks" ? st.latar : "#000" }}>
        <div className="wa-svr-bar">
          {daftarSt.map((x, i) => <span key={x.id}><i style={{ width: `${i < s ? 100 : i === s ? Math.min(100, prog * 100) : 0}%` }} /></span>)}
        </div>
        <div className="wa-svr-kepala">
          <button className="wa-ikon terang" onClick={onTutup} aria-label="Tutup"><Ik n="back" s={22} /></button>
          <Avatar nama={d.profil.nama} foto={fotoDari(d.profil)} ada={!!d.profil.fotoV} size={38} />
          <span className="wa-svr-nama"><NamaLencana nama={d.saya ? "Status saya" : d.profil.nama} lencana={d.profil.lencana} size={15} /><small>{waktuDaftar(st.createdAt) === jam(st.createdAt) ? `Hari ini ${jam(st.createdAt)}` : `${waktuDaftar(st.createdAt)} ${jam(st.createdAt)}`}</small></span>
          {d.saya && <button className="wa-ikon terang" onClick={() => setHapusMode(true)} aria-label="Hapus status"><Ik n="trash" s={21} /></button>}
        </div>

        <div
          className="wa-svr-tengah"
          onPointerDown={() => setJeda(true)}
          onPointerUp={() => setJeda(false)}
          onPointerLeave={() => setJeda(false)}
        >
          {st.jenis === "gambar" && st.media ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={st.media} alt={st.teks || "Status foto"} />
          ) : (
            <p className="wa-svr-teks">{st.teks}</p>
          )}
          <button className="wa-svr-nav kiri" onClick={mundur} aria-label="Sebelumnya" />
          <button className="wa-svr-nav kanan" onClick={maju} aria-label="Berikutnya" />
        </div>

        {st.jenis === "gambar" && st.teks ? <p className="wa-svr-cap">{st.teks}</p> : null}

        <div className="wa-svr-bawah">
          {d.saya ? (
            <button className="wa-svr-lihat" onClick={bukaPenonton}><Ik n="eye" s={20} /> {st.jumlahDilihat ?? 0} dilihat</button>
          ) : (
            <div className="wa-svr-balas">
              <input value={balas} onChange={(e) => setBalas(e.target.value)} placeholder="Balas status…" maxLength={500} onKeyDown={(e) => e.key === "Enter" && kirimBalasan()} />
              <button className="wa-kirim kecil" onClick={kirimBalasan} disabled={!balas.trim()} aria-label="Kirim balasan"><Ik n="send" s={18} /></button>
            </div>
          )}
        </div>
      </div>

      {lihatOrang && (
        <Lembar judul={`Dilihat oleh ${lihatOrang.length}`} onTutup={() => setLihatOrang(null)}>
          {!lihatOrang.length ? <p className="wa-kosong-kecil">Belum ada yang melihat status ini.</p> : lihatOrang.map((p) => (
            <div className="wa-baris-daftar" key={p.pid + p.at}>
              <Avatar nama={p.nama} foto={fotoDari(p)} ada={!!p.fotoV} size={44} />
              <span className="wa-baris-teks"><NamaLencana nama={p.nama} lencana={p.lencana} /><small>{waktuDaftar(p.at) === jam(p.at) ? `Hari ini ${jam(p.at)}` : `${waktuDaftar(p.at)} ${jam(p.at)}`}</small></span>
            </div>
          ))}
        </Lembar>
      )}
      {hapusMode && (
        <div className="wa-lembar-latar wa-konfirmasi-latar" onMouseDown={(e) => { if (e.target === e.currentTarget) setHapusMode(false); }}>
          <div className="wa-konfirmasi">
            <h3>Hapus status ini?</h3>
            <p>Status akan hilang untuk semua orang.</p>
            <div className="wa-konfirmasi-tombol">
              <button className="wa-tombol bahaya" onClick={hapusIni}>Hapus</button>
              <button className="wa-tombol polos" onClick={() => setHapusMode(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── PEMBUAT ───────────────────────────
function PembuatStatus({ mode, gambar, latar, onTutup, onSelesai }) {
  const wa = useWa();
  const { api, toast } = wa;
  const [teks, setTeks] = useState("");
  const [warna, setWarna] = useState(latar[0]);
  const [kirim, setKirim] = useState(false);
  const foto = mode === "gambar";

  async function simpan() {
    if (kirim) return;
    if (!foto && !teks.trim()) { toast("Tulis sesuatu dulu."); return; }
    setKirim(true);
    const r = await api.post("/api/wa/status", foto ? { aksi: "buat", jenis: "gambar", gambar, teks } : { aksi: "buat", jenis: "teks", teks, latar: warna });
    setKirim(false);
    if (r.ok) onSelesai(); else toast(r.error || "Gagal mengirim status.");
  }

  return (
    <div className="wa-svr wa-svb" style={{ background: foto ? "#000" : warna }} role="dialog" aria-label="Buat status">
      <div className="wa-svr-kepala">
        <button className="wa-ikon terang" onClick={onTutup} aria-label="Batal"><Ik n="close" s={24} /></button>
        <span className="wa-svr-nama"><b>{foto ? "Status foto" : "Status teks"}</b></span>
      </div>
      <div className="wa-svb-tengah">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gambar} alt="Pratinjau status" />
        ) : (
          <textarea autoFocus value={teks} onChange={(e) => setTeks(e.target.value)} maxLength={700} placeholder="Ketik status" aria-label="Isi status" />
        )}
      </div>
      <div className="wa-svb-bawah">
        {foto ? (
          <input value={teks} onChange={(e) => setTeks(e.target.value)} maxLength={200} placeholder="Tambahkan keterangan…" aria-label="Keterangan" />
        ) : (
          <div className="wa-svb-warna">
            {latar.map((w) => <button key={w} className={w === warna ? "aktif" : ""} style={{ background: w }} onClick={() => setWarna(w)} aria-label={`Warna ${w}`} />)}
          </div>
        )}
        <button className="wa-kirim" onClick={simpan} disabled={kirim} aria-label="Kirim status"><Ik n="send" s={22} /></button>
      </div>
    </div>
  );
}
