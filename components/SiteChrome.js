"use client";

import { usePathname, useRouter } from "next/navigation";
import { bolehRw } from "@/lib/rwHalaman";
import { CHANNEL_URL } from "@/lib/links";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import SupportWidget from "@/components/SupportWidget";
import RwBantuan from "@/components/RwBantuan";
import BroadcastBar from "@/components/BroadcastBar";
import MascotGreeting from "@/components/MascotGreeting";
import ComicIntro from "@/components/ComicIntro";
import MascotNudge from "@/components/MascotNudge";
import InfoModal from "@/components/InfoModal";
import LogoLoader from "@/components/LogoLoader";
import RevealOnScroll from "@/components/RevealOnScroll";
import Depth3D from "@/components/Depth3D";
import PanelTransition from "@/components/PanelTransition";
import PasangAplikasi from "@/components/PasangAplikasi";
import AuthGate from "@/components/AuthGate";
import LayarBan from "@/components/LayarBan";
import PembaruanModal from "@/components/PembaruanModal";
import MusimPenerap from "@/components/MusimPenerap";
import PopupAdmin from "@/components/PopupAdmin";
import { useUser, useBrand } from "@/app/providers";

// Halaman yang tetap terbuka tanpa akun saat login diwajibkan: informasi umum.
const TANPA_LOGIN = ["/syarat", "/informasi", "/faq", "/cara-pakai", "/api-docs", "/gateway"];

export default function SiteChrome({ children }) {
  const pathname = usePathname();
  const { perluMasuk, banned, brandSegar } = useUser();
  const brand = useBrand();
  const router = useRouter();
  // Web reseller hanya punya beli nokos, deposit, riwayat, dan mutasi. Halaman lain dialihkan ke BERANDA web reseller itu
  // sendiri (bukan ke web utama). Diputuskan hanya setelah merek dari server tiba, supaya cache lama tidak salah menilai.
  const rwTerkunci = !!(brand.reseller && brandSegar && pathname && !pathname.startsWith("/admin") && !bolehRw(pathname));
  useEffect(() => { if (rwTerkunci) router.replace("/dashboard"); }, [rwTerkunci, router]);
  // Jaring pengaman web reseller: tautan internal ke fitur yang tidak ada (mis. dari kartu atau banner yang tak
  // tersaring) disembunyikan di mana pun muncul, dan yang baru muncul belakangan ikut disaring.
  const rwAktifUi = !!(brand.reseller && brandSegar);
  useEffect(() => {
    if (!rwAktifUi || typeof document === "undefined") return undefined;
    let tunggu = 0;
    const sapu = () => {
      tunggu = 0;
      document.querySelectorAll('a[href^="/"]').forEach((a) => { if (!bolehRw(a.getAttribute("href"))) a.style.display = "none"; });
    };
    const jadwalkan = () => { if (!tunggu) tunggu = requestAnimationFrame(sapu); };
    sapu();
    const mo = new MutationObserver(jadwalkan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (tunggu) cancelAnimationFrame(tunggu); };
  }, [rwAktifUi, pathname]);
  const isAdmin = pathname?.startsWith("/admin");
  // Login wajib menyala dan belum punya akun: gerbang menutup halaman.
  const tampilGerbang = perluMasuk && !TANPA_LOGIN.some((p) => pathname === p || pathname?.startsWith(`${p}/`));
  // Room Chat itu satu layar penuh ala aplikasi chat: navbar, footer, dan
  // bottom nav situs tidak ikut ditampilkan. Sebelumnya ketiganya tetap
  // dirender di belakang overlay-nya — tidak terlihat, tapi ikut menambah
  // tinggi halaman sehingga muncul gulungan kosong di bawah layar chat.
  const isChat = pathname === "/chat";

  const [checked, setChecked] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("Sedang Maintenance");
  const [maintenanceBtnLabel, setMaintenanceBtnLabel] = useState("");
  const [maintenanceBtnUrl, setMaintenanceBtnUrl] = useState("");
  const [channelInfo, setChannelInfo] = useState(CHANNEL_URL);
  const [csUsername, setCsUsername] = useState("teatlas");

  useEffect(() => {
    if (isAdmin) {
      setChecked(true);
      return;
    }
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        setMaintenance(!!d.maintenance);
        setMaintenanceMsg(d.maintenanceMsg || "");
        if (d.maintenanceTitle) setMaintenanceTitle(d.maintenanceTitle);
        setMaintenanceBtnLabel(d.maintenanceButtonLabel || "");
        setMaintenanceBtnUrl(d.maintenanceButtonUrl || "");
        if (d.channelInfo) setChannelInfo(d.channelInfo);
        if (d.csUsername) setCsUsername(d.csUsername);
      })
      .catch(() => setMaintenance(false))
      .finally(() => setChecked(true));
  }, [isAdmin]);

  // Halaman admin punya tampilannya sendiri, tanpa navbar/footer publik & tanpa gerbang maintenance.
  if (isAdmin) return <>{children}</>;
  if (rwTerkunci) return null;

  // Akun di-ban: hanya satu layar peringatan. Tidak ada dasbor, navigasi, tombol, atau halaman lain yang dirender.
  if (banned) return <LayarBan />;

  if (checked && maintenance) {
    return (
      <MaintenanceScreen
        title={maintenanceTitle}
        message={maintenanceMsg}
        buttonLabel={maintenanceBtnLabel}
        buttonUrl={maintenanceBtnUrl}
      />
    );
  }

  // SESUDAH gerbang maintenance, bukan sebelumnya: Room Chat bukan halaman
  // admin, jadi saat situs ditutup dia harus ikut tertutup.
  //
  // Tanpa RevealOnScroll di sini: halaman ini tidak memakai kelas animasi
  // masuk apa pun, dan pengamat mutasinya justru akan bekerja terus-menerus
  // di DOM chat yang isinya berubah setiap pesan datang.
  if (isChat) return <>{tampilGerbang && <AuthGate />}{!tampilGerbang && <><PembaruanModal langsung /><PopupAdmin langsung /></>}{children}</>;

  return (
    <>
      {tampilGerbang && <AuthGate />}
      <RevealOnScroll />
      <Depth3D />
      <PanelTransition />
      <LogoLoader />
      {/* Sapaan maskot & popup pembuka menunggu animasi loading selesai
          (lihat lib/introGate.js) supaya tidak tertimbun di belakangnya. */}
      {/* Selama gerbang daftar/masuk tampil, popup pembuka ditunda: jangan
          bertumpuk di depan layar yang harus diisi dulu. */}
      {!tampilGerbang && (
        <>
          {!brand.reseller && <ComicIntro />}
          {!brand.reseller && <MascotNudge />}
          {!brand.reseller && <MascotGreeting />}
          {!brand.reseller && <InfoModal />}
          <PembaruanModal />
          <PopupAdmin />
        </>
      )}
      {!brand.reseller && <MusimPenerap />}
      <BroadcastBar />
      <Navbar />
      <main className="pb-24 md:pb-0">{children}</main>
      <Footer />
      <BottomNav />
      {brand.reseller ? <RwBantuan csUsername={csUsername} /> : <SupportWidget channelInfo={channelInfo} csUsername={csUsername} />}
      <PasangAplikasi />
    </>
  );
}

function MaintenanceScreen({ title, message, buttonLabel, buttonUrl }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="glow-ring rounded-3xl">
        <div className="glass max-w-sm rounded-3xl px-8 py-10 shadow-card-3d">
          <span className="mascot-platform mx-auto -mb-2 block h-6 w-28 rounded-full opacity-70" aria-hidden="true" />
          <span className="float-slow relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber text-3xl shadow-3d">
            🛠️
          </span>
          <h1 className="comic-head mt-5 font-display text-xl text-ink">{title || "Sedang Maintenance"}</h1>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
            {message || "Website sedang maintenance. Kami akan segera kembali, mohon coba lagi beberapa saat lagi."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {buttonLabel && buttonUrl && (
              <a
                href={buttonUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-3d rounded-lg border border-amber bg-amber-soft px-4 py-2.5 text-sm font-semibold text-amber-bright transition-colors hover:bg-amber hover:text-white"
              >
                {buttonLabel}
              </a>
            )}
            <a
              href={CHANNEL_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-3d rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-amber/40 hover:text-amber-bright"
            >
              📢 Info &amp; Promo Terbaru
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
