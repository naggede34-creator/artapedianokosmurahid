"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

const THEME_KEY = "artapedia_theme";
const ThemeContext = createContext(null);

// Default selalu "light" kecuali user pernah memilih "dark" sebelumnya
// (disimpan di localStorage). Skrip inline di layout.js sudah menaruh
// class "dark" di <html> sebelum React aktif, supaya tidak ada kedipan.
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");

  useEffect(() => {
    // Tema tampilan dipasang lebih dulu, di efek yang sama dengan mode
    // terang/gelap: dua efek terpisah berarti dua kali gambar ulang, dan
    // warnanya berkedip di antaranya.
    try {
      const { bacaTema, pasangTema } = require("@/lib/tema");
      const t = bacaTema();
      pasangTema(t.id, t.warna);
    } catch {}

    const saved = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
    setThemeState(saved === "dark" ? "dark" : "light");
  }, []);

  const applyTheme = useCallback((next) => {
    setThemeState(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_KEY, next);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === "dark" ? "light" : "dark");
  }, [theme, applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: applyTheme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme harus dipakai di dalam ThemeProvider");
  return ctx;
}

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [token, setToken] = useState(null);
  const [balance, setBalance] = useState(0);
  const [depositBalance, setDepositBalance] = useState(null);
  const [name, setName] = useState(null);
  const [joinedAt, setJoinedAt] = useState(null);
  const [tourDone, setTourDone] = useState(false);
  const [ready, setReady] = useState(false);
  // true = admin mewajibkan daftar/masuk dan pengunjung belum punya akun aktif.
  const [perluMasuk, setPerluMasuk] = useState(false);
  const [loginWajib, setLoginWajib] = useState(false);

  const init = useCallback(async (existingToken, ref) => {
    const body = existingToken ? { token: existingToken } : {};
    if (!existingToken && ref) body.ref = ref;
    const res = await fetch("/api/user/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("artapedia_token", data.token);
      try { localStorage.removeItem("artapedia_keluar"); } catch {}
      setToken(data.token);
      setBalance(data.balance);
      setDepositBalance(data.depositBalance ?? null);
      setName(data.name || null);
      setJoinedAt(data.createdAt || null);
      setTourDone(data.tourDone === true);
      return data;
    }
    const err = new Error(data.error || "Gagal memuat akun.");
    err.status = res.status;
    throw err;
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("artapedia_token") : null;
    const ref = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") : null;
    // Kode undangan diingat sampai benar-benar daftar: pengunjung yang dibawa
    // link ?ref= biasanya membaca dulu sebelum mengisi nama.
    try { if (ref) sessionStorage.setItem("artapedia_ref", ref); } catch {}

    (async () => {
      // Status saklar dibaca DULU. Dengan login wajib, akun tidak boleh dibuat
      // otomatis — yang tersimpan di perangkat tetap dicoba (pengguna lama).
      let wajib = false;
      try {
        const r = await fetch("/api/settings/public", { cache: "no-store" });
        wajib = !!(await r.json()).loginWajib;
      } catch {}
      setLoginWajib(wajib);

      if (saved) {
        try {
          await init(saved);
          return;
        } catch (e) {
          // Login wajib: minta masuk. Kode tersimpan HANYA dibuang kalau server
          // bilang tidak dikenal (404); gangguan jaringan atau batas percobaan
          // tidak boleh menghapus kode milik pengguna lama.
          // Tidak wajib: perilaku lama, buat akun baru.
          if (wajib) {
            if (e?.status === 404) {
              try { localStorage.removeItem("artapedia_token"); } catch {}
            }
            setPerluMasuk(true);
            return;
          }
        }
      }
      // Baru saja keluar dari akun: tampilkan gerbang masuk/daftar, jangan
      // diam-diam membuatkan akun kosong yang baru.
      let baruKeluar = false;
      try { baruKeluar = localStorage.getItem("artapedia_keluar") === "1"; } catch {}
      if (wajib || baruKeluar) {
        setPerluMasuk(true);
        return;
      }
      await init(undefined, ref || undefined).catch((e) => {
        // Saklar ternyata menyala (status tak terbaca di atas): tampilkan gerbang.
        if (e?.status === 403) {
          setLoginWajib(true);
          setPerluMasuk(true);
        }
      });
    })().finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pendaftaran: mengembalikan { token, name } TANPA langsung masuk, supaya
  // layar "simpan kode akun" sempat tampil sebelum halaman berganti.
  const daftar = useCallback(async (namaBaru) => {
    let ref = null;
    try { ref = sessionStorage.getItem("artapedia_ref"); } catch {}
    const res = await fetch("/api/user/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: namaBaru, ...(ref ? { ref } : {}) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Gagal mendaftar.");
    return data;
  }, []);

  // Masuk dengan kode akun (juga dipakai setelah daftar).
  const masuk = useCallback(
    async (kode) => {
      const data = await init(String(kode || "").trim().toUpperCase());
      setPerluMasuk(false);
      return data;
    },
    [init]
  );

  // Keluar dari akun di perangkat ini. Akunnya tidak dihapus: kode akun tetap
  // bisa dipakai masuk lagi kapan saja. Penanda "artapedia_keluar" membuat
  // halaman berikutnya menampilkan gerbang masuk, bukan akun baru otomatis.
  const keluar = useCallback(() => {
    try {
      localStorage.removeItem("artapedia_token");
      localStorage.setItem("artapedia_keluar", "1");
      sessionStorage.removeItem("artapedia_ref");
    } catch {}
    window.location.href = "/";
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!token) return;
    const res = await fetch("/api/user/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (res.ok) setBalance(data.balance);
  }, [token]);

  const restoreToken = useCallback(
    async (candidate) => {
      const data = await init(candidate.trim());
      return data;
    },
    [init]
  );

  const updateName = useCallback(
    async (newName) => {
      if (!token) return;
      const res = await fetch("/api/user/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: newName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan nama.");
      setName(data.name || null);
      return data;
    },
    [token]
  );

  const completeTour = useCallback(async () => {
    setTourDone(true);
    try { localStorage.setItem("artapedia_tour_done", "1"); } catch {}
    if (token) {
      fetch("/api/user/tour-done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      }).catch(() => {});
    }
  }, [token]);

  return (
    <UserContext.Provider
      value={{ token, balance, depositBalance, name, joinedAt, tourDone, ready, perluMasuk, loginWajib, daftar, masuk, keluar, setBalance, refreshBalance, restoreToken, updateName, completeTour }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser harus dipakai di dalam UserProvider");
  return ctx;
}
