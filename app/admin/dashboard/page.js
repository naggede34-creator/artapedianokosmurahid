"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OTP_SERVERS } from "@/lib/otpServers";

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
  { id: "banner", label: "Banner", icon: "🖼️" },
  { id: "transaksi", label: "Transaksi", icon: "💳" },
  { id: "produk", label: "Produk", icon: "🛍️" },
  { id: "job", label: "Job/Saldo", icon: "💰" },
  { id: "tiket", label: "Tiket", icon: "🎫" },
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
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [transferMsg, setTransferMsg] = useState("");
  const [stockServices, setStockServices] = useState("wa,tg,gojek,shopee,dana,grab");
  const [stockBusy, setStockBusy] = useState("");
  const [stockMsg, setStockMsg] = useState("");
  const [stockPreview, setStockPreview] = useState(null);
  const [stockTarget, setStockTarget] = useState(null);
  // Katalog kode layanan asli dari tiap provider. Kodenya beda-beda per server,
  // jadi tidak bisa ditebak — harus diambil langsung dari providernya.
  const [stockCatalog, setStockCatalog] = useState(null);
  const [stockCatalogBusy, setStockCatalogBusy] = useState(false);
  const [stockCatalogQuery, setStockCatalogQuery] = useState("");

  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementForm, setAnnouncementForm] = useState({ category: "Informasi", title: "", body: "" });
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState("");

  const [warungnokos, setWarungnokos] = useState(null);

  const [savingOtpServers, setSavingOtpServers] = useState(false);
  const [serverMarkups, setServerMarkups] = useState({});
  const [otpServersMsg, setOtpServersMsg] = useState("");

  const [providerDiag, setProviderDiag] = useState(null);
  const [dibanana, setDibanana] = useState(null);
  const [providerDiagLoading, setProviderDiagLoading] = useState(false);

  const [maintenanceBtnForm, setMaintenanceBtnForm] = useState({ label: "", url: "" });
  // Judul + isi pesan yang tampil di halaman maintenance.
  const [maintenanceTextForm, setMaintenanceTextForm] = useState({ title: "", msg: "" });
  const [csForm, setCsForm] = useState("");
  // Status & kontrol webhook bot toko.
  const [botInfo, setBotInfo] = useState(null);
  const [botBusy, setBotBusy] = useState("");
  const [savingCs, setSavingCs] = useState(false);
  const [csMsg, setCsMsg] = useState("");
  const [savingMaintenanceText, setSavingMaintenanceText] = useState(false);
  const [maintenanceTextMsg, setMaintenanceTextMsg] = useState("");
  // Nama, label, keterangan, dan pesan offline tiap server nokos.
  const [serverForms, setServerForms] = useState({});
  // Nama, label, keterangan, dan estimasi waktu tiap metode deposit.
  const [depositForms, setDepositForms] = useState({});
  const [savingDepositMethod, setSavingDepositMethod] = useState(false);
  const [depositMethodMsg, setDepositMethodMsg] = useState("");
  const [savingMaintenanceBtn, setSavingMaintenanceBtn] = useState(false);
  const [maintenanceBtnMsg, setMaintenanceBtnMsg] = useState("");

  const [warrantyClaims, setWarrantyClaims] = useState([]);
  const [warrantyLoading, setWarrantyLoading] = useState(true);
  const [warrantyMsg, setWarrantyMsg] = useState("");

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

  // Products state
  const [adminProducts, setAdminProducts] = useState([]);
  const [adminProductsLoading, setAdminProductsLoading] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", description: "", price: "", category: "Umum", stock: "-1", imageUrl: "", deliveryType: "text", deliveryContent: "" });
  const [productMsg, setProductMsg] = useState("");
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [stockAddForm, setStockAddForm] = useState({ id: "", amount: "" });

  // Banner state
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannerForm, setBannerForm] = useState({ title: "", imageUrl: "", linkUrl: "", placement: "homepage", sortOrder: "0" });
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerMsg, setBannerMsg] = useState("");
  const [bannerSubmitting, setBannerSubmitting] = useState(false);

  // Tiket support state
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketMsg, setTicketMsg] = useState("");
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [ticketReply, setTicketReply] = useState("");
  const [ticketReplyLoading, setTicketReplyLoading] = useState(false);

  // Settings extended fields
  const [siteSettingsForm, setSiteSettingsForm] = useState({ siteName: "", siteUrl: "", telegramBotToken: "", telegramChatId: "", telegramChannelId: "", depositMin: "", depositMax: "" });
  const [siteSettingsMsg, setSiteSettingsMsg] = useState("");
  const [siteSettingsSubmitting, setSiteSettingsSubmitting] = useState(false);

  // Jobs state
  const [adminJobs, setAdminJobs] = useState([]);
  const [adminJobsLoading, setAdminJobsLoading] = useState(false);
  const [jobForm, setJobForm] = useState({ title: "", description: "", reward: "", maxCompletions: "0", proofType: "text", proofRequired: true, category: "Umum", imageUrl: "" });
  const [jobMsg, setJobMsg] = useState("");
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [jobSubmissions, setJobSubmissions] = useState([]);
  const [jobSubmissionsLoading, setJobSubmissionsLoading] = useState(false);
  const [jobSubFilter, setJobSubFilter] = useState("pending");
  const [jobSubMsg, setJobSubMsg] = useState("");

  // Hero Chars editor
  const DEFAULT_HERO_CHARS = [
    { emoji: "🥷", name: "Gojo",   accent: "#818cf8", glow: "#6366f1", sub: "Infinite Nokos ✨",             line: "Dengan mata tak terbatas... aku melihat nokos paling murah!" },
    { emoji: "⚡", name: "Shadow", accent: "#fcd34d", glow: "#f59e0b", sub: "Shadow Clone OTP 🌀",           line: "Seribu bayangan... semua beli OTP di Artapedia!" },
    { emoji: "🤖", name: "Cyber",  accent: "#2dd4bf", glow: "#14b8a6", sub: 'System.execute("buy_nokos") 💻', line: "Sistem optimal: nokos cepat, harga minimal, proses instan!" },
    { emoji: "🦅", name: "ARTA PEDIA SUPPORT", accent: "#FF6B1A", glow: "#2E86FF", sub: "Siap Bantu 24 Jam ✦", line: "Halo! Aku elang penjaga Arta Pedia. Ada kendala nokos atau deposit? Panggil aku~" },
  ];
  const [heroCharsForm, setHeroCharsForm] = useState(DEFAULT_HERO_CHARS);
  const [heroCharsMsg, setHeroCharsMsg] = useState("");
  const [heroCharsSaving, setHeroCharsSaving] = useState(false);

  const loadBanners = useCallback(async () => {
    setBannersLoading(true);
    try {
      const res = await fetch("/api/admin/banners");
      if (res.status === 401) return router.push("/admin/login");
      const d = await res.json();
      setBanners(Array.isArray(d.items) ? d.items : []);
    } finally { setBannersLoading(false); }
  }, [router]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/admin/support/tickets");
      if (res.status === 401) return router.push("/admin/login");
      const d = await res.json();
      setTickets(Array.isArray(d.items) ? d.items : []);
    } finally { setTicketsLoading(false); }
  }, [router]);

  async function submitBanner(e) {
    e.preventDefault(); setBannerMsg(""); setBannerSubmitting(true);
    try {
      const action = editingBanner ? "update" : "create";
      const body = { action, ...bannerForm, sortOrder: Number(bannerForm.sortOrder) || 0 };
      if (editingBanner) body.id = editingBanner;
      const res = await fetch("/api/admin/banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal.");
      setBannerMsg(editingBanner ? "Banner diperbarui!" : "Banner dibuat!");
      setBannerForm({ title: "", imageUrl: "", linkUrl: "", placement: "homepage", sortOrder: "0" });
      setEditingBanner(null);
      loadBanners();
    } catch (err) { setBannerMsg(err.message); }
    finally { setBannerSubmitting(false); setTimeout(() => setBannerMsg(""), 3000); }
  }

  async function toggleBanner(id) {
    await fetch("/api/admin/banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) });
    loadBanners();
  }

  async function deleteBanner(id) {
    if (!confirm("Hapus banner ini?")) return;
    await fetch("/api/admin/banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    loadBanners();
  }

  async function sendTicketReply(ticketId) {
    if (!ticketReply.trim()) return;
    setTicketReplyLoading(true); setTicketMsg("");
    try {
      const res = await fetch("/api/admin/support/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId, action: "reply", message: ticketReply.trim() }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal.");
      setTicketReply(""); loadTickets();
      setExpandedTicket((prev) => {
        if (!prev) return prev;
        return { ...prev, messages: [...(prev.messages || []), { from: "admin", text: ticketReply.trim(), createdAt: new Date() }], status: "answered" };
      });
    } catch (err) { setTicketMsg(err.message); }
    finally { setTicketReplyLoading(false); setTimeout(() => setTicketMsg(""), 3000); }
  }

  async function closeTicket(ticketId) {
    setTicketMsg("");
    const res = await fetch("/api/admin/support/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId, action: "close" }) });
    const d = await res.json();
    if (d.ok) { setTicketMsg("Tiket ditutup."); loadTickets(); setExpandedTicket(null); }
    else setTicketMsg(d.error || "Gagal.");
    setTimeout(() => setTicketMsg(""), 3000);
  }

  async function saveSiteSettings(e) {
    e.preventDefault(); setSiteSettingsSubmitting(true); setSiteSettingsMsg("");
    try {
      // Field teks dikirim apa adanya — termasuk saat dikosongkan, supaya admin
      // bisa menghapus isian (nilai kosong otomatis kembali ke env).
      const patch = {
        siteName: siteSettingsForm.siteName,
        siteUrl: siteSettingsForm.siteUrl,
        telegramBotToken: siteSettingsForm.telegramBotToken,
        telegramChatId: siteSettingsForm.telegramChatId,
        telegramChannelId: siteSettingsForm.telegramChannelId.trim()
      };
      // Angka hanya dikirim kalau diisi; kosong berarti "biarkan seperti sekarang".
      if (siteSettingsForm.depositMin !== "") patch.depositMin = Number(siteSettingsForm.depositMin);
      if (siteSettingsForm.depositMax !== "") patch.depositMax = Number(siteSettingsForm.depositMax);
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal.");
      setSettings(d);
      setSiteSettingsForm({ siteName: d.siteName || "", siteUrl: d.siteUrl || "", telegramBotToken: d.telegramBotToken || "", telegramChatId: d.telegramChatId || "", telegramChannelId: d.telegramChannelId || "", depositMin: String(d.depositMin || ""), depositMax: String(d.depositMax || "") });
      setSiteSettingsMsg("Pengaturan tersimpan.");
    } catch (err) { setSiteSettingsMsg(err.message); }
    finally { setSiteSettingsSubmitting(false); setTimeout(() => setSiteSettingsMsg(""), 4000); }
  }

  const loadAdminProducts = useCallback(async () => {
    setAdminProductsLoading(true);
    try {
      const res = await fetch("/api/admin/products");
      if (res.status === 401) return router.push("/admin/login");
      const d = await res.json();
      setAdminProducts(Array.isArray(d.items) ? d.items : []);
    } finally { setAdminProductsLoading(false); }
  }, [router]);

  const loadAdminJobs = useCallback(async () => {
    setAdminJobsLoading(true);
    try {
      const res = await fetch("/api/admin/jobs");
      if (res.status === 401) return router.push("/admin/login");
      const d = await res.json();
      setAdminJobs(Array.isArray(d.items) ? d.items : []);
    } finally { setAdminJobsLoading(false); }
  }, [router]);

  const loadJobSubmissions = useCallback(async (status = jobSubFilter) => {
    setJobSubmissionsLoading(true);
    try {
      const res = await fetch(`/api/admin/jobs/submissions?status=${status}`);
      if (res.ok) { const d = await res.json(); setJobSubmissions(Array.isArray(d.items) ? d.items : []); }
    } finally { setJobSubmissionsLoading(false); }
  }, [jobSubFilter]);

  async function submitProduct(e) {
    e.preventDefault(); setProductMsg(""); setProductSubmitting(true);
    try {
      const action = editingProduct ? "edit" : "create";
      const body = { action, ...productForm, price: Number(productForm.price), stock: Number(productForm.stock) };
      if (editingProduct) body.id = editingProduct;
      const res = await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal.");
      setProductMsg(editingProduct ? "Produk diperbarui!" : "Produk ditambahkan!");
      setProductForm({ name: "", description: "", price: "", category: "Umum", stock: "-1", imageUrl: "", deliveryType: "text", deliveryContent: "" });
      setEditingProduct(null);
      loadAdminProducts();
    } catch (err) { setProductMsg(err.message); }
    finally { setProductSubmitting(false); setTimeout(() => setProductMsg(""), 3000); }
  }

  async function addProductStock(e) {
    e.preventDefault();
    const res = await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add-stock", id: stockAddForm.id, amount: Number(stockAddForm.amount) }) });
    const d = await res.json();
    if (d.ok) { setProductMsg("Stok ditambahkan!"); setStockAddForm({ id: "", amount: "" }); loadAdminProducts(); }
    else setProductMsg(d.error || "Gagal.");
    setTimeout(() => setProductMsg(""), 3000);
  }

  async function toggleProduct(id) {
    await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) });
    loadAdminProducts();
  }

  async function deleteProduct(id) {
    if (!confirm("Hapus produk ini?")) return;
    await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    loadAdminProducts();
  }

  function editProductFill(p) {
    setEditingProduct(p.id);
    setProductForm({ name: p.name, description: p.description || "", price: String(p.price), category: p.category || "Umum", stock: String(p.stock ?? -1), imageUrl: p.imageUrl || "", deliveryType: p.deliveryType || "text", deliveryContent: p.deliveryContent || "" });
    document.getElementById("product-form-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submitJob(e) {
    e.preventDefault(); setJobMsg(""); setJobSubmitting(true);
    try {
      const action = editingJob ? "edit" : "create";
      const body = { action, ...jobForm, reward: Number(jobForm.reward), maxCompletions: Number(jobForm.maxCompletions) };
      if (editingJob) body.id = editingJob;
      const res = await fetch("/api/admin/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal.");
      setJobMsg(editingJob ? "Job diperbarui!" : "Job ditambahkan!");
      setJobForm({ title: "", description: "", reward: "", maxCompletions: "0", proofType: "text", proofRequired: true, category: "Umum", imageUrl: "" });
      setEditingJob(null);
      loadAdminJobs();
    } catch (err) { setJobMsg(err.message); }
    finally { setJobSubmitting(false); setTimeout(() => setJobMsg(""), 3000); }
  }

  async function toggleJob(id) {
    await fetch("/api/admin/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) });
    loadAdminJobs();
  }

  async function deleteJob(id) {
    if (!confirm("Hapus job ini?")) return;
    await fetch("/api/admin/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    loadAdminJobs();
  }

  async function reviewJobSub(id, action, reason) {
    setJobSubMsg("");
    const res = await fetch("/api/admin/jobs/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, rejectionReason: reason || "" }) });
    const d = await res.json();
    if (d.ok) { setJobSubMsg(action === "approve" ? "Disetujui & saldo dikreditkan." : "Ditolak."); loadJobSubmissions(jobSubFilter); }
    else setJobSubMsg(d.error || "Gagal.");
    setTimeout(() => setJobSubMsg(""), 3000);
  }

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

  const loadDibanana = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dibanana");
      if (res.ok) setDibanana(await res.json());
    } catch {
      setDibanana({ configured: false, balance: null, error: "Gagal memuat." });
    }
  }, []);

  const loadWarungnokos = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/warungnokos");
      if (res.ok) setWarungnokos(await res.json());
    } catch {
      setWarungnokos({ configured: false, error: "Gagal memuat." });
    }
  }, []);

  async function runProviderDiagnose(provider = "warungnokos") {
    setProviderDiagLoading(true);
    setProviderDiag(null);
    try {
      const res = await fetch(`/api/admin/warungnokos?provider=${provider}`);
      const d = await res.json();
      setProviderDiag(d);
      if (provider === "warungnokos") setWarungnokos(d);
    } catch {
      setProviderDiag({ error: "Gagal menjalankan diagnosa." });
    } finally {
      setProviderDiagLoading(false);
    }
  }

  async function toggleOtpServer(id) {
    if (!settings) return;
    setSavingOtpServers(true);
    try {
      const current = Array.isArray(settings.otpServers) ? settings.otpServers : [];
      const updated = current.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpServers: updated })
      });
      const data = await res.json();
      if (res.ok) { setSettings(data); setOtpServersMsg("Tersimpan."); }
      else setOtpServersMsg(data.error || "Gagal.");
    } finally {
      setSavingOtpServers(false);
      setTimeout(() => setOtpServersMsg(""), 2500);
    }
  }

  // Simpan nama, label, keterangan, dan estimasi waktu satu metode deposit.
  async function saveDepositMethod(key) {
    if (!settings) return;
    const form = depositForms[key];
    if (!form) return;
    setSavingDepositMethod(true);
    setDepositMethodMsg("");
    try {
      const base = Array.isArray(settings.depositMethods) ? settings.depositMethods : [];
      const updated = base.map((m) => (m.key === key ? { ...m, ...form } : m));
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositMethods: updated })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data);
      setDepositMethodMsg("Tampilan metode deposit tersimpan.");
    } catch (err) {
      setDepositMethodMsg(err.message || "Gagal menyimpan.");
    } finally {
      setSavingDepositMethod(false);
      setTimeout(() => setDepositMethodMsg(""), 3000);
    }
  }

  // action: info | set | delete
  async function botWebhook(action) {
    setBotBusy(action);
    setBotInfo(null);
    try {
      const res = await fetch(`/api/bot/setup?action=${action}`);
      const d = await res.json();

      // Setelah memasang, cek ulang ke Telegram supaya yang ditampilkan adalah
      // keadaan sebenarnya, bukan sekadar "permintaan diterima".
      if (action === "set" && !d.error) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const res2 = await fetch("/api/bot/setup?action=info");
          const d2 = await res2.json();
          setBotInfo({ ...d, cekUlang: d2 });
          return;
        } catch {}
      }
      setBotInfo(d);
    } catch {
      setBotInfo({ error: "Gagal menghubungi endpoint bot." });
    } finally {
      setBotBusy("");
    }
  }

  async function saveCs() {
    setSavingCs(true);
    setCsMsg("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csUsername: csForm })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data);
      setCsMsg("Username CS tersimpan.");
    } catch (err) {
      setCsMsg(err.message || "Gagal menyimpan.");
    } finally {
      setSavingCs(false);
      setTimeout(() => setCsMsg(""), 3000);
    }
  }

  async function saveMaintenanceText() {
    setSavingMaintenanceText(true);
    setMaintenanceTextMsg("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceTitle: maintenanceTextForm.title,
          maintenanceMsg: maintenanceTextForm.msg
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data);
      setMaintenanceTextMsg("Pesan maintenance tersimpan.");
    } catch (err) {
      setMaintenanceTextMsg(err.message || "Gagal menyimpan.");
    } finally {
      setSavingMaintenanceText(false);
      setTimeout(() => setMaintenanceTextMsg(""), 3000);
    }
  }

  // Simpan nama, label, keterangan, dan pesan offline satu server.
  async function saveServerIdentity(id) {
    if (!settings) return;
    const form = serverForms[id];
    if (!form) return;
    setSavingOtpServers(true);
    setOtpServersMsg("");
    try {
      const updated = (settings.otpServers || []).map((s) =>
        s.id === id
          ? { ...s, name: form.name, badge: form.badge, desc: form.desc, offlineMsg: form.offlineMsg }
          : s
      );
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpServers: updated })
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data);
        setOtpServersMsg("Tampilan server tersimpan.");
      } else setOtpServersMsg(data.error || "Gagal.");
    } finally {
      setSavingOtpServers(false);
      setTimeout(() => setOtpServersMsg(""), 2500);
    }
  }

  async function saveServerMarkup(id) {
    if (!settings) return;
    setSavingOtpServers(true);
    try {
      const raw = serverMarkups[id];
      const updated = (settings.otpServers || []).map((s) =>
        // Kosong = ikut markup global, bukan 0%.
        s.id === id ? { ...s, markupPercent: raw === "" || raw === undefined ? null : Number(raw) } : s
      );
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpServers: updated })
      });
      const data = await res.json();
      if (res.ok) { setSettings(data); setOtpServersMsg("Markup tersimpan."); }
      else setOtpServersMsg(data.error || "Gagal.");
    } finally {
      setSavingOtpServers(false);
      setTimeout(() => setOtpServersMsg(""), 2500);
    }
  }

  async function saveMaintenanceBtn() {
    setSavingMaintenanceBtn(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceButtonLabel: maintenanceBtnForm.label,
          maintenanceButtonUrl: maintenanceBtnForm.url
        })
      });
      const data = await res.json();
      if (res.ok) { setSettings(data); setMaintenanceBtnMsg("Tersimpan."); }
      else setMaintenanceBtnMsg(data.error || "Gagal.");
    } finally {
      setSavingMaintenanceBtn(false);
      setTimeout(() => setMaintenanceBtnMsg(""), 2500);
    }
  }

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (res.status === 401) return router.push("/admin/login");
    const data = await res.json();
    setSettings(data);
    setMarkupInput(String(data.markupPercent ?? 0));
    setSiteSettingsForm({
      siteName: data.siteName || "",
      siteUrl: data.siteUrl || "",
      telegramBotToken: data.telegramBotToken || "",
      telegramChatId: data.telegramChatId || "",
      telegramChannelId: data.telegramChannelId || "",
      depositMin: String(data.depositMin || ""),
      depositMax: String(data.depositMax || ""),
    });
    setMaintenanceBtnForm({
      label: data.maintenanceButtonLabel || "",
      url: data.maintenanceButtonUrl || "",
    });
    setMaintenanceTextForm({
      title: data.maintenanceTitle || "",
      msg: data.maintenanceMsg || "",
    });
    setCsForm(data.csUsername || "");
    setDepositForms(
      Object.fromEntries(
        (Array.isArray(data.depositMethods) ? data.depositMethods : []).map((m) => [
          m.key,
          { name: m.name || "", badge: m.badge || "", desc: m.desc || "", speed: m.speed || "" }
        ])
      )
    );
    setServerForms(
      Object.fromEntries(
        (Array.isArray(data.otpServers) ? data.otpServers : []).map((s) => [
          s.id,
          {
            name: s.name || "",
            badge: s.badge || "",
            desc: s.desc || "",
            offlineMsg: s.offlineMsg || ""
          }
        ])
      )
    );
    setServerMarkups(
      Object.fromEntries(
        (Array.isArray(data.otpServers) ? data.otpServers : []).map((s) => [
          s.id,
          s.markupPercent === null || s.markupPercent === undefined ? "" : String(s.markupPercent)
        ])
      )
    );
    if (Array.isArray(data.heroChars) && data.heroChars.length > 0) {
      setHeroCharsForm(data.heroChars);
    }
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
    loadWarungnokos();
    loadDibanana();
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
    loadBanners();
    loadTickets();
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

  async function saveTransfer(patch) {
    setSavingTransfer(true);
    setTransferMsg("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transfer: patch })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data);
      setTransferMsg("Pengaturan transfer tersimpan.");
    } catch {
      setTransferMsg("Gagal menyimpan pengaturan transfer.");
    } finally {
      setSavingTransfer(false);
      setTimeout(() => setTransferMsg(""), 2500);
    }
  }

  async function loadStockCatalog() {
    setStockCatalogBusy(true);
    setStockMsg("");
    try {
      const enabledServers = OTP_SERVERS.filter(
        (sv) => (settings?.otpServers || []).find((x) => x.id === sv.key)?.enabled !== false
      );
      const results = await Promise.all(
        enabledServers.map(async (sv) => {
          try {
            const res = await fetch(`/api/otp/services?server=${encodeURIComponent(sv.key)}`);
            const d = await res.json();
            if (!res.ok) return { server: sv.key, name: sv.name, error: d.error || "gagal", items: [] };
            const items = (d.items || [])
              .map((it) => ({
                code: String(it.service_code ?? it.service_id ?? "").trim(),
                name: String(it.service_name ?? it.name ?? "").trim()
              }))
              .filter((it) => it.code);
            return { server: sv.key, name: sv.name, items };
          } catch {
            return { server: sv.key, name: sv.name, error: "tidak bisa dihubungi", items: [] };
          }
        })
      );
      setStockCatalog(results);
      const total = results.reduce((a, r) => a + r.items.length, 0);
      if (total === 0) setStockMsg("Tidak ada kode layanan yang bisa diambil dari provider.");
    } finally {
      setStockCatalogBusy(false);
    }
  }

  // Klik kode = masukkan/keluarkan dari daftar yang akan dilaporkan.
  function toggleStockService(code) {
    setStockServices((prev) => {
      const list = prev.split(",").map((x) => x.trim()).filter(Boolean);
      const i = list.indexOf(code);
      if (i >= 0) list.splice(i, 1);
      else {
        if (list.length >= 12) return prev; // server membatasi 12 layanan per laporan
        list.push(code);
      }
      return list.join(",");
    });
  }

  async function previewStockReport() {
    setStockBusy("preview");
    setStockMsg("");
    setStockPreview(null);
    try {
      const res = await fetch(`/api/admin/stock-report?services=${encodeURIComponent(stockServices)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStockPreview(data.groups || []);
      setStockTarget({ channel: data.channel || "", source: data.channelSource, bot: data.botConfigured });
      if (!data.groups?.length) setStockMsg("Provider tidak mengembalikan data stok.");
    } catch (err) {
      setStockMsg(err.message || "Gagal mengambil pratinjau.");
    } finally {
      setStockBusy("");
    }
  }

  async function sendStockReport() {
    if (!window.confirm("Kirim info stok & harga nokos ke channel Telegram sekarang?")) return;
    setStockBusy("send");
    setStockMsg("");
    try {
      const res = await fetch("/api/admin/stock-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: stockServices })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStockMsg(`Terkirim ke channel — ${data.sent} layanan.`);
    } catch (err) {
      setStockMsg(err.message || "Gagal mengirim.");
    } finally {
      setStockBusy("");
      setTimeout(() => setStockMsg(""), 4000);
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

      {/* ── Manga Header ── */}
      <div className="manga-panel manga-halftone relative overflow-hidden rounded-2xl bg-ink px-5 py-5 mb-5"
        style={{ background: "linear-gradient(135deg, #06090f 0%, #0d1730 60%, #0a1040 100%)" }}>
        {/* Speed lines */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "repeating-linear-gradient(86deg, transparent 0, transparent 16px, rgba(255,255,255,.9) 16px, rgba(255,255,255,.9) 17px)" }} />
        {/* Accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 rounded-b-none"
          style={{ background: "linear-gradient(90deg, rgb(var(--c-blue)), rgb(var(--c-danger)), rgb(var(--c-blue)))" }} />
        <div className="relative flex items-center justify-between gap-3 z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue/20 text-sm border border-blue/30">⚡</span>
              <p className="text-xs font-black uppercase tracking-widest text-amber opacity-80">Admin Panel</p>
            </div>
            <h1 className="font-display text-xl font-black text-white sm:text-2xl tracking-tight">
              Dashboard <span style={{ color: "rgb(var(--c-blue))" }}>Artapedia</span>
            </h1>
            <p className="text-[10px] text-white/40 mt-0.5 font-mono">Control Center · {new Date().toLocaleDateString("id-ID", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })}</p>
          </div>
          <button onClick={logout}
            className="shrink-0 rounded-xl border border-rose/40 bg-rose/10 px-4 py-2 text-sm font-bold text-rose press hover:bg-rose/20 transition-colors">
            ⬅ Keluar
          </button>
        </div>
      </div>

      {/* ── Quick stat strip ── */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Total User" value={total.toLocaleString("id-ID")} icon="👥" floatClass="pop-float" />
        <StatCard label="Saldo Beredar" value={fmtRp(totalBalance)} icon="💰" accent="text-amber-bright" floatClass="pop-float-2" />
        <StatCard
          label="Status Website"
          value={settings ? (settings.maintenance ? "Maintenance" : "Online ✓") : "..."}
          icon={settings?.maintenance ? "🔧" : "🟢"}
          accent={settings?.maintenance ? "text-rose" : "text-teal-bright"}
          floatClass="pop-float-3"
        />
        <StatCard
          label="Klaim Garansi"
          value={`${warrantyClaims.filter((c) => c.status === "pending").length} menunggu`}
          icon="🛡️"
          accent={warrantyClaims.filter((c) => c.status === "pending").length > 0 ? "text-rose" : "text-ink"}
          floatClass="pop-float-4"
        />
      </div>

      {/* ── Tab navigation ── */}
      <div className="mt-4 sticky top-2 z-30 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface/95 p-1 shadow-soft backdrop-blur-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 min-w-max rounded-xl px-3 py-2 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-ink text-bg shadow-soft scale-[1.02]"
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
          {/* ── Hero Panel Karakter ── */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display text-base font-semibold text-ink">🦸 Hero Panel Karakter (Beranda)</h2>
              {heroCharsForm.length < 6 && (
                <button type="button"
                  onClick={() => setHeroCharsForm((f) => [...f, { emoji: "✨", name: "Karakter", accent: "#818cf8", glow: "#6366f1", sub: "Subtitle", line: "Dialog karakter di sini." }])}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-amber/40 text-amber-bright hover:bg-amber/10 transition-colors press">
                  + Tambah
                </button>
              )}
            </div>
            <p className="text-xs text-muted mb-4">Atur karakter yang berputar di hero panel beranda. Maks 6 karakter.</p>

            <div className="space-y-3">
              {heroCharsForm.map((c, i) => (
                <div key={i} className="rounded-2xl border border-line bg-bg p-4 relative"
                  style={{ borderLeft: `4px solid ${c.accent || "#818cf8"}` }}>
                  {/* Preview mini */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 overflow-hidden"
                      style={{ background: `${c.glow || "#6366f1"}20`, border: `2px solid ${c.accent || "#818cf8"}40` }}>
                      {c.imageSrc
                        ? <img src={c.imageSrc} alt={c.name} className="w-full h-full object-cover" />
                        : (c.emoji || "✨")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase" style={{ color: c.accent || "#818cf8" }}>{c.name || "Karakter"}</p>
                      <p className="text-xs text-muted truncate">{c.sub || "-"}</p>
                    </div>
                    <button type="button"
                      onClick={() => setHeroCharsForm((f) => f.filter((_, j) => j !== i))}
                      className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg border border-rose/30 text-rose hover:bg-rose/10 press">
                      Hapus
                    </button>
                  </div>

                  {/* Foto / Gambar Upload */}
                  <div className="mb-3 rounded-xl border border-dashed border-amber/30 bg-amber/5 p-3">
                    <p className="text-[10px] font-semibold text-amber-bright mb-2">🖼️ Foto / Gambar Karakter</p>
                    <div className="flex items-center gap-3">
                      {c.imageSrc && (
                        <div className="relative shrink-0">
                          <img src={c.imageSrc} alt="preview" className="w-14 h-14 rounded-xl object-cover border-2"
                            style={{ borderColor: `${c.accent || "#818cf8"}60` }} />
                          <button type="button"
                            onClick={() => setHeroCharsForm((f) => f.map((x, j) => j === i ? { ...x, imageSrc: undefined } : x))}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose text-white text-[10px] font-bold flex items-center justify-center">
                            ×
                          </button>
                        </div>
                      )}
                      <div className="flex-1">
                        <label className="cursor-pointer flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs font-semibold text-amber-bright hover:bg-amber/20 transition-colors">
                          📁 {c.imageSrc ? "Ganti Foto" : "Upload Foto"}
                          <input type="file" accept="image/*" className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 512 * 1024) { alert("Ukuran foto maks 500KB."); return; }
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const base64 = ev.target.result;
                                // Resize via canvas to max 200px
                                const img = new Image();
                                img.onload = () => {
                                  const canvas = document.createElement("canvas");
                                  const MAX = 200;
                                  const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
                                  canvas.width = Math.round(img.width * ratio);
                                  canvas.height = Math.round(img.height * ratio);
                                  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                                  const src = canvas.toDataURL("image/jpeg", 0.82);
                                  setHeroCharsForm((f) => f.map((x, j) => j === i ? { ...x, imageSrc: src } : x));
                                };
                                img.src = base64;
                              };
                              reader.readAsDataURL(file);
                              e.target.value = "";
                            }} />
                        </label>
                        <p className="mt-1 text-[10px] text-muted">JPG/PNG/WebP, maks 500KB. Gambar otomatis dikecilkan ke 200×200px.</p>
                        {c.imageSrc && (
                          <p className="mt-0.5 text-[10px] text-teal-bright">✓ Foto terpasang — akan gantikan emoji di beranda.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-[10px] font-medium text-muted">Emoji (jika tidak pakai foto)</label>
                      <input value={c.emoji} maxLength={8}
                        onChange={(e) => setHeroCharsForm((f) => f.map((x, j) => j === i ? { ...x, emoji: e.target.value } : x))}
                        className="mt-0.5 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-amber" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted">Nama</label>
                      <input value={c.name} maxLength={20}
                        onChange={(e) => setHeroCharsForm((f) => f.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        className="mt-0.5 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-amber" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted">Warna Accent (hex)</label>
                      <div className="flex gap-2 mt-0.5">
                        <input type="color" value={c.accent || "#818cf8"}
                          onChange={(e) => setHeroCharsForm((f) => f.map((x, j) => j === i ? { ...x, accent: e.target.value } : x))}
                          className="h-9 w-10 rounded-lg border border-line cursor-pointer" />
                        <input value={c.accent} maxLength={12}
                          onChange={(e) => setHeroCharsForm((f) => f.map((x, j) => j === i ? { ...x, accent: e.target.value } : x))}
                          className="flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-amber" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted">Warna Glow (hex)</label>
                      <div className="flex gap-2 mt-0.5">
                        <input type="color" value={c.glow || "#6366f1"}
                          onChange={(e) => setHeroCharsForm((f) => f.map((x, j) => j === i ? { ...x, glow: e.target.value } : x))}
                          className="h-9 w-10 rounded-lg border border-line cursor-pointer" />
                        <input value={c.glow} maxLength={12}
                          onChange={(e) => setHeroCharsForm((f) => f.map((x, j) => j === i ? { ...x, glow: e.target.value } : x))}
                          className="flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-amber" />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-medium text-muted">Subtitle (maks 80 karakter)</label>
                      <input value={c.sub} maxLength={80}
                        onChange={(e) => setHeroCharsForm((f) => f.map((x, j) => j === i ? { ...x, sub: e.target.value } : x))}
                        className="mt-0.5 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-amber" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-medium text-muted">Dialog / Line (maks 200 karakter)</label>
                      <textarea value={c.line} maxLength={200} rows={2}
                        onChange={(e) => setHeroCharsForm((f) => f.map((x, j) => j === i ? { ...x, line: e.target.value } : x))}
                        className="mt-0.5 w-full resize-none rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-amber" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {heroCharsMsg && <p className="mt-3 text-xs font-medium text-teal-bright">{heroCharsMsg}</p>}
            <button type="button" disabled={heroCharsSaving}
              onClick={async () => {
                setHeroCharsSaving(true); setHeroCharsMsg("");
                try {
                  const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ heroChars: heroCharsForm }) });
                  const d = await res.json();
                  if (!res.ok) throw new Error(d.error || "Gagal.");
                  setHeroCharsMsg("✓ Hero karakter tersimpan!");
                  if (Array.isArray(d.heroChars)) setHeroCharsForm(d.heroChars);
                } catch (err) { setHeroCharsMsg(err.message); }
                finally { setHeroCharsSaving(false); setTimeout(() => setHeroCharsMsg(""), 3000); }
              }}
              className="mt-4 btn-3d rounded-xl bg-amber hover:bg-amber-bright px-5 py-2.5 text-sm font-bold text-white shadow-3d disabled:opacity-60">
              {heroCharsSaving ? "Menyimpan..." : "Simpan Hero Panel"}
            </button>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: BANNER                                                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "banner" && (
        <div className="mt-5 space-y-5">
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink mb-4">
              {editingBanner ? "✏️ Edit Banner" : "➕ Buat Banner Baru"}
            </h2>
            {bannerMsg && <p className="mb-3 text-xs font-medium text-teal-bright">{bannerMsg}</p>}
            <form onSubmit={submitBanner} className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted">Judul *</label>
                <input value={bannerForm.title} onChange={(e) => setBannerForm((f) => ({...f, title: e.target.value}))} placeholder="Judul banner" required className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">URL Gambar *</label>
                <input value={bannerForm.imageUrl} onChange={(e) => setBannerForm((f) => ({...f, imageUrl: e.target.value}))} placeholder="https://..." required className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">URL Link (klik banner)</label>
                <input value={bannerForm.linkUrl} onChange={(e) => setBannerForm((f) => ({...f, linkUrl: e.target.value}))} placeholder="/otp atau https://..." className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Penempatan *</label>
                <select value={bannerForm.placement} onChange={(e) => setBannerForm((f) => ({...f, placement: e.target.value}))} className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber">
                  <option value="homepage">Homepage</option>
                  <option value="order">Halaman Order</option>
                  <option value="dashboard">Dashboard User</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Urutan (sortOrder)</label>
                <input type="number" value={bannerForm.sortOrder} onChange={(e) => setBannerForm((f) => ({...f, sortOrder: e.target.value}))} placeholder="0" className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div className="sm:col-span-2 flex gap-2.5 mt-1">
                {editingBanner && (
                  <button type="button" onClick={() => { setEditingBanner(null); setBannerForm({ title: "", imageUrl: "", linkUrl: "", placement: "homepage", sortOrder: "0" }); }} className="flex-1 rounded-xl border-2 border-line py-2.5 text-sm font-bold text-ink">Batal</button>
                )}
                <button type="submit" disabled={bannerSubmitting} className="flex-1 rounded-xl bg-amber py-2.5 text-sm font-black text-white disabled:opacity-50">
                  {bannerSubmitting ? "Menyimpan..." : editingBanner ? "Simpan" : "Buat Banner"}
                </button>
              </div>
            </form>
          </div>

          <div className="glass rounded-2xl p-5 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-ink">🖼️ Daftar Banner</h2>
              <button onClick={loadBanners} className="text-xs text-amber-bright border border-amber/40 rounded-lg px-3 py-1">Refresh</button>
            </div>
            {bannersLoading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
            ) : banners.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">Belum ada banner.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted bg-surface2">
                      <th className="px-4 py-2.5 font-medium">Gambar</th>
                      <th className="px-4 py-2.5 font-medium">Judul</th>
                      <th className="px-4 py-2.5 font-medium">Penempatan</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banners.map((b) => (
                      <tr key={b.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2.5">
                          {b.imageUrl && <img src={b.imageUrl} alt={b.title} className="h-10 w-20 rounded-lg object-cover border border-line" />}
                        </td>
                        <td className="px-4 py-2.5 text-ink font-medium max-w-[180px] truncate">{b.title}</td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted capitalize">{b.placement}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${b.active ? "border-teal/40 text-teal-bright" : "border-rose/30 text-rose"}`}>
                            {b.active ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => { setEditingBanner(b.id); setBannerForm({ title: b.title, imageUrl: b.imageUrl, linkUrl: b.linkUrl || "", placement: b.placement, sortOrder: String(b.sortOrder || 0) }); }} className="btn-3d rounded-md border border-amber/40 px-2 py-1 text-xs font-medium text-amber-bright hover:bg-amber-soft">Edit</button>
                            <button onClick={() => toggleBanner(b.id)} className="btn-3d rounded-md border border-line px-2 py-1 text-xs font-medium text-ink hover:border-amber">{b.active ? "Nonaktif" : "Aktif"}</button>
                            <button onClick={() => deleteBanner(b.id)} className="btn-3d rounded-md border border-rose/40 px-2 py-1 text-xs font-medium text-rose hover:bg-rose-soft">Hapus</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: TRANSAKSI                                                */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "transaksi" && (
        <div className="mt-5 space-y-5">

          {/* Klaim Garansi */}
          <WarrantyAdminPanel
            claims={warrantyClaims}
            loading={warrantyLoading}
            msg={warrantyMsg}
            onAction={handleWarrantyAction}
          />

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
      {/* TAB: PRODUK                                                  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "produk" && (
        <div className="mt-5 space-y-5">

          {/* Form Tambah/Edit Produk */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink mb-4">
              {editingProduct ? "✏️ Edit Produk" : "➕ Tambah Produk Baru"}
            </h2>
            {productMsg && <p className="mb-3 text-xs font-medium text-teal-bright">{productMsg}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted">Nama Produk *</label>
                <input value={productForm.name} onChange={(e) => setProductForm((f) => ({...f, name: e.target.value}))} placeholder="Nama produk" className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Harga (Rp) *</label>
                <input type="number" value={productForm.price} onChange={(e) => setProductForm((f) => ({...f, price: e.target.value}))} placeholder="10000" className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Kategori</label>
                <input value={productForm.category} onChange={(e) => setProductForm((f) => ({...f, category: e.target.value}))} placeholder="digital, game, voucher..." className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Stok (-1 = unlimited)</label>
                <input type="number" value={productForm.stock} onChange={(e) => setProductForm((f) => ({...f, stock: e.target.value}))} placeholder="-1" className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted">Deskripsi</label>
                <textarea value={productForm.description} onChange={(e) => setProductForm((f) => ({...f, description: e.target.value}))} placeholder="Deskripsi produk... (Enter untuk baris baru)" rows={4} className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
                <p className="text-[10px] text-muted mt-0.5">Tekan Enter untuk baris baru. Formatnya akan ditampilkan ke user.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">URL Gambar</label>
                <input value={productForm.imageUrl} onChange={(e) => setProductForm((f) => ({...f, imageUrl: e.target.value}))} placeholder="https://..." className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Tipe Pengiriman</label>
                <select value={productForm.deliveryType} onChange={(e) => setProductForm((f) => ({...f, deliveryType: e.target.value}))} className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber">
                  <option value="text">Teks</option>
                  <option value="image">Gambar (URL)</option>
                  <option value="file">File (URL)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted">Konten Pengiriman *</label>
                <textarea value={productForm.deliveryContent} onChange={(e) => setProductForm((f) => ({...f, deliveryContent: e.target.value}))} placeholder="Konten yang dikirim ke pembeli setelah berhasil beli..." rows={3} className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber resize-none" />
              </div>
            </div>
            <div className="mt-4 flex gap-2.5">
              {editingProduct && (
                <button onClick={() => { setEditingProduct(null); setProductForm({ name:"", description:"", price:"", category:"", stock:"-1", imageUrl:"", deliveryType:"text", deliveryContent:"" }); setProductMsg(""); }} className="flex-1 rounded-xl border-2 border-line py-2.5 text-sm font-bold text-ink press">Batal</button>
              )}
              <button onClick={submitProduct} disabled={productSubmitting} className="flex-1 rounded-xl bg-amber py-2.5 text-sm font-black text-white press hover:bg-amber-bright disabled:opacity-50" style={{ boxShadow: "0 4px 0 0 rgba(180,100,0,0.4)" }}>
                {productSubmitting ? "Menyimpan..." : editingProduct ? "Simpan Perubahan" : "Tambah Produk"}
              </button>
            </div>
          </div>

          {/* Tambah Stok */}
          <div className="glass rounded-2xl p-5 shadow-soft">
            <h2 className="text-base font-bold text-ink mb-3">📦 Tambah Stok Produk</h2>
            <div className="flex gap-2.5">
              <select value={stockAddForm.id} onChange={(e) => setStockAddForm((f) => ({...f, id: e.target.value}))} className="flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber">
                <option value="">— Pilih Produk —</option>
                {adminProducts.map((p) => <option key={p.id} value={p.id}>{p.name} (stok: {p.stock === -1 ? "∞" : p.stock})</option>)}
              </select>
              <input type="number" value={stockAddForm.amount} onChange={(e) => setStockAddForm((f) => ({...f, amount: e.target.value}))} placeholder="Jumlah" className="w-24 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              <button onClick={addProductStock} className="rounded-xl bg-teal px-4 py-2.5 text-sm font-bold text-white press">Tambah</button>
            </div>
          </div>

          {/* Daftar Produk */}
          <div className="glass rounded-2xl p-5 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-ink">🛍️ Daftar Produk</h2>
              <button onClick={loadAdminProducts} className="text-xs text-amber-bright border border-amber/40 rounded-lg px-3 py-1 press">Refresh</button>
            </div>
            {adminProductsLoading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
            ) : adminProducts.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">Belum ada produk.</p>
            ) : (
              <div className="space-y-3">
                {adminProducts.map((p) => (
                  <div key={p.id} className={`rounded-2xl border-2 p-4 transition-all ${p.active ? "border-line bg-surface" : "border-line bg-surface2 opacity-70"}`} style={{ boxShadow: "3px 3px 0 0 rgba(0,0,0,0.06)" }}>
                    <div className="flex items-start gap-3">
                      {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="h-14 w-14 shrink-0 rounded-xl object-cover border border-line" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-black text-ink">{p.name}</p>
                            <p className="text-xs text-muted mt-0.5">{p.category || "—"} · Stok: {p.stock === -1 ? "∞" : p.stock} · Terjual: {p.soldCount || 0}</p>
                          </div>
                          <p className="text-sm font-black text-amber-bright shrink-0">Rp{Number(p.price).toLocaleString("id-ID")}</p>
                        </div>
                        {p.description && <p className="text-xs text-muted mt-1 line-clamp-1">{p.description}</p>}
                        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${p.active ? "border-teal/40 text-teal-bright" : "border-line text-muted"}`}>{p.active ? "Aktif" : "Nonaktif"}</span>
                          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">{p.deliveryType}</span>
                          <div className="flex gap-1.5 ml-auto">
                            <button onClick={() => editProductFill(p)} className="text-xs text-amber-bright border border-amber/40 rounded-lg px-2 py-1 press">Edit</button>
                            <button onClick={() => toggleProduct(p.id)} className="text-xs text-teal-bright border border-teal/40 rounded-lg px-2 py-1 press">{p.active ? "Nonaktif" : "Aktif"}</button>
                            <button onClick={() => deleteProduct(p.id)} className="text-xs text-rose border border-rose/30 rounded-lg px-2 py-1 press">Hapus</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: JOB/SALDO GRATIS                                        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "job" && (
        <div className="mt-5 space-y-5">

          {/* Form Tambah/Edit Job */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink mb-4">
              {editingJob ? "✏️ Edit Job" : "➕ Tambah Job Baru"}
            </h2>
            {jobMsg && <p className="mb-3 text-xs font-medium text-teal-bright">{jobMsg}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted">Judul Job *</label>
                <input value={jobForm.title} onChange={(e) => setJobForm((f) => ({...f, title: e.target.value}))} placeholder="Judul job..." className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Reward (Rp) *</label>
                <input type="number" value={jobForm.reward} onChange={(e) => setJobForm((f) => ({...f, reward: e.target.value}))} placeholder="5000" className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Maks Penyelesaian (0 = unlimited)</label>
                <input type="number" value={jobForm.maxCompletions} onChange={(e) => setJobForm((f) => ({...f, maxCompletions: e.target.value}))} placeholder="0" className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Tipe Bukti</label>
                <select value={jobForm.proofType} onChange={(e) => setJobForm((f) => ({...f, proofType: e.target.value}))} className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber">
                  <option value="text">Teks</option>
                  <option value="image">Gambar (URL)</option>
                  <option value="url">URL</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Kategori</label>
                <input value={jobForm.category} onChange={(e) => setJobForm((f) => ({...f, category: e.target.value}))} placeholder="sosmed, review, tugas..." className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">URL Gambar</label>
                <input value={jobForm.imageUrl} onChange={(e) => setJobForm((f) => ({...f, imageUrl: e.target.value}))} placeholder="https://..." className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted">Deskripsi / Instruksi</label>
                <textarea value={jobForm.description} onChange={(e) => setJobForm((f) => ({...f, description: e.target.value}))} placeholder={"Instruksi yang harus dilakukan user...\nContoh:\n1. Follow akun @artapedia\n2. Like postingan terbaru\n3. Screenshot buktinya"} rows={5} className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber font-mono" />
                <p className="text-[10px] text-muted mt-0.5">Tekan Enter untuk baris baru. Format akan ditampilkan rapi ke user.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={jobForm.proofRequired} onChange={(e) => setJobForm((f) => ({...f, proofRequired: e.target.checked}))} className="h-4 w-4 rounded border-line accent-amber" />
                  <span className="text-sm font-medium text-ink">Bukti wajib diisi</span>
                </label>
              </div>
            </div>
            <div className="mt-4 flex gap-2.5">
              {editingJob && (
                <button onClick={() => { setEditingJob(null); setJobForm({ title:"", description:"", reward:"", maxCompletions:"0", proofRequired:true, proofType:"text", category:"", imageUrl:"" }); setJobMsg(""); }} className="flex-1 rounded-xl border-2 border-line py-2.5 text-sm font-bold text-ink press">Batal</button>
              )}
              <button onClick={submitJob} disabled={jobSubmitting} className="flex-1 rounded-xl bg-teal py-2.5 text-sm font-black text-white press hover:bg-teal-bright disabled:opacity-50" style={{ boxShadow: "0 4px 0 0 rgba(0,100,80,0.4)" }}>
                {jobSubmitting ? "Menyimpan..." : editingJob ? "Simpan Perubahan" : "Tambah Job"}
              </button>
            </div>
          </div>

          {/* Daftar Job */}
          <div className="glass rounded-2xl p-5 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-ink">💼 Daftar Job</h2>
              <button onClick={loadAdminJobs} className="text-xs text-teal-bright border border-teal/40 rounded-lg px-3 py-1 press">Refresh</button>
            </div>
            {adminJobsLoading ? (
              <div className="space-y-2">{[1,2].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
            ) : adminJobs.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">Belum ada job.</p>
            ) : (
              <div className="space-y-3">
                {adminJobs.map((j) => (
                  <div key={j.id} className={`rounded-2xl border-2 p-4 ${j.active ? "border-line bg-surface" : "border-line bg-surface2 opacity-70"}`} style={{ boxShadow: "3px 3px 0 0 rgba(0,0,0,0.06)" }}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-ink">{j.title}</p>
                        <p className="text-xs text-muted mt-0.5">
                          Reward: <span className="text-teal-bright font-bold">Rp{Number(j.reward).toLocaleString("id-ID")}</span>
                          {j.maxCompletions > 0 && ` · Kuota: ${j.completedCount || 0}/${j.maxCompletions}`}
                          {j.category && ` · ${j.category}`}
                        </p>
                        {j.description && <p className="text-xs text-muted mt-1 line-clamp-1">{j.description}</p>}
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 ${j.active ? "border-teal/40 text-teal-bright" : "border-line text-muted"}`}>{j.active ? "Aktif" : "Nonaktif"}</span>
                    </div>
                    <div className="flex gap-1.5 mt-2.5">
                      <button onClick={() => { setEditingJob(j); setJobForm({ title: j.title, description: j.description || "", reward: String(j.reward), maxCompletions: String(j.maxCompletions || 0), proofRequired: j.proofRequired !== false, proofType: j.proofType || "text", category: j.category || "", imageUrl: j.imageUrl || "" }); }} className="text-xs text-amber-bright border border-amber/40 rounded-lg px-2 py-1 press">Edit</button>
                      <button onClick={() => toggleJob(j.id)} className="text-xs text-teal-bright border border-teal/40 rounded-lg px-2 py-1 press">{j.active ? "Nonaktif" : "Aktif"}</button>
                      <button onClick={() => deleteJob(j.id)} className="text-xs text-rose border border-rose/30 rounded-lg px-2 py-1 press">Hapus</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Review Pengajuan Job */}
          <div className="glass rounded-2xl p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h2 className="text-base font-bold text-ink">📋 Review Pengajuan</h2>
              <div className="flex gap-2">
                {[["pending", "⏳ Menunggu"], ["all", "📜 Semua"]].map(([v, l]) => (
                  <button key={v} onClick={() => { setJobSubFilter(v); loadJobSubmissions(v); }} className={`rounded-xl border px-3 py-1.5 text-xs font-bold press ${jobSubFilter === v ? "bg-ink text-white border-ink" : "border-line text-ink hover:border-amber"}`}>{l}</button>
                ))}
              </div>
            </div>
            {jobSubMsg && <p className="mb-3 text-xs font-medium text-teal-bright">{jobSubMsg}</p>}
            {jobSubmissionsLoading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
            ) : jobSubmissions.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">Tidak ada pengajuan.</p>
            ) : (
              <div className="space-y-3">
                {jobSubmissions.map((s) => (
                  <div key={s.id} className="rounded-2xl border-2 border-line bg-surface p-4" style={{ boxShadow: "3px 3px 0 0 rgba(0,0,0,0.06)" }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-ink">{s.jobTitle}</p>
                        <p className="text-xs text-muted font-mono mt-0.5 truncate">Token: {s.token}</p>
                        <p className="text-xs text-muted mt-0.5">
                          Reward: <span className="text-teal-bright font-bold">Rp{Number(s.reward).toLocaleString("id-ID")}</span>
                          {" · "}{new Date(s.submittedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 ${s.status === "approved" ? "border-teal/40 text-teal-bright" : s.status === "rejected" ? "border-rose/30 text-rose" : "border-amber/40 text-amber-bright"}`}>
                        {s.status === "approved" ? "Disetujui" : s.status === "rejected" ? "Ditolak" : "Menunggu"}
                      </span>
                    </div>
                    {s.proof && (
                      <div className="mb-2 rounded-xl bg-surface2 p-2.5">
                        <p className="text-[10px] font-bold text-muted mb-1">Bukti:</p>
                        <p className="text-xs text-ink font-mono break-all line-clamp-3">{s.proof}</p>
                      </div>
                    )}
                    {s.status === "pending" && (
                      <div className="flex gap-2">
                        <button onClick={() => reviewJobSub(s.id, "approve")} className="flex-1 rounded-xl bg-teal py-2 text-xs font-black text-white press">✓ Setujui</button>
                        <div className="flex flex-1 gap-1.5">
                          <input placeholder="Alasan penolakan..." className="flex-1 min-w-0 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-rose" id={`reject-reason-${s.id}`} />
                          <button onClick={() => { const el = document.getElementById(`reject-reason-${s.id}`); reviewJobSub(s.id, "reject", el?.value || ""); }} className="rounded-xl bg-rose px-3 py-2 text-xs font-black text-white press">✗ Tolak</button>
                        </div>
                      </div>
                    )}
                    {s.status === "rejected" && s.rejectionReason && <p className="text-xs text-rose mt-1">Alasan: {s.rejectionReason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: TIKET SUPPORT                                            */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "tiket" && (
        <div className="mt-5 space-y-5">
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Tiket Dukungan</h2>
                <p className="mt-0.5 text-xs text-muted">{tickets.filter((t) => t.status === "open").length} tiket terbuka</p>
              </div>
              <button onClick={loadTickets} disabled={ticketsLoading} className="btn-3d rounded-lg border border-amber/40 px-3 py-2 text-xs font-bold text-amber-bright hover:bg-amber-soft disabled:opacity-50">
                {ticketsLoading ? "Memuat…" : "Refresh"}
              </button>
            </div>
            {ticketMsg && <p className="mb-3 text-xs font-medium text-teal-bright">{ticketMsg}</p>}

            {ticketsLoading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">Belum ada tiket.</p>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div key={t.ticketId} className="rounded-2xl border border-line bg-surface overflow-hidden">
                    <button
                      onClick={() => setExpandedTicket(expandedTicket?.ticketId === t.ticketId ? null : t)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface2 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${t.status === "open" ? "border-amber/40 text-amber-bright" : t.status === "answered" ? "border-teal/40 text-teal-bright" : "border-line text-muted"}`}>
                            {t.status === "open" ? "Terbuka" : t.status === "answered" ? "Dijawab" : "Ditutup"}
                          </span>
                          <p className="text-sm font-semibold text-ink truncate">{t.subject}</p>
                        </div>
                        <p className="text-xs text-muted mt-0.5 font-mono">{t.token} · {t.messageCount} pesan · {fmtDate(t.updatedAt)}</p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform ${expandedTicket?.ticketId === t.ticketId ? "rotate-180" : ""}`}>
                        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>

                    {expandedTicket?.ticketId === t.ticketId && (
                      <div className="border-t border-line px-4 py-4">
                        <div className="space-y-3 max-h-72 overflow-y-auto mb-4">
                          {t.messages?.map((m, i) => (
                            <div key={i} className={`flex gap-2 ${m.from === "admin" ? "flex-row-reverse" : ""}`}>
                              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${m.from === "admin" ? "bg-teal-soft text-teal-bright" : "bg-amber-soft text-amber-bright"}`}>
                                {m.from === "admin" ? "A" : "U"}
                              </span>
                              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${m.from === "admin" ? "bg-teal-soft text-teal-bright rounded-tr-sm" : "bg-surface2 text-ink rounded-tl-sm"}`}>
                                <p>{m.text}</p>
                                <p className="mt-1 text-[10px] opacity-60">{m.createdAt ? fmtDate(m.createdAt) : ""}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {t.status !== "closed" && (
                          <div className="flex gap-2 mt-3">
                            <input
                              value={expandedTicket?.ticketId === t.ticketId ? ticketReply : ""}
                              onChange={(e) => setTicketReply(e.target.value)}
                              placeholder="Tulis balasan..."
                              className="flex-1 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-teal"
                            />
                            <button onClick={() => sendTicketReply(t.ticketId)} disabled={ticketReplyLoading || !ticketReply.trim()} className="btn-3d rounded-xl bg-teal px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                              Kirim
                            </button>
                            <button onClick={() => closeTicket(t.ticketId)} className="btn-3d rounded-xl border border-rose/40 px-3 py-2.5 text-xs font-bold text-rose hover:bg-rose-soft">
                              Tutup
                            </button>
                          </div>
                        )}
                      </div>
                    )}
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
                <p className="mt-1.5 text-[11px] text-muted">Markup dasar untuk semua server. Tiap server bisa punya markup sendiri di kartu Server OTP di bawah — kalau dikosongkan, server itu memakai markup ini.</p>
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
                <label className="text-xs font-medium text-muted">Username Customer Service (Telegram)</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    value={csForm}
                    onChange={(e) => setCsForm(e.target.value)}
                    placeholder="teatlas"
                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                  />
                  <button
                    onClick={saveCs}
                    disabled={savingCs}
                    className="btn-3d shrink-0 rounded-lg bg-amber px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {savingCs ? "..." : "Simpan"}
                  </button>
                </div>
                {csMsg && <p className="mt-1.5 text-xs font-medium text-teal-bright">{csMsg}</p>}
                <p className="mt-1 text-[11px] text-muted">
                  Tanpa tanda @. Dipakai tombol Customer Service di web dan di bot Telegram.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted">Judul &amp; pesan halaman maintenance</label>
                <input
                  value={maintenanceTextForm.title}
                  onChange={(e) => setMaintenanceTextForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Judul, mis: Sedang Maintenance"
                  className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                />
                <textarea
                  rows={3}
                  value={maintenanceTextForm.msg}
                  onChange={(e) => setMaintenanceTextForm((f) => ({ ...f, msg: e.target.value }))}
                  placeholder="Pesan yang dibaca user saat web ditutup. Boleh beberapa baris."
                  className="mt-2 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                />
                <button
                  onClick={saveMaintenanceText}
                  disabled={savingMaintenanceText}
                  className="btn-3d mt-2 rounded-lg bg-amber px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {savingMaintenanceText ? "..." : "Simpan pesan"}
                </button>
                {maintenanceTextMsg && <p className="mt-1.5 text-xs font-medium text-teal-bright">{maintenanceTextMsg}</p>}
                <p className="mt-1 text-[11px] text-muted">
                  Pesan ini tampil saat mode maintenance dinyalakan. Baris baru ikut terlihat apa adanya.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted">Tombol di halaman maintenance (opsional)</label>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input
                    value={maintenanceBtnForm.label}
                    onChange={(e) => setMaintenanceBtnForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Label tombol, mis: Hubungi Admin"
                    className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                  />
                  <input
                    value={maintenanceBtnForm.url}
                    onChange={(e) => setMaintenanceBtnForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="URL tombol, mis: https://t.me/admin"
                    className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                  />
                  <button onClick={saveMaintenanceBtn} disabled={savingMaintenanceBtn} className="btn-3d shrink-0 rounded-lg bg-amber px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                    {savingMaintenanceBtn ? "..." : "Simpan"}
                  </button>
                </div>
                {maintenanceBtnMsg && <p className="mt-1.5 text-xs font-medium text-teal-bright">{maintenanceBtnMsg}</p>}
                <p className="mt-1 text-[11px] text-muted">Kosongkan label untuk menyembunyikan tombol.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted">Metode deposit QRIS</label>
                <p className="mt-1 text-[11px] text-muted">
                  Nama, label, dan keterangan di bawah ini yang dilihat user saat memilih metode pembayaran.
                </p>
                <div className="mt-2 space-y-2">
                  {(settings?.depositMethods || []).map((p) => {
                    const on = !!settings?.depositProviders?.[p.key];
                    const form = depositForms[p.key] || {};
                    const set = (field) => (e) =>
                      setDepositForms((f) => ({ ...f, [p.key]: { ...f[p.key], [field]: e.target.value } }));
                    return (
                      <div key={p.key} className="rounded-lg border border-line bg-surface px-3.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-ink">{form.name || p.name}</span>
                            <span className="ml-2 text-[11px] text-muted">{on ? "Aktif" : "Nonaktif"}</span>
                          </div>
                          <button
                            onClick={() => toggleDepositProvider(p.key)}
                            disabled={!settings || savingProviders}
                            className={`btn-3d relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-teal" : "bg-line"}`}
                            aria-label={`Toggle ${p.name}`}
                          >
                            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </div>

                        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="text-[11px] font-medium text-muted">Nama metode</label>
                            <input
                              value={form.name ?? ""}
                              onChange={set("name")}
                              placeholder={p.key}
                              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-amber"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-muted">Label (kosong = tanpa label)</label>
                            <input
                              value={form.badge ?? ""}
                              onChange={set("badge")}
                              placeholder="mis: TERCEPAT, RESMI, PALING LARIS"
                              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-amber"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-muted">Estimasi waktu</label>
                            <input
                              value={form.speed ?? ""}
                              onChange={set("speed")}
                              placeholder="mis: ± 30 detik"
                              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-amber"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-muted">Biaya admin (%)</label>
                            <input
                              key={`${p.key}-${settings?.depositFeePercent?.[p.key] ?? 0}`}
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              defaultValue={settings?.depositFeePercent?.[p.key] ?? 0}
                              onBlur={(e) => saveFeePercent(p.key, e.target.value)}
                              disabled={!settings || savingProviders}
                              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-amber"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-medium text-muted">Keterangan singkat</label>
                            <textarea
                              rows={2}
                              value={form.desc ?? ""}
                              onChange={set("desc")}
                              placeholder="mis: Semua e-wallet & m-banking, otomatis 24 jam"
                              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-amber"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <button
                              onClick={() => saveDepositMethod(p.key)}
                              disabled={savingDepositMethod}
                              className="btn-3d rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                            >
                              Simpan tampilan metode
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {depositMethodMsg && (
                  <p className="mt-2 text-xs font-medium text-teal-bright">{depositMethodMsg}</p>
                )}
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

          {/* Info stok & harga ke channel */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink">Info Stok &amp; Harga ke Channel</h2>
            <p className="mt-1 text-xs text-muted">
              Kirim ringkasan harga jual (sudah termasuk markup) dan sisa stok nomor Indonesia
              dari semua server aktif ke channel Telegram. Otomatis terkirim 4x sehari lewat cron,
              atau kirim manual dari sini.
            </p>

            <label className="mt-4 block text-xs font-medium text-muted">Kode layanan (pisahkan dengan koma)</label>
            <input
              value={stockServices}
              onChange={(e) => setStockServices(e.target.value)}
              placeholder="wa,tg,gojek,shopee"
              className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={loadStockCatalog}
                disabled={stockCatalogBusy}
                className="btn-3d rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink disabled:opacity-60"
              >
                {stockCatalogBusy ? "Mengambil..." : "Lihat semua kode layanan"}
              </button>
              <button
                onClick={previewStockReport}
                disabled={!!stockBusy}
                className="btn-3d rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink disabled:opacity-60"
              >
                {stockBusy === "preview" ? "Memuat..." : "Pratinjau"}
              </button>
              <button
                onClick={sendStockReport}
                disabled={!!stockBusy}
                className="btn-3d rounded-lg bg-amber px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {stockBusy === "send" ? "Mengirim..." : "Kirim ke Channel"}
              </button>
            </div>

            {stockCatalog && (
              <div className="mt-4 rounded-lg border border-line bg-surface p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-ink">
                    Kode layanan dari provider ({stockCatalog.reduce((a, r) => a + r.items.length, 0)} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      value={stockCatalogQuery}
                      onChange={(e) => setStockCatalogQuery(e.target.value)}
                      placeholder="Cari: whatsapp, shopee…"
                      className="w-44 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-ink outline-none focus:border-amber"
                    />
                    <button
                      onClick={() => setStockCatalog(null)}
                      className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-muted"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  Klik kode untuk memasukkannya ke daftar laporan (maksimal 12). Tiap provider punya
                  kode sendiri, jadi kode yang sama belum tentu ada di semua server.
                </p>

                {stockCatalog.map((grp) => {
                  const q = stockCatalogQuery.trim().toLowerCase();
                  const items = q
                    ? grp.items.filter((it) => it.code.toLowerCase().includes(q) || it.name.toLowerCase().includes(q))
                    : grp.items;
                  return (
                    <div key={grp.server} className="mt-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                        {grp.name}
                        <span className="ml-1.5 font-normal normal-case opacity-70">
                          {grp.error ? `— ${grp.error}` : `— ${items.length} layanan`}
                        </span>
                      </p>
                      {items.length > 0 && (
                        <div className="mt-1.5 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                          {items.map((it) => {
                            const on = stockServices
                              .split(",")
                              .map((x) => x.trim())
                              .includes(it.code);
                            return (
                              <button
                                key={`${grp.server}-${it.code}`}
                                onClick={() => toggleStockService(it.code)}
                                title={it.name}
                                className={`rounded-lg border px-2 py-1 font-mono text-[11px] transition-colors ${
                                  on
                                    ? "border-amber bg-amber-soft font-bold text-amber-bright"
                                    : "border-line bg-bg text-ink hover:border-amber/50"
                                }`}
                              >
                                {it.code}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {stockPreview && stockPreview.length > 0 && (
              <div className="mt-3 space-y-2">
                {stockPreview.map((g) => (
                  <div key={g.service} className="rounded-lg border border-line bg-surface px-3.5 py-2.5">
                    <p className="text-xs font-bold uppercase text-ink">{g.service}</p>
                    <ul className="mt-1 space-y-0.5">
                      {g.rows.map((r) => (
                        <li key={`${g.service}-${r.server}`} className="flex justify-between text-[11px] text-muted">
                          <span>{r.server}</span>
                          <span className="tabular-nums text-ink">
                            Rp{Number(r.price).toLocaleString("id-ID")} · stok {r.stock ?? "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            {stockTarget && (
              <p
                className={`mt-3 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
                  stockTarget.channel && stockTarget.bot
                    ? "border-line bg-surface text-muted"
                    : "border-rose/40 bg-rose-soft text-rose"
                }`}
              >
                {stockTarget.channel
                  ? `Akan dikirim ke channel ${stockTarget.channel} (dari ${stockTarget.source}).`
                  : "Channel ID belum tersimpan. Isi di Pengaturan Situs lalu tekan Simpan."}
                {stockTarget.channel && !stockTarget.bot ? " Tapi bot token masih kosong." : ""}
              </p>
            )}
            {stockMsg && <p className="mt-3 text-xs font-medium text-teal-bright">{stockMsg}</p>}
          </div>

          {/* Bot Telegram toko */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink">Bot Telegram Toko</h2>
            <p className="mt-1 text-xs text-muted">
              Bot tempat pembeli order nokos &amp; deposit. Saldonya sama dengan di web. Pasang webhook
              sekali di sini — tidak perlu membuka URL manual.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => botWebhook("info")}
                disabled={!!botBusy}
                className="btn-3d rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink disabled:opacity-60"
              >
                {botBusy === "info" ? "Mengecek..." : "Cek Status"}
              </button>
              <button
                onClick={() => botWebhook("set")}
                disabled={!!botBusy}
                className="btn-3d rounded-lg bg-amber px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {botBusy === "set" ? "Memasang..." : "Pasang Webhook"}
              </button>
              <button
                onClick={() => botWebhook("diagnosa")}
                disabled={!!botBusy}
                className="btn-3d rounded-lg border border-blue/40 bg-blue-soft px-3.5 py-2 text-xs font-semibold text-blue-bright disabled:opacity-60"
              >
                {botBusy === "diagnosa" ? "Menganalisa..." : "Diagnosa Mendalam"}
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Lepas webhook? Bot akan berhenti merespons sampai dipasang lagi.")) {
                    botWebhook("delete");
                  }
                }}
                disabled={!!botBusy}
                className="btn-3d rounded-lg border border-rose/40 bg-rose-soft px-3.5 py-2 text-xs font-semibold text-rose disabled:opacity-60"
              >
                {botBusy === "delete" ? "Melepas..." : "Lepas Webhook"}
              </button>
            </div>

            {botInfo && (
              <div className="mt-3">
                {botInfo.error ? (
                  <div className="rounded-lg border border-rose/40 bg-rose-soft p-3">
                    <p className="text-xs font-bold text-rose">{botInfo.error}</p>
                    {botInfo.telegram && (
                      <p className="mt-1 text-[11px] text-muted">Telegram: {botInfo.telegram}</p>
                    )}
                    {botInfo.hint && <p className="mt-1 text-[11px] text-muted">{botInfo.hint}</p>}
                    {Array.isArray(botInfo.langkah) && (
                      <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-[11px] text-muted">
                        {botInfo.langkah.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-line bg-surface p-3">
                    {botInfo.bot?.username && (
                      <p className="text-xs font-bold text-ink">
                        🤖 @{botInfo.bot.username}
                        {botInfo.verifikasi ? (
                          <span
                            className={
                              botInfo.verifikasi === "terpasang" ? " text-success" : " text-warn"
                            }
                          >
                            {" · "}
                            {botInfo.verifikasi}
                          </span>
                        ) : null}
                      </p>
                    )}
                    {botInfo.webhook && (
                      <p className="mt-1 break-all text-[11px] text-muted">Webhook: {botInfo.webhook}</p>
                    )}
                    {botInfo.webhookTersimpan && botInfo.webhookTersimpan !== botInfo.webhook && (
                      <p className="mt-0.5 break-all text-[11px] text-muted">
                        Tersimpan di Telegram: {botInfo.webhookTersimpan}
                      </p>
                    )}
                    {botInfo.saran && (
                      <p className="mt-1.5 rounded-md bg-surface2 px-2 py-1.5 text-[11px] leading-relaxed text-muted">
                        {botInfo.saran}
                      </p>
                    )}
                    {typeof botInfo.pendingUpdates === "number" && botInfo.pendingUpdates > 0 && (
                      <p className="mt-1 text-[11px] text-warn">
                        {botInfo.pendingUpdates} update menunggu diproses.
                      </p>
                    )}
                    {botInfo.lastError && (
                      <p className="mt-1 text-[11px] font-medium text-rose">
                        Error terakhir dari Telegram: {botInfo.lastError}
                      </p>
                    )}
                    {botInfo.catatan && (
                      <p className="mt-1 text-[11px] font-medium text-warn">{botInfo.catatan}</p>
                    )}
                    {botInfo.peringatanSecret && (
                      <p className="mt-1.5 rounded-md border border-warn/40 bg-warn-soft px-2 py-1.5 text-[11px] leading-relaxed text-warn">
                        {botInfo.peringatanSecret}
                      </p>
                    )}
                    {botInfo.telegram && (
                      <p className="mt-1 text-[11px] text-muted">
                        Jawaban Telegram: <span className="font-mono">{String(botInfo.telegram)}</span>
                      </p>
                    )}
                    {botInfo.cekUlang && (
                      <p
                        className={`mt-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold ${
                          botInfo.cekUlang.verifikasi === "terpasang"
                            ? "bg-success-soft text-success"
                            : "bg-rose-soft text-rose"
                        }`}
                      >
                        Cek ulang: {botInfo.cekUlang.verifikasi} · {botInfo.cekUlang.webhook}
                        {botInfo.cekUlang.lastError ? ` · error: ${botInfo.cekUlang.lastError}` : ""}
                      </p>
                    )}
                    {Array.isArray(botInfo.langkah) && (
                      <div className="mt-2 rounded-md bg-surface2 p-2">
                        {botInfo.langkah.map((l) => (
                          <p key={l.saat} className="break-all text-[11px] text-muted">
                            <span className="font-semibold text-ink">{l.saat}:</span> {l.url}
                            {l.pending != null ? ` · ${l.pending} pending` : ""}
                            {l.lastError ? ` · ${l.lastError}` : ""}
                          </p>
                        ))}
                      </div>
                    )}
                    {botInfo.kesimpulan && (
                      <p className="mt-2 rounded-md border border-amber/40 bg-amber-soft px-2 py-1.5 text-[11px] font-semibold leading-relaxed text-amber-bright">
                        {botInfo.kesimpulan}
                      </p>
                    )}
                    {botInfo.langkahSelanjutnya && (
                      <p className="mt-1.5 text-[11px] font-semibold text-teal-bright">
                        {botInfo.langkahSelanjutnya}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Transfer saldo antar pengguna */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Transfer Saldo Antar Pengguna</h2>
                <p className="mt-1 text-xs text-muted">
                  Matikan kalau tidak mau user saling kirim saldo. Biaya admin dipotong dari pengirim
                  dan jadi pendapatan web — penerima tetap dapat nominal penuh.
                </p>
              </div>
              <button
                onClick={() => saveTransfer({ enabled: !(settings?.transfer?.enabled !== false) })}
                disabled={!settings || savingTransfer}
                className={`btn-3d relative h-7 w-12 shrink-0 rounded-full transition-colors ${settings?.transfer?.enabled !== false ? "bg-teal" : "bg-line"}`}
                aria-label="Toggle transfer saldo"
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings?.transfer?.enabled !== false ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted">Biaya admin (%)</label>
                <input
                  key={`tfp-${settings?.transfer?.feePercent}`}
                  type="number" min="0" max="50" step="0.1"
                  defaultValue={settings?.transfer?.feePercent ?? 0}
                  onBlur={(e) => saveTransfer({ feePercent: e.target.value })}
                  disabled={!settings || savingTransfer}
                  className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Biaya admin tetap (Rp)</label>
                <input
                  key={`tff-${settings?.transfer?.feeFlat}`}
                  type="number" min="0" step="100"
                  defaultValue={settings?.transfer?.feeFlat ?? 0}
                  onBlur={(e) => saveTransfer({ feeFlat: e.target.value })}
                  disabled={!settings || savingTransfer}
                  className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Minimal transfer (Rp)</label>
                <input
                  key={`tfmin-${settings?.transfer?.minAmount}`}
                  type="number" min="1" step="500"
                  defaultValue={settings?.transfer?.minAmount ?? 1000}
                  onBlur={(e) => saveTransfer({ minAmount: e.target.value })}
                  disabled={!settings || savingTransfer}
                  className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Maksimal transfer (Rp, 0 = bebas)</label>
                <input
                  key={`tfmax-${settings?.transfer?.maxAmount}`}
                  type="number" min="0" step="1000"
                  defaultValue={settings?.transfer?.maxAmount ?? 0}
                  onBlur={(e) => saveTransfer({ maxAmount: e.target.value })}
                  disabled={!settings || savingTransfer}
                  className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
                />
              </div>
            </div>

            <p className="mt-3 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[11px] leading-relaxed text-muted">
              {(() => {
                const t = settings?.transfer || {};
                const pct = Number(t.feePercent) || 0;
                const flat = Number(t.feeFlat) || 0;
                if (pct <= 0 && flat <= 0) return "Belum ada biaya admin — transfer gratis. Isi persen atau nominal tetap supaya tiap transfer menghasilkan untung.";
                const fee = Math.ceil((50000 * pct) / 100) + flat;
                return `Contoh: user transfer Rp50.000 → dipotong Rp${(50000 + fee).toLocaleString("id-ID")}, penerima dapat Rp50.000, untung kamu Rp${fee.toLocaleString("id-ID")}.`;
              })()}
            </p>
            {transferMsg && <p className="mt-3 text-xs font-medium text-teal-bright">{transferMsg}</p>}
          </div>

          {/* Server OTP */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink">Server OTP</h2>
            <p className="mt-1 text-xs text-muted">Aktifkan/nonaktifkan server yang muncul saat user beli nomor, dan atur markup masing-masing. Kosongkan markup untuk mengikuti markup global.</p>
            <div className="mt-4 space-y-2">
              {(settings?.otpServers || []).map((srv) => (
                <div key={srv.id} className="rounded-lg border border-line bg-surface px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium text-ink">{srv.name}</span>
                      <span className="ml-2 text-[11px] text-muted">{srv.enabled ? "Aktif" : "Nonaktif"}</span>
                    </div>
                    <button
                      onClick={() => toggleOtpServer(srv.id)}
                      disabled={!settings || savingOtpServers}
                      className={`btn-3d relative h-7 w-12 shrink-0 rounded-full transition-colors ${srv.enabled ? "bg-teal" : "bg-line"}`}
                      aria-label={`Toggle ${srv.name}`}
                    >
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${srv.enabled ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                  {/* Nama, label, dan keterangan yang dilihat user saat memilih server. */}
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-medium text-muted">Nama server</label>
                      <input
                        value={serverForms[srv.id]?.name ?? ""}
                        onChange={(e) =>
                          setServerForms((f) => ({ ...f, [srv.id]: { ...f[srv.id], name: e.target.value } }))
                        }
                        placeholder={srv.id}
                        className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-amber"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted">Label (kosong = tanpa label)</label>
                      <input
                        value={serverForms[srv.id]?.badge ?? ""}
                        onChange={(e) =>
                          setServerForms((f) => ({ ...f, [srv.id]: { ...f[srv.id], badge: e.target.value } }))
                        }
                        placeholder="mis: Utama, Murah, Fast"
                        className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-amber"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-medium text-muted">Keterangan singkat</label>
                      <textarea
                        rows={2}
                        value={serverForms[srv.id]?.desc ?? ""}
                        onChange={(e) =>
                          setServerForms((f) => ({ ...f, [srv.id]: { ...f[srv.id], desc: e.target.value } }))
                        }
                        placeholder="Kalimat yang tampil di bawah nama server"
                        className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-amber"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-medium text-muted">
                        Pesan saat server ini dimatikan (kosong = pesan bawaan)
                      </label>
                      <textarea
                        rows={2}
                        value={serverForms[srv.id]?.offlineMsg ?? ""}
                        onChange={(e) =>
                          setServerForms((f) => ({ ...f, [srv.id]: { ...f[srv.id], offlineMsg: e.target.value } }))
                        }
                        placeholder="mis: Server sedang perbaikan, pakai Server Plus dulu ya"
                        className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-amber"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        onClick={() => saveServerIdentity(srv.id)}
                        disabled={savingOtpServers}
                        className="btn-3d rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                      >
                        Simpan tampilan server
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={serverMarkups[srv.id] ?? ""}
                      onChange={(e) => setServerMarkups((m) => ({ ...m, [srv.id]: e.target.value }))}
                      placeholder="ikut global"
                      className="w-28 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-amber"
                    />
                    <span className="text-xs text-muted">% markup</span>
                    <button
                      onClick={() => saveServerMarkup(srv.id)}
                      disabled={savingOtpServers}
                      className="rounded-lg bg-amber px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Simpan
                    </button>
                    {/* Contoh nyata supaya admin langsung lihat efek markup ke harga jual. */}
                    <span className="text-[11px] text-muted">
                      {(() => {
                        const raw = serverMarkups[srv.id];
                        const useGlobal = raw === "" || raw === undefined;
                        const pct = Number(useGlobal ? settings?.markupPercent : raw);
                        if (!Number.isFinite(pct) || pct < 0) return null;
                        const jual = Math.ceil(5000 * (1 + pct / 100));
                        return `contoh: modal Rp5.000 → jual Rp${jual.toLocaleString("id-ID")}${useGlobal ? " (ikut global)" : ""}`;
                      })()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {otpServersMsg && <p className="mt-3 text-xs font-medium text-teal-bright">{otpServersMsg}</p>}

            <div className="mt-4 rounded-lg border border-line bg-surface px-3.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-ink">Koneksi WarungNokos</span>
                  <span className="ml-2 text-[11px] text-muted">
                    {warungnokos == null
                      ? "memuat..."
                      : warungnokos.configured === false
                      ? "WARUNGNOKOS_APIKEY belum diisi"
                      : warungnokos.profile?.balance != null
                      ? `saldo Rp${Number(warungnokos.profile.balance).toLocaleString("id-ID")}`
                      : warungnokos.profile?.error || warungnokos.error || "gagal cek"}
                  </span>
                </div>
                <button onClick={() => runProviderDiagnose("warungnokos")} disabled={providerDiagLoading} className="btn-ghost text-xs">
                  {providerDiagLoading ? "Mengecek..." : "Diagnosa koneksi"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <div>
                  <span className="text-sm font-medium text-ink">Koneksi dibanana</span>
                  <span className="ml-2 text-[11px] text-muted">
                    {dibanana == null
                      ? "memuat..."
                      : dibanana.configured === false
                      ? "API key belum diisi"
                      : dibanana.balance != null
                      ? `saldo Rp${Number(dibanana.balance).toLocaleString("id-ID")}`
                      : dibanana.error || "gagal cek"}
                  </span>
                </div>
                <button onClick={() => runProviderDiagnose("dibanana")} disabled={providerDiagLoading} className="btn-ghost text-xs">
                  {providerDiagLoading ? "Mengecek..." : "Diagnosa koneksi"}
                </button>
              </div>
              {providerDiag && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-ink">{providerDiag.verdict || providerDiag.error}</p>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-surface2 p-2.5 text-[10px] leading-relaxed text-muted">
                    {JSON.stringify(providerDiag.checks ?? providerDiag, null, 1)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Pengaturan Situs */}
          <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-base font-semibold text-ink">🌐 Pengaturan Situs &amp; Env</h2>
            <p className="mt-1 text-xs text-muted">Override variabel environment langsung dari dashboard — tidak perlu redeploy. Kosongkan untuk kembali ke nilai env Vercel.</p>
            <form onSubmit={saveSiteSettings}>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted">Nama Situs</label>
                  <input value={siteSettingsForm.siteName} onChange={(e) => setSiteSettingsForm((f) => ({ ...f, siteName: e.target.value }))} placeholder="Nokos Murah (dari env)" className="mt-1.5 input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted">URL Situs</label>
                  <input value={siteSettingsForm.siteUrl} onChange={(e) => setSiteSettingsForm((f) => ({ ...f, siteUrl: e.target.value }))} placeholder="https://... (dari env)" className="mt-1.5 input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted">Telegram Bot Token</label>
                  <input type="password" value={siteSettingsForm.telegramBotToken} onChange={(e) => setSiteSettingsForm((f) => ({ ...f, telegramBotToken: e.target.value }))} placeholder="••• (dari env)" className="mt-1.5 input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted">Telegram Chat ID <span className="text-rose text-xs">(admin notif)</span></label>
                  <input value={siteSettingsForm.telegramChatId} onChange={(e) => setSiteSettingsForm((f) => ({ ...f, telegramChatId: e.target.value }))} placeholder="-100... (dari env)" className="mt-1.5 input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted">Telegram Channel ID <span className="text-amber text-xs">(notif user baru)</span></label>
                  <input value={siteSettingsForm.telegramChannelId} onChange={(e) => setSiteSettingsForm((f) => ({ ...f, telegramChannelId: e.target.value }))} placeholder="-100... channel ID (env TELEGRAM_CHANNEL_ID)" className="mt-1.5 input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted">Min Deposit (Rp)</label>
                  <input type="number" min="1" value={siteSettingsForm.depositMin} onChange={(e) => setSiteSettingsForm((f) => ({ ...f, depositMin: e.target.value }))} placeholder="2000 (dari env)" className="mt-1.5 input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted">Max Deposit (Rp)</label>
                  <input type="number" min="1" value={siteSettingsForm.depositMax} onChange={(e) => setSiteSettingsForm((f) => ({ ...f, depositMax: e.target.value }))} placeholder="1000000 (dari env)" className="mt-1.5 input w-full text-sm" />
                </div>
              </div>
              {siteSettingsMsg && <p className="mt-3 text-xs font-medium text-teal-bright">{siteSettingsMsg}</p>}
              <button type="submit" disabled={siteSettingsSubmitting} className="mt-4 rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-bg press disabled:opacity-60">
                {siteSettingsSubmitting ? "Menyimpan…" : "Simpan Pengaturan Situs"}
              </button>
            </form>
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

function WarrantyAdminPanel({ claims, loading, msg, onAction }) {
  const [previewSrc, setPreviewSrc] = useState(null);
  const [notifTarget, setNotifTarget] = useState(null);
  const [notifMsg, setNotifMsg] = useState({ title: "", body: "" });
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifDone, setNotifDone] = useState("");

  async function sendQuickNotif() {
    if (!notifTarget || !notifMsg.title) return;
    setSendingNotif(true);
    try {
      const res = await fetch("/api/admin/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "single", token: notifTarget, type: "info", title: notifMsg.title, body: notifMsg.body }),
      });
      const d = await res.json();
      setNotifDone(d.ok ? "✅ Notifikasi terkirim!" : `❌ ${d.error}`);
      setTimeout(() => { setNotifTarget(null); setNotifDone(""); setNotifMsg({ title: "", body: "" }); }, 2000);
    } finally { setSendingNotif(false); }
  }

  return (
    <div className="glass rounded-2xl p-5 shadow-soft sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">🛡️ Klaim Garansi Nokos</h2>
          <p className="mt-1 text-xs text-muted">Approve = saldo dikembalikan sesuai harga beli. Lihat foto bukti sebelum keputusan.</p>
        </div>
        <span className="rounded-full bg-rose-soft px-3 py-1 text-xs font-semibold text-rose shrink-0">
          {claims.filter((c) => c.status === "pending").length} menunggu
        </span>
      </div>
      {msg && <p className="mb-2 text-xs font-medium text-teal-bright">{msg}</p>}

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted bg-surface">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Nokos</th>
              <th className="px-4 py-2.5 font-medium">Harga</th>
              <th className="px-4 py-2.5 font-medium">Detail + Foto</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-5 text-center text-muted">Memuat...</td></tr>
            ) : claims.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-5 text-center text-muted">Belum ada klaim garansi.</td></tr>
            ) : claims.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface/60 transition-colors">
                <td className="px-4 py-3 font-mono text-[11px] text-ink max-w-[110px] truncate">{c.token}</td>
                <td className="px-4 py-3 text-xs text-ink">
                  <div className="font-semibold">{c.serviceName}</div>
                  <div className="text-muted">{c.phoneNumber}</div>
                  <div className="font-mono text-[10px] text-muted">#{c.orderId?.slice(-10)}</div>
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-ink whitespace-nowrap">{fmtRp(c.purchasePrice)}</td>
                <td className="px-4 py-3 max-w-[240px]">
                  <p className="line-clamp-2 text-xs text-ink whitespace-pre-line">{c.description}</p>
                  {c.adminNote && <p className="mt-0.5 text-[10px] text-muted italic">Catatan: {c.adminNote}</p>}
                  {c.screenshotData && (
                    <button onClick={() => setPreviewSrc(c.screenshotData)}
                      className="mt-1.5 flex items-center gap-1 rounded-lg border border-blue/30 bg-blue-soft px-2 py-0.5 text-[10px] font-bold text-blue hover:opacity-80 press">
                      🖼️ Lihat Foto Bukti
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${c.status === "approved" ? "border-teal/40 text-teal-bright" : c.status === "rejected" ? "border-rose/30 text-rose" : "border-amber/40 text-amber-bright"}`}>
                    {c.status === "approved" ? "✓ Disetujui" : c.status === "rejected" ? "✕ Ditolak" : "⏳ Menunggu"}
                  </span>
                  <p className="mt-0.5 text-[10px] text-muted">{fmtDate(c.createdAt)}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-end gap-1.5">
                    {c.status === "pending" ? (
                      <>
                        <button onClick={() => onAction(c.id, "approve")} className="btn-3d rounded-md border border-teal/40 px-2.5 py-1 text-xs font-bold text-teal-bright hover:bg-teal-soft w-full">✓ Setujui</button>
                        <button onClick={() => onAction(c.id, "reject")} className="btn-3d rounded-md border border-rose/40 px-2.5 py-1 text-xs font-bold text-rose hover:bg-rose-soft w-full">✕ Tolak</button>
                      </>
                    ) : null}
                    <button onClick={() => { setNotifTarget(c.token); setNotifMsg({ title: c.status === "approved" ? "Klaim Garansi Disetujui ✅" : c.status === "rejected" ? "Klaim Garansi Ditolak" : "Update Klaim Garansi", body: "" }); }}
                      className="btn-3d rounded-md border border-indigo-400/40 px-2.5 py-1 text-xs font-bold text-indigo-400 hover:bg-indigo-50/20 w-full">
                      📢 Notif
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Screenshot lightbox */}
      {previewSrc && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => setPreviewSrc(null)}
          style={{ background: "rgba(0,0,0,0.85)" }}>
          <img src={previewSrc} alt="Bukti" className="max-w-full max-h-[80vh] rounded-2xl border-4 border-white/20 shadow-2xl" />
          <button className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white text-lg hover:bg-white/30">✕</button>
        </div>
      )}

      {/* Quick Notif Modal */}
      {notifTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-bg p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-ink">📢 Kirim Notifikasi</h3>
              <button onClick={() => setNotifTarget(null)} className="text-muted hover:text-ink text-lg">✕</button>
            </div>
            <p className="text-xs text-muted font-mono bg-surface rounded-lg px-3 py-1.5">{notifTarget}</p>
            <input value={notifMsg.title} onChange={(e) => setNotifMsg((m) => ({ ...m, title: e.target.value }))}
              placeholder="Judul notifikasi" className="input text-sm w-full" />
            <textarea value={notifMsg.body} onChange={(e) => setNotifMsg((m) => ({ ...m, body: e.target.value }))}
              placeholder="Isi pesan (opsional)" rows={3} className="input text-sm w-full resize-none" />
            {notifDone && <p className={`text-xs font-semibold ${notifDone.startsWith("✅") ? "text-teal-bright" : "text-rose"}`}>{notifDone}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setNotifTarget(null)} className="flex-1 rounded-xl border border-line py-2 text-sm text-muted hover:border-ink/30">Batal</button>
              <button onClick={sendQuickNotif} disabled={sendingNotif || !notifMsg.title}
                className="flex-1 rounded-xl bg-indigo-500 py-2 text-sm font-bold text-white disabled:opacity-50 press">
                {sendingNotif ? "Mengirim…" : "Kirim"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SecuritySection() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [lastScan, setLastScan] = useState(null);

  async function runScan() {
    setScanning(true);
    setMsg("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/security-scan", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setLastScan(new Date());
        setMsg(data.flagged === 0 ? "✅ Semua bersih — tidak ada ancaman terdeteksi." : `⚠️ ${data.flagged} flag ditemukan, ${data.autoSuspended} akun di-suspend otomatis.`);
      } else {
        setMsg(`❌ ${data.error || "Scan gagal."}`);
      }
    } catch {
      setMsg("❌ Scan gagal — cek koneksi.");
    } finally {
      setScanning(false);
    }
  }

  const sevColor = { critical: "text-rose border-rose/40 bg-rose-soft", high: "text-amber-bright border-amber/40 bg-amber-soft", medium: "text-blue border-blue/30 bg-blue-soft" };
  const sevIcon  = { critical: "🚨", high: "🔴", medium: "🟡" };
  const catLabel = { spam: "SPAM", balance: "SALDO", warranty: "GARANSI", phone: "NOMOR" };

  return (
    <div className="glass rounded-2xl p-5 shadow-soft space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink flex items-center gap-2">🛡️ Security — Auto-Ban</h2>
          <p className="text-xs text-muted mt-0.5">Deteksi spam order, deposit massal, abuse garansi, saldo anomali, nomor berulang.</p>
          {lastScan && <p className="text-[10px] text-muted mt-1">Scan terakhir: {lastScan.toLocaleTimeString("id-ID")}</p>}
        </div>
        <button onClick={runScan} disabled={scanning}
          className="shrink-0 rounded-xl bg-rose px-4 py-2 text-sm font-bold text-white press disabled:opacity-50 border border-rose/60 flex items-center gap-2">
          {scanning ? (
            <><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Scanning…</>
          ) : "🔍 Jalankan Scan"}
        </button>
      </div>

      {/* Summary stats (after scan) */}
      {result && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Critical", val: result.summary?.critical ?? 0, color: "text-rose bg-rose-soft border-rose/30" },
            { label: "High", val: result.summary?.high ?? 0, color: "text-amber-bright bg-amber-soft border-amber/30" },
            { label: "Medium", val: result.summary?.medium ?? 0, color: "text-blue bg-blue-soft border-blue/30" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-2.5 text-center ${s.color}`}>
              <p className="text-lg font-black">{s.val}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status message */}
      {msg && (
        <p className={`text-xs font-semibold rounded-xl px-3 py-2 ${msg.startsWith("✅") ? "bg-teal-soft text-teal-bright" : msg.startsWith("⚠️") ? "bg-amber-soft text-amber-bright" : "bg-rose-soft text-rose"}`}>
          {msg}
        </p>
      )}

      {/* Flagged list */}
      {result?.flags?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-ink">Akun Terdeteksi ({result.flags.length})</p>
          {result.flags.map((f, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${sevColor[f.severity] || "border-line bg-surface text-muted"}`}>
              <span className="text-base mt-0.5 shrink-0">{sevIcon[f.severity] || "🔵"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-mono font-bold">{f.token}</p>
                  {f.category && (
                    <span className="rounded-full border border-current/30 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest opacity-70">
                      {catLabel[f.category] || f.category}
                    </span>
                  )}
                  {(f.severity === "high" || f.severity === "critical") && (
                    <span className="rounded-full bg-rose text-white px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest">AUTO-SUSPEND</span>
                  )}
                </div>
                <p className="text-[11px] mt-0.5 opacity-80">{f.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {result?.flagged === 0 && (
        <div className="rounded-xl border border-teal/30 bg-teal-soft px-4 py-3 flex items-center gap-2">
          <span className="text-xl">✅</span>
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
  const [backupLoading, setBackupLoading] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importMode, setImportMode] = useState("merge");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);

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

  async function doBackup() {
    setBackupLoading(true);
    try {
      const res = await fetch("/api/admin/export?type=backup");
      if (!res.ok) { alert("Gagal export backup."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `artapedia-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBackupLoading(false);
    }
  }

  async function doImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    setImportError("");
    try {
      const text = await importFile.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { setImportError("File bukan JSON valid."); return; }
      if (!Array.isArray(parsed.users)) { setImportError("Format backup tidak dikenal."); return; }

      if (importMode === "restore") {
        const ok = window.confirm(`⚠️ Mode RESTORE akan HAPUS SEMUA data user terlebih dahulu lalu isi ulang dari backup (${parsed.users.length} user). Lanjutkan?`);
        if (!ok) return;
      }

      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed, mode: importMode }),
      });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error || "Gagal import."); return; }
      setImportResult(data);
    } catch (e) {
      setImportError("Terjadi kesalahan: " + e.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* CSV Export */}
      <div className="glass rounded-2xl p-5 shadow-soft">
        <h2 className="text-base font-bold text-ink mb-1">📥 Export Data (CSV)</h2>
        <p className="text-xs text-muted mb-4">Unduh data transaksi, deposit, atau user ringkasan dalam format CSV.</p>
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

      {/* Full Backup (JSON) */}
      <div className="glass rounded-2xl p-5 shadow-soft border border-indigo/20">
        <h2 className="text-base font-bold text-ink mb-1">🗄️ Backup Penuh (JSON)</h2>
        <p className="text-xs text-muted mb-4">Ekspor semua data user lengkap ke file JSON — bisa digunakan untuk restore jika data hilang.</p>
        <button onClick={doBackup} disabled={backupLoading} className="w-full rounded-xl bg-indigo-500 text-white py-2.5 text-sm font-bold press disabled:opacity-50 border border-indigo-400">
          {backupLoading ? "Menyiapkan backup…" : "📦 Download Backup JSON"}
        </button>
      </div>

      {/* Import / Restore */}
      <div className="glass rounded-2xl p-5 shadow-soft border border-rose/20">
        <h2 className="text-base font-bold text-ink mb-1">📤 Import / Restore Data User</h2>
        <p className="text-xs text-muted mb-4">Upload file backup JSON untuk memulihkan data user yang hilang.</p>

        {/* Mode selector */}
        <div className="mb-3 space-y-1">
          <label className="block text-xs font-semibold text-muted mb-1.5">Mode Import</label>
          {[
            { v: "merge", l: "Merge", desc: "Update user yang ada + tambah user baru" },
            { v: "safe", l: "Safe (Hanya Baru)", desc: "Hanya tambah user yang belum ada, jangan ubah yang sudah ada" },
            { v: "restore", l: "⚠️ Restore Penuh", desc: "Hapus SEMUA user lalu isi ulang dari backup" },
          ].map((m) => (
            <label key={m.v} className={`flex items-start gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${importMode === m.v ? "border-amber/60 bg-amber/10" : "border-line hover:border-amber/30"}`}>
              <input type="radio" name="importMode" value={m.v} checked={importMode === m.v} onChange={() => setImportMode(m.v)} className="mt-0.5" />
              <div>
                <p className="text-xs font-bold text-ink">{m.l}</p>
                <p className="text-[10px] text-muted">{m.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* File picker */}
        <div className="mb-3">
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden"
            onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); setImportError(""); }} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-line py-3 text-xs text-muted hover:border-amber/50 hover:text-amber-bright transition-colors press">
            {importFile ? `📄 ${importFile.name} (${(importFile.size / 1024).toFixed(1)} KB)` : "Pilih file backup .json…"}
          </button>
        </div>

        {importError && <p className="text-xs font-semibold text-rose mb-2">{importError}</p>}

        {importResult && (
          <div className="rounded-xl border border-teal/30 bg-teal-soft px-4 py-3 mb-2 text-xs space-y-0.5">
            <p className="font-bold text-teal-bright">✅ Import selesai!</p>
            <p className="text-muted">Total: <span className="text-ink font-semibold">{importResult.total}</span> &nbsp;|&nbsp; Ditambah: <span className="text-teal-bright font-semibold">{importResult.inserted}</span> &nbsp;|&nbsp; Diperbarui: <span className="text-amber-bright font-semibold">{importResult.updated}</span> &nbsp;|&nbsp; Dilewati: <span className="text-muted font-semibold">{importResult.skipped}</span></p>
          </div>
        )}

        <button onClick={doImport} disabled={!importFile || importing}
          className={`w-full rounded-xl py-2.5 text-sm font-bold press disabled:opacity-50 border transition-colors ${importMode === "restore" ? "bg-rose text-white border-rose/60" : "bg-amber text-white border-amber-bright"}`}>
          {importing ? "Mengimport…" : importMode === "restore" ? "🔄 Restore (Hapus & Timpa)" : "📤 Import Data"}
        </button>
      </div>
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

function StatCard({ label, value, accent, icon, floatClass }) {
  return (
    <div className={`manga-panel relative overflow-hidden rounded-2xl bg-surface p-4 ${floatClass || ""}`}>
      {/* Subtle dot grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "radial-gradient(circle, rgb(var(--c-ink)) 0.6px, transparent 0.6px)", backgroundSize: "7px 7px" }} />
      <div className="relative z-10">
        {icon && <span className="text-xl mb-1 block">{icon}</span>}
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted">{label}</p>
        <p className={`mt-1 font-display text-lg font-black ${accent || "text-ink"}`}>{value}</p>
      </div>
    </div>
  );
}
