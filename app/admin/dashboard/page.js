"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtRp(n) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

const TABS = [
  { id: "ringkasan", label: "Ringkasan", icon: "📊" },
  { id: "pengguna", label: "Pengguna", icon: "👥" },
  { id: "konten", label: "Konten", icon: "📝" },
  { id: "transaksi", label: "Transaksi", icon: "💳" },
  { id: "pengaturan", label: "Pengaturan", icon: "⚙️" },
  { id: "tools", label: "Tools", icon: "🛠️" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("ringkasan");

  const [settings, setSettings] = useState(null);
  const [markupInput, setMarkupInput] = useState("");
  const [savingMarkup, setSavingMarkup] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [savingProviders, setSavingProviders] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [balanceForm, setBalanceForm] = useState({ token: "", amount: "", note: "" });
  const [balanceAction, setBalanceAction] = useState("add");
  const [balanceSubmitting, setBalanceSubmitting] = useState(false);
  const [balanceMsg, setBalanceMsg] = useState("");
  const formRef = useRef(null);

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [vouchers, setVouchers] = useState([]);
  const [vouchersLoading, setVouchersLoading] = useState(true);
  const [voucherForm, setVoucherForm] = useState({ code: "", amount: "", maxUses: "1" });
  const [voucherSubmitting, setVoucherSubmitting] = useState(false);
  const [voucherMsg, setVoucherMsg] = useState("");

  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastsLoading, setBroadcastsLoading] = useState(true);
  const [broadcastInput, setBroadcastInput] = useState("");
  const [broadcastStart, setBroadcastStart] = useState("");
  const [broadcastEnd, setBroadcastEnd] = useState("");
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const [savingLoyalty, setSavingLoyalty] = useState(false);
  const [loyaltyMsg, setLoyaltyMsg] = useState("");

  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementForm, setAnnouncementForm] = useState({ category: "Informasi", title: "", body: "" });
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState("");

  const [simuru, setSimuru] = useState(null);
  const [smmMarkupInput, setSmmMarkupInput] = useState("");
  const [savingSmm, setSavingSmm] = useState(false);

  const [warrantyClaims, setWarrantyClaims] = useState([]);
  const [warrantyLoading, setWarrantyLoading] = useState(true);
  const [warrantyMsg, setWarrantyMsg] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);

  const [suspendMsg, setSuspendMsg] = useState("");

  const [flashSales, setFlashSales] = useState([]);
  const [flashSaleForm, setFlashSaleForm] = useState({ title: "", discountPercent: "", durationHours: "2", serviceFilter: "" });
  const [flashSaleMsg, setFlashSaleMsg] = useState("");
  const [flashSaleLoading, setFlashSaleLoading] = useState(false);

  const [luckyHours, setLuckyHours] = useState([]);
  const [luckyHourForm, setLuckyHourForm] = useState({ startHour: "", endHour: "", discountPercent: "", label: "" });
  const [luckyHourMsg, setLuckyHourMsg] = useState("");
  const [luckyHourLoading, setLuckyHourLoading] = useState(false);

  const [notifTarget, setNotifTarget] = useState("all");
  const [notifToken, setNotifToken] = useState("");
  const [notifType, setNotifType] = useState("promo");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifMsg, setNotifMsg] = useState("");
  const [notifLoading, setNotifLoading] = useState(false);

  const [gamStats, setGamStats] = useState(null);
  const [gamStatsLoading, setGamStatsLoading] = useState(false);

  const [platformMarkups, setPlatformMarkups] = useState([]);
  const [platformMarkupLoading, setPlatformMarkupLoading] = useState(false);
  const [platformMarkupForm, setPlatformMarkupForm] = useState({ platform: "", markupPercent: "" });
  const [platformMarkupMsg, setPlatformMarkupMsg] = useState("");

  // Activity log state
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityFilterToken, setActivityFilterToken] = useState("");
  const [activityFilterType, setActivityFilterType] = useState("all");
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPages, setActivityPages] = useState(1);

  const loadWarrantyClaims = useCallback(async () => {
    setWarrantyLoading(true);
    try {
      const res = await fetch("/api/admin/warranty");
      if (res.status === 401) return router.push("/admin/login");
      const data = await res.json();
      setWarrantyClaims(Array.isArray(data.items) ? data.items : []);
    } finally {
      setWarrantyLoading(false);
    }
  }, [router]);

  const loadSimuru = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/simuru");
      if (res.ok) setSimuru(await res.json());
    } catch {
      setSimuru({ configured: false, balance: null, error: "Gagal memuat." });
    }
  }, []);

  async function saveSmm(patch) {
    setSavingSmm(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smm: patch })
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data);
        setSmmMarkupInput(String(data.smm?.markupPercent ?? 0));
        setSettingsMsg("Pengaturan suntik sosmed tersimpan.");
      } else {
        setSettingsMsg(data.error || "Gagal menyimpan.");
      }
    } finally {
      setSavingSmm(false);
      setTimeout(() => setSettingsMsg(""), 2500);
    }
  }

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (res.status === 401) return router.push("/admin/login");
    const data = await res.json();
    setSettings(data);
    setMarkupInput(String(data.markupPercent ?? 0));
    setSmmMarkupInput(String(data.smm?.markupPercent ?? 0));
  }, [router]);

  const loadUsers = useCallback(
    async (q = search) => {
      setUsersLoading(true);
      try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
        if (res.status === 401) return router.push("/admin/login");
        const data = await res.json();
        setUsers(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total || 0);
        setTotalBalance(data.totalBalance || 0);
      } finally {
        setUsersLoading(false);
      }
    },
    [router, search]
  );

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (res.status === 401) return router.push("/admin/login");
      const data = await res.json();
      setStats(data);
    } finally {
      setStatsLoading(false);
    }
  }, [router]);

  const loadVouchers = useCallback(async () => {
    setVouchersLoading(true);
    try {
      const res = await fetch("/api/admin/vouchers");
      if (res.status === 401) return router.push("/admin/login");
      const data = await res.json();
      setVouchers(Array.isArray(data.items) ? data.items : []);
    } finally {
      setVouchersLoading(false);
    }
  }, [router]);

  const loadBroadcasts = useCallback(async () => {
    setBroadcastsLoading(true);
    try {
      const res = await fetch("/api/admin/broadcasts");
      if (res.status === 401) return router.push("/admin/login");
      const data = await res.json();
      setBroadcasts(Array.isArray(data.items) ? data.items : []);
    } finally {
      setBroadcastsLoading(false);
    }
  }, [router]);

  const loadAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    try {
      const res = await fetch("/api/admin/announcements");
      if (res.status === 401) return router.push("/admin/login");
      const data = await res.json();
      setAnnouncements(Array.isArray(data.items) ? data.items : []);
    } finally {
      setAnnouncementsLoading(false);
    }
  }, [router]);

  async function loadFlashSales() {
    setFlashSaleLoading(true);
    try {
      const res = await fetch("/api/admin/flashsale");
      if (res.ok) { const d = await res.json(); setFlashSales(Array.isArray(d.items) ? d.items : []); }
    } finally { setFlashSaleLoading(false); }
  }

  async function loadLuckyHours() {
    setLuckyHourLoading(true);
    try {
      const res = await fetch("/api/admin/lucky-hours");
      if (res.ok) { const d = await res.json(); setLuckyHours(Array.isArray(d.items) ? d.items : []); }
    } finally { setLuckyHourLoading(false); }
  }

  async function loadActivityLog(pg = activityPage) {
    setActivityLoading(true);
    try {
      const params = new URLSearchParams({ type: activityFilterType, page: String(pg) });
      if (activityFilterToken.trim()) params.set("token", activityFilterToken.trim());
      const res = await fetch(`/api/admin/activity?${params}`);
      if (res.ok) {
        const d = await res.json();
        setActivityLogs(Array.isArray(d.items) ? d.items : []);
        setActivityTotal(d.total || 0);
        setActivityPages(d.pages || 1);
        setActivityPage(d.page || 1);
      }
    } finally {
      setActivityLoading(false);
    }
  }

  async function createFlashSale(e) {
    e.preventDefault();
    setFlashSaleMsg("");
    const { title, discountPercent, durationHours, serviceFilter } = flashSaleForm;
    if (!title || !discountPercent) { setFlashSaleMsg("Judul dan diskon wajib diisi."); return; }
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + Number(durationHours) * 3600000);
    const res = await fetch("/api/admin/flashsale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, discountPercent: Number(discountPercent), startAt, endAt, serviceFilter }),
    });
    const d = await res.json();
    if (d.ok) { setFlashSaleMsg("Flash sale dibuat!"); setFlashSaleForm({ title: "", discountPercent: "", durationHours: "2", serviceFilter: "" }); loadFlashSales(); }
    else setFlashSaleMsg(d.error || "Gagal.");
    setTimeout(() => setFlashSaleMsg(""), 3000);
  }

  async function toggleFlashSale(id) {
    await fetch("/api/admin/flashsale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) });
    loadFlashSales();
  }

  async function deleteFlashSale(id) {
    await fetch("/api/admin/flashsale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    loadFlashSales();
  }

  async function createLuckyHour(e) {
    e.preventDefault();
    setLuckyHourMsg("");
    const { startHour, endHour, discountPercent, label } = luckyHourForm;
    if (startHour === "" || endHour === "" || !discountPercent) { setLuckyHourMsg("Semua field wajib diisi."); return; }
    const res = await fetch("/api/admin/lucky-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startHour: Number(startHour), endHour: Number(endHour), discountPercent: Number(discountPercent), label }),
    });
    const d = await res.json();
    if (d.ok) { setLuckyHourMsg("Lucky hour dibuat!"); setLuckyHourForm({ startHour: "", endHour: "", discountPercent: "", label: "" }); loadLuckyHours(); }
    else setLuckyHourMsg(d.error || "Gagal.");
    setTimeout(() => setLuckyHourMsg(""), 3000);
  }

  async function toggleLuckyHour(id) {
    await fetch("/api/admin/lucky-hours", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) });
    loadLuckyHours();
  }

  async function deleteLuckyHour(id) {
    await fetch("/api/admin/lucky-hours", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    loadLuckyHours();
  }

  async function sendBlastNotif(e) {
    e.preventDefault();
    setNotifMsg("");
    if (!notifTitle || !notifBody) { setNotifMsg("Judul dan pesan wajib diisi."); return; }
    if (notifTarget === "single" && !notifToken) { setNotifMsg("Token user wajib diisi."); return; }
    setNotifLoading(true);
    try {
      const res = await fetch("/api/admin/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: notifTarget, token: notifToken, type: notifType, title: notifTitle, body: notifBody }),
      });
      const d = await res.json();
      if (d.ok) { setNotifMsg(`✓ Terkirim ke ${d.sent} pengguna.`); setNotifTitle(""); setNotifBody(""); setNotifToken(""); }
      else setNotifMsg(d.error || "Gagal.");
    } finally {
      setNotifLoading(false);
      setTimeout(() => setNotifMsg(""), 3500);
    }
  }

  async function loadGamStats() {
    setGamStatsLoading(true);
    try {
      const res = await fetch("/api/admin/gamification-stats");
      if (res.ok) setGamStats(await res.json());
    } finally { setGamStatsLoading(false); }
  }

  async function loadPlatformMarkups() {
    setPlatformMarkupLoading(true);
    try {
      const res = await fetch("/api/admin/platform-markup");
      if (res.ok) { const d = await res.json(); setPlatformMarkups(Array.isArray(d.items) ? d.items : []); }
    } finally { setPlatformMarkupLoading(false); }
  }

  async function upsertPlatformMarkup(e) {
    e.preventDefault();
    setPlatformMarkupMsg("");
    const { platform, markupPercent } = platformMarkupForm;
    if (!platform || markupPercent === "") { setPlatformMarkupMsg("Platform dan markup wajib diisi."); return; }
    const res = await fetch("/api/admin/platform-markup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert", platform, markupPercent: Number(markupPercent) }),
    });
    const d = await res.json();
    if (d.ok) { setPlatformMarkupMsg("Tersimpan!"); setPlatformMarkupForm({ platform: "", markupPercent: "" }); loadPlatformMarkups(); }
    else setPlatformMarkupMsg(d.error || "Gagal.");
    setTimeout(() => setPlatformMarkupMsg(""), 3000);
  }

  async function togglePlatformMarkup(id) {
    await fetch("/api/admin/platform-markup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) });
    loadPlatformMarkups();
  }

  async function deletePlatformMarkup(id) {
    await fetch("/api/admin/platform-markup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    loadPlatformMarkups();
  }

  useEffect(() => {
    loadSettings();
    loadSimuru();
    loadUsers("");
    loadStats();
    loadVouchers();
    loadBroadcasts();
    loadAnnouncements();
    loadWarrantyClaims();
    loadFlashSales();
    loadLuckyHours();
    loadGamStats();
    loadPlatformMarkups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleWarrantyAction(id, action) {
    const adminNote = action === "reject" ? (prompt("Alasan penolakan (opsional):") ?? "") : "";
    setWarrantyMsg("");
    try {
      const res = await fetch("/api/admin/warranty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, adminNote })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses.");
      setWarrantyMsg(action === "approve" ? "Klaim disetujui & saldo dikembalikan." : "Klaim ditolak.");
      loadWarrantyClaims();
    } catch (err) {
      setWarrantyMsg(err.message);
    } finally {
      setTimeout(() => setWarrantyMsg(""), 3000);
    }
  }

  async function submitBroadcast(e) {
    e.preventDefault();
    setBroadcastMsg("");
    setBroadcastSubmitting(true);
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: broadcastInput.trim(), startAt: broadcastStart || null, endAt: broadcastEnd || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim broadcast.");
      setBroadcastMsg(broadcastStart || broadcastEnd ? "Broadcast terjadwal tersimpan." : "Broadcast terkirim & langsung tampil ke semua user.");
      setBroadcastInput("");
      setBroadcastStart("");
      setBroadcastEnd("");
      loadBroadcasts();
    } catch (err) {
      setBroadcastMsg(err.message);
    } finally {
      setBroadcastSubmitting(false);
      setTimeout(() => setBroadcastMsg(""), 3000);
    }
  }

  async function toggleBroadcast(id) {
    await fetch("/api/admin/broadcasts/toggle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    loadBroadcasts();
  }

  async function deleteBroadcast(id) {
    await fetch("/api/admin/broadcasts/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    loadBroadcasts();
  }

  async function submitAnnouncement(e) {
    e.preventDefault();
    setAnnouncementMsg("");
    setAnnouncementSubmitting(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: announcementForm.category, title: announcementForm.title.trim(), body: announcementForm.body.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat pengumuman.");
      setAnnouncementMsg("Pengumuman diterbitkan.");
      setAnnouncementForm({ category: "Informasi", title: "", body: "" });
      loadAnnouncements();
    } catch (err) {
      setAnnouncementMsg(err.message);
    } finally {
      setAnnouncementSubmitting(false);
      setTimeout(() => setAnnouncementMsg(""), 3000);
    }
  }

  async function toggleAnnouncement(id) {
    await fetch("/api/admin/announcements/toggle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    loadAnnouncements();
  }

  async function deleteAnnouncement(id) {
    await fetch("/api/admin/announcements/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    loadAnnouncements();
  }

  async function submitVoucher(e) {
    e.preventDefault();
    setVoucherMsg("");
    setVoucherSubmitting(true);
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: voucherForm.code.trim(), amount: Number(voucherForm.amount), maxUses: Number(voucherForm.maxUses) || 1 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat voucher.");
      setVoucherMsg(`Voucher ${data.code} berhasil dibuat.`);
      setVoucherForm({ code: "", amount: "", maxUses: "1" });
      loadVouchers();
    } catch (err) {
      setVoucherMsg(err.message);
    } finally {
      setVoucherSubmitting(false);
      setTimeout(() => setVoucherMsg(""), 3000);
    }
  }

  async function toggleVoucher(code) {
    await fetch("/api/admin/vouchers/toggle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    loadVouchers();
  }

  async function saveMarkup() {
    setSavingMarkup(true);
    setSettingsMsg("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markupPercent: Number(markupInput) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data);
      setSettingsMsg("Markup tersimpan.");
    } catch {
      setSettingsMsg("Gagal menyimpan markup.");
    } finally {
      setSavingMarkup(false);
      setTimeout(() => setSettingsMsg(""), 2500);
    }
  }

  async function toggleMaintenance() {
    setSavingMaintenance(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenance: !settings.maintenance })
      });
      const data = await res.json();
      if (res.ok) setSettings(data);
    } finally {
      setSavingMaintenance(false);
    }
  }

  async function toggleDepositProvider(key) {
    setSavingProviders(true);
    try {
      const next = { ...settings.depositProviders, [key]: !settings.depositProviders?.[key] };
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositProviders: next })
      });
      const data = await res.json();
      if (res.ok) setSettings(data);
    } finally {
      setSavingProviders(false);
    }
  }

  async function saveFeePercent(key, value) {
    setSavingProviders(true);
    try {
      const next = { ...settings.depositFeePercent, [key]: Number(value) || 0 };
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositFeePercent: next })
      });
      const data = await res.json();
      if (res.ok) setSettings(data);
    } finally {
      setSavingProviders(false);
    }
  }

  async function saveLoyalty(patch) {
    setSavingLoyalty(true);
    setLoyaltyMsg("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loyalty: patch })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data);
      setLoyaltyMsg("Pengaturan loyalitas tersimpan.");
    } catch {
      setLoyaltyMsg("Gagal menyimpan pengaturan loyalitas.");
    } finally {
      setSavingLoyalty(false);
      setTimeout(() => setLoyaltyMsg(""), 2500);
    }
  }

  async function submitBalance(e) {
    e.preventDefault();
    setBalanceMsg("");
    setBalanceSubmitting(true);
    try {
      const res = await fetch("/api/admin/users/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: balanceForm.token.trim(), amount: Number(balanceForm.amount), action: balanceAction, note: balanceForm.note.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses.");
      setBalanceMsg(`Berhasil. Saldo terbaru: ${fmtRp(data.balance)}`);
      setBalanceForm({ token: "", amount: "", note: "" });
      loadUsers();
    } catch (err) {
      setBalanceMsg(err.message);
    } finally {
      setBalanceSubmitting(false);
    }
  }

  function quickFill(token, action) {
    setBalanceAction(action);
    setBalanceForm((f) => ({ ...f, token }));
    setActiveTab("pengguna");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }

  async function suspendUser(token, suspended) {
    setSuspendMsg("");
    try {
      const res = await fetch("/api/admin/users/suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, suspended })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses.");
      setSuspendMsg(suspended ? "Akun disuspensi." : "Akun diaktifkan kembali.");
      loadUsers();
    } catch (err) {
      setSuspendMsg(err.message);
    } finally {
      setTimeout(() => setSuspendMsg(""), 3000);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-content px-4 pb-16 pt-6 sm:px-5 sm:pt-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-teal-bright">Admin Panel</p>
          <h1 className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">Dashboard Artapedia</h1>
        </div>
        <button
          onClick={logout}
          className="btn-3d rounded-lg border border-rose/40 px-4 py-2 text-sm font-medium text-rose transition-colors hover:bg-rose-soft"
        >
          Keluar
        </button>
      </div>

      {/* ── Quick stat strip ── */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total user" value={total.toLocaleString("id-ID")} />
        <StatCard label="Saldo beredar" value={fmtRp(totalBalance)} />
        <StatCard
          label="Status website"
          value={settings ? (settings.maintenance ? "Maintenance" : "Online") : "..."}
          accent={settings?.maintenance ? "text-rose" : "text-teal-bright"}
        />
        <StatCard
          label="Klaim garansi"
          value={`${warrantyClaims.filter((c) => c.status === "pending").length} menunggu`}
          accent={warrantyClaims.filter((c) => c.status === "pending").length > 0 ? "text-rose" : "text-ink"}
        />
      </div>

      {/* ── Tab navigation ── */}
      <div className="mt-5 sticky top-2 z-30 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface/95 p-1 shadow-soft backdrop-blur-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-max rounded-xl px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-ink text-bg shadow-soft"
                : "text-muted hover:bg-surface2 hover:text-ink"
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: RINGKASAN                                                */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "ringkasan" && (
        <div className="mt-5 space-y-5">
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink">Statistik 7 Hari Terakhir</h2>
            {statsLoading ? (
              <div className="mt-4 h-32 animate-pulse rounded-lg bg-surface2" />
            ) : stats ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <StatCard label="Order OTP (7 hari)" value={`${stats.totals.orderCount}`} />
                  <StatCard label="Omzet OTP (7 hari)" value={fmtRp(stats.totals.orderRevenue)} accent="text-teal-bright" />
                  <StatCard label="Order suntik (7 hari)" value={`${stats.totals.smmCount ?? 0}`} />
                  <StatCard label="Omzet suntik (7 hari)" value={fmtRp(stats.totals.smmRevenue || 0)} accent="text-teal-bright" />
                  <StatCard label="Deposit masuk (7 hari)" value={fmtRp(stats.totals.depositAmount || 0)} accent="text-success" />
                  <StatCard
                    label="Deposit per QRIS"
                    value={Object.entries(stats.depositByProvider || {}).map(([k, v]) => `${k}: ${v.count}x`).join(" · ") || "-"}
                  />
                </div>

                <p className="mt-6 text-xs font-medium text-muted">Omzet order OTP per hari</p>
                <div className="mt-2 flex items-end gap-2" style={{ height: 120 }}>
                  {stats.days.map((d) => {
                    const max = Math.max(1, ...stats.days.map((x) => x.orderRevenue));
                    const h = Math.round((d.orderRevenue / max) * 100);
                    return (
                      <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                        <div className="flex w-full flex-1 items-end">
                          <div
                            className="w-full rounded-t-md bg-gradient-to-t from-amber to-amber-bright transition-all"
                            style={{ height: `${Math.max(h, 3)}%` }}
                            title={fmtRp(d.orderRevenue)}
                          />
                        </div>
                        <span className="text-[10px] text-muted">{d.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted">Layanan paling laris</p>
                    <ul className="mt-2 space-y-1.5">
                      {stats.topServices.length === 0 && <li className="text-xs text-muted">Belum ada data.</li>}
                      {stats.topServices.map((s) => (
                        <li key={s.name} className="flex items-center justify-between text-sm text-ink">
                          <span className="truncate">{s.name}</span>
                          <span className="shrink-0 rounded-full bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber-bright">{s.count}x</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted">Negara paling laris</p>
                    <ul className="mt-2 space-y-1.5">
                      {stats.topCountries.length === 0 && <li className="text-xs text-muted">Belum ada data.</li>}
                      {stats.topCountries.map((c) => (
                        <li key={c.name} className="flex items-center justify-between text-sm text-ink">
                          <span className="truncate">{c.name}</span>
                          <span className="shrink-0 rounded-full bg-teal-soft px-2 py-0.5 text-xs font-medium text-teal-bright">{c.count}x</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted">Gagal memuat statistik.</p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: PENGGUNA                                                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "pengguna" && (
        <div className="mt-5 space-y-5">

          {/* Tambah/Kurangi Saldo */}
          <div ref={formRef} className="glow-ring rounded-2xl">
            <form onSubmit={submitBalance} className="rounded-2xl bg-surface p-5 shadow-card-3d sm:p-6">
              <h2 className="font-display text-base font-semibold text-ink">Tambah / Kurangi Saldo</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1.3fr_1fr_1.3fr_auto]">
                <input
                  value={balanceForm.token}
                  onChange={(e) => setBalanceForm((f) => ({ ...f, token: e.target.value }))}
                  placeholder="Kode akun user"
                  required
                  className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                />
                <input
                  type="number"
                  value={balanceForm.amount}
                  onChange={(e) => setBalanceForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="Nominal"
                  required
                  min="1"
                  className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                />
                <input
                  value={balanceForm.note}
                  onChange={(e) => setBalanceForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Catatan (opsional)"
                  className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBalanceAction("add")}
                    className={`btn-3d flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium sm:flex-none ${
                      balanceAction === "add" ? "border-teal bg-teal-soft text-teal-bright" : "border-line text-muted"
                    }`}
                  >
                    + Tambah
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceAction("sub")}
                    className={`btn-3d flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium sm:flex-none ${
                      balanceAction === "sub" ? "border-rose bg-rose-soft text-rose" : "border-line text-muted"
                    }`}
                  >
                    − Kurangi
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={balanceSubmitting}
                className="btn-3d mt-4 rounded-lg bg-gradient-to-r from-ink to-[#1D2A4A] px-5 py-2.5 text-sm font-medium text-white shadow-3d disabled:opacity-60"
              >
                {balanceSubmitting ? "Memproses..." : "Proses"}
              </button>
              {balanceMsg && <p className="mt-3 text-sm text-ink">{balanceMsg}</p>}
            </form>
          </div>

          {/* Daftar User */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Daftar User</h2>
                <p className="text-xs text-muted">{total} pengguna terdaftar · saldo beredar {fmtRp(totalBalance)}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadUsers()}
                  placeholder="Cari kode akun..."
                  className="w-44 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none focus:border-amber"
                />
                <button
                  onClick={() => loadUsers()}
                  className="btn-3d rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink hover:bg-surface2"
                >
                  Cari
                </button>
              </div>
            </div>
            {suspendMsg && <p className="mt-2 text-xs font-medium text-teal-bright">{suspendMsg}</p>}

            <div className="glass mt-3 overflow-x-auto rounded-2xl shadow-soft">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-3 font-medium">Kode akun</th>
                    <th className="px-4 py-3 font-medium">Saldo</th>
                    <th className="px-4 py-3 font-medium">Referral</th>
                    <th className="px-4 py-3 font-medium">Daftar</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Memuat...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Tidak ada user.</td></tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.token} className={`border-b border-line last:border-0 ${u.suspended ? "bg-rose-soft/30" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs text-ink">{u.token}{u.name ? ` · ${u.name}` : ""}</td>
                        <td className="px-4 py-3 font-medium text-ink">{fmtRp(u.balance)}</td>
                        <td className="px-4 py-3 text-xs text-muted">{u.referralCount} orang</td>
                        <td className="px-4 py-3 text-xs text-muted">{fmtDate(u.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            u.suspended ? "border-rose/40 text-rose" : "border-teal/40 text-teal-bright"
                          }`}>
                            {u.suspended ? "Suspended" : "Aktif"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => quickFill(u.token, "add")}
                              className="btn-3d rounded-md border border-teal/40 px-2 py-1 text-xs font-medium text-teal-bright hover:bg-teal-soft"
                            >
                              + Saldo
                            </button>
                            <button
                              onClick={() => quickFill(u.token, "sub")}
                              className="btn-3d rounded-md border border-rose/40 px-2 py-1 text-xs font-medium text-rose hover:bg-rose-soft"
                            >
                              − Saldo
                            </button>
                            <button
                              onClick={() => {
                                setActivityFilterToken(u.token);
                                setActivityFilterType("all");
                                setActivityPage(1);
                                // load then scroll
                                const params = new URLSearchParams({ type: "all", page: "1", token: u.token });
                                fetch(`/api/admin/activity?${params}`).then((r) => r.json()).then((d) => {
                                  setActivityLogs(Array.isArray(d.items) ? d.items : []);
                                  setActivityTotal(d.total || 0);
                                  setActivityPages(d.pages || 1);
                                });
                                document.getElementById("activity-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }}
                              className="btn-3d rounded-md border border-line px-2 py-1 text-xs font-medium text-muted hover:bg-surface2"
                            >
                              Aktivitas
                            </button>
                            <button
                              onClick={() => suspendUser(u.token, !u.suspended)}
                              className={`btn-3d rounded-md border px-2 py-1 text-xs font-medium ${
                                u.suspended
                                  ? "border-teal/40 text-teal-bright hover:bg-teal-soft"
                                  : "border-ochre/60 text-muted hover:bg-surface2"
                              }`}
                            >
                              {u.suspended ? "Aktifkan" : "Suspend"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Log Aktivitas Pengguna */}
          <div id="activity-section" className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Log Aktivitas Pengguna</h2>
                <p className="mt-0.5 text-xs text-muted">Lihat semua transaksi OTP, deposit, dan mutasi saldo setiap pengguna.</p>
              </div>
              <button
                onClick={() => loadActivityLog(1)}
                disabled={activityLoading}
                className="btn-3d rounded-lg border border-amber/50 px-3 py-2 text-xs font-bold text-amber-bright hover:bg-amber-soft disabled:opacity-50"
              >
                {activityLoading ? "Memuat…" : "Tampilkan"}
              </button>
            </div>

            {/* Filters */}
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={activityFilterToken}
                onChange={(e) => setActivityFilterToken(e.target.value)}
                placeholder="Filter token user..."
                className="min-w-[180px] flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-amber"
              />
              <div className="flex gap-1">
                {[
                  { v: "all", l: "Semua" },
                  { v: "otp", l: "OTP" },
                  { v: "deposit", l: "Deposit" },
                  { v: "balance", l: "Mutasi" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setActivityFilterType(opt.v)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                      activityFilterType === opt.v
                        ? "border-amber bg-amber text-white"
                        : "border-line bg-surface text-muted hover:border-amber/50"
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Results */}
            {activityLogs.length === 0 && !activityLoading ? (
              <p className="mt-4 text-center text-sm text-muted">Tekan "Tampilkan" untuk memuat log aktivitas.</p>
            ) : activityLoading ? (
              <div className="mt-4 space-y-2">
                {[1,2,3,4,5].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-surface2" />)}
              </div>
            ) : (
              <>
                <p className="mt-3 text-xs text-muted">{activityTotal} aktivitas ditemukan</p>
                <div className="mt-2 overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-line bg-surface2 text-left text-xs text-muted">
                        <th className="px-3 py-2.5 font-medium">Tipe</th>
                        <th className="px-3 py-2.5 font-medium">Token</th>
                        <th className="px-3 py-2.5 font-medium">Aktivitas</th>
                        <th className="px-3 py-2.5 font-medium">Detail</th>
                        <th className="px-3 py-2.5 font-medium text-right">Nominal</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">Waktu (WIB)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityLogs.map((item, i) => (
                        <tr key={i} className="border-b border-line last:border-0 hover:bg-surface2/50 transition-colors">
                          <td className="px-3 py-2.5 text-base">{item.icon}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-ink max-w-[100px] truncate">{item.token}</td>
                          <td className="px-3 py-2.5">
                            <p className="text-xs font-semibold text-ink">{item.title}</p>
                            {item.ref && <p className="text-[10px] text-muted font-mono">#{String(item.ref).slice(-10)}</p>}
                          </td>
                          <td className="px-3 py-2.5 max-w-[160px]">
                            <p className="text-xs text-muted truncate">{item.detail || "—"}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`text-xs font-bold ${
                              item.amount > 0 ? "text-teal-bright" : item.amount < 0 ? "text-rose" : "text-muted"
                            }`}>
                              {item.amount > 0 ? "+" : ""}{fmtRp(item.amount)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-muted whitespace-nowrap">{item.createdWIB}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {activityPages > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">Halaman {activityPage} dari {activityPages}</span>
                    <div className="flex gap-1.5">
                      <button
                        disabled={activityPage <= 1}
                        onClick={() => loadActivityLog(activityPage - 1)}
                        className="btn-3d rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
                      >
                        ← Prev
                      </button>
                      <button
                        disabled={activityPage >= activityPages}
                        onClick={() => loadActivityLog(activityPage + 1)}
                        className="btn-3d rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: KONTEN                                                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "konten" && (
        <div className="mt-5 space-y-5">

          {/* Broadcast */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink">Broadcast (Banner Mengambang)</h2>
            <p className="mt-1 text-xs text-muted">Pesan ini muncul mengambang di atas semua halaman untuk semua user.</p>
            <form onSubmit={submitBroadcast} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={broadcastInput}
                onChange={(e) => setBroadcastInput(e.target.value)}
                placeholder="Tulis pesan broadcast..."
                maxLength={240}
                required
                className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
              />
              <button
                type="submit"
                disabled={broadcastSubmitting}
                className="btn-3d shrink-0 rounded-lg bg-amber hover:bg-amber-bright px-4 py-2.5 text-sm font-medium text-white shadow-3d disabled:opacity-60"
              >
                {broadcastSubmitting ? "Mengirim..." : "Kirim Broadcast"}
              </button>
            </form>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-[11px] text-muted">Mulai tampil (opsional)</label>
                <input type="datetime-local" value={broadcastStart} onChange={(e) => setBroadcastStart(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-[11px] text-muted">Berhenti tampil (opsional)</label>
                <input type="datetime-local" value={broadcastEnd} onChange={(e) => setBroadcastEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-amber" />
              </div>
            </div>
            {broadcastMsg && <p className="mt-2 text-xs font-medium text-teal-bright">{broadcastMsg}</p>}
            <div className="glass mt-4 overflow-x-auto rounded-xl shadow-soft">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-2.5 font-medium">Pesan</th>
                    <th className="px-4 py-2.5 font-medium">Dibuat</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcastsLoading ? (
                    <tr><td colSpan={4} className="px-4 py-5 text-center text-muted">Memuat...</td></tr>
                  ) : broadcasts.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-5 text-center text-muted">Belum ada broadcast.</td></tr>
                  ) : (
                    broadcasts.map((b) => (
                      <tr key={b.id} className="border-b border-line last:border-0">
                        <td className="max-w-[260px] truncate px-4 py-2.5 text-ink">{b.message}</td>
                        <td className="px-4 py-2.5 text-xs text-muted">{fmtDate(b.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${b.active ? "border-teal/40 text-teal-bright" : "border-rose/30 text-rose"}`}>
                            {b.active ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => toggleBroadcast(b.id)} className="btn-3d rounded-md border border-line px-2 py-1 text-xs font-medium text-ink hover:border-amber">{b.active ? "Nonaktifkan" : "Aktifkan"}</button>
                            <button onClick={() => deleteBroadcast(b.id)} className="btn-3d rounded-md border border-rose/40 px-2 py-1 text-xs font-medium text-rose hover:bg-rose-soft">Hapus</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pengumuman */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink">Kelola Informasi (Pusat Informasi)</h2>
            <p className="mt-1 text-xs text-muted">Muncul di menu Informasi dan lonceng notifikasi di semua halaman.</p>
            <form onSubmit={submitAnnouncement} className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-[0.9fr_2fr]">
                <select value={announcementForm.category} onChange={(e) => setAnnouncementForm((f) => ({ ...f, category: e.target.value }))} className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber">
                  <option value="Informasi">Informasi</option>
                  <option value="Promo">Promo</option>
                  <option value="Penting">Penting</option>
                </select>
                <input value={announcementForm.title} onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))} placeholder="Judul pengumuman" required maxLength={120} className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <textarea value={announcementForm.body} onChange={(e) => setAnnouncementForm((f) => ({ ...f, body: e.target.value }))} placeholder="Isi pengumuman..." required rows={3} maxLength={1000} className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              <button type="submit" disabled={announcementSubmitting} className="btn-3d self-start rounded-lg bg-gradient-to-r from-teal to-teal-bright px-4 py-2.5 text-sm font-medium text-white shadow-3d disabled:opacity-60">
                {announcementSubmitting ? "Menerbitkan..." : "Terbitkan"}
              </button>
            </form>
            {announcementMsg && <p className="mt-2 text-xs font-medium text-teal-bright">{announcementMsg}</p>}
            <div className="mt-4 flex flex-col gap-2.5">
              {announcementsLoading ? (
                <p className="py-4 text-center text-sm text-muted">Memuat...</p>
              ) : announcements.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">Belum ada pengumuman.</p>
              ) : (
                announcements.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-soft text-base">{a.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{a.title}</p>
                        <span className="rounded bg-teal-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-bright">{a.category}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${a.active ? "border-teal/40 text-teal-bright" : "border-rose/30 text-rose"}`}>{a.active ? "Aktif" : "Nonaktif"}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{a.body}</p>
                      <p className="mt-1 text-[11px] text-muted">{fmtDate(a.createdAt)}</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col gap-1.5">
                      <button onClick={() => toggleAnnouncement(a.id)} className="btn-3d rounded-md border border-line px-2 py-1 text-xs font-medium text-ink hover:border-amber">{a.active ? "Nonaktifkan" : "Aktifkan"}</button>
                      <button onClick={() => deleteAnnouncement(a.id)} className="btn-3d rounded-md border border-rose/40 px-2 py-1 text-xs font-medium text-rose hover:bg-rose-soft">Hapus</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Voucher */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink">Voucher Saldo</h2>
            <form onSubmit={submitVoucher} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_0.8fr_auto]">
              <input value={voucherForm.code} onChange={(e) => setVoucherForm((f) => ({ ...f, code: e.target.value }))} placeholder="Kode (kosongkan = otomatis)" className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm uppercase text-ink outline-none focus:border-amber" />
              <input type="number" min="1" value={voucherForm.amount} onChange={(e) => setVoucherForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Nominal" required className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              <input type="number" min="1" value={voucherForm.maxUses} onChange={(e) => setVoucherForm((f) => ({ ...f, maxUses: e.target.value }))} placeholder="Kuota klaim" className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              <button type="submit" disabled={voucherSubmitting} className="btn-3d rounded-lg bg-gradient-to-r from-teal to-teal-bright px-4 py-2.5 text-sm font-medium text-white shadow-3d disabled:opacity-60">
                {voucherSubmitting ? "..." : "Buat"}
              </button>
            </form>
            {voucherMsg && <p className="mt-2 text-xs font-medium text-teal-bright">{voucherMsg}</p>}
            <div className="glass mt-4 overflow-x-auto rounded-xl shadow-soft">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-2.5 font-medium">Kode</th>
                    <th className="px-4 py-2.5 font-medium">Nominal</th>
                    <th className="px-4 py-2.5 font-medium">Klaim</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchersLoading ? (
                    <tr><td colSpan={5} className="px-4 py-5 text-center text-muted">Memuat...</td></tr>
                  ) : vouchers.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-5 text-center text-muted">Belum ada voucher.</td></tr>
                  ) : (
                    vouchers.map((v) => (
                      <tr key={v.code} className="border-b border-line last:border-0">
                        <td className="px-4 py-2.5 font-mono text-xs text-ink">{v.code}</td>
                        <td className="px-4 py-2.5 text-ink">{fmtRp(v.amount)}</td>
                        <td className="px-4 py-2.5 text-xs text-muted">{v.usedCount}/{v.maxUses}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${v.active ? "border-teal/40 text-teal-bright" : "border-rose/30 text-rose"}`}>{v.active ? "Aktif" : "Nonaktif"}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => toggleVoucher(v.code)} className="btn-3d rounded-md border border-line px-2 py-1 text-xs font-medium text-ink hover:border-amber">{v.active ? "Nonaktifkan" : "Aktifkan"}</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: TRANSAKSI                                                */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "transaksi" && (
        <div className="mt-5 space-y-5">

          {/* Klaim Garansi */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Klaim Garansi Nokos</h2>
                <p className="mt-1 text-xs text-muted">Approve = saldo dikembalikan sesuai harga beli.</p>
              </div>
              <span className="rounded-full bg-rose-soft px-3 py-1 text-xs font-semibold text-rose">
                {warrantyClaims.filter((c) => c.status === "pending").length} menunggu
              </span>
            </div>
            {warrantyMsg && <p className="mt-2 text-xs font-medium text-teal-bright">{warrantyMsg}</p>}

            {selectedScreenshot && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: "rgb(0 0 0 / 0.8)" }} onClick={() => setSelectedScreenshot(null)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedScreenshot} alt="Screenshot" className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain" />
              </div>
            )}

            <div className="glass mt-4 overflow-x-auto rounded-xl shadow-soft">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-2.5 font-medium">User</th>
                    <th className="px-4 py-2.5 font-medium">Nokos</th>
                    <th className="px-4 py-2.5 font-medium">Harga</th>
                    <th className="px-4 py-2.5 font-medium">Deskripsi</th>
                    <th className="px-4 py-2.5 font-medium">SS</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {warrantyLoading ? (
                    <tr><td colSpan={7} className="px-4 py-5 text-center text-muted">Memuat...</td></tr>
                  ) : warrantyClaims.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-5 text-center text-muted">Belum ada klaim garansi.</td></tr>
                  ) : (
                    warrantyClaims.map((c) => (
                      <tr key={c.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-ink max-w-[100px] truncate">{c.token}</td>
                        <td className="px-4 py-2.5 text-xs text-ink">
                          <div className="font-semibold">{c.serviceName}</div>
                          <div className="text-muted">{c.phoneNumber}</div>
                          <div className="font-mono text-[10px] text-muted">#{c.orderId?.slice(-10)}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-ink">{fmtRp(c.purchasePrice)}</td>
                        <td className="px-4 py-2.5 max-w-[180px]">
                          <p className="line-clamp-2 text-xs text-ink">{c.description}</p>
                          {c.adminNote && <p className="mt-0.5 text-[10px] text-muted italic">Catatan: {c.adminNote}</p>}
                        </td>
                        <td className="px-4 py-2.5">
                          {c.screenshotData ? (
                            <button onClick={() => setSelectedScreenshot(c.screenshotData)} className="rounded-md border border-line px-2 py-1 text-[10px] font-medium text-teal-bright hover:border-teal/40">Lihat</button>
                          ) : <span className="text-xs text-muted">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${c.status === "approved" ? "border-teal/40 text-teal-bright" : c.status === "rejected" ? "border-rose/30 text-rose" : "border-amber/40 text-amber-bright"}`}>
                            {c.status === "approved" ? "Disetujui" : c.status === "rejected" ? "Ditolak" : "Menunggu"}
                          </span>
                          <p className="mt-0.5 text-[10px] text-muted">{fmtDate(c.createdAt)}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {c.status === "pending" ? (
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => handleWarrantyAction(c.id, "approve")} className="btn-3d rounded-md border border-teal/40 px-2 py-1 text-xs font-medium text-teal-bright hover:bg-teal-soft">Setujui</button>
                              <button onClick={() => handleWarrantyAction(c.id, "reject")} className="btn-3d rounded-md border border-rose/40 px-2 py-1 text-xs font-medium text-rose hover:bg-rose-soft">Tolak</button>
                            </div>
                          ) : <span className="text-xs text-muted">—</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Flash Sale */}
          <div className="glass rounded-2xl p-5 shadow-soft">
            <h2 className="text-base font-bold text-ink mb-4">⚡ Manajemen Flash Sale</h2>
            <form onSubmit={createFlashSale} className="grid gap-3 sm:grid-cols-2 mb-4">
              <input value={flashSaleForm.title} onChange={(e) => setFlashSaleForm((f) => ({...f, title: e.target.value}))} placeholder="Judul flash sale" className="input text-sm" />
              <input value={flashSaleForm.discountPercent} onChange={(e) => setFlashSaleForm((f) => ({...f, discountPercent: e.target.value}))} type="number" min="1" max="90" placeholder="Diskon (%)" className="input text-sm" />
              <input value={flashSaleForm.durationHours} onChange={(e) => setFlashSaleForm((f) => ({...f, durationHours: e.target.value}))} type="number" min="1" placeholder="Durasi (jam)" className="input text-sm" />
              <input value={flashSaleForm.serviceFilter} onChange={(e) => setFlashSaleForm((f) => ({...f, serviceFilter: e.target.value}))} placeholder="Filter layanan (opsional)" className="input text-sm" />
              <button type="submit" className="sm:col-span-2 rounded-xl bg-rose py-2 text-sm font-bold text-white press">Buat Flash Sale</button>
            </form>
            {flashSaleMsg && <p className="text-xs text-teal-bright mb-3">{flashSaleMsg}</p>}
            {flashSaleLoading ? <div className="skeleton h-16 rounded-xl" /> : flashSales.length === 0 ? (
              <p className="text-sm text-muted">Belum ada flash sale.</p>
            ) : (
              <div className="space-y-2">
                {flashSales.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${s.active ? "bg-teal-bright" : "bg-rose"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">{s.title}</p>
                      <p className="text-xs text-muted">{s.discountPercent}% OFF · {s.serviceFilter || "Semua"} · Berakhir {new Date(s.endAt).toLocaleString("id-ID")}</p>
                    </div>
                    <button onClick={() => toggleFlashSale(s.id)} className="text-xs text-amber-bright border border-amber/40 rounded-lg px-2 py-1 press">{s.active ? "Nonaktif" : "Aktif"}</button>
                    <button onClick={() => deleteFlashSale(s.id)} className="text-xs text-rose border border-rose/40 rounded-lg px-2 py-1 press">Hapus</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lucky Hours */}
          <div className="glass rounded-2xl p-5 shadow-soft">
            <h2 className="text-base font-bold text-ink mb-4">⏰ Manajemen Lucky Hours</h2>
            <form onSubmit={createLuckyHour} className="grid gap-3 sm:grid-cols-2 mb-4">
              <input value={luckyHourForm.startHour} onChange={(e) => setLuckyHourForm((f) => ({...f, startHour: e.target.value}))} type="number" min="0" max="23" placeholder="Jam mulai (0-23)" className="input text-sm" />
              <input value={luckyHourForm.endHour} onChange={(e) => setLuckyHourForm((f) => ({...f, endHour: e.target.value}))} type="number" min="0" max="23" placeholder="Jam selesai (0-23)" className="input text-sm" />
              <input value={luckyHourForm.discountPercent} onChange={(e) => setLuckyHourForm((f) => ({...f, discountPercent: e.target.value}))} type="number" min="1" max="90" placeholder="Diskon (%)" className="input text-sm" />
              <input value={luckyHourForm.label} onChange={(e) => setLuckyHourForm((f) => ({...f, label: e.target.value}))} placeholder="Label (opsional)" className="input text-sm" />
              <button type="submit" className="sm:col-span-2 rounded-xl bg-amber py-2 text-sm font-bold text-white press">Tambah Lucky Hour</button>
            </form>
            {luckyHourMsg && <p className="text-xs text-teal-bright mb-3">{luckyHourMsg}</p>}
            {luckyHourLoading ? <div className="skeleton h-16 rounded-xl" /> : luckyHours.length === 0 ? (
              <p className="text-sm text-muted">Belum ada lucky hour.</p>
            ) : (
              <div className="space-y-2">
                {luckyHours.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${h.active ? "bg-amber" : "bg-muted/40"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">{h.label}</p>
                      <p className="text-xs text-muted">{h.startHour}:00 – {h.endHour}:00 · {h.discountPercent}% OFF</p>
                    </div>
                    <button onClick={() => toggleLuckyHour(h.id)} className="text-xs text-amber-bright border border-amber/40 rounded-lg px-2 py-1 press">{h.active ? "Nonaktif" : "Aktif"}</button>
                    <button onClick={() => deleteLuckyHour(h.id)} className="text-xs text-rose border border-rose/40 rounded-lg px-2 py-1 press">Hapus</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: PENGATURAN                                              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "pengaturan" && (
        <div className="mt-5 space-y-5">

          {/* Pengaturan utama */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink">Pengaturan Umum</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted">Markup harga jual OTP (%)</label>
                <div className="mt-1.5 flex gap-2">
                  <input type="number" value={markupInput} onChange={(e) => setMarkupInput(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
                  <button onClick={saveMarkup} disabled={savingMarkup} className="btn-3d shrink-0 rounded-lg bg-amber hover:bg-amber-bright px-4 py-2.5 text-sm font-medium text-white shadow-3d disabled:opacity-60">{savingMarkup ? "..." : "Simpan"}</button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted">Harga jual = harga dasar RumahOTP × (1 + markup%).</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Mode maintenance</label>
                <div className="mt-1.5 flex items-center justify-between rounded-lg border border-line bg-surface px-3.5 py-2.5">
                  <span className="text-sm text-ink">{settings?.maintenance ? "Aktif — website ditutup" : "Nonaktif — berjalan normal"}</span>
                  <button onClick={toggleMaintenance} disabled={!settings || savingMaintenance} className={`btn-3d relative h-7 w-12 shrink-0 rounded-full transition-colors ${settings?.maintenance ? "bg-rose" : "bg-teal"}`} aria-label="Toggle maintenance">
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings?.maintenance ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted">Metode deposit QRIS aktif</label>
                <div className="mt-1.5 space-y-2">
                  {[
                    { key: "simuru", label: "QRIS Simuru" },
                    { key: "pakasir", label: "QRIS Pakasir" },
                    { key: "rumahotp", label: "QRIS RumahOTP" }
                  ].map((p) => (
                    <div key={p.key} className="rounded-lg border border-line bg-surface px-3.5 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-ink">{p.label}</span>
                        <button onClick={() => toggleDepositProvider(p.key)} disabled={!settings || savingProviders} className={`btn-3d relative h-7 w-12 shrink-0 rounded-full transition-colors ${settings?.depositProviders?.[p.key] ? "bg-teal" : "bg-line"}`} aria-label={`Toggle ${p.label}`}>
                          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings?.depositProviders?.[p.key] ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-muted">Biaya admin (%)</span>
                        <input key={`${p.key}-${settings?.depositFeePercent?.[p.key] ?? 0}`} type="number" step="0.1" min="0" max="100" defaultValue={settings?.depositFeePercent?.[p.key] ?? 0} onBlur={(e) => saveFeePercent(p.key, e.target.value)} disabled={!settings || savingProviders} className="w-16 rounded-md border border-line bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-amber" />
                        <span className="text-[11px] text-muted">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {settingsMsg && <p className="mt-3 text-xs font-medium text-teal-bright">{settingsMsg}</p>}
          </div>

          {/* Loyalitas */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink">Loyalitas & Cashback</h2>
            <p className="mt-1 text-xs text-muted">Poin dari transaksi OTP sukses, cashback dari deposit, badge dari total transaksi.</p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {[
                { key: "pointsPerRupiah", label: "Poin per Rp1.000 transaksi OTP sukses", step: "0.1" },
                { key: "pointRupiahValue", label: "Nilai tukar 1 poin (Rp)", step: "1" },
                { key: "minRedeemPoints", label: "Minimal poin untuk ditukar", step: "1", min: "1" },
                { key: "cashbackDepositPercent", label: "Cashback deposit (%)", step: "0.1" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="text-xs font-medium text-muted">{field.label}</label>
                  <input
                    key={`${field.key}-${settings?.loyalty?.[field.key]}`}
                    type="number"
                    step={field.step}
                    min={field.min || "0"}
                    defaultValue={settings?.loyalty?.[field.key] ?? 0}
                    onBlur={(e) => saveLoyalty({ [field.key]: e.target.value })}
                    disabled={!settings || savingLoyalty}
                    className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-muted">Threshold badge Silver (total Rp)</label>
                <input key={`bts-${settings?.loyalty?.badgeThresholds?.silver}`} type="number" min="0" defaultValue={settings?.loyalty?.badgeThresholds?.silver ?? 0} onBlur={(e) => saveLoyalty({ badgeThresholds: { silver: e.target.value } })} disabled={!settings || savingLoyalty} className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Threshold badge Gold (total Rp)</label>
                <input key={`btg-${settings?.loyalty?.badgeThresholds?.gold}`} type="number" min="0" defaultValue={settings?.loyalty?.badgeThresholds?.gold ?? 0} onBlur={(e) => saveLoyalty({ badgeThresholds: { gold: e.target.value } })} disabled={!settings || savingLoyalty} className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
            </div>
            {loyaltyMsg && <p className="mt-3 text-xs font-medium text-teal-bright">{loyaltyMsg}</p>}
          </div>

          {/* Suntik Sosmed */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink">Suntik Sosmed (Simuru)</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-line bg-surface px-3.5 py-2.5">
                <span className="text-sm text-ink">{settings?.smm?.enabled ? "Aktif — user bisa order" : "Nonaktif"}</span>
                <button onClick={() => saveSmm({ enabled: !settings?.smm?.enabled })} disabled={!settings || savingSmm} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${settings?.smm?.enabled ? "bg-teal" : "bg-line"}`} aria-label="Toggle suntik sosmed">
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings?.smm?.enabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" step="1" value={smmMarkupInput} onChange={(e) => setSmmMarkupInput(e.target.value)} className="w-24 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-amber" />
                  <span className="text-sm text-muted">% markup</span>
                  <button onClick={() => saveSmm({ markupPercent: Number(smmMarkupInput) || 0 })} disabled={savingSmm} className="rounded-lg bg-amber px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Simpan</button>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Markup */}
          <div className="glass rounded-2xl p-5 shadow-soft">
            <h2 className="text-base font-bold text-ink mb-1">⚙️ Markup Kustom per Platform</h2>
            <p className="text-xs text-muted mb-4">Override markup untuk platform OTP tertentu (misal: gojek, tokopedia, shopee).</p>
            <form onSubmit={upsertPlatformMarkup} className="flex gap-2 mb-4 flex-wrap">
              <input value={platformMarkupForm.platform} onChange={(e) => setPlatformMarkupForm((f) => ({...f, platform: e.target.value}))} placeholder="Nama platform" className="input text-sm flex-1 min-w-[120px]" />
              <input value={platformMarkupForm.markupPercent} onChange={(e) => setPlatformMarkupForm((f) => ({...f, markupPercent: e.target.value}))} type="number" min="0" max="200" step="0.5" placeholder="Markup (%)" className="input text-sm w-28" />
              <button type="submit" className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-white press">Simpan</button>
            </form>
            {platformMarkupMsg && <p className="text-xs text-teal-bright mb-3">{platformMarkupMsg}</p>}
            {platformMarkupLoading ? <div className="skeleton h-16 rounded-xl" /> : platformMarkups.length === 0 ? (
              <p className="text-sm text-muted">Belum ada markup kustom.</p>
            ) : (
              <div className="space-y-2">
                {platformMarkups.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${m.active ? "bg-teal-bright" : "bg-muted/40"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink capitalize">{m.platform}</p>
                      <p className="text-xs text-muted">Markup: {m.markupPercent}%</p>
                    </div>
                    <button onClick={() => togglePlatformMarkup(m.id)} className="text-xs text-amber-bright border border-amber/40 rounded-lg px-2 py-1 press">{m.active ? "Nonaktif" : "Aktif"}</button>
                    <button onClick={() => deletePlatformMarkup(m.id)} className="text-xs text-rose border border-rose/40 rounded-lg px-2 py-1 press">Hapus</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: TOOLS                                                    */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "tools" && (
        <div className="mt-5 space-y-5">
          <SecuritySection />
          <ExportSection />

          {/* Blast Notifikasi */}
          <div className="glass rounded-2xl p-5 shadow-soft">
            <h2 className="text-base font-bold text-ink mb-1">📣 Blast Notifikasi</h2>
            <p className="text-xs text-muted mb-4">Kirim notifikasi ke satu atau semua pengguna langsung ke inbox mereka.</p>
            <form onSubmit={sendBlastNotif} className="space-y-3">
              <div className="flex gap-2">
                {[{ v: "all", l: "Semua User" }, { v: "single", l: "Satu User" }].map((opt) => (
                  <button key={opt.v} type="button" onClick={() => setNotifTarget(opt.v)}
                    className={`flex-1 rounded-xl py-2 text-xs font-bold border transition-colors press ${notifTarget === opt.v ? "bg-ink text-bg border-ink" : "border-line text-muted hover:border-ink/30"}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
              {notifTarget === "single" && (
                <input value={notifToken} onChange={(e) => setNotifToken(e.target.value)} placeholder="Token user" className="input text-sm w-full" />
              )}
              <select value={notifType} onChange={(e) => setNotifType(e.target.value)} className="input text-sm w-full">
                <option value="promo">Promo</option>
                <option value="reward">Reward</option>
                <option value="mission">Misi</option>
                <option value="deposit">Deposit</option>
              </select>
              <input value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} placeholder="Judul notifikasi" className="input text-sm w-full" />
              <textarea value={notifBody} onChange={(e) => setNotifBody(e.target.value)} placeholder="Isi pesan..." rows={3} className="input text-sm w-full resize-none" />
              <button type="submit" disabled={notifLoading} className="w-full rounded-xl bg-teal py-2.5 text-sm font-bold text-white press disabled:opacity-50">
                {notifLoading ? "Mengirim…" : "Kirim Notifikasi"}
              </button>
            </form>
            {notifMsg && <p className="text-xs mt-2 text-teal-bright font-semibold">{notifMsg}</p>}
          </div>

          {/* Statistik Gamifikasi */}
          <div className="glass rounded-2xl p-5 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-ink">📊 Statistik Gamifikasi</h2>
              <button onClick={loadGamStats} disabled={gamStatsLoading} className="text-xs text-amber-bright border border-amber/40 rounded-lg px-3 py-1.5 press disabled:opacity-50">
                {gamStatsLoading ? "…" : "Refresh"}
              </button>
            </div>
            {!gamStats ? (
              <p className="text-sm text-muted">Tekan Refresh untuk memuat data.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Misi Diklaim (7hr)", value: gamStats.weekly.missionsClaimed, icon: "🎯" },
                    { label: "Mystery Box (7hr)", value: gamStats.weekly.mysteryBoxOpened, icon: "🎁" },
                    { label: "Kartu Gores (7hr)", value: gamStats.weekly.scratchCardScratched, icon: "🎫" },
                    { label: "Hadiah Leaderboard", value: gamStats.weekly.weeklyPrizesClaimed, icon: "🏆" },
                    { label: "Challenge Selesai", value: gamStats.weekly.challengeCompleted, icon: "⚡" },
                    { label: "User Aktif (7hr)", value: gamStats.weekly.activeUsersWeek, icon: "👥" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-line bg-surface p-3">
                      <p className="text-lg">{s.icon}</p>
                      <p className="text-xl font-extrabold text-ink">{s.value}</p>
                      <p className="text-[10px] text-muted leading-tight">{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted">Total user: {gamStats.totalUsers} · Data per {new Date(gamStats.asOf).toLocaleString("id-ID")}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function SecuritySection() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");

  async function runScan() {
    setScanning(true);
    setMsg("");
    setResult(null);
    try {
      const res = await fetch("/api/cron/security-scan");
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setMsg(data.flagged === 0 ? "✅ Tidak ada aktivitas mencurigakan." : `⚠️ ${data.flagged} flag, ${data.autoSuspended} auto-suspend.`);
      } else {
        setMsg(data.error || "Scan gagal.");
      }
    } catch {
      setMsg("Scan gagal — cek koneksi.");
    } finally {
      setScanning(false);
      setTimeout(() => setMsg(""), 6000);
    }
  }

  return (
    <div className="glass rounded-2xl p-5 shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-ink">🛡️ Security — Auto-Ban</h2>
          <p className="text-xs text-muted mt-0.5">Deteksi spam order, deposit massal, saldo anomali, dan auto-suspend.</p>
        </div>
        <button onClick={runScan} disabled={scanning} className="rounded-xl bg-rose px-4 py-2 text-sm font-bold text-white press disabled:opacity-50 border border-rose/60">
          {scanning ? "Scanning…" : "Jalankan Scan"}
        </button>
      </div>
      {msg && <p className={`text-sm font-semibold mb-3 ${msg.startsWith("✅") ? "text-teal-bright" : "text-rose"}`}>{msg}</p>}
      {result && result.flags?.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {result.flags.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
              <span className={`text-lg ${f.severity === "critical" ? "text-rose" : f.severity === "high" ? "text-amber-bright" : "text-amber"}`}>
                {f.severity === "critical" ? "🚨" : f.severity === "high" ? "🔴" : "🟡"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-ink">{f.token}</p>
                <p className="text-xs text-muted">{f.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {result && result.flagged === 0 && (
        <div className="rounded-xl border border-teal/30 bg-teal-soft px-4 py-3">
          <p className="text-sm font-semibold text-teal-bright">Semua bersih — tidak ada aktivitas mencurigakan.</p>
        </div>
      )}
    </div>
  );
}

function ExportSection() {
  const [type, setType] = useState("transactions");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  async function doExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/admin/export?${params}`);
      if (!res.ok) { alert("Gagal export."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `artapedia-${type}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5 shadow-soft">
      <h2 className="text-base font-bold text-ink mb-1">📥 Export Data (CSV)</h2>
      <p className="text-xs text-muted mb-4">Unduh data transaksi, deposit, atau user dalam format CSV.</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {[{ v: "transactions", l: "Transaksi OTP" }, { v: "deposits", l: "Deposit" }, { v: "users", l: "User" }].map((opt) => (
          <button key={opt.v} type="button" onClick={() => setType(opt.v)}
            className={`rounded-xl border px-4 py-2 text-xs font-bold press transition-colors ${type === opt.v ? "bg-amber text-white border-amber-bright" : "bg-surface border-line text-muted hover:border-amber/50"}`}>
            {opt.l}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <div className="flex-1 min-w-[130px]">
          <label className="block text-xs font-semibold text-muted mb-1">Dari Tanggal</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input text-sm w-full" />
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className="block text-xs font-semibold text-muted mb-1">Sampai Tanggal</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input text-sm w-full" />
        </div>
      </div>
      <button onClick={doExport} disabled={loading} className="w-full rounded-xl bg-teal-bright text-white py-2.5 text-sm font-bold press disabled:opacity-50 border border-teal">
        {loading ? "Menyiapkan…" : "⬇️ Download CSV"}
      </button>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    success: ["border-teal/40 text-teal-bright", "Sukses"],
    completed: ["border-teal/40 text-teal-bright", "Selesai"],
    refund: ["border-amber/40 text-amber-bright", "Refund"],
    canceled: ["border-rose/30 text-rose", "Batal"],
    pending: ["border-amber/40 text-amber-bright", "Pending"],
    expired: ["border-rose/30 text-rose", "Expired"],
    logged: ["border-line text-muted", "Tercatat"],
  };
  const [cls, label] = map[status] || ["border-line text-muted", status || "—"];
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
}

function StatCard({ label, value, accent }) {
  return (
    <div className="glass rounded-2xl p-4 shadow-soft">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-display text-lg font-semibold ${accent || "text-ink"}`}>{value}</p>
    </div>
  );
}
