"use client";

import { useEffect, useRef, useState } from "react";
import { CHANNEL_URL } from "@/lib/links";

const GREETING = {
  role: "assistant",
  content:
    "Halo! Aku Arta, CS AI Artapedia 🤖. Ada kendala deposit, order OTP, atau pertanyaan lain? Tanya aja di sini."
};

function ChatBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-amber text-white"
            : "rounded-bl-sm border border-line bg-surface2 text-ink"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-line bg-surface2 px-4 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
      </div>
    </div>
  );
}

export default function SupportWidget({
  channelInfo = CHANNEL_URL,
  csUsername = "teatlas"
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, chatOpen]);

  async function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const history = messages;
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/cs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: history.map((m) => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI CS sedang tidak bisa dihubungi.");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed right-4 z-50 flex flex-col items-end gap-3 md:right-6 bottom-[calc(6rem_+_env(safe-area-inset-bottom))] md:bottom-[calc(1.5rem_+_max(1rem,env(safe-area-inset-bottom)))]">
      {/* Chat panel */}
      {chatOpen && (
        <div className="animate-scale-in flex h-[70vh] max-h-[520px] w-[92vw] max-w-[360px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
          <div className="flex items-center justify-between bg-teal-bright px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/maskot-sm.webp" alt="" className="h-full w-full object-contain object-bottom p-0.5" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">ARTA PEDIA SUPPORT</p>
                <p className="text-[11px] text-white/80">Biasanya balas dalam beberapa detik</p>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="press flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15"
              aria-label="Tutup chat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-bg px-3.5 py-3.5">
            {messages.map((m, i) => (
              <ChatBubble key={i} msg={m} />
            ))}
            {loading && <TypingDots />}
            {error && (
              <p className="rounded-xl bg-rose-soft px-3 py-2 text-xs font-medium text-rose">{error}</p>
            )}
          </div>

          <div className="border-t border-line bg-surface2 p-2.5">
            <p className="px-1 pb-1.5 text-[10px] text-muted">
              Jangan kirim kode akun/OTP/password ke chat ini. Kendala mendesak? Hubungi admin lewat tombol
              di bawah.
            </p>
            <form onSubmit={sendMessage} className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tulis pertanyaanmu..."
                className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink outline-none focus:border-amber"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="btn-3d press flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber text-white shadow-3d disabled:opacity-50"
                aria-label="Kirim"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="m4 12 16-7-6 16-2.5-6.5L4 12Z" stroke="white" strokeWidth="1.7" strokeLinejoin="round" fill="white" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Speed-dial links */}
      {!chatOpen && menuOpen && (
        <div className="flex flex-col items-end gap-2">
          {/* CS manusia — diletakkan paling atas karena ini yang paling dicari
              user saat ada masalah transaksi. */}
          <a
            href={`https://t.me/${(csUsername || "teatlas").replace(/^@/, "")}`}
            target="_blank"
            rel="noreferrer"
            className="hover-lift flex items-center gap-2 rounded-full border-2 border-amber bg-amber-soft py-2 pl-3 pr-4 text-sm font-bold text-amber-bright shadow-lift"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber text-white">💬</span>
            Customer Service
          </a>
          <a
            href={channelInfo}
            target="_blank"
            rel="noreferrer"
            className="hover-lift flex items-center gap-2 rounded-full border border-line bg-surface py-2 pl-3 pr-4 text-sm font-medium text-ink shadow-lift"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-soft text-amber-bright">📢</span>
            Channel Info
          </a>
          <button
            onClick={() => {
              setChatOpen(true);
              setMenuOpen(false);
            }}
            className="hover-lift flex items-center gap-2 rounded-full border border-line bg-surface py-2 pl-3 pr-4 text-sm font-medium text-ink shadow-lift"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-soft text-success">🤖</span>
            Tanya CS AI
          </button>
        </div>
      )}

      {/* Main FAB */}
      {!chatOpen && (
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="mascot-fab press"
          aria-label={menuOpen ? "Tutup menu bantuan" : "Bantuan — ARTA PEDIA SUPPORT"}
        >
          {menuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mascot-fab-x">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/maskot-sm.webp" alt="" className="mascot-fab-img" />
              <span className="mascot-fab-dot" aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
