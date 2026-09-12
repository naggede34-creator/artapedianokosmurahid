"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [token, setToken] = useState(null);
  const [balance, setBalance] = useState(0);
  const [ready, setReady] = useState(false);

  const init = useCallback(async (existingToken) => {
    const res = await fetch("/api/user/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(existingToken ? { token: existingToken } : {})
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("artapedia_token", data.token);
      setToken(data.token);
      setBalance(data.balance);
      return data;
    }
    throw new Error(data.error || "Gagal memuat akun.");
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("artapedia_token") : null;
    init(saved || undefined)
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

  return (
    <UserContext.Provider value={{ token, balance, ready, setBalance, refreshBalance, restoreToken }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser harus dipakai di dalam UserProvider");
  return ctx;
}
