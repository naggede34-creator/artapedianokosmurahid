"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CHANNEL_URL } from "@/lib/links";
import { saranHalaman } from "@/lib/navigasiAi";
import TopiMaskot from "@/components/TopiMaskot";
import { useCsBuka } from "@/lib/useCsBuka";
import { CS_JAM_TEKS, csBukaLagi } from "@/lib/jamCs";

const GREETING = {
  role: "assistant",
  content:
    "Halo! Aku WEARTA AI 🦅✨ Aku bisa menjawab pertanyaan dan mengarahkanmu ke menu yang tepat — deposit, beli nomor OTP, QRIS Gateway, Saldo Kaget, sampai ganti tema. Mau tanya apa?"
};

function tebal(teks) {
  return String(teks).split(/(\*\*[^*]+\*\*)/g).map((x, i) => (x.startsWith("**") && x.endsWith("**") ? <strong key={i}>{x.slice(2, -2)}</strong> : x));
}

function ChatBubble({ msg, onNav }) {
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
        {isUser ? msg.content : tebal(msg.content)}
        {!isUser && msg.tautan?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid="ai-tautan">
            {msg.tautan.map((t) => (
              <Link key={t.href} href={t.href} onClick={onNav} className="press rounded-full border-2 border-amber bg-amber-soft px-2.5 py-1 text-[11px] font-bold text-amber-bright">
                {t.ikon} {t.label} →
              </Link>
            ))}
          </div>
        )}
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
  const csBuka = useCsBuka();
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const path = usePathname() || "/";

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, chatOpen]);

  async function sendMessage(e, teksLangsung) {
    e?.preventDefault?.();
    const text = String(teksLangsung ?? input).trim();
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
          halaman: path,
          history: history.map((m) => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "WEARTA AI sedang tidak bisa dihubungi.");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, tautan: data.tautan || [] }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gelembung-bantuan fixed right-4 z-50 flex flex-col items-end gap-3 md:right-6 bottom-[calc(6rem_+_env(safe-area-inset-bottom))] md:bottom-[calc(1.5rem_+_max(1rem,env(safe-area-inset-bottom)))]">
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
                <p className="text-sm font-semibold leading-tight">WEARTA AI</p>
                <p className="text-[11px] text-white/80">Menjawab & mengarahkan ke menu yang tepat</p>
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
              <ChatBubble key={i} msg={m} onNav={() => setChatOpen(false)} />
            ))}
            {messages.length <= 1 && !loading && (
              <div className="flex flex-wrap gap-1.5 pt-1" data-testid="ai-saran">
                {saranHalaman(path).map((q) => (
                  <button key={q} onClick={() => sendMessage(null, q)} className="press rounded-full border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-ink">{q}</button>
                ))}
              </div>
            )}
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
                placeholder="Tanya WEARTA AI…"
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
          {csBuka === false ? (
            <div
              role="button"
              aria-disabled="true"
              tabIndex={-1}
              data-testid="widget-cs-tutup"
              title={`Customer Service buka ${CS_JAM_TEKS}`}
              className="flex cursor-not-allowed select-none items-center gap-2 rounded-full border-2 border-line bg-surface2 py-2 pl-3 pr-4 text-sm font-bold text-muted shadow-lift"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/10 text-white grayscale">💬</span>
              <span className="leading-tight">Customer Service<small className="block text-[10px] font-semibold">Sedang di luar jam kerja · buka {csBukaLagi()}</small></span>
            </div>
          ) : (
          <a
            href={`https://t.me/${(csUsername || "teatlas").replace(/^@/, "")}`}
            target="_blank"
            rel="noreferrer"
            data-testid="widget-cs-buka"
            className="hover-lift flex items-center gap-2 rounded-full border-2 border-amber bg-amber-soft py-2 pl-3 pr-4 text-sm font-bold text-amber-bright shadow-lift"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber text-white">💬</span>
            Customer Service
          </a>
          )}
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
            Tanya WEARTA AI
          </button>
        </div>
      )}

      {/* Main FAB */}
      {!chatOpen && (
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="mascot-fab press"
          aria-label={menuOpen ? "Tutup menu bantuan" : "Bantuan — WEARTA AI"}
        >
          {menuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mascot-fab-x">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/maskot-sm.webp" alt="" className="mascot-fab-img" />
              <TopiMaskot ukuran="1.1rem" />
              <span className="mascot-fab-dot" aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
