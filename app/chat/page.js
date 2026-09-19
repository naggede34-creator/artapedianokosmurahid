"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@/app/providers";
import Link from "next/link";

/* ─── AI Personas ─────────────────────────────────────────────── */
const AI_PERSONAS = {
  Sanzz:        { emoji: "🦅", color: "#6366f1" },
  Manz:         { emoji: "🐺", color: "#8b5cf6" },
  Ara:          { emoji: "🌸", color: "#ec4899" },
  "Dunia OTP":  { emoji: "🌏", color: "#14b8a6" },
  "Fascall ID": { emoji: "⚡", color: "#f59e0b" },
  Zall:         { emoji: "🎯", color: "#10b981" },
};

/* ─── Sticker Packs ───────────────────────────────────────────── */
const STICKER_PACKS = [
  { label: "Ekspresi", s: ["😂","🤣","😍","🥰","😎","🤩","😤","🥺","😭","🤯","🤔","🫡","😏","🥳"] },
  { label: "Hewan",   s: ["🦅","🐺","🌸","🌏","⚡","🎯","🦊","🐱","🦁","🐉","🦋","🐸","🦄","🐻"] },
  { label: "OTP",     s: ["📱","💻","🔑","🔐","💳","💰","🚀","⚡","🌏","🎯","📲","🛡️","💎","🔥"] },
];

/* ─── Helpers ─────────────────────────────────────────────────── */
function timeStr(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function dateLabel(date) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return "Hari ini";
  if (diffDays === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long" });
}

function getNameColor(name) {
  if (!name) return "#128C7E";
  const cols = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f59e0b","#10b981","#3b82f6","#e11d48","#0891b2","#7c3aed"];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return cols[h % cols.length];
}

/* ─── Voice Player ────────────────────────────────────────────── */
function VoicePlayer({ data, isMine }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  function toggle() {
    if (!audioRef.current) {
      audioRef.current = new Audio(data);
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); };
      audioRef.current.ontimeupdate = () => {
        const a = audioRef.current;
        if (a.duration) setProgress(a.currentTime / a.duration);
      };
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else          { audioRef.current.play(); setPlaying(true); }
  }

  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:180 }}>
      <button onClick={toggle}
        style={{ width:38, height:38, borderRadius:"50%", background: isMine ? "#075E54" : "#128C7E", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          {playing
            ? <><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>
            : <path d="M8 5v14l11-7z"/>}
        </svg>
      </button>
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:5 }}>
        <div style={{ position:"relative", height:3, background: isMine ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.15)", borderRadius:2 }}>
          <div style={{ position:"absolute", top:0, left:0, height:"100%", width:`${progress*100}%`, background: isMine ? "#ffffff" : "#128C7E", borderRadius:2, transition:"width .1s linear" }} />
          <div style={{ position:"absolute", top:"50%", left:`${progress*100}%`, transform:"translate(-50%,-50%)", width:10, height:10, borderRadius:"50%", background: isMine ? "#ffffff" : "#128C7E" }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontSize:11, color: isMine ? "rgba(255,255,255,.7)" : "#888" }}>🎤 VN</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Message Bubble ──────────────────────────────────────────── */
function MsgBubble({ msg, isMine, onReply, prevSender }) {
  const persona = msg.isAI && AI_PERSONAS[msg.aiPersona];
  const nameColor = msg.isAI && persona ? persona.color : getNameColor(msg.displayName);
  const avatarEmoji = persona ? persona.emoji : msg.displayName?.[0]?.toUpperCase();
  const showAvatar = !isMine && msg.displayName !== prevSender;
  const showName   = !isMine && msg.displayName !== prevSender;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems: isMine ? "flex-end" : "flex-start", paddingLeft: isMine ? 0 : (showAvatar ? 0 : 38), marginBottom:2 }}>
      <div style={{ display:"flex", gap:6, alignItems:"flex-end", maxWidth: msg.type === "sticker" ? 120 : 290, flexDirection: isMine ? "row-reverse" : "row" }}>
        {/* Avatar */}
        {!isMine && (
          <div style={{ width:30, height:30, flexShrink:0, visibility: showAvatar ? "visible" : "hidden" }}>
            {showAvatar && (
              <div style={{ width:30, height:30, borderRadius:"50%", background:`linear-gradient(135deg,${nameColor},${nameColor}99)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"white", border:`1.5px solid ${nameColor}40` }}>
                {avatarEmoji}
              </div>
            )}
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", alignItems: isMine ? "flex-end" : "flex-start" }}>
          {/* Sender name */}
          {showName && (
            <div style={{ fontSize:11.5, fontWeight:700, color:nameColor, marginBottom:2, paddingLeft:2 }}>{msg.displayName}</div>
          )}

          {/* Sticker — no bubble */}
          {msg.type === "sticker" ? (
            <div style={{ padding:"4px 2px", cursor:"default" }} onClick={() => onReply(msg)}>
              <span style={{ fontSize:54, lineHeight:1, display:"block" }}>{msg.stickerCode}</span>
              <div style={{ textAlign: isMine ? "right" : "left" }}>
                <span style={{ fontSize:11, color:"#8a9aab" }}>{timeStr(msg.createdAt)}</span>
              </div>
            </div>
          ) : (
            /* Text / Voice bubble */
            <div
              onClick={() => onReply(msg)}
              style={{
                padding: msg.type === "voice" ? "8px 12px" : "7px 11px",
                borderRadius: isMine ? "8px 8px 0 8px" : "8px 8px 8px 0",
                background: isMine ? "#DCF8C6" : "#FFFFFF",
                boxShadow:"0 1px 1px rgba(0,0,0,.1)",
                cursor:"pointer",
                maxWidth: 270,
              }}>
              {/* Reply preview */}
              {msg.replyTo && (
                <div style={{ background:"rgba(0,0,0,.06)", borderLeft:`3px solid ${nameColor}`, borderRadius:4, padding:"5px 8px", marginBottom:7 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:nameColor, marginBottom:1 }}>{msg.replyToName}</div>
                  <div style={{ fontSize:12, color:"#555", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:210 }}>{msg.replyToPreview || "…"}</div>
                </div>
              )}

              {msg.type === "voice"
                ? <VoicePlayer data={msg.voiceData} isMine={isMine} />
                : <div style={{ fontSize:14, color:"#111", lineHeight:1.45, wordBreak:"break-word" }}>{msg.message}</div>
              }

              {/* Time + read ticks */}
              <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:3, marginTop: msg.type === "voice" ? 4 : 3 }}>
                <span style={{ fontSize:11, color:"#8a9aab" }}>{timeStr(msg.createdAt)}</span>
                {isMine && (
                  <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
                    <path d="M15.01 1.41L13.6 0 5.93 7.67 2.43 4.18 1.01 5.59l4.92 4.92 9.08-9.1z" fill="#53bdeb"/>
                    <path d="M11.01 1.41L9.6 0 6.42 3.17 7.84 4.59l3.17-3.18z" fill="#53bdeb"/>
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sticker Picker ──────────────────────────────────────────── */
function StickerPicker({ onPick, onClose }) {
  const [tab, setTab] = useState(0);
  return (
    <div style={{ position:"absolute", bottom:"100%", left:0, marginBottom:4, width:288, background:"white", borderRadius:12, boxShadow:"0 4px 24px rgba(0,0,0,.18)", overflow:"hidden", zIndex:50 }}>
      <div style={{ display:"flex", borderBottom:"1px solid #eee" }}>
        {STICKER_PACKS.map((p, i) => (
          <button key={i} onClick={() => setTab(i)}
            style={{ flex:1, padding:"9px 0", background:"none", border:"none", cursor:"pointer", fontSize:12, fontWeight:600, color: tab===i ? "#128C7E" : "#999", borderBottom: tab===i ? "2px solid #128C7E" : "2px solid transparent" }}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:4, padding:10 }}>
        {STICKER_PACKS[tab].s.map(s => (
          <button key={s} onClick={() => { onPick(s); onClose(); }}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:24, padding:4, borderRadius:6, lineHeight:1 }}
            onMouseEnter={e => e.target.style.background="#f0faf9"}
            onMouseLeave={e => e.target.style.background="none"}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Set Name Modal ──────────────────────────────────────────── */
function SetNameModal({ token, onSaved }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    const n = name.trim();
    if (n.length < 2) { setErr("Minimal 2 karakter"); return; }
    if (n.length > 20) { setErr("Maksimal 20 karakter"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/user/name", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ token, name:n }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onSaved(n);
    } catch(e) { setErr(e.message || "Gagal"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:60, display:"flex", alignItems:"center", justifyContent:"center", padding:20, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)" }}>
      <div style={{ background:"white", borderRadius:16, overflow:"hidden", width:"100%", maxWidth:340, boxShadow:"0 8px 32px rgba(0,0,0,.35)" }}>
        {/* Accent bar */}
        <div style={{ height:5, background:"linear-gradient(90deg,#075E54,#25D366,#128C7E)" }} />
        <div style={{ padding:"28px 24px 24px" }}>
          {/* Icon */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, marginBottom:22 }}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#128C7E,#25D366)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 16px rgba(18,140,126,.4)" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:700, color:"#111", marginBottom:4 }}>Masuk Grup Chat</div>
              <div style={{ fontSize:13.5, color:"#666", lineHeight:1.4 }}>Atur nama tampilan kamu sebelum mulai chat di Artapedia Community</div>
            </div>
          </div>
          {/* Input */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12.5, fontWeight:600, color:"#128C7E", marginBottom:6 }}>Nama Kamu</label>
            <div style={{ border:"1.5px solid #128C7E", borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", gap:10, background:"#f9fdfc" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#128C7E"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              <input type="text" placeholder="Nama tampilan (2–20 karakter)" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()} maxLength={20}
                style={{ flex:1, fontSize:15, border:"none", outline:"none", background:"transparent", color:"#111" }} autoFocus />
            </div>
            {err && <p style={{ fontSize:12, color:"#e53e3e", marginTop:4 }}>{err}</p>}
            <p style={{ fontSize:11.5, color:"#999", marginTop:5 }}>Nama ini terlihat oleh semua anggota grup.</p>
          </div>
          {/* Button */}
          <button onClick={save} disabled={loading || !name.trim()}
            style={{ width:"100%", padding:"13px 0", borderRadius:10, background:"linear-gradient(135deg,#128C7E,#25D366)", border:"none", color:"white", fontSize:15, fontWeight:700, cursor: loading||!name.trim() ? "not-allowed" : "pointer", opacity: loading||!name.trim() ? .6 : 1, boxShadow:"0 3px 12px rgba(18,140,126,.35)" }}>
            {loading ? "Menyimpan..." : "✓  Masuk ke Grup"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────── */
export default function ChatPage() {
  const { token, name: ctxName, updateName, ready } = useUser();
  const [userName, setUserName] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showStickers, setShowStickers] = useState(false);
  const [recording, setRecording] = useState(false);
  const [lastTs, setLastTs] = useState(null);
  const [onlineCount] = useState(() => 847 + Math.floor(Math.random() * 120));

  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const mediaRecRef = useRef(null);
  const audioChunks = useRef([]);

  /* Sync name from context */
  useEffect(() => { if (ready) setUserName(ctxName || null); }, [ready, ctxName]);

  /* Initial load */
  useEffect(() => { loadMessages(); }, []);

  /* Polling */
  useEffect(() => {
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [lastTs]);

  async function loadMessages() {
    try {
      const r = await fetch("/api/chat/messages?limit=60");
      const data = await r.json();
      if (Array.isArray(data) && data.length) {
        setMessages(data);
        setLastTs(data[data.length-1]?.createdAt);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 80);
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
          const ids = new Set(prev.map(m=>m.id));
          const fresh = data.filter(m=>!ids.has(m.id));
          if (!fresh.length) return prev;
          return [...prev, ...fresh];
        });
        setLastTs(data[data.length-1]?.createdAt);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 80);
      }
    } catch {}
  }, [lastTs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages.length]);

  async function sendMsg(type, extra={}) {
    if (!token || !userName) return;
    setSending(true);
    try {
      const body = { token, displayName:userName, type,
        ...(type==="text" && { message:input.trim() }),
        ...(replyTo && { replyTo:replyTo.id, replyToName:replyTo.displayName, replyToPreview: replyTo.type==="text" ? replyTo.message?.slice(0,80) : "[stiker/suara]" }),
        ...extra };
      const r = await fetch("/api/chat/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      if (!r.ok) return;
      const d = await r.json();
      if (type==="text") setInput("");
      setReplyTo(null);
      const localMsg = { id:d.msgId, token, displayName:userName, message:body.message||"", type, createdAt:d.createdAt||new Date().toISOString(), ...extra, replyTo:body.replyTo||null, replyToName:body.replyToName||null, replyToPreview:body.replyToPreview||null };
      setMessages(prev => [...prev, localMsg]);
      setLastTs(localMsg.createdAt);
      setTimeout(() => {
        fetch("/api/chat/ai-reply", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ message:body.message||"[stiker/suara]", type, displayName:userName }) }).catch(()=>{});
      }, 1800 + Math.random()*1400);
    } catch {}
    finally { setSending(false); }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      mediaRecRef.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecRef.current.ondataavailable = e => audioChunks.current.push(e.data);
      mediaRecRef.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type:"audio/webm" });
        const reader = new FileReader();
        reader.onload = e => sendMsg("voice", { voiceData:e.target.result });
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t=>t.stop());
      };
      mediaRecRef.current.start();
      setRecording(true);
    } catch { alert("Tidak bisa akses mikrofon."); }
  }

  function stopRecording() { mediaRecRef.current?.stop(); setRecording(false); }

  /* Group messages by date */
  const grouped = [];
  let lastDate = null;
  messages.forEach((msg, i) => {
    const d = dateLabel(msg.createdAt);
    if (d !== lastDate) { grouped.push({ type:"date", label:d, key:`d-${i}` }); lastDate=d; }
    grouped.push({ type:"msg", msg, key:msg.id||i, prev: messages[i-1]?.displayName });
  });

  if (!ready) {
    return (
      <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#E5DDD5" }}>
        <div style={{ width:36, height:36, border:"3px solid #128C7E", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, background:"#E5DDD5", fontFamily:"system-ui,sans-serif" }}>
        <div style={{ fontSize:48 }}>🔒</div>
        <p style={{ color:"#333", fontWeight:600 }}>Login dulu untuk akses grup chat</p>
        <Link href="/" style={{ padding:"12px 28px", borderRadius:10, background:"#128C7E", color:"white", fontWeight:700, textDecoration:"none" }}>Kembali</Link>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", maxWidth:480, margin:"0 auto", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", background:"#E5DDD5", overflow:"hidden" }}>

      {/* Name modal */}
      {ready && !userName && (
        <SetNameModal token={token} onSaved={async n => { await updateName(n).catch(()=>{}); setUserName(n); }} />
      )}

      {/* ── Header ── */}
      <div style={{ background:"#128C7E", display:"flex", alignItems:"center", gap:8, padding:"10px 8px", flexShrink:0, boxShadow:"0 1px 4px rgba(0,0,0,.25)" }}>
        <Link href="/dashboard" style={{ padding:8, display:"flex", color:"white", flexShrink:0 }} aria-label="Kembali">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </Link>
        <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#25D366,#075E54)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:20, boxShadow:"0 2px 6px rgba(0,0,0,.3)" }}>🎌</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:"white", fontSize:16, fontWeight:600, lineHeight:1.2 }}>Artapedia Community</div>
          <div style={{ color:"rgba(255,255,255,.82)", fontSize:11.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {Object.keys(AI_PERSONAS).join(", ")} • {onlineCount.toLocaleString("id-ID")} online
          </div>
        </div>
        <div style={{ display:"flex", flexShrink:0 }}>
          <button style={{ background:"none", border:"none", padding:8, cursor:"pointer", display:"flex" }} aria-label="Info">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
          </button>
        </div>
      </div>

      {/* ── Member pills ── */}
      <div style={{ background:"rgba(255,255,255,.55)", borderBottom:"1px solid rgba(0,0,0,.06)", padding:"6px 10px", display:"flex", gap:6, overflowX:"auto", flexShrink:0 }}>
        {Object.entries(AI_PERSONAS).map(([name, p]) => (
          <div key={name} style={{ flexShrink:0, display:"flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:99, background:`${p.color}18`, border:`1px solid ${p.color}40`, whiteSpace:"nowrap" }}>
            <span style={{ fontSize:13 }}>{p.emoji}</span>
            <span style={{ fontSize:11.5, fontWeight:600, color:p.color }}>{name}</span>
          </div>
        ))}
        <style>{`.no-sb::-webkit-scrollbar{display:none}`}</style>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex:1, overflowY:"auto", padding:"8px 8px 4px" }} className="chat-scroll">
        {grouped.length === 0 && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:8, opacity:.5 }}>
            <div style={{ fontSize:40 }}>💬</div>
            <p style={{ color:"#555", fontSize:13 }}>Belum ada pesan. Mulai percakapan!</p>
          </div>
        )}
        {grouped.map(item => item.type === "date" ? (
          <div key={item.key} style={{ display:"flex", alignItems:"center", gap:8, margin:"10px 0 8px" }}>
            <div style={{ flex:1, height:1, background:"rgba(0,0,0,.1)" }} />
            <div style={{ background:"rgba(255,255,255,.78)", borderRadius:8, padding:"4px 12px", fontSize:12, color:"#666" }}>{item.label}</div>
            <div style={{ flex:1, height:1, background:"rgba(0,0,0,.1)" }} />
          </div>
        ) : (
          <MsgBubble key={item.key} msg={item.msg} isMine={item.msg.token===token} onReply={m=>{ setReplyTo(m); inputRef.current?.focus(); }} prevSender={item.prev} />
        ))}
        <div ref={bottomRef} style={{ height:4 }} />
      </div>

      {/* ── Reply bar ── */}
      {replyTo && (
        <div style={{ background:"white", borderTop:"1px solid #eee", padding:"7px 10px", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <div style={{ width:4, height:38, background:"#128C7E", borderRadius:2, flexShrink:0 }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#128C7E", marginBottom:1 }}>{replyTo.displayName}</div>
            <div style={{ fontSize:12.5, color:"#888", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{replyTo.type==="text" ? replyTo.message : "[stiker/suara]"}</div>
          </div>
          <button onClick={()=>setReplyTo(null)} style={{ background:"none", border:"none", padding:6, cursor:"pointer", display:"flex", flexShrink:0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#aaa"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      )}

      {/* ── Input bar ── */}
      <div style={{ background:"#F0F2F1", padding:8, display:"flex", alignItems:"flex-end", gap:8, flexShrink:0 }}>
        {/* Left section: emoji + sticker + text input + attachment */}
        <div style={{ flex:1, background:"white", borderRadius:24, display:"flex", alignItems:"center", padding:"6px 12px", gap:8, minHeight:46, boxShadow:"0 1px 2px rgba(0,0,0,.1)", position:"relative" }}>
          {/* Emoji */}
          <button style={{ background:"none", border:"none", padding:2, cursor:"pointer", flexShrink:0, fontSize:22, lineHeight:1, opacity:.7 }} aria-label="Emoji"
            onClick={() => setInput(v => v + "😊")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#8a9aab"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
          </button>

          {/* Input */}
          <input ref={inputRef} type="text" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&input.trim()&&sendMsg("text")} placeholder="Ketik pesan" maxLength={500}
            style={{ flex:1, fontSize:15, border:"none", outline:"none", background:"transparent", color:"#111", minWidth:0 }} />

          {/* Sticker */}
          <div style={{ position:"relative", flexShrink:0 }}>
            <button onClick={() => setShowStickers(v=>!v)} style={{ background:"none", border:"none", padding:2, cursor:"pointer", display:"flex" }} aria-label="Stiker">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#8a9aab"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.64-.56 3.54-1.47.65.89 1.77 1.47 2.96 1.47 1.97 0 3.5-1.6 3.5-3.57V12c0-5.52-4.48-10-10-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>
            </button>
            {showStickers && <StickerPicker onPick={s => sendMsg("sticker",{stickerCode:s})} onClose={()=>setShowStickers(false)} />}
          </div>
        </div>

        {/* Right: mic/send button */}
        {input.trim() ? (
          <button onClick={() => sendMsg("text")} disabled={sending}
            style={{ width:48, height:48, borderRadius:"50%", background:"#128C7E", border:"none", cursor:sending?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 2px 6px rgba(0,0,0,.25)", opacity:sending?.6:1 }}>
            {sending
              ? <div style={{ width:20, height:20, border:"2px solid white", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite" }} />
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            }
          </button>
        ) : (
          <button
            onPointerDown={startRecording} onPointerUp={stopRecording} onPointerLeave={stopRecording}
            style={{ width:48, height:48, borderRadius:"50%", background: recording ? "#dc2626" : "#128C7E", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 2px 6px rgba(0,0,0,.25)", transition:"background .2s" }}
            aria-label="Pesan suara">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
          </button>
        )}
      </div>

      {/* Recording toast */}
      {recording && (
        <div style={{ position:"fixed", top:80, left:"50%", transform:"translateX(-50%)", background:"#dc2626", color:"white", borderRadius:99, padding:"8px 20px", display:"flex", alignItems:"center", gap:8, fontSize:13, fontWeight:600, boxShadow:"0 4px 16px rgba(220,38,38,.4)", zIndex:99 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:"white", display:"inline-block", animation:"pulse 1s infinite" }} />
          Merekam… lepas untuk kirim
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        .chat-scroll::-webkit-scrollbar { width: 3px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 99px; }
        .no-sb::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
