"use client";

// Tombol "Aktifkan notifikasi di perangkat ini" (Web Push).
// Sengaja hanya muncul lewat tindakan pengguna: izin notifikasi yang diminta
// tiba-tiba saat halaman dibuka hampir selalu ditolak, dan penolakan itu
// permanen di banyak peramban.
import { useEffect, useState } from "react";

function keBytes(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushToggle({ token }) {
  const [dukung, setDukung] = useState(false);
  const [aktif, setAktif] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setDukung(ok);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setAktif(Boolean(sub) && Notification.permission === "granted"))
      .catch(() => {});
  }, []);

  if (!dukung || !token) return null;

  async function nyalakan() {
    setSibuk(true);
    setPesan("");
    try {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") {
        setPesan("Izin notifikasi ditolak. Aktifkan lewat pengaturan situs di peramban.");
        return;
      }
      const k = await fetch("/api/push/kunci").then((r) => r.json());
      if (!k.publik) throw new Error("Push belum tersedia.");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keBytes(k.publik) }));
      const r = await fetch("/api/push/langganan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, subscription: sub.toJSON(), uji: true })
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Gagal mendaftar.");
      setAktif(true);
    } catch (e) {
      setPesan(e.message || "Gagal mengaktifkan notifikasi.");
    } finally {
      setSibuk(false);
    }
  }

  async function matikan() {
    setSibuk(true);
    setPesan("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/langganan", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, endpoint: sub.endpoint })
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setAktif(false);
    } catch (e) {
      setPesan(e.message || "Gagal mematikan notifikasi.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="px-4 py-2.5" style={{ borderBottom: "1px solid rgba(30,45,61,0.9)" }}>
      <button
        type="button"
        disabled={sibuk}
        onClick={aktif ? matikan : nyalakan}
        className="press flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-bold disabled:opacity-60"
        style={
          aktif
            ? { background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }
            : { background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }
        }
      >
        <span>{aktif ? "🔔 Notifikasi perangkat ini: AKTIF" : "🔕 Aktifkan notifikasi di perangkat ini"}</span>
        <span className="text-[10px] opacity-80">{sibuk ? "…" : aktif ? "Matikan" : "Nyalakan"}</span>
      </button>
      {pesan && <p className="mt-1.5 text-[11px]" style={{ color: "#fb7185" }}>{pesan}</p>}
    </div>
  );
}
