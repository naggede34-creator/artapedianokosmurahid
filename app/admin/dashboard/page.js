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

  useEffect(() => {
    loadSettings();
    loadUsers("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
