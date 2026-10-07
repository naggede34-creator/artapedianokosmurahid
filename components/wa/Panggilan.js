"use client";

// Panggilan suara & video 1:1 lewat WebRTC. Server hanya menjadi perantara
// sinyal (offer/answer/ICE) lewat polling; media mengalir antar peramban.
import { useEffect, useRef, useState } from "react";
import { Ik, Avatar, NamaLencana, useWa, durasiTeks } from "@/components/wa/kit";

function pesanGalatMedia(err, video) {
  const n = err?.name || "";
  if (n === "NotAllowedError" || n === "SecurityError") return `Izin ${video ? "kamera & mikrofon" : "mikrofon"} ditolak. Aktifkan izinnya untuk situs ini di pengaturan peramban.`;
  if (n === "NotFoundError" || n === "OverconstrainedError") return video ? "Kamera atau mikrofon tidak ditemukan." : "Mikrofon tidak ditemukan.";
  if (n === "NotReadableError") return "Kamera/mikrofon sedang dipakai aplikasi lain.";
  return "Tidak bisa mengakses kamera/mikrofon.";
}

/** Nada dering sederhana lewat WebAudio (tanpa berkas). */
function useNada(aktif, mode) {
  useEffect(() => {
    if (!aktif) return undefined;
    let ctx = null;
    let timer = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return undefined;
      ctx = new AC();
      const bunyi = () => {
        if (!ctx || ctx.state === "closed") return;
        ctx.resume?.().catch(() => {});
        const t0 = ctx.currentTime;
        const nada = mode === "masuk" ? [[880, 0], [660, 0.22], [880, 0.5], [660, 0.72]] : [[425, 0], [425, 0.5]];
        for (const [f, d] of nada) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = mode === "masuk" ? "triangle" : "sine";
          o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t0 + d);
          g.gain.exponentialRampToValueAtTime(0.16, t0 + d + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + (mode === "masuk" ? 0.2 : 0.42));
          o.connect(g).connect(ctx.destination);
          o.start(t0 + d);
          o.stop(t0 + d + 0.5);
        }
        if (mode === "masuk") navigator.vibrate?.([300, 150, 300]);
      };
      bunyi();
      timer = setInterval(bunyi, mode === "masuk" ? 2200 : 3000);
    } catch { /* tanpa suara: layarnya tetap jalan */ }
    return () => {
      clearInterval(timer);
      try { ctx?.close(); } catch {}
    };
  }, [aktif, mode]);
}

export default function LayarPanggilan({ sesi, onSelesai }) {
  const wa = useWa();
  const { api, toast } = wa;
  const video = sesi.jenis === "video";
  const masuk = sesi.arah === "masuk";

  const [status, setStatus] = useState(masuk ? "dering" : "menyiapkan"); // menyiapkan | memanggil | dering | menyambung | tersambung | berakhir
  const [ket, setKet] = useState("");
  const [mik, setMik] = useState(true);
  const [kam, setKam] = useState(video);
  const [detik, setDetik] = useState(0);
  const [hadap, setHadap] = useState("user");

  const pc = useRef(null);
  const stream = useRef(null);
  const callId = useRef(sesi.callId || null);
  const idx = useRef(0);
  const remoteSet = useRef(false);
  const antreCand = useRef([]);
  const antreKirim = useRef([]);
  const selesai = useRef(false);
  const mulaiAt = useRef(0);
  const loop = useRef(null);
  const gagalBeruntun = useRef(0);
  const statusRef = useRef(status);
  const vLokal = useRef(null);
  const vJauh = useRef(null);
  statusRef.current = status;

  useNada(status === "dering" || status === "memanggil", status === "dering" ? "masuk" : "keluar");

  // ───────────── penutup ─────────────
  function bersihkan() {
    clearTimeout(loop.current);
    loop.current = null;
    try { stream.current?.getTracks().forEach((t) => t.stop()); } catch {}
    stream.current = null;
    try { pc.current?.close(); } catch {}
    pc.current = null;
  }

  function akhiriLokal(pesan, { kirim = true, aksi = "akhiri" } = {}) {
    if (selesai.current) return;
    selesai.current = true;
    if (kirim && callId.current) api.post("/api/wa/call", { aksi, callId: callId.current });
    bersihkan();
    setStatus("berakhir");
    setKet(pesan || "Panggilan berakhir");
    setTimeout(() => onSelesai?.(), 1400);
  }

  useEffect(() => {
    const keluarHalaman = () => {
      if (selesai.current || !callId.current) return;
      try {
        navigator.sendBeacon("/api/wa/call", new Blob([JSON.stringify({ aksi: masuk && statusRef.current === "dering" ? "tolak" : "akhiri", callId: callId.current, token: wa.token })], { type: "application/json" }));
      } catch {}
    };
    window.addEventListener("pagehide", keluarHalaman);
    return () => {
      window.removeEventListener("pagehide", keluarHalaman);
      if (!selesai.current) { selesai.current = true; if (callId.current) api.post("/api/wa/call", { aksi: masuk && statusRef.current === "dering" ? "tolak" : "akhiri", callId: callId.current }); }
      bersihkan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────────── media & koneksi ─────────────
  async function ambilMedia() {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("tak didukung"), { name: "SecurityError" });
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false });
  }

  async function bikinPc(st) {
    const ice = await api.get("/api/wa/call?ice=1");
    const p = new RTCPeerConnection({ iceServers: ice.ok ? ice.data.iceServers : [{ urls: "stun:stun.l.google.com:19302" }] });
    st.getTracks().forEach((t) => p.addTrack(t, st));
    p.ontrack = (e) => {
      const s = e.streams[0] || new MediaStream([e.track]);
      if (vJauh.current && vJauh.current.srcObject !== s) { vJauh.current.srcObject = s; vJauh.current.play?.().catch(() => {}); }
    };
    p.onicecandidate = (e) => {
      if (!e.candidate) return;
      const c = e.candidate.toJSON();
      if (callId.current) api.post("/api/wa/call", { aksi: "ice", callId: callId.current, kandidat: c });
      else antreKirim.current.push(c);
    };
    const cek = () => {
      const s = p.connectionState || p.iceConnectionState;
      if (s === "connected" || s === "completed") {
        if (statusRef.current !== "tersambung") { mulaiAt.current = mulaiAt.current || Date.now(); setStatus("tersambung"); }
      } else if (s === "failed") {
        akhiriLokal("Koneksi gagal. Jaringan kalian mungkin butuh server TURN (admin bisa mengisinya di Konfigurasi).");
      }
    };
    p.onconnectionstatechange = cek;
    p.oniceconnectionstatechange = cek;
    pc.current = p;
    return p;
  }

  function tambahKandidat(daftar) {
    for (const c of daftar || []) {
      if (remoteSet.current) pc.current?.addIceCandidate(c).catch(() => {});
      else antreCand.current.push(c);
    }
  }
  function kosongkanAntre() {
    for (const c of antreCand.current) pc.current?.addIceCandidate(c).catch(() => {});
    antreCand.current = [];
  }

  function mulaiPoll() {
    const putar = async () => {
      if (selesai.current) return;
      const r = await api.get(`/api/wa/call?call=${callId.current}&idx=${idx.current}`);
      if (selesai.current) return;
      if (!r.ok) {
        gagalBeruntun.current++;
        if (r.status === 404 || gagalBeruntun.current > 10) return akhiriLokal("Panggilan terputus", { kirim: false });
      } else {
        gagalBeruntun.current = 0;
        const k = r.data;
        if (k.kandidat?.length) tambahKandidat(k.kandidat);
        idx.current = k.idx ?? idx.current;
        if (k.sayaPenelepon && k.answer && !remoteSet.current && pc.current) {
          try {
            await pc.current.setRemoteDescription(k.answer);
            remoteSet.current = true;
            kosongkanAntre();
            if (statusRef.current === "memanggil") setStatus("menyambung");
          } catch { return akhiriLokal("Gagal menyambungkan panggilan."); }
        }
        if (k.mulaiAt && !mulaiAt.current) mulaiAt.current = new Date(k.mulaiAt).getTime();
        if (k.status === "ditolak") return akhiriLokal(masuk ? "Panggilan berakhir" : "Panggilan ditolak", { kirim: false });
        if (k.status === "sibuk") return akhiriLokal("Sedang dalam panggilan lain", { kirim: false });
        if (k.status === "tak-terjawab") return akhiriLokal(masuk ? "Panggilan terlewat" : "Tidak dijawab", { kirim: false });
        if (k.status === "selesai") return akhiriLokal("Panggilan berakhir", { kirim: false });
      }
      loop.current = setTimeout(putar, 900);
    };
    loop.current = setTimeout(putar, 500);
  }

  // Panggilan keluar dimulai otomatis.
  useEffect(() => {
    if (masuk) return undefined;
    let batal = false;
    (async () => {
      let st;
      try { st = await ambilMedia(); } catch (err) { if (!batal) akhiriLokal(pesanGalatMedia(err, video), { kirim: false }); return; }
      if (batal || selesai.current) { st.getTracks().forEach((t) => t.stop()); return; }
      stream.current = st;
      if (vLokal.current) vLokal.current.srcObject = st;
      try {
        const p = await bikinPc(st);
        const offer = await p.createOffer();
        await p.setLocalDescription(offer);
        const r = await api.post("/api/wa/call", { aksi: "mulai", ke: sesi.lawan.pid, jenis: sesi.jenis, offer: { type: "offer", sdp: p.localDescription.sdp } });
        if (batal || selesai.current) return;
        if (!r.ok) return akhiriLokal(r.error || "Panggilan gagal dimulai.", { kirim: false });
        callId.current = r.data.callId;
        if (r.data.status === "sibuk") return akhiriLokal(`${sesi.lawan.nama} sedang dalam panggilan lain`, { kirim: false });
        for (const c of antreKirim.current) api.post("/api/wa/call", { aksi: "ice", callId: callId.current, kandidat: c });
        antreKirim.current = [];
        setStatus("memanggil");
        mulaiPoll();
      } catch (err) {
        akhiriLokal("Panggilan gagal dimulai di perangkat ini.", { kirim: !!callId.current });
      }
    })();
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function terima() {
    if (statusRef.current !== "dering") return;
    setStatus("menyambung");
    let st;
    try { st = await ambilMedia(); } catch (err) { toast(pesanGalatMedia(err, video)); return akhiriLokal("Panggilan ditolak (tanpa izin)", { aksi: "tolak" }); }
    if (selesai.current) { st.getTracks().forEach((t) => t.stop()); return; }
    stream.current = st;
    if (vLokal.current) vLokal.current.srcObject = st;
    try {
      const r = await api.get(`/api/wa/call?call=${callId.current}&idx=0`);
      if (!r.ok || !r.data.offer) return akhiriLokal(r.error || "Panggilan sudah berakhir", { kirim: false });
      if (r.data.status !== "ringing") return akhiriLokal("Panggilan sudah berakhir", { kirim: false });
      const p = await bikinPc(st);
      await p.setRemoteDescription(r.data.offer);
      remoteSet.current = true;
      tambahKandidat(r.data.kandidat);
      idx.current = r.data.idx || 0;
      const ans = await p.createAnswer();
      await p.setLocalDescription(ans);
      const j = await api.post("/api/wa/call", { aksi: "jawab", callId: callId.current, answer: { type: "answer", sdp: p.localDescription.sdp } });
      if (!j.ok) return akhiriLokal(j.error || "Panggilan sudah berakhir", { kirim: false });
      for (const c of antreKirim.current) api.post("/api/wa/call", { aksi: "ice", callId: callId.current, kandidat: c });
      antreKirim.current = [];
      mulaiPoll();
    } catch {
      akhiriLokal("Gagal menjawab panggilan.");
    }
  }
  function tolak() { akhiriLokal("Panggilan ditolak", { aksi: "tolak" }); }

  // ───────────── kontrol ─────────────
  function alihMik() {
    const t = stream.current?.getAudioTracks() || [];
    const baru = !mik;
    t.forEach((x) => { x.enabled = baru; });
    setMik(baru);
  }
  function alihKamera() {
    const t = stream.current?.getVideoTracks() || [];
    const baru = !kam;
    t.forEach((x) => { x.enabled = baru; });
    setKam(baru);
  }
  async function balikKamera() {
    if (!video || !stream.current) return;
    const arah = hadap === "user" ? "environment" : "user";
    try {
      const s2 = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: arah } }, audio: false });
      const trackBaru = s2.getVideoTracks()[0];
      const sender = pc.current?.getSenders().find((s) => s.track?.kind === "video");
      await sender?.replaceTrack(trackBaru);
      stream.current.getVideoTracks().forEach((t) => { t.stop(); stream.current.removeTrack(t); });
      stream.current.addTrack(trackBaru);
      if (vLokal.current) vLokal.current.srcObject = stream.current;
      setHadap(arah);
      setKam(true);
    } catch {
      toast("Kamera lain tidak tersedia.");
    }
  }

  // Waktu berjalan.
  useEffect(() => {
    if (status !== "tersambung") return undefined;
    const id = setInterval(() => setDetik(Math.max(0, Math.floor((Date.now() - (mulaiAt.current || Date.now())) / 1000))), 500);
    return () => clearInterval(id);
  }, [status]);

  const teksStatus = {
    menyiapkan: "Menyiapkan…",
    memanggil: "Memanggil…",
    dering: video ? "Panggilan video masuk" : "Panggilan suara masuk",
    menyambung: "Menyambungkan…",
    tersambung: durasiTeks(detik),
    berakhir: ket || "Panggilan berakhir"
  }[status];
  const foto = sesi.lawan.fotoV ? `/api/wa/foto/${sesi.lawan.pid}?v=${sesi.lawan.fotoV}` : null;
  const tampilVideo = video && (status === "tersambung" || status === "menyambung");

  return (
    <div className={`wa-call${tampilVideo ? " video" : ""}`} role="dialog" aria-label="Panggilan">
      <div className="wa-call-latar" aria-hidden />
      {/* Video lawan: satu elemen untuk suara & gambar */}
      <video ref={vJauh} className={`wa-call-jauh${tampilVideo ? "" : " sembunyi"}`} autoPlay playsInline />
      {video && <video ref={vLokal} className={`wa-call-lokal${kam ? "" : " mati"}`} autoPlay playsInline muted />}

      <div className="wa-call-atas">
        <span className="wa-call-enkripsi"><Ik n="lock" s={13} /> Panggilan {video ? "video" : "suara"} langsung antar perangkat</span>
      </div>

      <div className={`wa-call-tengah${tampilVideo ? " kecil" : ""}`}>
        <div className={`wa-call-avatar${status === "memanggil" || status === "dering" ? " berdenyut" : ""}`}>
          <Avatar nama={sesi.lawan.nama} foto={foto} ada={!!sesi.lawan.fotoV} size={tampilVideo ? 64 : 132} />
        </div>
        <h2><NamaLencana nama={sesi.lawan.nama} lencana={sesi.lawan.lencana} size={22} /></h2>
        <p className={`wa-call-status${status === "berakhir" ? " akhir" : ""}`}>{teksStatus}</p>
      </div>

      <div className="wa-call-bawah">
        {status === "dering" ? (
          <>
            <div className="wa-call-tombol">
              <button className="wa-call-btn merah" onClick={tolak} aria-label="Tolak panggilan"><Ik n="phone" s={30} style={{ transform: "rotate(135deg)" }} /></button>
              <span>Tolak</span>
            </div>
            <div className="wa-call-tombol">
              <button className="wa-call-btn hijau" onClick={terima} aria-label="Terima panggilan"><Ik n={video ? "video" : "phone"} s={30} /></button>
              <span>Terima</span>
            </div>
          </>
        ) : status === "berakhir" ? null : (
          <>
            <div className="wa-call-tombol">
              <button className={`wa-call-btn abu${mik ? "" : " mati"}`} onClick={alihMik} aria-label={mik ? "Matikan mikrofon" : "Nyalakan mikrofon"}><Ik n={mik ? "mic" : "micoff"} s={26} /></button>
              <span>{mik ? "Mik" : "Mik mati"}</span>
            </div>
            {video && (
              <>
                <div className="wa-call-tombol">
                  <button className={`wa-call-btn abu${kam ? "" : " mati"}`} onClick={alihKamera} aria-label={kam ? "Matikan kamera" : "Nyalakan kamera"}><Ik n={kam ? "video" : "videooff"} s={26} /></button>
                  <span>{kam ? "Kamera" : "Kamera mati"}</span>
                </div>
                <div className="wa-call-tombol">
                  <button className="wa-call-btn abu" onClick={balikKamera} aria-label="Balik kamera"><Ik n="flip" s={26} /></button>
                  <span>Balik</span>
                </div>
              </>
            )}
            <div className="wa-call-tombol">
              <button className="wa-call-btn merah" onClick={() => akhiriLokal("Panggilan berakhir")} aria-label="Akhiri panggilan"><Ik n="phone" s={30} style={{ transform: "rotate(135deg)" }} /></button>
              <span>Akhiri</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
