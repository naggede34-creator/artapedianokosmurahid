"use client";

// Layar percakapan: pesan, penulis pesan, rekam suara, emoji/stiker, lampiran,
// balas/ubah/hapus/teruskan/bintang/sematkan, pencarian, dan status lawan bicara.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ik, Avatar, NamaLencana, Lembar, Konfirmasi, useWa, jam, labelHari, teksTerakhir, kecilkanGambar, salin, useInterval, tautanKontak } from "@/components/wa/kit";
import { Gelembung, EMOJI_REAKSI } from "@/components/wa/Gelembung";

const GRUP_EMOJI = [
  { i: "😀", e: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 💀 💩 🤡 👻 👽 🤖".split(" ") },
  { i: "👋", e: "👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 💪 🫶 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 ⚡".split(" ") },
  { i: "🦅", e: "🦅 🐺 🦊 🐱 🐶 🐭 🐹 🐰 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦉 🦇 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🦑 🐠 🐬 🐳 🦈 🐘 🦒 🐉 🦄 🌸 🌹 🌻 🌼 🌷 🌲 🌴 🍀 🌍 🌏 🌙 ☀️ 🌈 ☁️ ❄️".split(" ") },
  { i: "🍔", e: "🍏 🍎 🍌 🍉 🍇 🍓 🍒 🍑 🍍 🥭 🥑 🍅 🥕 🌽 🍞 🧀 🍗 🍔 🍟 🍕 🌭 🌮 🍜 🍣 🍩 🍪 🎂 🍫 🍿 ☕ 🍵 🥤 🍺 🍻".split(" ") },
  { i: "⚽", e: "⚽ 🏀 🏈 ⚾ 🎾 🏐 🎱 🏓 🥊 🎮 🎲 🎯 🎨 🎬 🎤 🎧 🎵 🎶 🎁 🎉 🎊 🏆 🥇 🚗 🚀 ✈️ 🏠 📱 💻 📷 💡 🔑 🔐 💳 💰 💎 📌 📎 ✏️ 📚".split(" ") }
];

const PAKET_STIKER = [
  { label: "Ekspresi", s: ["😂", "🤣", "😍", "🥰", "😎", "🤩", "😤", "🥺", "😭", "🤯", "🤔", "🫡", "😏", "🥳", "😴", "🤮"] },
  { label: "Hewan", s: ["🦅", "🐺", "🌸", "🌏", "⚡", "🎯", "🦊", "🐱", "🦁", "🐉", "🦋", "🐸", "🦄", "🐻", "🐼", "🐧"] },
  { label: "OTP", s: ["📱", "💻", "🔑", "🔐", "💳", "💰", "🚀", "⚡", "🌏", "🎯", "📲", "🛡️", "💎", "🔥", "✅", "❌"] }
];

const BATAS_UBAH_MS = 15 * 60_000;

export default function Percakapan({ roomId }) {
  const wa = useWa();
  const { api, toast, me, rooms, admin } = wa;

  const [info, setInfo] = useState(null);
  const [pesan, setPesan] = useState([]);
  const [pengirim, setPengirim] = useState({});
  const [mengetik, setMengetik] = useState([]);
  const [adaLagi, setAdaLagi] = useState(false);
  const [dimuat, setDimuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [teks, setTeks] = useState("");
  const [balas, setBalas] = useState(null);
  const [ubah, setUbah] = useState(null);
  const [panel, setPanel] = useState(null); // "emoji" | "stiker"
  const [grupEmoji, setGrupEmoji] = useState(0);
  const [lampir, setLampir] = useState(false);
  const [menuPesan, setMenuPesan] = useState(null);
  const [menuKepala, setMenuKepala] = useState(false);
  const [cari, setCari] = useState(null); // { q, hasil, memuat }
  const [rekam, setRekam] = useState(null); // { detik }
  const [pratinjau, setPratinjau] = useState(null); // { data, teks }
  const [lihatGambar, setLihatGambar] = useState(null);
  const [sorot, setSorot] = useState(null);
  const [bawah, setBawah] = useState(true);
  const [baruDibawah, setBaruDibawah] = useState(0);
  const [tanya, setTanya] = useState(null); // dialog konfirmasi
  const [poll, setPoll] = useState(false);
  const [berbintang, setBerbintang] = useState(null);
  const [pilihSementara, setPilihSementara] = useState(false);
  const [mengirim, setMengirim] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const tmpN = useRef(0);
  const rekamRef = useRef(null);
  const ketikTerakhir = useRef(0);
  const belumAwal = useRef(null);
  const tick = useRef(0);
  const pesanRef = useRef([]);
  const bawahRef = useRef(true);
  const fileFoto = useRef(null);
  const fileKamera = useRef(null);

  pesanRef.current = pesan;
  bawahRef.current = bawah;

  const umum = info?.jenis === "umum";
  const grup = info?.jenis === "grup";
  const privat = info?.jenis === "private";
  const lawan = info?.lawan || null;
  const adminAksi = umum ? !!admin : !!info?.saya?.admin;

  // ───────────── muat info ─────────────
  const muatInfo = useCallback(async () => {
    const r = await api.get(`/api/wa/room?room=${encodeURIComponent(roomId)}`);
    if (r.ok) setInfo(r.data);
    else if (r.status === 404) { setGalat("Obrolan tidak ditemukan atau kamu bukan anggotanya."); }
    return r;
  }, [api, roomId]);

  // ───────────── muat pesan awal ─────────────
  useEffect(() => {
    let batal = false;
    setInfo(null); setPesan([]); setPengirim({}); setDimuat(false); setGalat(""); setBalas(null); setUbah(null); setTeks(""); setPanel(null); setCari(null);
    belumAwal.current = rooms.find((r) => r.roomId === roomId)?.belumBaca || 0;
    try { const d = localStorage.getItem(`wa-draf:${roomId}`); if (d) setTeks(d); } catch {}
    (async () => {
      const [ri, rp] = await Promise.all([muatInfo(), api.get(`/api/wa/pesan?room=${encodeURIComponent(roomId)}&limit=50`)]);
      if (batal) return;
      if (rp.ok) {
        setPesan(rp.data.pesan || []);
        setPengirim(rp.data.pengirim || {});
        setAdaLagi(!!rp.data.adaLagi);
        setMengetik(rp.data.mengetik || []);
      } else if (!ri.ok && ri.status !== 404) {
        setGalat(rp.error || "Gagal memuat pesan.");
      }
      setDimuat(true);
      requestAnimationFrame(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; });
    })();
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ───────────── polling ─────────────
  const gabung = useCallback((baru, penuh) => {
    setPesan((prev) => {
      const real = baru.filter(Boolean);
      const temps = prev.filter((m) => m.tunda || m.gagal);
      let dasar = prev.filter((m) => !m.tunda && !m.gagal);
      if (penuh && real.length) {
        const awal = real[0].createdAt;
        dasar = dasar.filter((m) => m.createdAt < awal);
      }
      const peta = new Map(dasar.map((m) => [m.id, m]));
      for (const m of real) peta.set(m.id, m);
      const hasil = [...peta.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
      return [...hasil, ...temps];
    });
  }, []);

  const polling = useCallback(async () => {
    if (!dimuat || document.visibilityState === "hidden") return;
    tick.current++;
    const real = pesanRef.current.filter((m) => !m.tunda && !m.gagal);
    const akhir = real[real.length - 1];
    const penuh = tick.current % 4 === 0 || !akhir;
    const r = await api.get(`/api/wa/pesan?room=${encodeURIComponent(roomId)}&${penuh ? "limit=60" : `after=${encodeURIComponent(akhir.createdAt)}`}`);
    if (!r.ok) return;
    setMengetik(r.data.mengetik || []);
    setPengirim((p) => ({ ...p, ...(r.data.pengirim || {}) }));
    const baru = r.data.pesan || [];
    if (baru.length) {
      const adaMasuk = baru.some((m) => !m.mine && !pesanRef.current.some((x) => x.id === m.id));
      gabung(baru, penuh);
      if (adaMasuk) {
        if (bawahRef.current) requestAnimationFrame(() => { const el = listRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); });
        else setBaruDibawah((n) => n + baru.filter((m) => !m.mine).length);
      }
    }
  }, [api, roomId, dimuat, gabung]);

  useInterval(polling, 2500, dimuat);
  useInterval(muatInfo, 9000, dimuat);

  // ───────────── tandai dibaca ─────────────
  const idMasukTerakhir = useMemo(() => {
    for (let i = pesan.length - 1; i >= 0; i--) if (!pesan[i].mine && pesan[i].jenis !== "sistem" && !pesan[i].tunda) return pesan[i].id;
    return null;
  }, [pesan]);

  useEffect(() => {
    if (!dimuat || !idMasukTerakhir) return;
    const kirimBaca = () => { if (document.visibilityState === "visible") api.post("/api/wa/pesan", { aksi: "baca", room: roomId }).then(() => wa.muatUlang?.()); };
    kirimBaca();
    const f = () => kirimBaca();
    window.addEventListener("focus", f);
    return () => window.removeEventListener("focus", f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idMasukTerakhir, dimuat, roomId]);

  // ───────────── gulir ─────────────
  function saatGulir() {
    const el = listRef.current;
    if (!el) return;
    const dekat = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    setBawah(dekat);
    if (dekat) setBaruDibawah(0);
  }
  function keBawah(halus = true) {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: halus ? "smooth" : "auto" });
    setBaruDibawah(0);
  }

  async function muatLama() {
    const pertama = pesan.find((m) => !m.tunda && !m.gagal);
    if (!pertama) return;
    const el = listRef.current;
    const tinggiLama = el?.scrollHeight || 0;
    const r = await api.get(`/api/wa/pesan?room=${encodeURIComponent(roomId)}&sebelum=${encodeURIComponent(pertama.createdAt)}&limit=50`);
    if (!r.ok) { toast(r.error || "Gagal memuat."); return; }
    setAdaLagi(!!r.data.adaLagi);
    setPengirim((p) => ({ ...p, ...(r.data.pengirim || {}) }));
    setPesan((prev) => { const ada = new Set(prev.map((m) => m.id)); return [...(r.data.pesan || []).filter((m) => !ada.has(m.id)), ...prev]; });
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - tinggiLama; });
  }

  function lompat(id) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) { toast("Pesan asli belum dimuat — gulir ke atas untuk melihat riwayat."); return; }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setSorot(id);
    setTimeout(() => setSorot(null), 1600);
  }

  // ───────────── kirim ─────────────
  const kirimKe = useCallback(async (tmp, payload) => {
    setPesan((p) => [...p, tmp]);
    requestAnimationFrame(() => keBawah(false));
    const r = await api.post("/api/wa/pesan", { aksi: "kirim", room: roomId, ...payload });
    if (r.ok && r.data.pesan) {
      const asli = r.data.pesan;
      setPesan((p) => {
        const tanpaTmp = p.filter((m) => m.id !== tmp.id);
        if (tanpaTmp.some((m) => m.id === asli.id)) return tanpaTmp;
        const temps = tanpaTmp.filter((m) => m.tunda || m.gagal);
        const real = tanpaTmp.filter((m) => !m.tunda && !m.gagal);
        return [...real, asli, ...temps];
      });
      wa.muatUlang?.();
      if (roomId === "umum" && (payload.jenis === "teks" || payload.jenis === "stiker" || payload.jenis === "gambar")) {
        api.post("/api/wa/ai", { teks: payload.teks || "", jenis: payload.jenis === "teks" ? "teks" : "lain" }).then((x) => { if (x.data?.replied) setTimeout(polling, 500); });
      }
      return true;
    }
    if (r.data?.tutup) toast(r.error || "WEARTA CHAT sedang ditutup.");
    setPesan((p) => p.map((m) => (m.id === tmp.id ? { ...m, tunda: false, gagal: true, payload, galatPesan: r.error } : m)));
    if (r.error) toast(r.error);
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, roomId, polling]);

  const buatTmp = (ekstra) => ({
    id: `tmp-${Date.now()}-${++tmpN.current}`, jenis: "teks", dari: me?.pid, namaDari: me?.nama, mine: true, teks: "", media: null, stiker: null, poll: null,
    balas: null, reaksi: {}, diedit: false, diteruskan: false, bintang: false, pinned: false, status: "kirim", tunda: true, createdAt: new Date().toISOString(), ...ekstra
  });

  function kirimTeks() {
    const t = teks.trim();
    if (!t) return;
    if (ubah) {
      const id = ubah.id;
      setUbah(null); setTeks("");
      api.post("/api/wa/pesan", { aksi: "ubah", room: roomId, msgId: id, teks: t }).then((r) => { if (!r.ok) toast(r.error || "Gagal mengubah pesan."); polling(); });
      return;
    }
    const b = balas;
    try { localStorage.removeItem(`wa-draf:${roomId}`); } catch {}
    setTeks(""); setBalas(null); setPanel(null);
    inputRef.current?.focus();
    kirimKe(
      buatTmp({ teks: t, balas: b ? { msgId: b.id, nama: b.nama, preview: b.preview } : null }),
      { jenis: "teks", teks: t, ...(b ? { balasId: b.id } : {}) }
    );
  }

  // Kontak dibagikan sebagai TAUTAN (bukan kartu kontak): penerima mengetuknya untuk mulai chat.
  function bagikanKontak(p) {
    const teksKontak = `👤 Kontak: ${p.nama}\n${tautanKontak(p.pid)}`;
    setPanel(null);
    kirimKe(buatTmp({ teks: teksKontak }), { jenis: "teks", teks: teksKontak });
  }

  function kirimStiker(s) {
    setPanel(null);
    kirimKe(buatTmp({ jenis: "stiker", stiker: s }), { jenis: "stiker", stiker: s });
  }

  function ulang(m) {
    if (!m.payload) return;
    setPesan((p) => p.filter((x) => x.id !== m.id));
    const { id: _id, payload: _p, galatPesan: _g, ...sisa } = m;
    kirimKe(buatTmp({ ...sisa, gagal: false, tunda: true }), m.payload);
  }

  function saatKetik(e) {
    setTeks(e.target.value);
    try { e.target.value ? localStorage.setItem(`wa-draf:${roomId}`, e.target.value) : localStorage.removeItem(`wa-draf:${roomId}`); } catch {}
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 132) + "px";
    if (Date.now() - ketikTerakhir.current > 2500 && e.target.value) {
      ketikTerakhir.current = Date.now();
      api.post("/api/wa/pesan", { aksi: "ketik", room: roomId });
    }
  }
  function saatTekan(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      const sentuh = window.matchMedia?.("(pointer: coarse)").matches;
      if (!sentuh) { e.preventDefault(); kirimTeks(); }
    }
  }
  useEffect(() => { if (inputRef.current && !teks) inputRef.current.style.height = "auto"; }, [teks]);

  function sisipEmoji(e) {
    const el = inputRef.current;
    if (!el) { setTeks((t) => t + e); return; }
    const a = el.selectionStart ?? teks.length, b = el.selectionEnd ?? teks.length;
    setTeks(teks.slice(0, a) + e + teks.slice(b));
    requestAnimationFrame(() => { try { el.setSelectionRange(a + e.length, a + e.length); } catch {} });
  }

  // ───────────── foto ─────────────
  async function pilihFoto(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    setLampir(false);
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast("Pilih berkas gambar (PNG/JPG/WEBP)."); return; }
    try {
      const data = await kecilkanGambar(f, { sisi: 1280, maksBytes: 820_000 });
      setPratinjau({ data, teks: "" });
    } catch (err) {
      toast(err.message || "Gambar tidak bisa diproses.");
    }
  }
  async function kirimFoto() {
    const p = pratinjau;
    if (!p) return;
    setPratinjau(null);
    const b = balas;
    setBalas(null);
    kirimKe(buatTmp({ jenis: "gambar", media: p.data, teks: p.teks, balas: b ? { msgId: b.id, nama: b.nama, preview: b.preview } : null }), { jenis: "gambar", media: p.data, teks: p.teks, ...(b ? { balasId: b.id } : {}) });
  }

  // ───────────── suara ─────────────
  async function mulaiRekam() {
    if (rekamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { toast("Perangkat ini belum mendukung rekam suara."); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast("Izin mikrofon ditolak. Aktifkan mikrofon untuk situs ini di pengaturan peramban.");
      return;
    }
    const tipe = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported?.(t));
    let mr;
    try {
      mr = new MediaRecorder(stream, { ...(tipe ? { mimeType: tipe } : {}), audioBitsPerSecond: 32000 });
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      toast("Rekam suara tidak bisa dimulai.");
      return;
    }
    const r = { mr, stream, potong: [], mulai: Date.now(), batal: false, timer: null };
    rekamRef.current = r;
    mr.ondataavailable = (ev) => { if (ev.data?.size) r.potong.push(ev.data); };
    mr.onstop = async () => {
      clearInterval(r.timer);
      stream.getTracks().forEach((t) => t.stop());
      rekamRef.current = null;
      setRekam(null);
      const dur = Math.round((Date.now() - r.mulai) / 1000);
      if (r.batal) return;
      if (dur < 1) { toast("Tahan lebih lama untuk merekam."); return; }
      const blob = new Blob(r.potong, { type: mr.mimeType || tipe || "audio/webm" });
      const data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      const b = balas;
      setBalas(null);
      kirimKe(buatTmp({ jenis: "suara", media: data, durasi: dur }), { jenis: "suara", media: data, durasi: dur, ...(b ? { balasId: b.id } : {}) });
    };
    mr.start(250);
    setRekam({ detik: 0 });
    r.timer = setInterval(() => {
      const d = Math.round((Date.now() - r.mulai) / 1000);
      setRekam({ detik: d });
      if (d >= 120) selesaiRekam(false);
    }, 500);
  }
  function selesaiRekam(batal) {
    const r = rekamRef.current;
    if (!r) return;
    r.batal = batal;
    try { r.mr.state !== "inactive" && r.mr.stop(); } catch {}
  }
  useEffect(() => () => { const r = rekamRef.current; if (r) { r.batal = true; try { r.mr.stop(); } catch {} r.stream?.getTracks().forEach((t) => t.stop()); } }, []);

  // ───────────── aksi pesan ─────────────
  const aksiPesan = useCallback(async (aksi, m, ekstra = {}) => {
    const r = await api.post("/api/wa/pesan", { aksi, room: roomId, msgId: m.id, ...ekstra });
    if (!r.ok) { toast(r.error || "Gagal."); return r; }
    if (r.data.pesan) gabung([r.data.pesan], false);
    else polling();
    return r;
  }, [api, roomId, gabung, polling, toast]);

  const h = useRef({});
  h.current = {
    menu: (m) => { if (!m.tunda) { navigator.vibrate?.(8); setMenuPesan(m); } },
    balas: (m) => {
      if (m.jenis === "dihapus" || m.tunda) return;
      const nama = m.mine ? "Kamu" : (pengirim[m.dari]?.nama || m.namaDari || "Pengguna");
      const preview = m.jenis === "teks" ? m.teks : m.jenis === "gambar" ? `📷 ${m.teks || "Foto"}` : m.jenis === "suara" ? "🎤 Pesan suara" : m.jenis === "stiker" ? `${m.stiker} Stiker` : m.jenis === "poll" ? `📊 ${m.poll?.pertanyaan}` : "";
      setBalas({ id: m.id, nama, preview: String(preview || "").slice(0, 80) });
      setUbah(null);
      inputRef.current?.focus();
    },
    gambar: (src, cap) => setLihatGambar({ src, cap }),
    vote: (m, o) => aksiPesan("vote", m, { opsiId: o }),
    lompat,
    profil: (pid) => wa.buka({ tipe: "user", pid }),
    ulang
  };
  const onMenu = useCallback((m) => h.current.menu(m), []);
  const onBalas = useCallback((m) => h.current.balas(m), []);
  const onGambar = useCallback((s, c) => h.current.gambar(s, c), []);
  const onVote = useCallback((m, o) => h.current.vote(m, o), []);
  const onLompat = useCallback((id) => h.current.lompat(id), []);
  const onProfil = useCallback((pid) => h.current.profil(pid), []);
  const onUlang = useCallback((m) => h.current.ulang(m), []);

  function bolehHapusSemua(m) {
    return m.mine || (grup && info?.saya?.admin) || (umum && admin);
  }
  function hapus(m) {
    setMenuPesan(null);
    if (m.jenis === "dihapus" || m.gagal) {
      if (m.gagal) { setPesan((p) => p.filter((x) => x.id !== m.id)); return; }
    }
    const tombol = [{ label: "Hapus untuk saya", gaya: "bahaya", onClick: async () => { setTanya(null); setPesan((p) => p.filter((x) => x.id !== m.id)); const r = await api.post("/api/wa/pesan", { aksi: "hapus", room: roomId, msgId: m.id, scope: "saya" }); if (!r.ok) toast(r.error || "Gagal menghapus."); } }];
    if (m.jenis !== "dihapus" && bolehHapusSemua(m)) {
      tombol.unshift({ label: "Hapus untuk semua orang", gaya: "bahaya", onClick: async () => { setTanya(null); const r = await api.post("/api/wa/pesan", { aksi: "hapus", room: roomId, msgId: m.id, scope: "semua" }); if (!r.ok) toast(r.error || "Gagal menghapus."); polling(); } });
    }
    setTanya({ judul: "Hapus pesan?", isi: bolehHapusSemua(m) ? "Kamu bisa menghapusnya hanya untukmu atau untuk semua orang di obrolan ini." : "Pesan ini akan hilang dari layarmu saja.", tombol });
  }

  function jalankan(kode, m) {
    setMenuPesan(null);
    if (kode === "balas") h.current.balas(m);
    else if (kode === "salin") salin(m.jenis === "teks" || m.jenis === "gambar" ? m.teks : m.stiker || m.poll?.pertanyaan || "").then((ok) => toast(ok ? "Disalin." : "Gagal menyalin."));
    else if (kode === "teruskan") wa.buka({ tipe: "teruskan", room: roomId, msg: m });
    else if (kode === "bintang") aksiPesan("bintang", m, { nyalakan: !m.bintang }).then((r) => r.ok && toast(m.bintang ? "Bintang dilepas." : "Diberi bintang."));
    else if (kode === "sematkan") aksiPesan("sematkan", m, { nyalakan: !m.pinned }).then((r) => { if (r.ok) { toast(m.pinned ? "Sematan dilepas." : "Pesan disematkan."); muatInfo(); } });
    else if (kode === "ubah") { setUbah(m); setBalas(null); setTeks(m.teks || ""); setTimeout(() => inputRef.current?.focus(), 30); }
    else if (kode === "hapus") hapus(m);
  }

  // ───────────── menu kepala ─────────────
  async function ubahPref(kunci) {
    const nilai = !info?.pref?.[kunci];
    const r = await api.post("/api/wa/room", { aksi: "pref", roomId, [kunci]: nilai });
    if (!r.ok) { toast(r.error || "Gagal."); return; }
    toast({ muted: nilai ? "Notifikasi dibisukan." : "Notifikasi diaktifkan.", pinned: nilai ? "Chat disematkan." : "Sematan chat dilepas.", archived: nilai ? "Chat diarsipkan." : "Chat dikeluarkan dari arsip." }[kunci]);
    muatInfo(); wa.muatUlang?.();
    if (kunci === "archived" && nilai) wa.tutupRoom();
  }
  function kosongkanChat() {
    setTanya({ judul: "Kosongkan chat?", isi: "Semua pesan disembunyikan dari layarmu. Orang lain tetap bisa melihatnya.", tombol: [{ label: "Kosongkan", gaya: "bahaya", onClick: async () => { setTanya(null); const r = await api.post("/api/wa/pesan", { aksi: "kosongkan", room: roomId }); if (r.ok) { setPesan([]); setAdaLagi(false); wa.muatUlang?.(); toast("Chat dikosongkan."); } else toast(r.error || "Gagal."); } }] });
  }
  function keluarGrup() {
    setTanya({ judul: `Keluar dari “${info?.nama}”?`, isi: "Kamu tidak akan menerima pesan grup ini lagi.", tombol: [{ label: "Keluar grup", gaya: "bahaya", onClick: async () => { setTanya(null); const r = await api.post("/api/wa/room", { aksi: "keluar", roomId }); if (r.ok) { wa.muatUlang?.(); wa.tutupRoom(); toast("Kamu keluar dari grup."); } else toast(r.error || "Gagal."); } }] });
  }
  async function blokirLawan() {
    if (!lawan) return;
    const diblokir = (wa.saya?.blokir || []).includes(lawan.pid);
    const r = await api.post("/api/wa/profil", { blokir: { pid: lawan.pid, nyalakan: !diblokir } });
    if (r.ok) { toast(diblokir ? `${lawan.nama} dibuka blokirnya.` : `${lawan.nama} diblokir.`); wa.muatUlang?.(); } else toast(r.error || "Gagal.");
  }
  async function bukaBerbintang() {
    setMenuKepala(false);
    const r = await api.get(`/api/wa/pesan?room=${encodeURIComponent(roomId)}&bintang=1&limit=100`);
    if (r.ok) setBerbintang(r.data.pesan || []); else toast(r.error || "Gagal memuat.");
  }
  async function jalankanCari(q) {
    setCari((c) => ({ ...c, q, memuat: true }));
    if (q.trim().length < 2) { setCari({ q, hasil: [], memuat: false }); return; }
    const r = await api.get(`/api/wa/pesan?room=${encodeURIComponent(roomId)}&q=${encodeURIComponent(q.trim())}&limit=50`);
    setCari((c) => (c && c.q === q ? { q, hasil: r.ok ? r.data.pesan || [] : [], memuat: false } : c));
  }

  function telepon(jenis) {
    if (privat && lawan) wa.telepon(lawan, jenis);
    else toast("Panggilan grup belum tersedia. Telepon anggota lewat chat pribadinya.");
  }

  // ───────────── status kepala ─────────────
  const namaJudul = info?.nama || rooms.find((r) => r.roomId === roomId)?.nama || "…";
  const dariDaftar = rooms.find((r) => r.roomId === roomId);
  const fotoKepala = info?.foto || dariDaftar?.foto;
  const fotoAda = info ? info.fotoAda : !!dariDaftar?.fotoAda;
  let subjudul = "";
  if (mengetik.length) subjudul = privat ? "sedang mengetik…" : `${mengetik.slice(0, 2).join(", ")} sedang mengetik…`;
  else if (privat && lawan) subjudul = teksTerakhir(lawan);
  else if (grup && info) subjudul = info.anggota.slice(0, 4).map((a) => (a.pid === me?.pid ? "Kamu" : a.nama)).join(", ") + (info.anggota.length > 4 ? "…" : "");
  else if (umum) subjudul = info?.tutup ? "Ditutup admin" : "Grup terbuka untuk semua pengguna";
  if (info?.sementara && !mengetik.length && !umum) subjudul = `🕒 ${subjudul}`;

  const diblokirSaya = privat && lawan && (wa.saya?.blokir || []).includes(lawan.pid);
  let penghalang = null;
  if (umum && info?.tutup && !admin) penghalang = "WEARTA CHAT sedang ditutup admin. Coba lagi nanti ya.";
  else if (grup && info?.hanyaAdminKirim && !info.saya?.admin) penghalang = "Hanya admin grup yang bisa mengirim pesan.";

  // ───────────── daftar dengan pemisah ─────────────
  const baris = useMemo(() => {
    const hasil = [];
    let hariLalu = "";
    let idxMasuk = 0;
    const masukTotal = pesan.filter((m) => !m.mine && m.jenis !== "sistem" && m.jenis !== "call").length;
    const dari = belumAwal.current ? masukTotal - belumAwal.current : -1;
    pesan.forEach((m, i) => {
      const hari = new Date(m.createdAt).toDateString();
      if (hari !== hariLalu) { hasil.push({ tipe: "hari", id: `h-${hari}`, label: labelHari(m.createdAt) }); hariLalu = hari; }
      const masuk = !m.mine && m.jenis !== "sistem" && m.jenis !== "call";
      if (masuk) { if (dari >= 0 && idxMasuk === dari && belumAwal.current > 0) hasil.push({ tipe: "belum", id: "belum", n: belumAwal.current }); idxMasuk++; }
      const sebelum = pesan[i - 1];
      const awalGrup = !sebelum || sebelum.dari !== m.dari || sebelum.jenis === "sistem" || sebelum.jenis === "call" || new Date(m.createdAt) - new Date(sebelum.createdAt) > 5 * 60_000 || new Date(sebelum.createdAt).toDateString() !== hari;
      hasil.push({ tipe: "pesan", m, awalGrup });
    });
    return hasil;
  }, [pesan]);

  const pesanSemat = info?.pinnedMsgId ? pesan.find((m) => m.id === info.pinnedMsgId) : null;

  // ───────────── render ─────────────
  return (
    <section className="wa-perc" aria-label={`Percakapan ${namaJudul}`}>
      <header className="wa-kepala">
        <button className="wa-ikon wa-kembali" onClick={() => wa.tutupRoom()} aria-label="Kembali"><Ik n="back" s={22} /></button>
        <button className="wa-kepala-info" onClick={() => (privat && lawan ? wa.buka({ tipe: "user", pid: lawan.pid }) : info && wa.buka({ tipe: "room", roomId }))}>
          <Avatar nama={namaJudul} foto={fotoKepala} ada={fotoAda} size={42} online={privat && !!lawan?.online} umum={umum && !info?.fotoAda} />
          <span className="wa-kepala-teks">
            <NamaLencana nama={namaJudul} lencana={info?.lencana} size={16} />
            <small className={mengetik.length ? "mengetik" : lawan?.online ? "online" : ""}>{subjudul || " "}</small>
          </span>
        </button>
        <div className="wa-kepala-aksi">
          {!umum && (
            <>
              <button className="wa-ikon" onClick={() => telepon("video")} aria-label="Panggilan video"><Ik n="video" s={22} /></button>
              <button className="wa-ikon" onClick={() => telepon("suara")} aria-label="Panggilan suara"><Ik n="phone" s={20} /></button>
            </>
          )}
          <button className="wa-ikon" onClick={() => setCari(cari ? null : { q: "", hasil: [], memuat: false })} aria-label="Cari pesan"><Ik n="search" s={21} /></button>
          <div className="wa-menu-jangkar">
            <button className="wa-ikon" onClick={() => setMenuKepala((v) => !v)} aria-label="Menu lainnya" aria-expanded={menuKepala}><Ik n="more" s={22} /></button>
            {menuKepala && (
              <>
                <div className="wa-menu-tutup" onClick={() => setMenuKepala(false)} />
                <div className="wa-menu-pop" role="menu">
                  <button onClick={() => { setMenuKepala(false); privat && lawan ? wa.buka({ tipe: "user", pid: lawan.pid }) : wa.buka({ tipe: "room", roomId }); }}><Ik n="info" s={18} /> {privat ? "Lihat kontak" : "Info grup"}</button>
                  <button onClick={bukaBerbintang}><Ik n="star" s={18} /> Pesan berbintang</button>
                  <button onClick={() => { setMenuKepala(false); ubahPref("muted"); }}><Ik n={info?.pref?.muted ? "bell" : "mute"} s={18} /> {info?.pref?.muted ? "Aktifkan notifikasi" : "Bisukan notifikasi"}</button>
                  <button onClick={() => { setMenuKepala(false); ubahPref("pinned"); }}><Ik n="pin" s={18} /> {info?.pref?.pinned ? "Lepas sematan chat" : "Sematkan chat"}</button>
                  {!umum && <button onClick={() => { setMenuKepala(false); ubahPref("archived"); }}><Ik n="archive" s={18} /> Arsipkan chat</button>}
                  {!umum && <button onClick={() => { setMenuKepala(false); setPilihSementara(true); }}><Ik n="refresh" s={18} /> Pesan sementara{info?.sementara ? ` (${info.sementara === 86400000 ? "24 jam" : info.sementara === 604800000 ? "7 hari" : "90 hari"})` : ""}</button>}
                  <button onClick={() => { setMenuKepala(false); kosongkanChat(); }}><Ik n="trash" s={18} /> Kosongkan chat</button>
                  {privat && lawan && <button className="bahaya" onClick={() => { setMenuKepala(false); blokirLawan(); }}><Ik n="block" s={18} /> {diblokirSaya ? "Buka blokir" : "Blokir"}</button>}
                  {grup && <button className="bahaya" onClick={() => { setMenuKepala(false); keluarGrup(); }}><Ik n="logout" s={18} /> Keluar grup</button>}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {cari && (
        <div className="wa-cari">
          <div className="wa-cari-bar">
            <Ik n="search" s={18} />
            <input autoFocus value={cari.q} onChange={(e) => jalankanCari(e.target.value)} placeholder="Cari di percakapan ini…" aria-label="Cari pesan" />
            <button className="wa-ikon kecil" onClick={() => setCari(null)} aria-label="Tutup pencarian"><Ik n="close" s={18} /></button>
          </div>
          {cari.q.trim().length >= 2 && (
            <div className="wa-cari-hasil">
              {cari.memuat && <p className="wa-kosong-kecil">Mencari…</p>}
              {!cari.memuat && !cari.hasil.length && <p className="wa-kosong-kecil">Tidak ada pesan yang cocok.</p>}
              {cari.hasil.map((m) => (
                <button key={m.id} onClick={() => { setCari(null); lompat(m.id); }}>
                  <b>{m.mine ? "Kamu" : pengirim[m.dari]?.nama || m.namaDari || "Pengguna"}</b>
                  <span>{m.teks}</span>
                  <time>{labelHari(m.createdAt)} · {jam(m.createdAt)}</time>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {info?.pinnedMsgId && (
        <button className="wa-semat" onClick={() => (pesanSemat ? lompat(pesanSemat.id) : toast("Pesan yang disematkan ada di riwayat lama — gulir ke atas."))}>
          <Ik n="pin" s={16} />
          <span><b>Pesan disematkan</b><em>{pesanSemat ? (pesanSemat.jenis === "teks" ? pesanSemat.teks : pesanSemat.jenis === "gambar" ? "📷 Foto" : pesanSemat.jenis === "suara" ? "🎤 Pesan suara" : "Pesan") : "Ketuk untuk melihat"}</em></span>
        </button>
      )}

      <div className="wa-pesan" ref={listRef} onScroll={saatGulir} onClick={() => { setPanel(null); setLampir(false); }}>
        {galat && <div className="wa-galat-blok"><span>🦅</span><p>{galat}</p><button className="wa-tombol" onClick={() => wa.tutupRoom()}>Kembali</button></div>}
        {!dimuat && !galat && <div className="wa-memuat"><span className="wa-spin" /> Memuat pesan…</div>}
        {dimuat && !galat && adaLagi && <button className="wa-muat-lama" onClick={muatLama}>Muat pesan sebelumnya</button>}
        {dimuat && !galat && !pesan.length && (
          <div className="wa-kosong">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/maskot-sm.webp" alt="" />
            <b>{privat ? "Belum ada obrolan" : "Belum ada pesan"}</b>
            <p>{privat ? `Kirim pesan pertama ke ${namaJudul}. Sapa dulu, yuk!` : "Jadilah yang pertama menyapa di sini."}</p>
          </div>
        )}
        {baris.map((b) => {
          if (b.tipe === "hari") return <div className="wa-hari" key={b.id}><span>{b.label}</span></div>;
          if (b.tipe === "belum") return <div className="wa-belum" key={b.id}><span>{b.n} pesan belum dibaca</span></div>;
          return (
            <Gelembung
              key={b.m.id}
              m={b.m}
              grup={grup}
              umum={umum}
              pengirim={pengirim}
              awalGrup={b.awalGrup}
              sorot={sorot === b.m.id}
              adminUmum={!!admin}
              onMenu={onMenu}
              onBalas={onBalas}
              onLihatGambar={onGambar}
              onVote={onVote}
              onLompat={onLompat}
              onProfil={onProfil}
              onUlang={onUlang}
            />
          );
        })}
        {mengetik.length > 0 && (
          <div className="wa-baris lain awal"><div className="wa-gel lain awal wa-titik-tulis"><i /><i /><i /></div></div>
        )}
      </div>

      {!bawah && (
        <button className="wa-turun" onClick={() => keBawah()} aria-label="Ke pesan terbaru">
          {baruDibawah > 0 && <b>{baruDibawah}</b>}
          <Ik n="down" s={24} />
        </button>
      )}

      {/* ───────── penulis pesan ───────── */}
      {penghalang ? (
        <div className="wa-halang"><Ik n="lock" s={16} /> {penghalang}</div>
      ) : diblokirSaya ? (
        <div className="wa-halang">Kamu memblokir kontak ini. <button onClick={blokirLawan}>Buka blokir</button></div>
      ) : (
        <footer className="wa-tulis">
          {(balas || ubah) && (
            <div className="wa-tulis-konteks">
              <div className="wa-tulis-kutip">
                <b>{ubah ? "Ubah pesan" : `Membalas ${balas.nama}`}</b>
                <span>{ubah ? ubah.teks : balas.preview}</span>
              </div>
              <button className="wa-ikon kecil" onClick={() => { setBalas(null); if (ubah) { setUbah(null); setTeks(""); } }} aria-label="Batalkan"><Ik n="close" s={18} /></button>
            </div>
          )}

          {panel && (
            <div className="wa-panel-emoji">
              <div className="wa-panel-tab">
                <button className={panel === "emoji" ? "aktif" : ""} onClick={() => setPanel("emoji")}><Ik n="smile" s={18} /> Emoji</button>
                <button className={panel === "stiker" ? "aktif" : ""} onClick={() => setPanel("stiker")}><Ik n="sticker" s={18} /> Stiker</button>
              </div>
              {panel === "emoji" ? (
                <>
                  <div className="wa-emoji-grup">
                    {GRUP_EMOJI.map((g, i) => <button key={i} className={grupEmoji === i ? "aktif" : ""} onClick={() => setGrupEmoji(i)}>{g.i}</button>)}
                  </div>
                  <div className="wa-emoji-grid">
                    {GRUP_EMOJI[grupEmoji].e.map((e) => <button key={e} onClick={() => sisipEmoji(e)}>{e}</button>)}
                  </div>
                </>
              ) : (
                <div className="wa-stiker-isi">
                  {PAKET_STIKER.map((p) => (
                    <div key={p.label}>
                      <h4>{p.label}</h4>
                      <div className="wa-stiker-grid">{p.s.map((s) => <button key={s} onClick={() => kirimStiker(s)}>{s}</button>)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {lampir && (
            <div className="wa-lampir">
              <button onClick={() => fileFoto.current?.click()}><span style={{ background: "#8b5cf6" }}><Ik n="image" s={24} /></span>Foto</button>
              <button onClick={() => fileKamera.current?.click()}><span style={{ background: "#ec4899" }}><Ik n="camera" s={24} /></span>Kamera</button>
              <button onClick={() => { setLampir(false); setPoll(true); }}><span style={{ background: "#14b8a6" }}><Ik n="poll" s={24} /></span>Jajak</button>
              <button onClick={() => { setLampir(false); wa.buka({ tipe: "kontak", mode: "bagikan", onPilih: bagikanKontak }); }}><span style={{ background: "#0ea5e9" }}><Ik n="user" s={24} /></span>Kontak</button>
              <button onClick={() => { setLampir(false); setPanel("stiker"); }}><span style={{ background: "#f77c22" }}><Ik n="sticker" s={24} /></span>Stiker</button>
            </div>
          )}
          <input ref={fileFoto} type="file" accept="image/*" hidden onChange={pilihFoto} />
          <input ref={fileKamera} type="file" accept="image/*" capture="environment" hidden onChange={pilihFoto} />

          {rekam ? (
            <div className="wa-rekam">
              <button className="wa-ikon" onClick={() => selesaiRekam(true)} aria-label="Batalkan rekaman"><Ik n="trash" s={22} /></button>
              <span className="wa-rekam-titik" />
              <b>{Math.floor(rekam.detik / 60)}:{String(rekam.detik % 60).padStart(2, "0")}</b>
              <em>Merekam… ketuk kirim untuk mengirim</em>
              <button className="wa-kirim" onClick={() => selesaiRekam(false)} aria-label="Kirim rekaman"><Ik n="send" s={22} /></button>
            </div>
          ) : (
            <div className="wa-tulis-baris">
              <div className="wa-tulis-kotak">
                <button className="wa-ikon kecil" onClick={(e) => { e.stopPropagation(); setLampir(false); setPanel(panel ? null : "emoji"); }} aria-label="Emoji dan stiker"><Ik n="smile" s={24} /></button>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={teks}
                  onChange={saatKetik}
                  onKeyDown={saatTekan}
                  onFocus={() => { setPanel(null); setLampir(false); }}
                  placeholder={ubah ? "Ubah pesan…" : "Ketik pesan"}
                  maxLength={2000}
                  aria-label="Tulis pesan"
                />
                {!ubah && <button className="wa-ikon kecil" onClick={(e) => { e.stopPropagation(); setPanel(null); setLampir((v) => !v); }} aria-label="Lampirkan"><Ik n="plus" s={24} style={{ transform: lampir ? "rotate(45deg)" : "none", transition: "transform .15s" }} /></button>}
                {!ubah && !teks.trim() && <button className="wa-ikon kecil" onClick={() => fileKamera.current?.click()} aria-label="Ambil foto"><Ik n="camera" s={22} /></button>}
              </div>
              {teks.trim() ? (
                <button className="wa-kirim" onClick={kirimTeks} aria-label={ubah ? "Simpan perubahan" : "Kirim"}><Ik n={ubah ? "check" : "send"} s={22} /></button>
              ) : (
                <button className="wa-kirim mik" onClick={mulaiRekam} aria-label="Rekam pesan suara"><Ik n="mic" s={24} /></button>
              )}
            </div>
          )}
        </footer>
      )}

      {/* ───────── lapisan ───────── */}
      {menuPesan && (
        <div className="wa-lembar-latar wa-menu-pesan-latar" onMouseDown={(e) => { if (e.target === e.currentTarget) setMenuPesan(null); }}>
          <div className="wa-menu-pesan" role="menu">
            <div className="wa-reaksi-bar">
              {EMOJI_REAKSI.map((e) => (
                <button key={e} className={menuPesan.reaksi?.[e]?.saya ? "saya" : ""} onClick={() => { const m = menuPesan; setMenuPesan(null); aksiPesan("reaksi", m, { emoji: e }); }}>{e}</button>
              ))}
            </div>
            <div className="wa-menu-pesan-daftar">
              {menuPesan.jenis !== "dihapus" && <button onClick={() => jalankan("balas", menuPesan)}><Ik n="reply" s={19} /> Balas</button>}
              {(menuPesan.jenis === "teks" || menuPesan.jenis === "gambar" || menuPesan.jenis === "stiker") && menuPesan.jenis !== "dihapus" && <button onClick={() => jalankan("salin", menuPesan)}><Ik n="copy" s={19} /> Salin</button>}
              {["teks", "gambar", "stiker", "suara"].includes(menuPesan.jenis) && <button onClick={() => jalankan("teruskan", menuPesan)}><Ik n="forward" s={19} /> Teruskan</button>}
              {menuPesan.jenis !== "dihapus" && <button onClick={() => jalankan("bintang", menuPesan)}><Ik n="star" s={19} /> {menuPesan.bintang ? "Lepas bintang" : "Beri bintang"}</button>}
              {menuPesan.jenis !== "dihapus" && (privat || adminAksi) && <button onClick={() => jalankan("sematkan", menuPesan)}><Ik n="pin" s={19} /> {menuPesan.pinned ? "Lepas sematan" : "Sematkan"}</button>}
              {menuPesan.mine && (menuPesan.jenis === "teks" || menuPesan.jenis === "gambar") && Date.now() - new Date(menuPesan.createdAt).getTime() < BATAS_UBAH_MS && <button onClick={() => jalankan("ubah", menuPesan)}><Ik n="edit" s={19} /> Ubah</button>}
              <button className="bahaya" onClick={() => jalankan("hapus", menuPesan)}><Ik n="trash" s={19} /> Hapus</button>
            </div>
          </div>
        </div>
      )}

      {pratinjau && (
        <div className="wa-pratinjau">
          <button className="wa-ikon terang" onClick={() => setPratinjau(null)} aria-label="Batal"><Ik n="close" s={24} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pratinjau.data} alt="Pratinjau foto" />
          <div className="wa-pratinjau-bawah">
            <input value={pratinjau.teks} maxLength={500} onChange={(e) => setPratinjau({ ...pratinjau, teks: e.target.value })} placeholder="Tambahkan keterangan…" onKeyDown={(e) => e.key === "Enter" && kirimFoto()} />
            <button className="wa-kirim" onClick={kirimFoto} aria-label="Kirim foto"><Ik n="send" s={22} /></button>
          </div>
        </div>
      )}

      {lihatGambar && (
        <div className="wa-pratinjau" onClick={() => setLihatGambar(null)}>
          <button className="wa-ikon terang" onClick={() => setLihatGambar(null)} aria-label="Tutup"><Ik n="close" s={24} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lihatGambar.src} alt={lihatGambar.cap || "Foto"} />
          {lihatGambar.cap ? <p className="wa-pratinjau-cap">{lihatGambar.cap}</p> : null}
        </div>
      )}

      {poll && <PembuatPoll onTutup={() => setPoll(false)} onKirim={(pertanyaan, opsi) => { setPoll(false); kirimKe(buatTmp({ jenis: "poll", poll: { pertanyaan, opsi: opsi.map((t, i) => ({ id: String(i), teks: t, suara: 0, saya: false })) } }), { jenis: "poll", pertanyaan, opsi }); }} />}

      {berbintang && (
        <Lembar judul="Pesan berbintang" onTutup={() => setBerbintang(null)}>
          {!berbintang.length ? <p className="wa-kosong-kecil">Belum ada pesan berbintang. Tahan sebuah pesan lalu pilih “Beri bintang”.</p> : berbintang.map((m) => (
            <button key={m.id} className="wa-baris-daftar" onClick={() => { setBerbintang(null); lompat(m.id); }}>
              <span className="wa-baris-teks"><b>{m.mine ? "Kamu" : pengirim[m.dari]?.nama || m.namaDari}</b><small>{m.jenis === "teks" ? m.teks : m.jenis === "gambar" ? `📷 ${m.teks || "Foto"}` : m.jenis}</small></span>
              <time>{labelHari(m.createdAt)}</time>
            </button>
          ))}
        </Lembar>
      )}

      {pilihSementara && (
        <Lembar judul="Pesan sementara" onTutup={() => setPilihSementara(false)} lebar={400}>
          <p className="wa-kosong-kecil" style={{ textAlign: "left", paddingTop: 4 }}>
            Pesan baru di obrolan ini hilang sendiri setelah waktu yang dipilih. Pesan yang sudah ada tidak berubah.
            {grup && !info?.saya?.admin ? " Hanya admin grup yang bisa mengubahnya." : ""}
          </p>
          {[[0, "Mati"], [86400000, "24 jam"], [604800000, "7 hari"], [7776000000, "90 hari"]].map(([ms, l]) => (
            <button key={ms} className={`wa-baris-daftar${(info?.sementara || 0) === ms ? " dipilih" : ""}`} onClick={async () => { const r = await api.post("/api/wa/room", { aksi: "sementara", roomId, ms }); if (r.ok) { setPilihSementara(false); muatInfo(); polling(); toast(ms ? `Pesan sementara aktif: ${l}.` : "Pesan sementara dimatikan."); } else toast(r.error || "Gagal."); }}>
              <span className="wa-baris-teks"><b className="wa-nama-teks">{l}</b></span>
              <span className={`wa-centang-pilih${(info?.sementara || 0) === ms ? " aktif" : ""}`}>{(info?.sementara || 0) === ms && <Ik n="check" s={16} />}</span>
            </button>
          ))}
        </Lembar>
      )}
      {tanya && <Konfirmasi judul={tanya.judul} isi={tanya.isi} tombol={tanya.tombol} onTutup={() => setTanya(null)} />}
    </section>
  );
}

function PembuatPoll({ onTutup, onKirim }) {
  const [tanya, setTanya] = useState("");
  const [opsi, setOpsi] = useState(["", ""]);
  const sah = tanya.trim() && opsi.filter((o) => o.trim()).length >= 2;
  return (
    <Lembar judul="Buat jajak pendapat" onTutup={onTutup}>
      <div className="wa-form">
        <label>Pertanyaan
          <input value={tanya} maxLength={200} onChange={(e) => setTanya(e.target.value)} placeholder="Tanyakan sesuatu…" autoFocus />
        </label>
        <div className="wa-form-grup">
          <span>Pilihan jawaban</span>
          {opsi.map((o, i) => (
            <div className="wa-form-baris" key={i}>
              <input value={o} maxLength={60} onChange={(e) => setOpsi(opsi.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Pilihan ${i + 1}`} />
              {opsi.length > 2 && <button className="wa-ikon kecil" onClick={() => setOpsi(opsi.filter((_, j) => j !== i))} aria-label="Hapus pilihan"><Ik n="close" s={18} /></button>}
            </div>
          ))}
          {opsi.length < 6 && <button className="wa-tombol polos" onClick={() => setOpsi([...opsi, ""])}>+ Tambah pilihan</button>}
        </div>
        <button className="wa-tombol utama" disabled={!sah} onClick={() => onKirim(tanya.trim(), opsi.map((o) => o.trim()).filter(Boolean))}>Kirim jajak pendapat</button>
      </div>
    </Lembar>
  );
}
