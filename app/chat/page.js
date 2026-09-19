"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@/app/providers";
import Link from "next/link";

/* ─── Constants ──────────────────────────────────────────────── */
const AI_PERSONAS = {
  Sanzz:       { avatar: "🦅", color: "#6366f1", bg: "#1e1b4b" },
  Manz:        { avatar: "🐺", color: "#8b5cf6", bg: "#1e1040" },
  Ara:         { avatar: "🌸", color: "#ec4899", bg: "#2d0a1e" },
  "Dunia OTP": { avatar: "🌏", color: "#14b8a6", bg: "#0c2826" },
  "Fascall ID":{ avatar: "⚡", color: "#f59e0b", bg: "#1c1200" },
  Zall:        { avatar: "🎯", color: "#10b981", bg: "#052015" },
};

const STICKER_PACKS = [
  { label: "Ekspresi", stickers: ["😂","🤣","😍","🥰","😎","🤩","😤","🥺","😭","🤯","🤔","🫡","🤗","😏"] },
  { label: "Hewan", stickers:   ["🦅","🐺","🌸","🌏","⚡","🎯","🦊","🐱","🦁","🐉","🦋","🐸"] },
  { label: "OTP",   stickers:   ["📱","💻","🔑","🔐","💳","💰","🚀","⚡","🌏","🎯","📲","🛡️"] },
  { label: "Hype",  stickers:   ["🎌","✨","💫","🔥","💥","🎉","🏆","👑","💎","🌟","🎊","🎶"] },
];

const QUICK_EMOJI = ["👍","❤️","😂","🔥","😮","😢","🙏","💯","👏","🎉"];

/* ─── Helpers ────────────────────────────────────────────────── */
function timeAgo(date) {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 5)   return "baru saja";
  if (diff < 60)  return `${diff}d lalu`;
  if (diff < 3600) return `${Math.floor(diff/60)} mnt`;
  if (diff < 86400) return `${Math.floor(diff/3600)} jam`;
  return new Date(date).toLocaleDateString("id-ID",{day:"2-digit",month:"short"});
}

function getColor(name) {
  if (!name) return "#6366f1";
  const colors = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f59e0b","#10b981","#3b82f6","#ef4444"];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[h % colors.length];
}

function getAvatar(name, isAI, aiPersona) {
  if (isAI && aiPersona && AI_PERSONAS[aiPersona]) return AI_PERSONAS[aiPersona].avatar;
  if (!name) return "👤";
  return name[0].toUpperCase();
}

/* ─── SetName Modal ──────────────────────────────────────────── */
function SetNameModal({ token, onSaved }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    const n = name.trim();
    if (!n || n.length < 2) { setErr("Nama minimal 2 karakter"); return; }
    if (n.length > 20) { setErr("Nama maksimal 20 karakter"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/user/name", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name: n }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal");
      onSaved(n);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="manga-panel manga-halftone relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: "linear-gradient(135deg,#06090f 0%,#0d1730 100%)", border: "2.5px solid #3b4fd8" }}>
        {/* accent bar */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#6366f1,#ec4899,#14b8a6)" }} />
        <div className="p-6">
          <div className="flex flex-col items-center mb-5">
            <div className="text-5xl mb-3 pop-float">🎌</div>
            <h2 className="text-xl font-black text-white">Selamat Datang!</h2>
            <p className="text-sm text-white/50 text-center mt-1">Set nama tampilan dulu sebelum bisa chat di grup</p>
          </div>
          <input
            value={name}
            onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&save()}
            placeholder="Nama kamu (2–20 karakter)"
            maxLength={20}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 mb-3"
          />
          {err && <p className="text-rose-400 text-xs mb-3">{err}</p>}
          <button
            onClick={save} disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 20px #6366f180" }}>
            {loading ? "Menyimpan..." : "✨ Masuk ke Grup"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Message Bubble ─────────────────────────────────────────── */
function MsgBubble({ msg, isMine, onReply }) {
  const persona = msg.isAI && msg.aiPersona ? AI_PERSONAS[msg.aiPersona] : null;
  const accentColor = msg.isAI && persona ? persona.color : getColor(msg.displayName);
  const avatarEmoji = typeof getAvatar(msg.displayName, msg.isAI, msg.aiPersona) === "string" ? getAvatar(msg.displayName, msg.isAI, msg.aiPersona) : null;
  const isEmoji = avatarEmoji && avatarEmoji.length > 1; // multi-char = emoji

  return (
    <div className={`flex items-end gap-2 slide-up mb-1 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {!isMine && (
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg font-black"
          style={{ background: persona ? persona.bg : `${accentColor}22`, border: `2px solid ${accentColor}`, color: accentColor, boxShadow: `0 0 10px ${accentColor}44` }}>
          {isEmoji ? avatarEmoji : <span style={{ fontSize: 14 }}>{avatarEmoji}</span>}
        </div>
      )}

      <div className={`flex flex-col max-w-[75%] ${isMine ? "items-end" : "items-start"}`}>
        {/* Name + time */}
        <div className={`flex items-center gap-2 mb-1 px-1 ${isMine ? "flex-row-reverse" : ""}`}>
          <span className="text-xs font-bold" style={{ color: accentColor }}>
            {msg.displayName}{msg.isAI && <span className="ml-1 text-[9px] opacity-60">● online</span>}
          </span>
          <span className="text-[10px] text-white/30">{timeAgo(msg.createdAt)}</span>
        </div>

        {/* Reply preview */}
        {msg.replyTo && (
          <div className={`mb-1 px-2 py-1 rounded-lg text-[11px] border-l-2 opacity-70 ${isMine ? "text-right" : ""}`}
            style={{ borderColor: accentColor, background: "#ffffff08", color: "#aaa" }}>
            <span className="font-semibold mr-1" style={{ color: accentColor }}>{msg.replyToName}</span>
            {msg.replyToPreview || "…"}
          </div>
        )}

        {/* Bubble */}
        <div
          onClick={() => onReply(msg)}
          className={`relative px-4 py-2.5 rounded-2xl cursor-pointer active:scale-95 transition-all select-none ${
            isMine
              ? "rounded-br-sm text-white"
              : "rounded-bl-sm text-white/90"
          }`}
          style={isMine
            ? { background: `linear-gradient(135deg,${accentColor}cc,${accentColor}88)`, boxShadow: `3px 3px 0 #000, 0 0 12px ${accentColor}44` }
            : { background: persona ? persona.bg : "#111827", border: `1.5px solid ${accentColor}44`, boxShadow: "2px 2px 0 #000" }
          }>
          {msg.type === "sticker" ? (
            <span className="text-5xl leading-none select-none block">{msg.stickerCode}</span>
          ) : msg.type === "voice" ? (
            <VoicePlayer data={msg.voiceData} color={accentColor} />
          ) : (
            <p className="text-sm leading-relaxed break-words">{msg.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Voice Player ───────────────────────────────────────────── */
function VoicePlayer({ data, color }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  function toggle() {
    if (!audioRef.current) {
      audioRef.current = new Audio(data);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else          { audioRef.current.play(); setPlaying(true); }
  }

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <button onClick={toggle} className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all active:scale-90"
        style={{ background: color, boxShadow: `0 0 8px ${color}88` }}>
        {playing ? "⏸" : "▶"}
      </button>
      <div className="flex items-center gap-0.5 flex-1">
        {Array.from({length: 14}, (_, i) => (
          <div key={i} className="w-[3px] rounded-full"
            style={{ height: `${8 + Math.sin(i * 1.3) * 6}px`, background: playing ? color : `${color}66`, animation: playing ? `pop-float ${0.3+i*0.05}s ease-in-out infinite` : "none" }} />
        ))}
      </div>
      <span className="text-[10px] text-white/40">🎤</span>
    </div>
  );
}

/* ─── Sticker Picker ─────────────────────────────────────────── */
function StickerPicker({ onPick, onClose }) {
  const [tab, setTab] = useState(0);
  return (
    <div className="manga-panel absolute bottom-full left-0 mb-2 w-72 rounded-2xl z-40 overflow-hidden"
      style={{ background: "#0a0f1e", border: "2px solid #1e2d4d", boxShadow: "4px 4px 0 #000" }}>
      <div className="flex border-b border-white/10">
        {STICKER_PACKS.map((p, i) => (
          <button key={i} onClick={() => setTab(i)}
            className={`flex-1 py-2 text-xs font-bold transition-all ${tab === i ? "text-indigo-400 border-b-2 border-indigo-400" : "text-white/40"}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 p-3">
        {STICKER_PACKS[tab].stickers.map((s) => (
          <button key={s} onClick={() => { onPick(s); onClose(); }}
            className="text-2xl leading-none p-1.5 rounded-xl hover:bg-white/10 active:scale-90 transition-all">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Chat Page ─────────────────────────────────────────── */
export default function ChatPage() {
  const { token, name: ctxName, updateName, ready } = useUser();
  const [userName, setUserName] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showStickers, setShowStickers] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [lastTs, setLastTs] = useState(null);
  const [onlineCount] = useState(() => 847 + Math.floor(Math.random() * 120));

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const mediaRecRef = useRef(null);
  const audioChunks = useRef([]);
  const pollingRef = useRef(null);

  /* Sync userName from context */
  useEffect(() => { if (ready) setUserName(ctxName || null); }, [ready, ctxName]);

  /* Initial load */
  useEffect(() => {
    loadMessages();
  }, []);

  /* Polling */
  useEffect(() => {
    pollingRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollingRef.current);
  }, [lastTs]);

  async function loadMessages() {
    try {
      const r = await fetch("/api/chat/messages?limit=60");
      const data = await r.json();
      if (Array.isArray(data) && data.length) {
        setMessages(data);
        setLastTs(data[data.length - 1]?.createdAt || null);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch {}
  }

  const poll = useCallback(async () => {
    if (!lastTs) return;
    try {
      const r = await fetch(`/api/chat/messages?after=${encodeURIComponent(lastTs)}`);
      const data = await r.json();
      if (Array.isArray(data) && data.length) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newOnes = data.filter(m => !existingIds.has(m.id));
          if (!newOnes.length) return prev;
          return [...prev, ...newOnes];
        });
        setLastTs(data[data.length - 1]?.createdAt || lastTs);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      }
    } catch {}
  }, [lastTs]);

  /* Scroll to bottom when new messages arrive */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendMsg(type, extra = {}) {
    if (!token || !userName) return;
    setSending(true);
    try {
      const body = {
        token,
        displayName: userName,
        type,
        ...(type === "text" && { message: input.trim() }),
        ...(replyTo && { replyTo: replyTo.id, replyToName: replyTo.displayName, replyToPreview: replyTo.type === "text" ? replyTo.message?.slice(0, 80) : "[stiker/suara]" }),
        ...extra,
      };

      const r = await fetch("/api/chat/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) return;
      if (type === "text") setInput("");
      setReplyTo(null);

      // Optimistic local add
      const d = await r.json();
      const localMsg = { id: d.msgId, token, displayName: userName, message: body.message || "", type, createdAt: d.createdAt || new Date().toISOString(), ...extra, replyTo: body.replyTo || null, replyToName: body.replyToName || null, replyToPreview: body.replyToPreview || null };
      setMessages(prev => [...prev, localMsg]);
      setLastTs(localMsg.createdAt);

      // Trigger AI reply after short delay
      setTimeout(() => {
        fetch("/api/chat/ai-reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: body.message || "[stiker/suara]", type, displayName: userName }) }).catch(() => {});
      }, 1800 + Math.random() * 1500);
    } catch {}
    finally { setSending(false); }
  }

  function handleSend() {
    if (!input.trim() || sending) return;
    sendMsg("text");
  }

  function handleSticker(code) {
    sendMsg("sticker", { stickerCode: code });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecRef.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecRef.current.ondataavailable = e => audioChunks.current.push(e.data);
      mediaRecRef.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = e => sendMsg("voice", { voiceData: e.target.result });
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecRef.current.start();
      setRecording(true);
    } catch { alert("Tidak bisa akses mikrofon."); }
  }

  function stopRecording() {
    mediaRecRef.current?.stop();
    setRecording(false);
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#06090f" }}>
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-white font-bold mb-4">Login dulu untuk akses grup chat</p>
          <Link href="/" className="px-6 py-3 rounded-xl font-bold text-white text-sm" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>Kembali</Link>
        </div>
      </div>
    );
  }

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "#06090f" }}><div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "linear-gradient(180deg,#06090f 0%,#080d1e 100%)" }}>
      {/* ── Name modal ── */}
      {ready && !userName && (
        <SetNameModal token={token} onSaved={async n => { await updateName(n).catch(() => {}); setUserName(n); }} />
      )}

      {/* ── Header ── */}
      <header className="manga-halftone relative flex-shrink-0 px-4 py-3 flex items-center gap-3 z-10"
        style={{ background: "linear-gradient(90deg,#06090f 0%,#0d1730 60%,#0a1040 100%)", borderBottom: "2px solid #1e2d4d", boxShadow: "0 4px 20px #000a" }}>
        {/* Speed lines */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(175deg, transparent 0, transparent 18px, rgba(255,255,255,1) 18px, rgba(255,255,255,1) 19px)" }} />
        <Link href="/dashboard" className="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all flex-shrink-0">
          ←
        </Link>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 pop-float"
          style={{ background: "linear-gradient(135deg,#1e1b4b,#0d1730)", border: "2px solid #6366f1", boxShadow: "0 0 16px #6366f166" }}>
          🎌
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-white text-base leading-tight">Artapedia Community</h1>
          <p className="text-xs text-indigo-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" style={{ boxShadow: "0 0 6px #4ade80" }} />
            {onlineCount.toLocaleString("id-ID")} anggota aktif
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {Object.values(AI_PERSONAS).slice(0, 4).map((p, i) => (
            <div key={i} className="w-6 h-6 rounded-lg flex items-center justify-center text-sm"
              style={{ background: `${p.color}22`, border: `1px solid ${p.color}66`, marginLeft: i > 0 ? -4 : 0 }}>
              {p.avatar}
            </div>
          ))}
          <span className="text-[10px] text-white/40 ml-1">+{Object.keys(AI_PERSONAS).length}</span>
        </div>
      </header>

      {/* ── Member pills ── */}
      <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar"
        style={{ borderBottom: "1px solid #ffffff08" }}>
        {Object.entries(AI_PERSONAS).map(([name, p]) => (
          <div key={name} className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: `${p.color}18`, border: `1px solid ${p.color}44`, color: p.color }}>
            <span>{p.avatar}</span>{name}
          </div>
        ))}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1" id="chat-scroll">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-40 pt-16">
            <div className="text-5xl mb-3">💬</div>
            <p className="text-white text-sm">Belum ada pesan. Mulai dulu!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MsgBubble
            key={msg.id || i}
            msg={msg}
            isMine={msg.token === token}
            onReply={m => { setReplyTo(m); inputRef.current?.focus(); }}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Reply bar ── */}
      {replyTo && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 mx-3 mb-1 rounded-xl"
          style={{ background: "#0d1730", border: "1.5px solid #6366f144" }}>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-indigo-400">Membalas {replyTo.displayName}</p>
            <p className="text-[11px] text-white/50 truncate">{replyTo.type === "text" ? replyTo.message : "[stiker/suara]"}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 px-3 pb-4 pt-2 relative">
        <div className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ background: "#0a0f1e", border: "2px solid #1e2d4d", boxShadow: "0 -4px 20px #0008" }}>

          {/* Emoji quick */}
          <div className="relative">
            <button onClick={() => { setShowEmoji(v => !v); setShowStickers(false); }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg hover:bg-white/10 transition-all active:scale-90">
              😊
            </button>
            {showEmoji && (
              <div className="absolute bottom-full left-0 mb-2 flex gap-1 p-2 rounded-2xl z-40 flex-wrap w-48"
                style={{ background: "#0a0f1e", border: "2px solid #1e2d4d", boxShadow: "4px 4px 0 #000" }}>
                {QUICK_EMOJI.map(e => (
                  <button key={e} onClick={() => { setInput(v => v + e); setShowEmoji(false); inputRef.current?.focus(); }}
                    className="text-xl p-1 rounded-lg hover:bg-white/10 active:scale-90 transition-all">{e}</button>
                ))}
              </div>
            )}
          </div>

          {/* Sticker */}
          <div className="relative">
            <button onClick={() => { setShowStickers(v => !v); setShowEmoji(false); }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg hover:bg-white/10 transition-all active:scale-90">
              🎭
            </button>
            {showStickers && <StickerPicker onPick={handleSticker} onClose={() => setShowStickers(false)} />}
          </div>

          {/* Text input */}
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ketik pesan..."
            maxLength={500}
            className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none min-w-0"
          />

          {/* Voice note */}
          <button
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all active:scale-90 ${recording ? "ring-pulse relative" : "hover:bg-white/10"}`}
            style={recording ? { background: "#ef444444", color: "#ef4444" } : {}}>
            🎤
          </button>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all active:scale-90 disabled:opacity-30 flex-shrink-0"
            style={{ background: input.trim() ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#ffffff10", boxShadow: input.trim() ? "0 0 12px #6366f166" : "none" }}>
            {sending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "➤"}
          </button>
        </div>

        {/* Recording indicator */}
        {recording && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 px-4 py-1.5 rounded-full flex items-center gap-2 badge-pop"
            style={{ background: "#ef4444", boxShadow: "0 0 16px #ef444488" }}>
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white text-xs font-bold">Merekam...</span>
          </div>
        )}
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        #chat-scroll::-webkit-scrollbar { width: 3px; }
        #chat-scroll::-webkit-scrollbar-track { background: transparent; }
        #chat-scroll::-webkit-scrollbar-thumb { background: #1e2d4d; border-radius: 99px; }
      `}</style>
    </div>
  );
}
