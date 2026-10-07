"use client";

// Lembar-lembar: kontak, grup baru, profil, info grup, teruskan, tambah anggota.
import { useCallback, useEffect, useRef, useState } from "react";
import { Ik, Avatar, NamaLencana, Lembar, Konfirmasi, useWa, kecilkanGambar, teksTerakhir, salin, labelHari, tautanKontak, bagikanTautan } from "@/components/wa/kit";
import { LENCANA } from "@/lib/wa/lencanaWarna";
import PushToggle from "@/components/PushToggle";

const fotoDari = (p) => (p?.fotoV ? `/api/wa/foto/${p.pid}?v=${p.fotoV}` : null);

// ─────────────────────────── PILIH KONTAK ───────────────────────────
function DaftarKontak({ multi, kecuali = [], pilih, setPilih, onKetuk, atas = null }) {
  const { api } = useWa();
  const [q, setQ] = useState("");
  const [items, setItems] = useState(null);
  const [hal, setHal] = useState(0);
  const [adaLagi, setAdaLagi] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const seq = useRef(0);

  const muat = useCallback(async (kata, h, tambah) => {
    const n = ++seq.current;
    setMemuat(true);
    const r = await api.get(`/api/wa/kontak?q=${encodeURIComponent(kata)}&hal=${h}`);
    if (n !== seq.current) return;
    setMemuat(false);
    if (!r.ok) { setItems((x) => x || []); return; }
    setAdaLagi(!!r.data.adaLagi);
    setItems((x) => (tambah ? [...(x || []), ...r.data.items] : r.data.items));
  }, [api]);

  useEffect(() => {
    const t = setTimeout(() => { setHal(0); muat(q, 0, false); }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, muat]);

  const tampil = (items || []).filter((p) => !kecuali.includes(p.pid));
  return (
    <>
      <div className="wa-cari-bar solid">
        <Ik n="search" s={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama pengguna…" aria-label="Cari pengguna" autoFocus />
        {q && <button className="wa-ikon kecil" onClick={() => setQ("")} aria-label="Hapus pencarian"><Ik n="close" s={16} /></button>}
      </div>
      {atas}
      <h3 className="wa-subjudul">Pengguna WEARTA CHAT</h3>
      {items === null && <div className="wa-memuat"><span className="wa-spin" /> Memuat…</div>}
      {items && !tampil.length && <p className="wa-kosong-kecil">{q ? "Tidak ada pengguna dengan nama itu." : "Belum ada pengguna lain."}</p>}
      {tampil.map((p) => {
        const dipilih = pilih?.some((x) => x.pid === p.pid);
        return (
          <button key={p.pid} className={`wa-baris-daftar${dipilih ? " dipilih" : ""}`} onClick={() => (multi ? setPilih(dipilih ? pilih.filter((x) => x.pid !== p.pid) : [...pilih, p]) : onKetuk(p))}>
            <Avatar nama={p.nama} foto={fotoDari(p)} ada={!!p.fotoV} size={46} online={p.online} />
            <span className="wa-baris-teks">
              <NamaLencana nama={p.nama} lencana={p.lencana} />
              <small className={p.online ? "online" : ""}>{p.diblokir ? "Diblokir" : p.bio || teksTerakhir(p)}</small>
            </span>
            {multi && <span className={`wa-centang-pilih${dipilih ? " aktif" : ""}`}>{dipilih && <Ik n="check" s={16} />}</span>}
          </button>
        );
      })}
      {adaLagi && <button className="wa-muat-lama" disabled={memuat} onClick={() => { const h = hal + 1; setHal(h); muat(q, h, true); }}>{memuat ? "Memuat…" : "Muat lebih banyak"}</button>}
    </>
  );
}

export function SheetKontak({ onTutup, mode = "chat", onPilih = null }) {
  const wa = useWa();
  const [buka, setBuka] = useState(false);
  async function mulai(p) {
    if (mode === "panggil") { onTutup(); wa.buka({ tipe: "user", pid: p.pid }); return; }
    if (mode === "bagikan") { onTutup(); onPilih?.(p); return; }
    const r = await wa.api.post("/api/wa/room", { aksi: "private", pid: p.pid });
    if (!r.ok) { wa.toast(r.error || "Gagal membuka obrolan."); return; }
    onTutup();
    wa.bukaRoom(r.data.roomId);
  }
  if (buka) return <SheetGrupBaru onTutup={onTutup} />;
  return (
    <Lembar judul={mode === "panggil" ? "Pilih siapa yang ditelepon" : mode === "bagikan" ? "Bagikan kontak (lewat tautan)" : "Chat baru"} onTutup={onTutup}>
      <DaftarKontak
        onKetuk={mulai}
        atas={mode === "panggil" || mode === "bagikan" ? null : (
          <button className="wa-baris-daftar aksi" onClick={() => setBuka(true)}>
            <span className="wa-ikon-bulat besar hijau"><Ik n="users" s={24} /></span>
            <span className="wa-baris-teks"><b className="wa-nama-teks">Grup baru</b><small>Ngobrol bareng banyak teman</small></span>
          </button>
        )}
      />
    </Lembar>
  );
}

// ─────────────────────────── GRUP BARU ───────────────────────────
export function SheetGrupBaru({ onTutup }) {
  const wa = useWa();
  const [langkah, setLangkah] = useState(1);
  const [pilih, setPilih] = useState([]);
  const [nama, setNama] = useState("");
  const [desk, setDesk] = useState("");
  const [foto, setFoto] = useState(null);
  const [kirim, setKirim] = useState(false);
  const fileRef = useRef(null);

  async function pilihFoto(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setFoto(await kecilkanGambar(f, { sisi: 320, maksBytes: 150_000, persegi: true })); } catch (err) { wa.toast(err.message || "Gambar tidak bisa diproses."); }
  }
  async function buat() {
    if (kirim) return;
    setKirim(true);
    const r = await wa.api.post("/api/wa/room", { aksi: "buat-grup", nama, deskripsi: desk, anggota: pilih.map((p) => p.pid), foto });
    setKirim(false);
    if (!r.ok) { wa.toast(r.error || "Gagal membuat grup."); return; }
    onTutup();
    wa.muatUlang?.();
    wa.bukaRoom(r.data.roomId);
    wa.toast("Grup dibuat.");
  }

  if (langkah === 1) {
    return (
      <Lembar judul="Tambah anggota grup" onTutup={onTutup} aksi={<button className="wa-tombol utama kecil" disabled={!pilih.length} onClick={() => setLangkah(2)}>Lanjut ({pilih.length})</button>}>
        {pilih.length > 0 && (
          <div className="wa-chip-daftar">
            {pilih.map((p) => <button key={p.pid} className="wa-chip" onClick={() => setPilih(pilih.filter((x) => x.pid !== p.pid))}>{p.nama} <Ik n="close" s={14} /></button>)}
          </div>
        )}
        <DaftarKontak multi pilih={pilih} setPilih={setPilih} />
      </Lembar>
    );
  }
  return (
    <Lembar judul="Grup baru" onTutup={() => setLangkah(1)} kiri={<button className="wa-ikon" onClick={() => setLangkah(1)} aria-label="Kembali"><Ik n="back" s={22} /></button>}>
      <div className="wa-form">
        <div className="wa-foto-pilih">
          <button onClick={() => fileRef.current?.click()} aria-label="Pilih foto grup" className="wa-foto-bulat">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="Foto grup" />
            ) : <Ik n="camera" s={34} />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pilihFoto} />
        </div>
        <label>Nama grup
          <input value={nama} maxLength={40} onChange={(e) => setNama(e.target.value)} placeholder="Contoh: Geng Nokos" autoFocus />
        </label>
        <label>Deskripsi (opsional)
          <textarea value={desk} maxLength={300} onChange={(e) => setDesk(e.target.value)} rows={3} placeholder="Tentang grup ini…" />
        </label>
        <div className="wa-form-grup">
          <span>Anggota: {pilih.length + 1}</span>
          <div className="wa-chip-daftar">
            <span className="wa-chip diam">Kamu (admin)</span>
            {pilih.map((p) => <span key={p.pid} className="wa-chip diam">{p.nama}</span>)}
          </div>
        </div>
        <button className="wa-tombol utama" disabled={nama.trim().length < 2 || kirim} onClick={buat}>{kirim ? "Membuat…" : "Buat grup"}</button>
      </div>
    </Lembar>
  );
}

// ─────────────────────────── PROFIL SAYA ───────────────────────────
export function SheetProfilSaya({ onTutup }) {
  const wa = useWa();
  const { saya, api, toast } = wa;
  const [nama, setNama] = useState(saya?.nama || "");
  const [bio, setBio] = useState(saya?.bio || "");
  const [sembunyi, setSembunyi] = useState(!!saya?.sembunyiTerakhir);
  const [simpan, setSimpan] = useState(false);
  const [blokir, setBlokir] = useState([]);
  const fileRef = useRef(null);
  const [fotoBaru, setFotoBaru] = useState(null);

  useEffect(() => {
    let batal = false;
    (async () => {
      const hasil = [];
      for (const pid of (saya?.blokir || []).slice(0, 30)) {
        const r = await api.get(`/api/wa/profil?pid=${encodeURIComponent(pid)}`);
        if (r.ok) hasil.push(r.data.profil);
      }
      if (!batal) setBlokir(hasil);
    })();
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ubahFoto(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const data = await kecilkanGambar(f, { sisi: 320, maksBytes: 150_000, persegi: true });
      const r = await api.post("/api/wa/profil", { foto: data });
      if (r.ok) { setFotoBaru(data); toast("Foto profil diperbarui."); wa.muatUlang?.(); } else toast(r.error || "Gagal mengunggah foto.");
    } catch (err) { toast(err.message || "Gambar tidak bisa diproses."); }
  }
  async function hapusFoto() {
    const r = await api.post("/api/wa/profil", { hapusFoto: true });
    if (r.ok) { setFotoBaru("hapus"); toast("Foto profil dihapus."); wa.muatUlang?.(); } else toast(r.error || "Gagal.");
  }
  async function simpanProfil() {
    setSimpan(true);
    const r = await api.post("/api/wa/profil", { nama, bio, sembunyiTerakhir: sembunyi });
    setSimpan(false);
    if (r.ok) { toast("Profil disimpan."); wa.muatUlang?.(); } else toast(r.error || "Gagal menyimpan.");
  }
  async function bukaBlokir(pid) {
    const r = await api.post("/api/wa/profil", { blokir: { pid, nyalakan: false } });
    if (r.ok) { setBlokir((b) => b.filter((x) => x.pid !== pid)); wa.muatUlang?.(); toast("Blokir dibuka."); } else toast(r.error || "Gagal.");
  }

  const fotoUrl = fotoBaru === "hapus" ? null : fotoBaru || fotoDari(saya);
  const lb = saya?.lencana ? LENCANA[saya.lencana] : null;
  const berubah = nama !== saya?.nama || bio !== (saya?.bio || "") || sembunyi !== !!saya?.sembunyiTerakhir;

  return (
    <Lembar judul="Profil saya" onTutup={onTutup}>
      <div className="wa-profil-atas">
        <Avatar nama={nama || saya?.nama} foto={fotoUrl} ada={!!fotoUrl} size={132} />
        <div className="wa-profil-foto-aksi">
          <button className="wa-tombol kecil" onClick={() => fileRef.current?.click()}><Ik n="camera" s={16} /> Ganti foto</button>
          {fotoUrl && <button className="wa-tombol polos kecil" onClick={hapusFoto}>Hapus</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={ubahFoto} />
      </div>
      <div className="wa-form">
        <label>Nama
          <input value={nama} maxLength={24} onChange={(e) => setNama(e.target.value)} />
        </label>
        <label>Info / bio
          <textarea value={bio} maxLength={140} rows={2} onChange={(e) => setBio(e.target.value)} placeholder="Ceritakan sedikit tentangmu…" />
          <small>{bio.length}/140</small>
        </label>
        <div className="wa-kartu-info">
          <small>Tautan chat-ku</small>
          <p className="wa-tautan-undang">{saya?.pid ? tautanKontak(saya.pid) : ""}</p>
          <p style={{ fontSize: 12, color: "var(--wa-redup)", marginTop: 2 }}>Bagikan tautan ini ke teman supaya mereka bisa langsung mengobrol denganmu — tanpa membagikan nomor atau kode akun.</p>
          <div className="wa-form-baris" style={{ marginTop: 8 }}>
            <button type="button" className="wa-tombol kecil" onClick={() => wa.bagikanSaya?.()}><Ik n="link" s={16} /> Bagikan</button>
            <button type="button" className="wa-tombol polos kecil" onClick={async () => toast((await salin(tautanKontak(saya.pid))) ? "Tautan disalin." : "Gagal menyalin.")}><Ik n="copy" s={16} /> Salin</button>
          </div>
        </div>
        <div className="wa-lencana-info">
          {lb ? (
            <>
              <NamaLencana nama={`Lencana verifikasi ${lb.label.toLowerCase()}`} lencana={saya.lencana} size={20} />
              <small>Kamu terverifikasi oleh admin.</small>
            </>
          ) : (
            <>
              <b>Lencana verifikasi</b>
              <small>Belum ada. Lencana hanya bisa diberikan oleh admin.</small>
            </>
          )}
        </div>
        <label className="wa-saklar">
          <span><b>Sembunyikan “terakhir dilihat”</b><small>Orang lain tidak melihat kapan kamu terakhir aktif.</small></span>
          <input type="checkbox" checked={sembunyi} onChange={(e) => setSembunyi(e.target.checked)} />
          <i />
        </label>
        <button className="wa-tombol utama" disabled={!berubah || simpan || nama.trim().length < 2} onClick={simpanProfil}>{simpan ? "Menyimpan…" : "Simpan perubahan"}</button>

        <div className="wa-form-grup">
          <span>Notifikasi pesan & panggilan</span>
          <div className="wa-kartu-info" style={{ padding: 0, overflow: "hidden" }}>
            <PushToggle token={wa.token} />
          </div>
        </div>

        <div className="wa-form-grup">
          <span>Kontak diblokir ({blokir.length})</span>
          {!blokir.length && <small>Tidak ada kontak yang diblokir.</small>}
          {blokir.map((p) => (
            <div className="wa-baris-daftar" key={p.pid}>
              <Avatar nama={p.nama} foto={fotoDari(p)} ada={!!p.fotoV} size={38} />
              <span className="wa-baris-teks"><NamaLencana nama={p.nama} lencana={p.lencana} /></span>
              <button className="wa-tombol polos kecil" onClick={() => bukaBlokir(p.pid)}>Buka blokir</button>
            </div>
          ))}
        </div>
      </div>
    </Lembar>
  );
}

// ─────────────────────────── PROFIL PENGGUNA ───────────────────────────
export function SheetUser({ pid, onTutup }) {
  const wa = useWa();
  const { api, toast, saya } = wa;
  const [d, setD] = useState(null);
  const [lihat, setLihat] = useState(false);

  useEffect(() => {
    if (pid === saya?.pid) { onTutup(); wa.buka({ tipe: "profil-saya" }); return undefined; }
    let batal = false;
    api.get(`/api/wa/profil?pid=${encodeURIComponent(pid)}`).then((r) => { if (!batal) { if (r.ok) setD(r.data); else { toast(r.error || "Pengguna tidak ditemukan."); onTutup(); } } });
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  async function pesan() {
    const r = await api.post("/api/wa/room", { aksi: "private", pid });
    if (!r.ok) { toast(r.error || "Gagal."); return; }
    onTutup();
    wa.bukaRoom(r.data.roomId);
  }
  async function blokir() {
    const nyalakan = !d.diblokir;
    const r = await api.post("/api/wa/profil", { blokir: { pid, nyalakan } });
    if (r.ok) { setD({ ...d, diblokir: nyalakan }); wa.muatUlang?.(); toast(nyalakan ? `${d.profil.nama} diblokir.` : `${d.profil.nama} dibuka blokirnya.`); } else toast(r.error || "Gagal.");
  }
  if (!d) return <Lembar judul="Info kontak" onTutup={onTutup}><div className="wa-memuat"><span className="wa-spin" /> Memuat…</div></Lembar>;
  const p = d.profil;
  const lb = p.lencana ? LENCANA[p.lencana] : null;
  return (
    <Lembar judul="Info kontak" onTutup={onTutup}>
      <div className="wa-profil-atas">
        <Avatar nama={p.nama} foto={fotoDari(p)} ada={!!p.fotoV} size={132} online={p.online} onClick={p.fotoV ? () => setLihat(true) : undefined} />
        <h2 className="wa-profil-nama"><NamaLencana nama={p.nama} lencana={p.lencana} size={22} /></h2>
        <p className={`wa-profil-status${p.online ? " online" : ""}`}>{teksTerakhir(p)}</p>
        <div className="wa-profil-aksi">
          <button onClick={pesan}><span><Ik n="chat" s={22} /></span>Pesan</button>
          <button onClick={() => { onTutup(); wa.telepon(p, "suara"); }}><span><Ik n="phone" s={22} /></span>Suara</button>
          <button onClick={() => { onTutup(); wa.telepon(p, "video"); }}><span><Ik n="video" s={22} /></span>Video</button>
        </div>
      </div>
      <div className="wa-kartu-info"><small>Info</small><p>{p.bio || "—"}</p></div>
      <button className="wa-tombol lebar" style={{ marginTop: 10 }} onClick={async () => { const r = await bagikanTautan({ judul: `Kontak ${p.nama}`, teks: `Kontak WEARTA CHAT: ${p.nama}`, url: tautanKontak(p.pid) }); if (r === "salin") toast("Tautan kontak disalin."); else if (r === "gagal") toast("Gagal menyalin tautan."); }}>
        <Ik n="link" s={18} /> Bagikan kontak ini (tautan)
      </button>
      {lb && <div className="wa-kartu-info"><small>Verifikasi</small><p><NamaLencana nama={`Terverifikasi (${lb.label.toLowerCase()})`} lencana={p.lencana} size={18} /></p></div>}
      <button className="wa-tombol bahaya lebar" onClick={blokir}><Ik n="block" s={18} /> {d.diblokir ? "Buka blokir" : "Blokir"} {p.nama}</button>
      {lihat && (
        <div className="wa-pratinjau" onClick={() => setLihat(false)}>
          <button className="wa-ikon terang" onClick={() => setLihat(false)} aria-label="Tutup"><Ik n="close" s={24} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotoDari(p)} alt={`Foto ${p.nama}`} />
        </div>
      )}
    </Lembar>
  );
}

// ─────────────────────────── INFO GRUP ───────────────────────────
export function SheetRoom({ roomId, onTutup }) {
  const wa = useWa();
  const { api, toast, admin } = wa;
  const [info, setInfo] = useState(null);
  const [nama, setNama] = useState("");
  const [desk, setDesk] = useState("");
  const [edit, setEdit] = useState(false);
  const [menuAnggota, setMenuAnggota] = useState(null);
  const [tanya, setTanya] = useState(null);
  const [fotoBaru, setFotoBaru] = useState(0);
  const fileRef = useRef(null);

  const muat = useCallback(async () => {
    const r = await api.get(`/api/wa/room?room=${encodeURIComponent(roomId)}`);
    if (r.ok) { setInfo(r.data); } else { toast(r.error || "Gagal memuat info."); onTutup(); }
    return r;
  }, [api, roomId, toast, onTutup]);

  useEffect(() => { muat().then((r) => { if (r.ok) { setNama(r.data.nama); setDesk(r.data.deskripsi || ""); } }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  if (!info) return <Lembar judul="Info grup" onTutup={onTutup}><div className="wa-memuat"><span className="wa-spin" /> Memuat…</div></Lembar>;
  const umum = info.jenis === "umum";
  const adm = !!info.saya?.admin;
  const pembuat = !!info.saya?.pembuat;

  async function aksi(body, pesanOk) {
    const r = await api.post("/api/wa/room", body);
    if (r.ok) { if (pesanOk) toast(pesanOk); muat(); wa.muatUlang?.(); } else toast(r.error || "Gagal.");
    return r;
  }
  async function simpanInfo() {
    const r = await aksi({ aksi: "ubah-grup", roomId, nama, deskripsi: desk }, "Info grup disimpan.");
    if (r.ok) setEdit(false);
  }
  async function ubahFoto(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const data = await kecilkanGambar(f, { sisi: 320, maksBytes: 150_000, persegi: true });
      const r = await aksi({ aksi: "ubah-grup", roomId, foto: data }, "Foto grup diperbarui.");
      if (r.ok) setFotoBaru(Date.now());
    } catch (err) { toast(err.message || "Gambar tidak bisa diproses."); }
  }
  const tautan = info.kodeUndang ? `${window.location.origin}/chat?gabung=${info.kodeUndang}` : "";
  const fotoUrl = info.foto ? info.foto + (fotoBaru ? `&t=${fotoBaru}` : "") : null;

  return (
    <Lembar judul={umum ? "Info grup" : "Info grup"} onTutup={onTutup}>
      <div className="wa-profil-atas">
        <Avatar nama={info.nama} foto={fotoUrl} ada={info.fotoAda || !!fotoBaru} size={132} umum={umum && !info.fotoAda} />
        {adm && !umum && (
          <>
            <button className="wa-tombol kecil" onClick={() => fileRef.current?.click()}><Ik n="camera" s={16} /> Ganti foto</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={ubahFoto} />
          </>
        )}
        {edit ? null : <h2 className="wa-profil-nama">{info.nama}</h2>}
        <p className="wa-profil-status">{umum ? "Grup terbuka untuk semua pengguna" : `Grup · ${info.anggota.length} anggota`}</p>
      </div>

      {edit ? (
        <div className="wa-form">
          <label>Nama grup<input value={nama} maxLength={40} onChange={(e) => setNama(e.target.value)} /></label>
          <label>Deskripsi<textarea value={desk} maxLength={300} rows={3} onChange={(e) => setDesk(e.target.value)} /></label>
          <div className="wa-form-baris"><button className="wa-tombol utama" onClick={simpanInfo} disabled={nama.trim().length < 2}>Simpan</button><button className="wa-tombol polos" onClick={() => { setEdit(false); setNama(info.nama); setDesk(info.deskripsi || ""); }}>Batal</button></div>
        </div>
      ) : (
        <div className="wa-kartu-info">
          <small>Deskripsi {adm && !umum && <button className="wa-tautan-kecil" onClick={() => setEdit(true)}>Ubah</button>}</small>
          <p>{info.deskripsi || (umum ? "Komunitas deposit saldo & beli nomor OTP 🚀" : "Tidak ada deskripsi.")}</p>
          {info.dibuat && !umum && <small>Dibuat {labelHari(info.dibuat)}</small>}
        </div>
      )}

      <label className="wa-saklar">
        <span><b>Bisukan notifikasi</b></span>
        <input type="checkbox" checked={!!info.pref?.muted} onChange={(e) => aksi({ aksi: "pref", roomId, muted: e.target.checked })} />
        <i />
      </label>
      {!umum && adm && (
        <label className="wa-saklar">
          <span><b>Hanya admin yang boleh mengirim pesan</b><small>Anggota lain hanya bisa membaca.</small></span>
          <input type="checkbox" checked={!!info.hanyaAdminKirim} onChange={(e) => aksi({ aksi: "ubah-grup", roomId, hanyaAdminKirim: e.target.checked })} />
          <i />
        </label>
      )}

      {umum && admin && (
        <div className="wa-kartu-info"><small>Admin</small><p>Buka/tutup grup ini dan pesan penting lewat Dasbor Admin → WEARTA CHAT.</p></div>
      )}

      {tautan && (
        <div className="wa-kartu-info">
          <small>Tautan undangan</small>
          <p className="wa-tautan-undang">{tautan}</p>
          <div className="wa-form-baris">
            <button className="wa-tombol kecil" onClick={async () => toast((await salin(tautan)) ? "Tautan disalin." : "Gagal menyalin.")}><Ik n="copy" s={16} /> Salin</button>
            <button className="wa-tombol polos kecil" onClick={() => setTanya({ judul: "Reset tautan undangan?", isi: "Tautan lama tidak berlaku lagi.", tombol: [{ label: "Reset", gaya: "bahaya", onClick: async () => { setTanya(null); await aksi({ aksi: "reset-kode", roomId }, "Tautan baru dibuat."); } }] })}>Reset</button>
          </div>
        </div>
      )}

      {!umum && (
        <>
          <h3 className="wa-subjudul">{info.anggota.length} anggota</h3>
          {adm && (
            <button className="wa-baris-daftar aksi" onClick={() => wa.buka({ tipe: "tambah-anggota", roomId, sudah: info.anggota.map((a) => a.pid) })}>
              <span className="wa-ikon-bulat besar hijau"><Ik n="userplus" s={22} /></span>
              <span className="wa-baris-teks"><b className="wa-nama-teks">Tambah anggota</b></span>
            </button>
          )}
          {info.anggota.map((a) => {
            const aku = a.pid === wa.saya?.pid;
            return (
              <button key={a.pid} className="wa-baris-daftar" onClick={() => setMenuAnggota(a)}>
                <Avatar nama={a.nama} foto={fotoDari(a)} ada={!!a.fotoV} size={44} online={a.online} />
                <span className="wa-baris-teks"><NamaLencana nama={aku ? `${a.nama} (Kamu)` : a.nama} lencana={a.lencana} /><small>{a.bio || teksTerakhir(a)}</small></span>
                {a.admin && <span className="wa-label-admin">Admin</span>}
              </button>
            );
          })}
          <button className="wa-tombol bahaya lebar" onClick={() => setTanya({ judul: `Keluar dari “${info.nama}”?`, tombol: [{ label: "Keluar grup", gaya: "bahaya", onClick: async () => { setTanya(null); const r = await api.post("/api/wa/room", { aksi: "keluar", roomId }); if (r.ok) { onTutup(); wa.tutupRoom(); wa.muatUlang?.(); toast("Kamu keluar dari grup."); } else toast(r.error || "Gagal."); } }] })}><Ik n="logout" s={18} /> Keluar grup</button>
        </>
      )}

      {menuAnggota && (
        <Lembar judul={menuAnggota.nama} onTutup={() => setMenuAnggota(null)} lebar={380}>
          <button className="wa-baris-daftar aksi" onClick={() => { const p = menuAnggota; setMenuAnggota(null); onTutup(); wa.buka({ tipe: "user", pid: p.pid }); }}><Ik n="user" s={20} /><span className="wa-baris-teks"><b className="wa-nama-teks">Lihat profil</b></span></button>
          {menuAnggota.pid !== wa.saya?.pid && (
            <button className="wa-baris-daftar aksi" onClick={async () => { const p = menuAnggota; const r = await api.post("/api/wa/room", { aksi: "private", pid: p.pid }); if (r.ok) { setMenuAnggota(null); onTutup(); wa.bukaRoom(r.data.roomId); } else toast(r.error || "Gagal."); }}><Ik n="chat" s={20} /><span className="wa-baris-teks"><b className="wa-nama-teks">Kirim pesan</b></span></button>
          )}
          {adm && menuAnggota.pid !== wa.saya?.pid && (
            <button className="wa-baris-daftar aksi" onClick={async () => { const p = menuAnggota; setMenuAnggota(null); await aksi({ aksi: "admin", roomId, pid: p.pid, jadikan: !p.admin }, p.admin ? "Admin dicabut." : "Dijadikan admin."); }}><Ik n="star" s={20} /><span className="wa-baris-teks"><b className="wa-nama-teks">{menuAnggota.admin ? "Cabut admin" : "Jadikan admin grup"}</b></span></button>
          )}
          {adm && menuAnggota.pid !== wa.saya?.pid && (
            <button className="wa-baris-daftar aksi bahaya" onClick={async () => { const p = menuAnggota; setMenuAnggota(null); await aksi({ aksi: "keluarkan", roomId, pid: p.pid }, `${p.nama} dikeluarkan.`); }}><Ik n="block" s={20} /><span className="wa-baris-teks"><b className="wa-nama-teks">Keluarkan dari grup</b></span></button>
          )}
        </Lembar>
      )}
      {tanya && <Konfirmasi judul={tanya.judul} isi={tanya.isi} tombol={tanya.tombol} onTutup={() => setTanya(null)} />}
    </Lembar>
  );
}

export function SheetTambahAnggota({ roomId, sudah, onTutup }) {
  const wa = useWa();
  const [pilih, setPilih] = useState([]);
  const [kirim, setKirim] = useState(false);
  async function tambah() {
    setKirim(true);
    const r = await wa.api.post("/api/wa/room", { aksi: "tambah", roomId, pids: pilih.map((p) => p.pid) });
    setKirim(false);
    if (r.ok) { wa.toast(`${r.data.ditambah ?? pilih.length} anggota ditambahkan.`); wa.muatUlang?.(); onTutup(); } else wa.toast(r.error || "Gagal menambah anggota.");
  }
  return (
    <Lembar judul="Tambah anggota" onTutup={onTutup} aksi={<button className="wa-tombol utama kecil" disabled={!pilih.length || kirim} onClick={tambah}>Tambah ({pilih.length})</button>}>
      {pilih.length > 0 && <div className="wa-chip-daftar">{pilih.map((p) => <button key={p.pid} className="wa-chip" onClick={() => setPilih(pilih.filter((x) => x.pid !== p.pid))}>{p.nama} <Ik n="close" s={14} /></button>)}</div>}
      <DaftarKontak multi kecuali={sudah || []} pilih={pilih} setPilih={setPilih} />
    </Lembar>
  );
}

// ─────────────────────────── TERUSKAN ───────────────────────────
export function SheetTeruskan({ room, msg, onTutup }) {
  const wa = useWa();
  const [pilih, setPilih] = useState([]);
  const [kirim, setKirim] = useState(false);
  const bisa = wa.rooms.filter((r) => !(r.jenis === "umum" && r.tutup && !wa.admin));
  async function jalan() {
    setKirim(true);
    const r = await wa.api.post("/api/wa/pesan", { aksi: "teruskan", room, msgId: msg.id, ke: pilih });
    setKirim(false);
    if (r.ok) { wa.toast(`Diteruskan ke ${r.data.terkirim ?? pilih.length} obrolan.`); wa.muatUlang?.(); onTutup(); } else wa.toast(r.error || "Gagal meneruskan.");
  }
  const toggle = (id) => setPilih((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 5 ? (wa.toast("Maksimal 5 obrolan."), p) : [...p, id]));
  return (
    <Lembar judul="Teruskan ke…" onTutup={onTutup} aksi={<button className="wa-tombol utama kecil" disabled={!pilih.length || kirim} onClick={jalan}>Kirim ({pilih.length})</button>}>
      {!bisa.length && <p className="wa-kosong-kecil">Belum ada obrolan. Mulai obrolan dulu dari tombol “Chat baru”.</p>}
      {bisa.map((r) => (
        <button key={r.roomId} className={`wa-baris-daftar${pilih.includes(r.roomId) ? " dipilih" : ""}`} onClick={() => toggle(r.roomId)}>
          <Avatar nama={r.nama} foto={r.foto} ada={r.fotoAda} size={44} umum={r.jenis === "umum" && !r.fotoAda} />
          <span className="wa-baris-teks"><NamaLencana nama={r.nama} lencana={r.lencana} /><small>{r.jenis === "grup" ? "Grup" : r.jenis === "umum" ? "Grup umum" : "Pribadi"}</small></span>
          <span className={`wa-centang-pilih${pilih.includes(r.roomId) ? " aktif" : ""}`}>{pilih.includes(r.roomId) && <Ik n="check" s={16} />}</span>
        </button>
      ))}
    </Lembar>
  );
}
