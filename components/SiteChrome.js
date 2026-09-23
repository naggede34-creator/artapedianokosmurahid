"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import SupportWidget from "@/components/SupportWidget";
import BroadcastBar from "@/components/BroadcastBar";
import MascotGreeting from "@/components/MascotGreeting";
import WelcomeBonusPopup from "@/components/WelcomeBonusPopup";
import InfoModal from "@/components/InfoModal";
import LogoLoader from "@/components/LogoLoader";

export default function SiteChrome({ children }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  const [checked, setChecked] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("Sedang Maintenance");
  const [maintenanceBtnLabel, setMaintenanceBtnLabel] = useState("");
  const [maintenanceBtnUrl, setMaintenanceBtnUrl] = useState("");
  const [channelInfo, setChannelInfo] = useState("https://t.me/kkaelnokosmurah");
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

  return (
    <>
      <LogoLoader />
      {/* Sapaan maskot & popup pembuka menunggu animasi loading selesai
          (lihat lib/introGate.js) supaya tidak tertimbun di belakangnya. */}
      <MascotGreeting />
      <InfoModal />
      <WelcomeBonusPopup />
      <BroadcastBar />
      <Navbar />
      <main className="pb-24 md:pb-0">{children}</main>
      <Footer />
      <BottomNav />
      <SupportWidget channelInfo={channelInfo} csUsername={csUsername} />
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
              href="https://t.me/kkaelnokosmurah"
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
