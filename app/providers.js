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
  const [name, setName] = useState(null);
  const [joinedAt, setJoinedAt] = useState(null);
  const [tourDone, setTourDone] = useState(false);
  const [ready, setReady] = useState(false);

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
      setToken(data.token);
      setBalance(data.balance);
      setName(data.name || null);
      setJoinedAt(data.createdAt || null);
      setTourDone(data.tourDone === true);
      return data;
    }
    throw new Error(data.error || "Gagal memuat akun.");
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("artapedia_token") : null;
    const ref = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") : null;
    init(saved || undefined, ref || undefined)
      .catch(() => init())
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      value={{ token, balance, name, joinedAt, tourDone, ready, setBalance, refreshBalance, restoreToken, updateName, completeTour }}
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
