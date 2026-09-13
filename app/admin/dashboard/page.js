"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [settings, setSettings] = useState(null);
  const [markupInput, setMarkupInput] = useState("");
  const [savingMarkup, setSavingMarkup] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
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
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementForm, setAnnouncementForm] = useState({ category: "Informasi", title: "", body: "" });
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState("");

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (res.status === 401) return router.push("/admin/login");
    const data = await res.json();
    setSettings(data);
    setMarkupInput(String(data.markupPercent ?? 0));
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

  useEffect(() => {
    loadSettings();
    loadUsers("");
    loadStats();
    loadVouchers();
    loadBroadcasts();
    loadAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitBroadcast(e) {
    e.preventDefault();
    setBroadcastMsg("");
    setBroadcastSubmitting(true);
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: broadcastInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim broadcast.");
      setBroadcastMsg("Broadcast terkirim & langsung tampil ke semua user.");
      setBroadcastInput("");
      loadBroadcasts();
    } catch (err) {
      setBroadcastMsg(err.message);
    } finally {
      setBroadcastSubmitting(false);
      setTimeout(() => setBroadcastMsg(""), 3000);
    }
  }

  async function toggleBroadcast(id) {
    await fetch("/api/admin/broadcasts/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    loadBroadcasts();
  }

  async function deleteBroadcast(id) {
    await fetch("/api/admin/broadcasts/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
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
        body: JSON.stringify({
          category: announcementForm.category,
          title: announcementForm.title.trim(),
          body: announcementForm.body.trim()
        })
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
    await fetch("/api/admin/announcements/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    loadAnnouncements();
  }

  async function deleteAnnouncement(id) {
    await fetch("/api/admin/announcements/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
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
        body: JSON.stringify({
          code: voucherForm.code.trim(),
          amount: Number(voucherForm.amount),
          maxUses: Number(voucherForm.maxUses) || 1
        })
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
    await fetch("/api/admin/vouchers/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
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
    } catch (e) {
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

  async function submitBalance(e) {
    e.preventDefault();
    setBalanceMsg("");
    setBalanceSubmitting(true);
    try {
      const res = await fetch("/api/admin/users/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: balanceForm.token.trim(),
          amount: Number(balanceForm.amount),
          action: balanceAction,
          note: balanceForm.note.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses.");
      setBalanceMsg(`Berhasil. Saldo terbaru: Rp${Number(data.balance).toLocaleString("id-ID")}`);
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
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="mx-auto max-w-content px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-bright">Admin Panel</p>
          <h1 className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">Dashboard Artapedia</h1>
        </div>
        <button
          onClick={logout}
          className="btn-3d rounded-lg border border-rose/40 px-4 py-2 text-sm font-medium text-rose transition-colors hover:bg-rose-soft"
        >
          Keluar
        </button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total user" value={total.toLocaleString("id-ID")} />
        <StatCard label="Total saldo beredar" value={`Rp${totalBalance.toLocaleString("id-ID")}`} />
        <StatCard
          label="Status website"
          value={settings ? (settings.maintenance ? "Maintenance" : "Online") : "..."}
          accent={settings?.maintenance ? "text-rose" : "text-teal-bright"}
        />
      </div>

      {/* Statistik 7 hari terakhir */}
      <div className="glass mt-8 rounded-2xl p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-base font-semibold text-ink">Statistik 7 Hari Terakhir</h2>
        {statsLoading ? (
          <div className="mt-4 h-32 animate-pulse rounded-lg bg-surface2" />
        ) : stats ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatCard label="Order OTP (7 hari)" value={`${stats.totals.orderCount}`} />
              <StatCard label="Omzet OTP (7 hari)" value={`Rp${stats.totals.orderRevenue.toLocaleString("id-ID")}`} accent="text-teal-bright" />
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
                        title={`Rp${d.orderRevenue.toLocaleString("id-ID")}`}
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

      {/* Voucher saldo */}
      <div className="glass mt-8 rounded-2xl p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-base font-semibold text-ink">Voucher Saldo</h2>
        <form onSubmit={submitVoucher} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_0.8fr_auto]">
          <input
            value={voucherForm.code}
            onChange={(e) => setVoucherForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="Kode (kosongkan = otomatis)"
            className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm uppercase text-ink outline-none focus:border-amber"
          />
          <input
            type="number"
            min="1"
            value={voucherForm.amount}
            onChange={(e) => setVoucherForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="Nominal"
            required
            className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
          />
          <input
            type="number"
            min="1"
            value={voucherForm.maxUses}
            onChange={(e) => setVoucherForm((f) => ({ ...f, maxUses: e.target.value }))}
            placeholder="Kuota klaim"
            className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
          />
          <button
            type="submit"
            disabled={voucherSubmitting}
            className="btn-3d rounded-lg bg-gradient-to-r from-teal to-teal-bright px-4 py-2.5 text-sm font-medium text-white shadow-3d disabled:opacity-60"
          >
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
                <tr>
                  <td colSpan={5} className="px-4 py-5 text-center text-muted">Memuat...</td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-5 text-center text-muted">Belum ada voucher.</td>
                </tr>
              ) : (
                vouchers.map((v) => (
                  <tr key={v.code} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-ink">{v.code}</td>
                    <td className="px-4 py-2.5 text-ink">Rp{v.amount.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{v.usedCount}/{v.maxUses}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${v.active ? "border-teal/40 text-teal-bright" : "border-rose/30 text-rose"}`}>
                        {v.active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => toggleVoucher(v.code)}
                        className="btn-3d rounded-md border border-line px-2 py-1 text-xs font-medium text-ink hover:border-amber"
                      >
                        {v.active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broadcast */}
      <div className="glass mt-8 rounded-2xl p-5 shadow-soft sm:p-6">
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
            className="btn-3d shrink-0 rounded-lg bg-gradient-to-r from-amber to-amber-bright px-4 py-2.5 text-sm font-medium text-white shadow-3d disabled:opacity-60"
          >
            {broadcastSubmitting ? "Mengirim..." : "Kirim Broadcast"}
          </button>
        </form>
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
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-center text-muted">Memuat...</td>
                </tr>
              ) : broadcasts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-center text-muted">Belum ada broadcast.</td>
                </tr>
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
                        <button
                          onClick={() => toggleBroadcast(b.id)}
                          className="btn-3d rounded-md border border-line px-2 py-1 text-xs font-medium text-ink hover:border-amber"
                        >
                          {b.active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => deleteBroadcast(b.id)}
                          className="btn-3d rounded-md border border-rose/40 px-2 py-1 text-xs font-medium text-rose hover:bg-rose-soft"
                        >
                          Hapus
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

      {/* Kelola Informasi / Pengumuman */}
      <div className="glass mt-8 rounded-2xl p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-base font-semibold text-ink">Kelola Informasi (Pusat Informasi)</h2>
        <p className="mt-1 text-xs text-muted">Muncul di menu Informasi dan lonceng notifikasi di semua halaman.</p>
        <form onSubmit={submitAnnouncement} className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[0.9fr_2fr]">
            <select
              value={announcementForm.category}
              onChange={(e) => setAnnouncementForm((f) => ({ ...f, category: e.target.value }))}
              className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
            >
              <option value="Informasi">Informasi</option>
              <option value="Promo">Promo</option>
              <option value="Penting">Penting</option>
            </select>
            <input
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Judul pengumuman"
              required
              maxLength={120}
              className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
            />
          </div>
          <textarea
            value={announcementForm.body}
            onChange={(e) => setAnnouncementForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Isi pengumuman..."
            required
            rows={3}
            maxLength={1000}
            className="rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
          />
          <button
            type="submit"
            disabled={announcementSubmitting}
            className="btn-3d self-start rounded-lg bg-gradient-to-r from-teal to-teal-bright px-4 py-2.5 text-sm font-medium text-white shadow-3d disabled:opacity-60"
          >
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
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-soft text-base">
                  {a.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{a.title}</p>
                    <span className="rounded bg-teal-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-bright">
                      {a.category}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${a.active ? "border-teal/40 text-teal-bright" : "border-rose/30 text-rose"}`}>
                      {a.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{a.body}</p>
                  <p className="mt-1 text-[11px] text-muted">{fmtDate(a.createdAt)}</p>
                </div>
                <div className="flex flex-shrink-0 flex-col gap-1.5">
                  <button
                    onClick={() => toggleAnnouncement(a.id)}
                    className="btn-3d rounded-md border border-line px-2 py-1 text-xs font-medium text-ink hover:border-amber"
                  >
                    {a.active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <button
                    onClick={() => deleteAnnouncement(a.id)}
                    className="btn-3d rounded-md border border-rose/40 px-2 py-1 text-xs font-medium text-rose hover:bg-rose-soft"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pengaturan */}
      <div className="glass mt-8 rounded-2xl p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-base font-semibold text-ink">Pengaturan</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted">Markup harga jual OTP (%)</label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="number"
                value={markupInput}
                onChange={(e) => setMarkupInput(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
              />
              <button
                onClick={saveMarkup}
                disabled={savingMarkup}
                className="btn-3d shrink-0 rounded-lg bg-gradient-to-r from-amber to-amber-bright px-4 py-2.5 text-sm font-medium text-white shadow-3d disabled:opacity-60"
              >
                {savingMarkup ? "..." : "Simpan"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Harga jual = harga dasar RumahOTP × (1 + markup%). Berlaku langsung, tanpa deploy ulang.</p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted">Mode maintenance</label>
            <div className="mt-1.5 flex items-center justify-between rounded-lg border border-line bg-surface px-3.5 py-2.5">
              <span className="text-sm text-ink">
                {settings?.maintenance ? "Aktif — website ditutup untuk user" : "Nonaktif — website berjalan normal"}
              </span>
              <button
                onClick={toggleMaintenance}
                disabled={!settings || savingMaintenance}
                className={`btn-3d relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  settings?.maintenance ? "bg-rose" : "bg-teal"
                }`}
                aria-label="Toggle maintenance"
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    settings?.maintenance ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Kalau aktif, semua halaman publik diganti layar maintenance. Halaman admin tetap bisa diakses.</p>
          </div>
        </div>
        {settingsMsg && <p className="mt-3 text-xs font-medium text-teal-bright">{settingsMsg}</p>}
      </div>

      {/* Tambah/Kurangi Saldo */}
      <div ref={formRef} className="glow-ring mt-8 rounded-2xl">
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
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-ink">Daftar User</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadUsers()}
            placeholder="Cari kode akun..."
            className="w-56 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none focus:border-amber"
          />
        </div>

        <div className="glass mt-3 overflow-x-auto rounded-2xl shadow-soft">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Kode akun</th>
                <th className="px-4 py-3 font-medium">Saldo</th>
                <th className="px-4 py-3 font-medium">Referral</th>
                <th className="px-4 py-3 font-medium">Daftar</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">Memuat...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">Tidak ada user.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.token} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-ink">{u.token}</td>
                    <td className="px-4 py-3 font-medium text-ink">Rp{u.balance.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-xs text-muted">{u.referralCount} orang</td>
                    <td className="px-4 py-3 text-xs text-muted">{fmtDate(u.createdAt)}</td>
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="glass rounded-2xl p-4 shadow-soft">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-display text-lg font-semibold ${accent || "text-ink"}`}>{value}</p>
    </div>
  );
}
