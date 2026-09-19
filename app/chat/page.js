"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@/app/providers";
import Link from "next/link";

/* ─── AI Personas ─────────────────────────────────────────────── */
const AI_PERSONAS = {
  Sanzz:        { emoji: "🦅", color: "#6366f1" },
  Manz:         { emoji: "🐺", color: "#8b5cf6" },
  Ara:          { emoji: "🌸", color: "#ec4899" },
  "Dunia OTP":  { emoji: "🌏", color: "#0891b2" },
  "Fascall ID": { emoji: "⚡", color: "#f59e0b" },
  Zall:         { emoji: "🎯", color: "#10b981" },
};

/* ─── Sticker Packs ───────────────────────────────────────────── */
const STICKER_PACKS = [
  { label: "Ekspresi", s: ["😂","🤣","😍","🥰","😎","🤩","😤","🥺","😭","🤯","🤔","🫡","😏","🥳"] },
  { label: "Hewan",   s: ["🦅","🐺","🌸","🌏","⚡","🎯","🦊","🐱","🦁","🐉","🦋","🐸","🦄","🐻"] },
  { label: "OTP",     s: ["📱","💻","🔑","🔐","💳","💰","🚀","⚡","🌏","🎯","📲","🛡️","💎","🔥"] },
];

const EMOJI_QUICK = ["😂","😍","👍","🔥","💯","😎","🤩","❤️","😭","🫡"];

/* ─── Helpers ─────────────────────────────────────────────────── */
function timeStr(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit", hour12:false });
}

function dateLabel(date) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return "Hari ini";
  if (diffDays === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day:"numeric", month:"long" });
}

function getNameColor(name) {
  if (!name) return "#128C7E";
  const cols = ["#6366f1","#8b5cf6","#ec4899","#0891b2","#f59e0b","#10b981","#3b82f6","#e11d48","#0ea5e9","#7c3aed"];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return cols[h % cols.length];
}

function getInitials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
}

/* ─── Voice Player ────────────────────────────────────────────── */
function VoicePlayer({ data, isMine }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const audioRef = useRef(null);

  function toggle() {
    if (!audioRef.current) {
      audioRef.current = new Audio(data);
      audioRef.current.onloadedmetadata = () => setDuration(audioRef.current.duration||0);
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); setElapsed(0); };
      audioRef.current.ontimeupdate = () => {
        const a = audioRef.current;
        if (a.duration) { setProgress(a.currentTime / a.duration); setElapsed(Math.floor(a.currentTime)); }
      };
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else          { audioRef.current.play(); setPlaying(true); }
  }

  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const barColor = isMine ? "rgba(255,255,255,.9)" : "#128C7E";
  const trackColor = isMine ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.12)";

  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:180, maxWidth:230 }}>
      <button onClick={toggle}
        style={{ width:40, height:40, borderRadius:"50%", background: isMine ? "rgba(255,255,255,.25)" : "rgba(18,140,126,.12)", border:`1.5px solid ${isMine?"rgba(255,255,255,.4)":"rgba(18,140,126,.3)"}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"transform .15s", backdropFilter:"blur(4px)" }}
        onMouseDown={e=>e.currentTarget.style.transform="scale(.92)"}
        onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={isMine?"white":barColor}>
          {playing
            ? <><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></>
            : <path d="M8 5v14l11-7z"/>}
        </svg>
      </button>
      <div style={{ flex:1 }}>
        {/* Waveform bars */}
        <div style={{ display:"flex", alignItems:"center", gap:2, height:28, marginBottom:4 }}>
          {Array.from({length:24}).map((_,i)=>{
            const h = 6 + (Math.sin(i*0.7)*2 + Math.cos(i*0.4)*3 + 5);
            const filled = i / 24 <= progress;
            return <div key={i} style={{ width:2.5, height:h, borderRadius:2, background: filled ? barColor : trackColor, flexShrink:0, transition:"background .1s" }} />;
          })}
        </div>
        <div style={{ fontSize:10.5, color: isMine ? "rgba(255,255,255,.7)" : "#888", fontWeight:500 }}>
          {playing ? fmt(elapsed) : (duration ? fmt(Math.round(duration)) : "🎤 VN")}
        </div>
      </div>
    </div>
  );
}

/* ─── Message Bubble ──────────────────────────────────────────── */
function MsgBubble({ msg, isMine, onReply, prevSender, nextSender }) {
  const persona = msg.isAI && AI_PERSONAS[msg.aiPersona];
  const nameColor = msg.isAI && persona ? persona.color : getNameColor(msg.displayName);
  const showSenderInfo = !isMine && msg.displayName !== prevSender;
  const isLastInGroup = !isMine && msg.displayName !== nextSender;

  const sentGrad = "linear-gradient(135deg,#25D366,#128C7E)";
  const bubbleBg = isMine ? sentGrad : "rgba(255,255,255,.97)";
  const textColor = isMine ? "white" : "#111";
  const timeColor = isMine ? "rgba(255,255,255,.7)" : "#a0adb8";

  const br = msg.type === "sticker" ? 0
    : isMine ? "18px 18px 4px 18px"
    : showSenderInfo ? "4px 18px 18px 18px" : "18px 18px 18px 4px";

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems: isMine ? "flex-end" : "flex-start", marginBottom: showSenderInfo ? 8 : 2, paddingLeft: !isMine ? 0 : 0 }}>
      <div style={{ display:"flex", gap:8, alignItems:"flex-end", maxWidth: msg.type==="sticker" ? 130 : 300, flexDirection: isMine ? "row-reverse" : "row" }}>

        {/* Avatar */}
        {!isMine && (
          <div style={{ width:34, height:34, flexShrink:0, marginBottom:2 }}>
            {isLastInGroup && (
              <div style={{ width:34, height:34, borderRadius:"50%", background:`linear-gradient(135deg,${nameColor}cc,${nameColor})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize: persona ? 16 : 13, fontWeight:700, color:"white", boxShadow:`0 2px 8px ${nameColor}55` }}>
                {persona ? persona.emoji : getInitials(msg.displayName)}
              </div>
            )}
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", alignItems: isMine ? "flex-end" : "flex-start", maxWidth: msg.type==="sticker" ? 130 : 270 }}>
          {/* Sender name */}
          {showSenderInfo && (
            <div style={{ fontSize:12, fontWeight:700, color:nameColor, marginBottom:3, paddingLeft:2, letterSpacing:.1 }}>{msg.displayName}</div>
          )}

          {msg.type === "sticker" ? (
            <div onClick={() => onReply(msg)} style={{ cursor:"pointer", padding:4, borderRadius:12 }}>
              <span style={{ fontSize:58, lineHeight:1, display:"block" }}>{msg.stickerCode}</span>
              <span style={{ fontSize:10.5, color:"#a0adb8", display:"block", textAlign: isMine?"right":"left", marginTop:2 }}>{timeStr(msg.createdAt)}</span>
            </div>
          ) : (
            <div onClick={() => onReply(msg)} style={{ borderRadius:br, background:bubbleBg, boxShadow: isMine ? "0 2px 8px rgba(37,211,102,.35)" : "0 2px 8px rgba(0,0,0,.08)", padding: msg.type==="voice" ? "10px 14px 8px" : "9px 13px 7px", cursor:"pointer", backdropFilter: isMine ? "none" : "blur(2px)", border: isMine ? "none" : "1px solid rgba(0,0,0,.05)" }}>

              {/* Reply preview */}
              {msg.replyTo && (
                <div style={{ background: isMine ? "rgba(0,0,0,.18)" : "rgba(0,0,0,.06)", borderLeft:`3px solid ${isMine?"rgba(255,255,255,.8)":nameColor}`, borderRadius:"0 8px 8px 0", padding:"6px 9px", marginBottom:8 }}>
                  <div style={{ fontSize:11.5, fontWeight:700, color: isMine?"rgba(255,255,255,.9)":nameColor, marginBottom:2 }}>{msg.replyToName}</div>
                  <div style={{ fontSize:12, color: isMine?"rgba(255,255,255,.7)":"#666", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:200 }}>{msg.replyToPreview||"…"}</div>
                </div>
              )}

              {msg.type === "voice"
                ? <VoicePlayer data={msg.voiceData} isMine={isMine} />
                : <div style={{ fontSize:14.5, color:textColor, lineHeight:1.5, wordBreak:"break-word", fontWeight:400 }}>{msg.message}</div>
              }

              {/* Time + ticks */}
              <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:4, marginTop:5 }}>
                <span style={{ fontSize:11, color:timeColor, fontWeight:400 }}>{timeStr(msg.createdAt)}</span>
                {isMine && (
                  <svg width="16" height="11" viewBox="0 0 16 11">
                    <path d="M15.01 1.41L13.6 0 5.93 7.67 2.43 4.18 1.01 5.59l4.92 4.92 9.08-9.1z" fill="rgba(255,255,255,.85)"/>
                    <path d="M11.01 1.41L9.6 0 6.42 3.17 7.84 4.59l3.17-3.18z" fill="rgba(255,255,255,.85)"/>
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

/* ─── Emoji Quick Picker ──────────────────────────────────────── */
function EmojiPicker({ onPick, onClose }) {
  const [tab, setTab] = useState(0);
  return (
    <div style={{ position:"absolute", bottom:"calc(100% + 8px)", left:0, width:300, background:"rgba(20,20,30,.95)", borderRadius:16, boxShadow:"0 8px 32px rgba(0,0,0,.4)", overflow:"hidden", zIndex:50, backdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,.08)" }}>
      {/* Quick row */}
      <div style={{ display:"flex", padding:"10px 10px 6px", gap:4, borderBottom:"1px solid rgba(255,255,255,.06)" }}>
        {EMOJI_QUICK.map(e=>(
          <button key={e} onClick={()=>{onPick(e);onClose();}} style={{ flex:1, background:"none", border:"none", cursor:"pointer", fontSize:20, padding:"4px 2px", borderRadius:8, transition:"background .15s" }}
            onMouseEnter={ev=>ev.currentTarget.style.background="rgba(255,255,255,.1)"}
            onMouseLeave={ev=>ev.currentTarget.style.background="none"}>{e}</button>
        ))}
      </div>
      {/* Sticker packs */}
      <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,.06)" }}>
        {STICKER_PACKS.map((p,i)=>(
          <button key={i} onClick={()=>setTab(i)} style={{ flex:1, padding:"8px 0", background:"none", border:"none", cursor:"pointer", fontSize:11.5, fontWeight:600, color:tab===i?"#25D366":"rgba(255,255,255,.4)", borderBottom: tab===i?"2px solid #25D366":"2px solid transparent", transition:"all .2s" }}>{p.label}</button>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, padding:"8px 8px 10px" }}>
        {STICKER_PACKS[tab].s.map(s=>(
          <button key={s} onClick={()=>{onPick(s);onClose();}} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, padding:5, borderRadius:8, lineHeight:1, transition:"background .15s, transform .1s" }}
            onMouseEnter={ev=>{ev.currentTarget.style.background="rgba(255,255,255,.08)";ev.currentTarget.style.transform="scale(1.15)"}}
            onMouseLeave={ev=>{ev.currentTarget.style.background="none";ev.currentTarget.style.transform="scale(1)"}}>{s}</button>
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
  const [focused, setFocused] = useState(false);

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
    } catch(e) { setErr(e.message || "Gagal menyimpan nama"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:60, display:"flex", alignItems:"center", justifyContent:"center", padding:20, background:"rgba(0,0,0,.65)", backdropFilter:"blur(8px)" }}>
      <div style={{ width:"100%", maxWidth:360, animation:"modalIn .3s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ background:"rgba(22,24,30,.97)", borderRadius:24, overflow:"hidden", boxShadow:"0 24px 64px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.07)" }}>
          {/* Gradient top bar */}
          <div style={{ height:4, background:"linear-gradient(90deg,#075E54,#25D366,#128C7E,#25D366)" }} />

          <div style={{ padding:"30px 28px 26px" }}>
            {/* Icon */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14, marginBottom:26 }}>
              <div style={{ position:"relative" }}>
                <div style={{ width:80, height:80, borderRadius:"50%", background:"linear-gradient(135deg,#128C7E,#25D366)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 8px 24px rgba(37,211,102,.4), 0 0 0 8px rgba(37,211,102,.08)" }}>
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                </div>
                <div style={{ position:"absolute", bottom:2, right:2, width:20, height:20, borderRadius:"50%", background:"#25D366", display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid rgba(22,24,30,.97)" }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="white"><path d="M2 5l2.5 2.5L8 2.5"/></svg>
                </div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:"white", marginBottom:6, letterSpacing:"-.3px" }}>Bergabung ke Grup</div>
                <div style={{ fontSize:13.5, color:"rgba(255,255,255,.5)", lineHeight:1.5 }}>Atur nama tampilan sebelum mulai chat di <span style={{ color:"#25D366", fontWeight:600 }}>Artapedia Community</span></div>
              </div>
            </div>

            {/* Input */}
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,.4)", marginBottom:8, textTransform:"uppercase", letterSpacing:".8px" }}>Nama Tampilan</div>
              <div style={{ borderRadius:14, padding:"1px", background: focused ? "linear-gradient(135deg,#128C7E,#25D366)" : "rgba(255,255,255,.08)", transition:"background .2s" }}>
                <div style={{ borderRadius:13, background:"rgba(255,255,255,.05)", padding:"12px 16px", display:"flex", alignItems:"center", gap:10 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={focused?"#25D366":"rgba(255,255,255,.3)"}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  <input type="text" placeholder="Nama kamu (2–20 karakter)" value={name}
                    onChange={e=>{ setName(e.target.value); setErr(""); }}
                    onKeyDown={e=>e.key==="Enter"&&save()}
                    onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
                    maxLength={20} autoFocus
                    style={{ flex:1, fontSize:15, border:"none", outline:"none", background:"transparent", color:"white", fontWeight:500 }} />
                  <span style={{ fontSize:11.5, color:"rgba(255,255,255,.25)", flexShrink:0 }}>{name.length}/20</span>
                </div>
              </div>
              {err && <div style={{ fontSize:12, color:"#fc8181", marginTop:6, paddingLeft:2 }}>⚠ {err}</div>}
            </div>

            {/* Button */}
            <button onClick={save} disabled={loading || name.trim().length < 2}
              style={{ width:"100%", padding:"14px 0", borderRadius:14, background: name.trim().length >= 2 ? "linear-gradient(135deg,#128C7E,#25D366)" : "rgba(255,255,255,.07)", border:"none", color: name.trim().length >= 2 ? "white" : "rgba(255,255,255,.3)", fontSize:15, fontWeight:700, cursor: loading||name.trim().length<2 ? "not-allowed" : "pointer", transition:"all .2s", boxShadow: name.trim().length >= 2 ? "0 4px 16px rgba(37,211,102,.4)" : "none", letterSpacing:".2px" }}>
              {loading ? (
                <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <span style={{ width:16, height:16, border:"2px solid rgba(255,255,255,.4)", borderTopColor:"white", borderRadius:"50%", display:"inline-block", animation:"spin .7s linear infinite" }} />
                  Menyimpan...
                </span>
              ) : "Masuk ke Grup →"}
            </button>

            <div style={{ textAlign:"center", marginTop:14, fontSize:11.5, color:"rgba(255,255,255,.2)" }}>🔒 Nama hanya terlihat di grup ini</div>
          </div>
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
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [lastTs, setLastTs] = useState(null);
  const [onlineCount] = useState(() => 847 + Math.floor(Math.random() * 120));

  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const mediaRecRef = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => { if (ready) setUserName(ctxName || null); }, [ready, ctxName]);
  useEffect(() => { loadMessages(); }, []);
  useEffect(() => { const id = setInterval(poll, 3000); return () => clearInterval(id); }, [lastTs]);

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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages.length]);

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
      const localMsg = { id:d.msgId, token, displayName:userName, type, createdAt:d.createdAt||new Date().toISOString(), ...extra, message:body.message||"", replyTo:body.replyTo||null, replyToName:body.replyToName||null, replyToPreview:body.replyToPreview||null };
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
    grouped.push({ type:"msg", msg, key:msg.id||i, prev:messages[i-1]?.displayName, next:messages[i+1]?.displayName });
  });

  if (!ready) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#0a0e1a,#111827)" }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
        <div style={{ width:48, height:48, borderRadius:"50%", background:"linear-gradient(135deg,#128C7E,#25D366)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:24, height:24, border:"2.5px solid rgba(255,255,255,.35)", borderTopColor:"white", borderRadius:"50%", animation:"spin .8s linear infinite" }} />
        </div>
        <span style={{ color:"rgba(255,255,255,.5)", fontSize:13 }}>Memuat chat...</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!token) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, background:"linear-gradient(135deg,#0a0e1a,#111827)", fontFamily:"system-ui,sans-serif" }}>
      <div style={{ fontSize:52 }}>🔒</div>
      <p style={{ color:"rgba(255,255,255,.7)", fontWeight:600, fontSize:16 }}>Login dulu untuk akses grup chat</p>
      <Link href="/" style={{ padding:"12px 28px", borderRadius:12, background:"linear-gradient(135deg,#128C7E,#25D366)", color:"white", fontWeight:700, textDecoration:"none", boxShadow:"0 4px 16px rgba(37,211,102,.35)" }}>Kembali</Link>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", maxWidth:520, margin:"0 auto", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", background:"#0d1117", overflow:"hidden", position:"relative" }}>

      {/* Name modal */}
      {ready && !userName && (
        <SetNameModal token={token} onSaved={async n => { await updateName(n).catch(()=>{}); setUserName(n); }} />
      )}

      {/* ── Header ── */}
      <div style={{ background:"linear-gradient(180deg,rgba(7,94,84,.98),rgba(18,140,126,.95))", display:"flex", alignItems:"center", gap:10, padding:"12px 8px 12px 4px", flexShrink:0, boxShadow:"0 2px 16px rgba(0,0,0,.4)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(255,255,255,.06)", position:"relative", zIndex:10 }}>
        <Link href="/dashboard" style={{ padding:8, display:"flex", color:"white", flexShrink:0, borderRadius:"50%", transition:"background .15s" }}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.12)"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}
          aria-label="Kembali">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </Link>

        {/* Avatar */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#25D366,#075E54)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, boxShadow:"0 3px 10px rgba(0,0,0,.4), 0 0 0 2px rgba(37,211,102,.3)" }}>🎌</div>
          <div style={{ position:"absolute", bottom:1, right:1, width:12, height:12, borderRadius:"50%", background:"#25D366", border:"2px solid #075E54" }} />
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:"white", fontSize:16, fontWeight:700, lineHeight:1.2, letterSpacing:"-.2px" }}>Artapedia Community</div>
          <div style={{ color:"rgba(255,255,255,.6)", fontSize:11.5, marginTop:1.5, display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#25D366", flexShrink:0, boxShadow:"0 0 4px #25D366" }} />
            {onlineCount.toLocaleString("id-ID")} anggota online
          </div>
        </div>

        {/* Action icons */}
        <div style={{ display:"flex", gap:2, flexShrink:0 }}>
          {[
            <path key="search" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>,
            <circle key="dot1" cx="12" cy="5" r="1.8"/>,
          ].map((_, idx) => idx === 0 ? (
            <button key={idx} style={{ background:"none", border:"none", padding:8, cursor:"pointer", display:"flex", borderRadius:"50%", transition:"background .15s" }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.12)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              aria-label="Cari pesan">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,.8)"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            </button>
          ) : (
            <button key={idx} style={{ background:"none", border:"none", padding:8, cursor:"pointer", display:"flex", borderRadius:"50%", transition:"background .15s" }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.12)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              aria-label="Menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,.8)"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
            </button>
          ))}
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex:1, overflowY:"auto", padding:"12px 10px 6px", background:"linear-gradient(180deg,#0d1117 0%,#111827 100%)", position:"relative" }} className="chat-scroll">

        {/* Subtle pattern overlay */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle, rgba(37,211,102,.03) 1px, transparent 1px)", backgroundSize:"24px 24px", pointerEvents:"none" }} />

        {grouped.length === 0 && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:12, padding:"40px 20px" }}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"rgba(37,211,102,.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, border:"1px solid rgba(37,211,102,.12)" }}>💬</div>
            <div style={{ textAlign:"center" }}>
              <p style={{ color:"rgba(255,255,255,.5)", fontSize:15, fontWeight:600, margin:"0 0 4px" }}>Belum ada pesan</p>
              <p style={{ color:"rgba(255,255,255,.25)", fontSize:13, margin:0 }}>Mulai percakapan di Artapedia Community!</p>
            </div>
          </div>
        )}

        {grouped.map(item => item.type === "date" ? (
          <div key={item.key} style={{ display:"flex", alignItems:"center", gap:10, margin:"14px 0 10px" }}>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,.06)" }} />
            <div style={{ background:"rgba(255,255,255,.06)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,.08)", borderRadius:99, padding:"4px 14px", fontSize:11.5, color:"rgba(255,255,255,.45)", fontWeight:500, letterSpacing:".2px" }}>{item.label}</div>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,.06)" }} />
          </div>
        ) : (
          <MsgBubble key={item.key} msg={item.msg} isMine={item.msg.token===token}
            onReply={m=>{ setReplyTo(m); inputRef.current?.focus(); }}
            prevSender={item.prev} nextSender={item.next} />
        ))}
        <div ref={bottomRef} style={{ height:4 }} />
      </div>

      {/* ── Reply bar ── */}
      {replyTo && (
        <div style={{ background:"rgba(20,24,32,.97)", borderTop:"1px solid rgba(255,255,255,.06)", padding:"8px 12px 8px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0, backdropFilter:"blur(12px)" }}>
          <div style={{ width:3, height:36, background:"linear-gradient(180deg,#128C7E,#25D366)", borderRadius:2, flexShrink:0 }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#25D366", marginBottom:2 }}>{replyTo.displayName}</div>
            <div style={{ fontSize:12.5, color:"rgba(255,255,255,.4)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{replyTo.type==="text" ? replyTo.message : "[stiker/suara]"}</div>
          </div>
          <button onClick={()=>setReplyTo(null)} style={{ background:"rgba(255,255,255,.08)", border:"none", padding:6, cursor:"pointer", display:"flex", borderRadius:"50%", flexShrink:0, transition:"background .15s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.08)"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,.5)"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      )}

      {/* ── Input bar ── */}
      <div style={{ background:"rgba(13,17,23,.97)", padding:"10px 10px 12px", display:"flex", alignItems:"flex-end", gap:8, flexShrink:0, borderTop:"1px solid rgba(255,255,255,.05)", backdropFilter:"blur(12px)" }}>

        {/* Input container */}
        <div style={{ flex:1, background:"rgba(255,255,255,.07)", borderRadius:26, display:"flex", alignItems:"center", padding:"8px 12px", gap:8, minHeight:48, border:"1px solid rgba(255,255,255,.08)", transition:"border-color .2s", position:"relative" }}>

          {/* Emoji toggle */}
          <div style={{ position:"relative" }}>
            <button style={{ background:"none", border:"none", padding:2, cursor:"pointer", flexShrink:0, display:"flex", opacity:.7, transition:"opacity .15s, transform .15s" }} aria-label="Emoji & Stiker"
              onClick={() => setShowEmoji(v=>!v)}
              onMouseEnter={e=>{ e.currentTarget.style.opacity="1"; e.currentTarget.style.transform="scale(1.1)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.opacity=".7"; e.currentTarget.style.transform="scale(1)"; }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill={showEmoji?"#25D366":"rgba(255,255,255,.55)"}><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
            </button>
            {showEmoji && <EmojiPicker onPick={e => setInput(v=>v+e)} onClose={()=>setShowEmoji(false)} />}
          </div>

          {/* Text input */}
          <input ref={inputRef} type="text" value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&input.trim()&&sendMsg("text")}
            onFocus={e=>e.currentTarget.closest("div").style.borderColor="rgba(37,211,102,.35)"}
            onBlur={e=>e.currentTarget.closest("div").style.borderColor="rgba(255,255,255,.08)"}
            placeholder="Ketik pesan..." maxLength={500}
            style={{ flex:1, fontSize:15, border:"none", outline:"none", background:"transparent", color:"rgba(255,255,255,.9)", minWidth:0, fontWeight:400 }} />

          {/* Attachment icon */}
          <button style={{ background:"none", border:"none", padding:2, cursor:"pointer", display:"flex", opacity:.6, flexShrink:0, transition:"opacity .15s, transform .15s" }} aria-label="Lampiran"
            onMouseEnter={e=>{ e.currentTarget.style.opacity="1"; e.currentTarget.style.transform="scale(1.1)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.opacity=".6"; e.currentTarget.style.transform="scale(1)"; }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,255,255,.55)"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
          </button>
        </div>

        {/* Send / Mic button */}
        {input.trim() ? (
          <button onClick={() => sendMsg("text")} disabled={sending}
            style={{ width:50, height:50, borderRadius:"50%", background:"linear-gradient(135deg,#128C7E,#25D366)", border:"none", cursor:sending?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 4px 16px rgba(37,211,102,.45)", opacity:sending?.6:1, transition:"transform .15s, box-shadow .15s" }}
            onMouseDown={e=>{ e.currentTarget.style.transform="scale(.92)"; e.currentTarget.style.boxShadow="0 2px 8px rgba(37,211,102,.3)"; }}
            onMouseUp={e=>{ e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.boxShadow="0 4px 16px rgba(37,211,102,.45)"; }}>
            {sending
              ? <div style={{ width:22, height:22, border:"2.5px solid rgba(255,255,255,.4)", borderTopColor:"white", borderRadius:"50%", animation:"spin .7s linear infinite" }} />
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            }
          </button>
        ) : (
          <button
            onPointerDown={startRecording} onPointerUp={stopRecording} onPointerLeave={stopRecording}
            style={{ width:50, height:50, borderRadius:"50%", background: recording ? "linear-gradient(135deg,#dc2626,#ef4444)" : "linear-gradient(135deg,#128C7E,#25D366)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow: recording ? "0 4px 16px rgba(220,38,38,.5)" : "0 4px 16px rgba(37,211,102,.45)", transition:"all .2s" }}
            aria-label="Pesan suara">
            {recording
              ? <span style={{ width:16, height:16, borderRadius:3, background:"white", display:"block" }} />
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
            }
          </button>
        )}
      </div>

      {/* Recording toast */}
      {recording && (
        <div style={{ position:"fixed", top:70, left:"50%", transform:"translateX(-50%)", background:"rgba(220,38,38,.9)", color:"white", borderRadius:99, padding:"10px 22px", display:"flex", alignItems:"center", gap:10, fontSize:13, fontWeight:600, boxShadow:"0 6px 24px rgba(220,38,38,.5)", zIndex:99, backdropFilter:"blur(8px)", border:"1px solid rgba(255,100,100,.3)" }}>
          <span style={{ width:10, height:10, borderRadius:"50%", background:"white", display:"inline-block", animation:"pulse 1s infinite", boxShadow:"0 0 6px white" }} />
          Merekam... lepas untuk kirim
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
        @keyframes modalIn { from{opacity:0;transform:scale(.88) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
        .chat-scroll::-webkit-scrollbar        { width: 3px; }
        .chat-scroll::-webkit-scrollbar-thumb  { background: rgba(255,255,255,.1); border-radius: 99px; }
        .chat-scroll::-webkit-scrollbar-track  { background: transparent; }
      `}</style>
    </div>
  );
}
