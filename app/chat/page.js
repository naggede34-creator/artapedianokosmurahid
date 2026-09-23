"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@/app/providers";
import { useRouter } from "next/navigation";

/* ─── AI Personas ─────────────────────────────────────────────── */
const AI_PERSONAS = {
  Sanzz:        { emoji: "🦅", color: "#6366f1" },
  Manz:         { emoji: "🐺", color: "#8b5cf6" },
  Ara:          { emoji: "🌸", color: "#ec4899" },
  "Dunia OTP":  { emoji: "🌏", color: "#0891b2" },
  "Fascall ID": { emoji: "⚡", color: "#f59e0b" },
  Zall:         { emoji: "🎯", color: "#10b981" },
};

const AI_COMMANDS = [
  { cmd: "/tanya", desc: "Tanya langsung ke AI" },
  { cmd: "/kurs", desc: "Info kurs & deposit" },
  { cmd: "/cek-otp", desc: "Panduan cek OTP" },
];

const STICKER_PACKS = [
  { label: "Ekspresi", s: ["😂","🤣","😍","🥰","😎","🤩","😤","🥺","😭","🤯","🤔","🫡","😏","🥳"] },
  { label: "Hewan",   s: ["🦅","🐺","🌸","🌏","⚡","🎯","🦊","🐱","🦁","🐉","🦋","🐸","🦄","🐻"] },
  { label: "OTP",     s: ["📱","💻","🔑","🔐","💳","💰","🚀","⚡","🌏","🎯","📲","🛡️","💎","🔥"] },
];

const QUICK_EMOJI = ["😂","😍","👍","🔥","💯","❤️","😎","🤩","🥺","🫡"];
const REACT_EMOJI = ["👍","❤️","😂","😮","😢","🙏","🔥","💯"];

/* ─── Helpers ─────────────────────────────────────────────────── */
function timeStr(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit", hour12:false });
}

function dateLabel(d) {
  if (!d) return "";
  const date = new Date(d), now = new Date();
  const diff = Math.floor((now - date) / 86400000);
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  return date.toLocaleDateString("id-ID", { day:"numeric", month:"long" });
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

function highlightMentions(text, myName) {
  if (!text || !text.includes("@")) return text;
  return text.split(/(@\w[\w\s]*)/g).map((part, i) => {
    if (part.startsWith("@")) {
      const isMe = myName && part.toLowerCase().includes(myName.toLowerCase());
      return (
        <span key={i} style={{ color: isMe ? "#fbbf24" : "#25D366", fontWeight:700 }}>{part}</span>
      );
    }
    return part;
  });
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
        if (a.duration) { setProgress(a.currentTime/a.duration); setElapsed(Math.floor(a.currentTime)); }
      };
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const bar = isMine ? "rgba(255,255,255,.9)" : "#25D366";
  const track = isMine ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.12)";

  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:190, maxWidth:240 }}>
      <button onClick={toggle} style={{ width:40, height:40, borderRadius:"50%", background: isMine ? "rgba(255,255,255,.2)" : "rgba(37,211,102,.15)", border:`1.5px solid ${isMine?"rgba(255,255,255,.35)":"rgba(37,211,102,.4)"}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={isMine?"white":bar}>
          {playing ? <><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></> : <path d="M8 5v14l11-7z"/>}
        </svg>
      </button>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:2, height:28, marginBottom:3 }}>
          {Array.from({length:24}).map((_,i) => {
            const h = 5 + Math.abs(Math.sin(i*0.7+1)*3 + Math.cos(i*0.4)*4);
            return <div key={i} style={{ width:2.5, height:h, borderRadius:2, background: i/24<=progress?bar:track, flexShrink:0, transition:"background .1s" }} />;
          })}
        </div>
        <div style={{ fontSize:10.5, color: isMine?"rgba(255,255,255,.6)":"rgba(255,255,255,.4)", fontWeight:500 }}>
          {playing ? fmt(elapsed) : (duration ? fmt(Math.round(duration)) : "🎤 VN")}
        </div>
      </div>
    </div>
  );
}

/* ─── Poll Bubble ─────────────────────────────────────────────── */
function PollBubble({ msg, token, onVote }) {
  const total = (msg.pollOptions||[]).reduce((s,o) => s+(o.voters?.length||0), 0);
  const myVote = (msg.pollOptions||[]).find(o => (o.voters||[]).includes(token));

  return (
    <div style={{ minWidth:220, maxWidth:280 }}>
      <div style={{ fontSize:13.5, fontWeight:700, color:"white", marginBottom:10, lineHeight:1.35 }}>📊 {msg.pollQuestion}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {(msg.pollOptions||[]).map(opt => {
          const pct = total > 0 ? Math.round((opt.voters?.length||0)/total*100) : 0;
          const voted = (opt.voters||[]).includes(token);
          return (
            <button key={opt.id} onClick={() => onVote(msg.id, opt.id)}
              style={{ background:"none", border:`1.5px solid ${voted?"#25D366":"rgba(255,255,255,.2)"}`, borderRadius:10, padding:"8px 12px", cursor:"pointer", position:"relative", overflow:"hidden", textAlign:"left" }}>
              <div style={{ position:"absolute", top:0, left:0, height:"100%", width:`${pct}%`, background: voted?"rgba(37,211,102,.2)":"rgba(255,255,255,.06)", transition:"width .4s ease", borderRadius:8 }} />
              <div style={{ position:"relative", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:13, color: voted?"#25D366":"rgba(255,255,255,.8)", fontWeight: voted?700:400 }}>{voted?"✓ ":""}{opt.text}</span>
                <span style={{ fontSize:11.5, color:"rgba(255,255,255,.45)", flexShrink:0 }}>{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize:11, color:"rgba(255,255,255,.35)", marginTop:7 }}>
        {total} suara{myVote ? ` · kamu memilih "${myVote.text}"` : ""}
      </div>
    </div>
  );
}

/* ─── Reaction Row ────────────────────────────────────────────── */
function ReactionRow({ reactions, token, onReact }) {
  if (!reactions || !Object.keys(reactions).length) return null;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:4 }}>
      {Object.entries(reactions).map(([emoji, voters]) => {
        if (!voters?.length) return null;
        const mine = voters.includes(token);
        return (
          <button key={emoji} onClick={() => onReact(emoji)}
            style={{ display:"flex", alignItems:"center", gap:3, padding:"2px 8px", borderRadius:99, background: mine?"rgba(37,211,102,.2)":"rgba(255,255,255,.08)", border:`1px solid ${mine?"rgba(37,211,102,.5)":"rgba(255,255,255,.12)"}`, cursor:"pointer", fontSize:13, color: mine?"#25D366":"rgba(255,255,255,.7)", fontWeight: mine?700:400, transition:"all .15s" }}>
            {emoji} <span style={{ fontSize:11 }}>{voters.length}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Reaction Picker ─────────────────────────────────────────── */
function ReactionPicker({ onPick, onClose, style }) {
  return (
    <div style={{ position:"absolute", zIndex:100, background:"rgba(20,24,32,.97)", border:"1px solid rgba(255,255,255,.1)", borderRadius:99, padding:"6px 10px", display:"flex", gap:6, boxShadow:"0 8px 24px rgba(0,0,0,.5)", backdropFilter:"blur(16px)", ...style }}>
      {REACT_EMOJI.map(e => (
        <button key={e} onClick={() => { onPick(e); onClose(); }}
          style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, padding:3, borderRadius:8, lineHeight:1, transition:"transform .15s" }}
          onMouseEnter={ev=>ev.currentTarget.style.transform="scale(1.35)"}
          onMouseLeave={ev=>ev.currentTarget.style.transform="scale(1)"}>
          {e}
        </button>
      ))}
    </div>
  );
}

/* ─── Message Bubble ──────────────────────────────────────────── */
function MsgBubble({ msg, isMine, onReply, prevSender, nextSender, token, isAdmin, onPin, onReact, onVote, onDelete }) {
  const [konfirmHapus, setKonfirmHapus] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const holdTimer = useRef(null);
  const bubbleRef = useRef(null);

  const persona = msg.isAI && AI_PERSONAS[msg.aiPersona];
  const nameColor = msg.isAI && persona ? persona.color : getNameColor(msg.displayName);
  const showSenderInfo = !isMine && msg.displayName !== prevSender;
  const isLastInGroup = !isMine && msg.displayName !== nextSender;

  function startHold() {
    holdTimer.current = setTimeout(() => setShowReactionPicker(true), 500);
  }
  function endHold() { clearTimeout(holdTimer.current); }

  useEffect(() => () => clearTimeout(holdTimer.current), []);

  if (msg.isSystem) {
    return (
      <div style={{ display:"flex", justifyContent:"center", margin:"8px 0" }}>
        <div style={{ background:"rgba(37,211,102,.1)", border:"1px solid rgba(37,211,102,.2)", borderRadius:99, padding:"6px 16px", fontSize:12.5, color:"rgba(37,211,102,.9)", fontWeight:500, maxWidth:320, textAlign:"center" }}>
          📢 {msg.message}
        </div>
      </div>
    );
  }

  const sentGrad = "linear-gradient(135deg,#1da878,#25D366)";
  const bubbleBg = isMine ? sentGrad : "rgba(255,255,255,.07)";
  const textColor = "rgba(255,255,255,.92)";
  const timeColor = isMine ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.35)";

  const br = msg.type === "sticker" ? 0
    : isMine ? "18px 18px 4px 18px"
    : showSenderInfo ? "4px 18px 18px 18px" : "18px 18px 18px 4px";

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems: isMine?"flex-end":"flex-start", marginBottom: showSenderInfo?10:3, position:"relative" }}>
      <div style={{ display:"flex", gap:8, alignItems:"flex-end", flexDirection: isMine?"row-reverse":"row", maxWidth: msg.type==="sticker"?140:320 }}>

        {/* Avatar */}
        {!isMine && (
          <div style={{ width:36, height:36, flexShrink:0, marginBottom:2 }}>
            {isLastInGroup && (
              <div style={{ width:36, height:36, borderRadius:"50%", background:`linear-gradient(135deg,${nameColor}cc,${nameColor})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize: persona?16:13, fontWeight:700, color:"white", boxShadow:`0 2px 8px ${nameColor}44`, cursor:"default" }}>
                {persona ? persona.emoji : getInitials(msg.displayName)}
              </div>
            )}
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", alignItems: isMine?"flex-end":"flex-start", maxWidth: msg.type==="sticker"?130:290 }}>
          {showSenderInfo && (
            <div style={{ fontSize:12, fontWeight:700, color:nameColor, marginBottom:4, paddingLeft:2, letterSpacing:.1 }}>{msg.displayName}</div>
          )}

          {msg.type === "sticker" ? (
            <div onClick={() => onReply(msg)} style={{ cursor:"pointer", padding:4 }}>
              <span style={{ fontSize:60, lineHeight:1, display:"block" }}>{msg.stickerCode}</span>
              <span style={{ fontSize:10.5, color:"rgba(255,255,255,.3)", display:"block", textAlign:isMine?"right":"left", marginTop:2 }}>{timeStr(msg.createdAt)}</span>
            </div>
          ) : msg.type === "image" ? (
            <div ref={bubbleRef} style={{ borderRadius:br, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,.4)", cursor:"pointer", maxWidth:240 }}
              onContextMenu={e=>{ e.preventDefault(); setShowReactionPicker(true); }}
              onTouchStart={startHold} onTouchEnd={endHold} onMouseDown={endHold}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={msg.imageData} alt="img" style={{ width:"100%", maxWidth:240, display:"block", borderRadius:br }} onClick={() => onReply(msg)} />
              <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:3, padding:"4px 8px 5px", background:"rgba(0,0,0,.3)" }}>
                <span style={{ fontSize:10.5, color:"rgba(255,255,255,.6)" }}>{timeStr(msg.createdAt)}</span>
                {isMine && <svg width="15" height="10" viewBox="0 0 16 11"><path d="M15.01 1.41L13.6 0 5.93 7.67 2.43 4.18 1.01 5.59l4.92 4.92 9.08-9.1z" fill="rgba(255,255,255,.8)"/><path d="M11.01 1.41L9.6 0 6.42 3.17 7.84 4.59l3.17-3.18z" fill="rgba(255,255,255,.8)"/></svg>}
              </div>
            </div>
          ) : msg.type === "poll" ? (
            <div style={{ borderRadius:br, background:"rgba(37,211,102,.08)", border:"1px solid rgba(37,211,102,.2)", padding:"12px 14px 10px", maxWidth:290, boxShadow:"0 2px 12px rgba(0,0,0,.3)" }}>
              <PollBubble msg={msg} token={token} onVote={onVote} />
              <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
                <span style={{ fontSize:10.5, color:"rgba(255,255,255,.35)" }}>{timeStr(msg.createdAt)}</span>
              </div>
            </div>
          ) : (
            <div ref={bubbleRef}
              onClick={() => onReply(msg)}
              onContextMenu={e=>{ e.preventDefault(); setShowReactionPicker(v=>!v); }}
              onTouchStart={startHold} onTouchEnd={endHold} onMouseDown={endHold}
              style={{ borderRadius:br, background:bubbleBg, boxShadow: isMine?"0 2px 10px rgba(37,211,102,.25)":"0 2px 10px rgba(0,0,0,.2)", padding: msg.type==="voice"?"10px 14px 8px":"9px 13px 7px", cursor:"pointer", border: isMine?"none":"1px solid rgba(255,255,255,.06)" }}>

              {msg.replyTo && (
                <div style={{ background: isMine?"rgba(0,0,0,.2)":"rgba(255,255,255,.06)", borderLeft:`3px solid ${isMine?"rgba(255,255,255,.7)":nameColor}`, borderRadius:"0 8px 8px 0", padding:"5px 9px", marginBottom:8 }}>
                  <div style={{ fontSize:11.5, fontWeight:700, color: isMine?"rgba(255,255,255,.8)":nameColor, marginBottom:2 }}>{msg.replyToName}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,.45)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:210 }}>{msg.replyToPreview||"…"}</div>
                </div>
              )}

              {msg.type === "voice"
                ? <VoicePlayer data={msg.voiceData} isMine={isMine} />
                : <div style={{ fontSize:14.5, color:textColor, lineHeight:1.5, wordBreak:"break-word" }}>
                    {highlightMentions(msg.message, null)}
                  </div>
              }

              <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:4, marginTop:5 }}>
                <span style={{ fontSize:10.5, color:timeColor }}>{timeStr(msg.createdAt)}</span>
                {isMine && <svg width="16" height="11" viewBox="0 0 16 11"><path d="M15.01 1.41L13.6 0 5.93 7.67 2.43 4.18 1.01 5.59l4.92 4.92 9.08-9.1z" fill="rgba(255,255,255,.75)"/><path d="M11.01 1.41L9.6 0 6.42 3.17 7.84 4.59l3.17-3.18z" fill="rgba(255,255,255,.75)"/></svg>}
              </div>
            </div>
          )}

          {/* Reactions */}
          <ReactionRow reactions={msg.reactions} token={token} onReact={e => onReact(msg.id, e)} />
        </div>
      </div>

      {/* Context menu */}
      {showReactionPicker && (
        <>
          <div style={{ position:"fixed", inset:0, zIndex:99 }} onClick={()=>setShowReactionPicker(false)} />
          <ReactionPicker onPick={e => onReact(msg.id, e)} onClose={()=>setShowReactionPicker(false)}
            style={{ bottom:"calc(100% + 4px)", [isMine?"right":"left"]:0 }} />
          {/* Menunya sekarang untuk SEMUA orang, bukan admin saja. Sebelumnya
              hanya admin yang punya menu, jadi tidak ada satu pun cara bagi
              pengirimnya menghapus pesannya sendiri. */}
          <div style={{ position:"absolute", bottom:"calc(100% + 54px)", [isMine?"right":"left"]:0, zIndex:101, background:"rgba(20,24,32,.97)", border:"1px solid rgba(255,255,255,.1)", borderRadius:12, padding:4, display:"flex", flexDirection:"column", boxShadow:"0 8px 24px rgba(0,0,0,.5)", minWidth:184 }}>
            <button onClick={() => { onReply(msg); setShowReactionPicker(false); }} style={menuBtn}>↩ Balas</button>

            {isAdmin && (
              <button onClick={() => { onPin(msg.id, msg.pinned); setShowReactionPicker(false); }}
                style={{ ...menuBtn, color: msg.pinned ? "#fb923c" : "rgba(255,255,255,.8)" }}>
                📌 {msg.pinned ? "Unpin" : "Pin Pesan"}
              </button>
            )}

            <div style={{ height:1, background:"rgba(255,255,255,.08)", margin:"4px 8px" }} />

            {/* Selalu boleh: cuma menyembunyikan dari layar sendiri. */}
            <button onClick={() => { onDelete(msg.id, "me"); setShowReactionPicker(false); }} style={menuBtn}>
              🙈 Hapus untuk saya
            </button>

            {/* Untuk semua: pengirimnya, atau admin untuk pesan siapa pun. */}
            {(isMine || isAdmin) && (
              konfirmHapus ? (
                <button onClick={() => { onDelete(msg.id, isMine ? "all" : "admin"); setShowReactionPicker(false); }}
                  style={{ ...menuBtn, color:"#fff", background:"rgba(239,68,68,.9)", fontWeight:700 }}>
                  ⚠️ Yakin? Hapus permanen
                </button>
              ) : (
                // Satu ketukan konfirmasi: menghapus untuk semua orang tidak
                // bisa dibatalkan, dan menu ini muncul tepat di bawah jempol.
                <button onClick={(e) => { e.stopPropagation(); setKonfirmHapus(true); }}
                  style={{ ...menuBtn, color:"#f87171" }}>
                  🗑 Hapus untuk semua{!isMine && isAdmin ? " (admin)" : ""}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Gaya tombol menu pesan. Disatukan supaya baris menunya tidak perlahan-lahan
// berbeda tinggi dan warnanya satu sama lain.
const menuBtn = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "9px 12px",
  fontSize: 13,
  color: "rgba(255,255,255,.85)",
  textAlign: "left",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  gap: 8
};

/* ─── Group Settings Panel ────────────────────────────────────── */
function GroupSettingsPanel({ settings, onClose, onSaved }) {
  const [name, setName] = useState(settings.name || "");
  const [desc, setDesc] = useState(settings.desc || "");
  const [photo, setPhoto] = useState(settings.photo || null);
  const [closed, setClosed] = useState(settings.closed || false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/chat/group-settings", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name, desc, photo, closed }) });
      setSaved(true);
      onSaved({ name, desc, photo, closed });
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  async function tagAll() {
    await fetch("/api/chat/group-settings", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"tagall" }) });
    onClose();
  }

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 300000) { alert("Foto maksimal 300KB"); return; }
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:70, display:"flex" }}>
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.6)", backdropFilter:"blur(4px)" }} onClick={onClose} />
      <div style={{ position:"absolute", right:0, top:0, bottom:0, width:"min(360px,100vw)", background:"#0f1319", borderLeft:"1px solid rgba(255,255,255,.07)", display:"flex", flexDirection:"column", animation:"slideIn .25s ease" }}>
        {/* Header */}
        <div style={{ padding:"16px 18px 14px", borderBottom:"1px solid rgba(255,255,255,.06)", display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,.6)", padding:6, borderRadius:8, display:"flex" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          <span style={{ fontSize:16, fontWeight:700, color:"white" }}>Pengaturan Grup</span>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"20px 18px" }}>
          {/* Group photo */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, marginBottom:24 }}>
            <label style={{ cursor:"pointer", position:"relative" }}>
              <div style={{ width:84, height:84, borderRadius:"50%", background: photo?"transparent":"rgba(37,211,102,.15)", display:"flex", alignItems:"center", justifyContent:"center", border:"2px dashed rgba(37,211,102,.3)", overflow:"hidden" }}>
                {photo
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={photo} alt="pp" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(37,211,102,.6)"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>}
              </div>
              <div style={{ position:"absolute", bottom:2, right:2, width:24, height:24, borderRadius:"50%", background:"#25D366", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              </div>
              <input type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhoto} />
            </label>
            <span style={{ fontSize:12, color:"rgba(255,255,255,.35)" }}>Tap untuk ubah foto grup</span>
          </div>

          {/* Fields */}
          {[
            { label:"Nama Grup", val:name, set:setName, max:50, ph:"Nama grup chat" },
            { label:"Deskripsi", val:desc, set:setDesc, max:200, ph:"Deskripsi singkat grup" },
          ].map(f => (
            <div key={f.label} style={{ marginBottom:16 }}>
              <div style={{ fontSize:11.5, fontWeight:600, color:"rgba(255,255,255,.4)", marginBottom:6, textTransform:"uppercase", letterSpacing:".7px" }}>{f.label}</div>
              <div style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.08)", borderRadius:12, padding:"10px 14px", display:"flex", gap:8 }}>
                <input type="text" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} maxLength={f.max}
                  style={{ flex:1, background:"none", border:"none", outline:"none", color:"rgba(255,255,255,.85)", fontSize:14 }} />
                <span style={{ fontSize:11, color:"rgba(255,255,255,.2)", alignSelf:"flex-end" }}>{f.val.length}/{f.max}</span>
              </div>
            </div>
          ))}

          {/* Closed toggle */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, padding:"12px 14px", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:"rgba(255,255,255,.85)" }}>🔒 Tutup Grup</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,.35)", marginTop:2 }}>Member tidak bisa kirim pesan</div>
            </div>
            <button onClick={()=>setClosed(v=>!v)}
              style={{ width:48, height:28, borderRadius:99, background: closed?"#25D366":"rgba(255,255,255,.12)", border:"none", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
              <div style={{ width:22, height:22, borderRadius:"50%", background:"white", position:"absolute", top:3, left: closed?23:3, transition:"left .2s", boxShadow:"0 2px 4px rgba(0,0,0,.3)" }} />
            </button>
          </div>

          {/* Tag all */}
          <button onClick={tagAll} style={{ width:"100%", padding:"12px", borderRadius:12, background:"rgba(251,191,36,.1)", border:"1.5px solid rgba(251,191,36,.3)", color:"#fbbf24", fontSize:14, fontWeight:600, cursor:"pointer", marginBottom:12 }}>
            📢 Tag Semua Anggota (@semua)
          </button>

          {/* Save */}
          <button onClick={save} disabled={saving}
            style={{ width:"100%", padding:"13px", borderRadius:12, background: saved?"rgba(37,211,102,.25)":"linear-gradient(135deg,#128C7E,#25D366)", border:"none", color:"white", fontSize:15, fontWeight:700, cursor:saving?"not-allowed":"pointer", transition:"all .2s", boxShadow:"0 4px 14px rgba(37,211,102,.3)" }}>
            {saved ? "✓ Tersimpan" : saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Poll Creator Modal ──────────────────────────────────────── */
function PollCreator({ onSend, onClose }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  function addOption() { if (options.length < 4) setOptions(v=>[...v,""]); }
  function setOpt(i, v) { setOptions(p => p.map((o,j) => j===i?v:o)); }

  function send() {
    const q = question.trim();
    const opts = options.map(o=>o.trim()).filter(Boolean);
    if (!q || opts.length < 2) return;
    onSend(q, opts);
    onClose();
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:70, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,.65)", backdropFilter:"blur(8px)" }}>
      <div style={{ width:"100%", maxWidth:360, background:"#0f1319", borderRadius:20, overflow:"hidden", border:"1px solid rgba(255,255,255,.07)", boxShadow:"0 24px 64px rgba(0,0,0,.6)", animation:"modalIn .3s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#128C7E,#25D366)" }} />
        <div style={{ padding:"22px 20px 20px" }}>
          <div style={{ fontSize:17, fontWeight:700, color:"white", marginBottom:16 }}>📊 Buat Poll</div>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11.5, color:"rgba(255,255,255,.4)", marginBottom:6, fontWeight:600, textTransform:"uppercase", letterSpacing:".7px" }}>Pertanyaan</div>
            <div style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.1)", borderRadius:10, padding:"10px 14px" }}>
              <input type="text" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ketik pertanyaan poll..." maxLength={150}
                style={{ width:"100%", background:"none", border:"none", outline:"none", color:"rgba(255,255,255,.85)", fontSize:14 }} autoFocus />
            </div>
          </div>

          <div style={{ fontSize:11.5, color:"rgba(255,255,255,.4)", marginBottom:8, fontWeight:600, textTransform:"uppercase", letterSpacing:".7px" }}>Opsi</div>
          {options.map((o,i) => (
            <div key={i} style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.08)", borderRadius:10, padding:"9px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:12, color:"rgba(255,255,255,.3)", width:18, textAlign:"center" }}>{i+1}</span>
              <input type="text" value={o} onChange={e=>setOpt(i,e.target.value)} placeholder={`Opsi ${i+1}`} maxLength={60}
                style={{ flex:1, background:"none", border:"none", outline:"none", color:"rgba(255,255,255,.8)", fontSize:14 }} />
            </div>
          ))}

          {options.length < 4 && (
            <button onClick={addOption} style={{ width:"100%", padding:"9px", borderRadius:10, background:"none", border:"1px dashed rgba(255,255,255,.15)", color:"rgba(255,255,255,.4)", fontSize:13, cursor:"pointer", marginBottom:14 }}>+ Tambah Opsi</button>
          )}

          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button onClick={onClose} style={{ flex:1, padding:"12px", borderRadius:11, background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.08)", color:"rgba(255,255,255,.6)", fontSize:14, cursor:"pointer" }}>Batal</button>
            <button onClick={send} disabled={!question.trim()||options.filter(o=>o.trim()).length<2}
              style={{ flex:2, padding:"12px", borderRadius:11, background:"linear-gradient(135deg,#128C7E,#25D366)", border:"none", color:"white", fontSize:14, fontWeight:700, cursor:"pointer", opacity: !question.trim()||options.filter(o=>o.trim()).length<2?.4:1 }}>
              Kirim Poll
            </button>
          </div>
        </div>
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
    } catch(e) { setErr(e.message || "Gagal menyimpan"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:60, display:"flex", alignItems:"center", justifyContent:"center", padding:20, background:"rgba(0,0,0,.7)", backdropFilter:"blur(10px)" }}>
      <div style={{ width:"100%", maxWidth:360, animation:"modalIn .3s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ background:"#0f1319", borderRadius:24, overflow:"hidden", boxShadow:"0 24px 64px rgba(0,0,0,.7)", border:"1px solid rgba(255,255,255,.07)" }}>
          <div style={{ height:4, background:"linear-gradient(90deg,#075E54,#25D366,#128C7E)" }} />
          <div style={{ padding:"30px 28px 26px" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14, marginBottom:26 }}>
              <div style={{ width:80, height:80, borderRadius:"50%", background:"linear-gradient(135deg,#128C7E,#25D366)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 8px 24px rgba(37,211,102,.4), 0 0 0 8px rgba(37,211,102,.07)" }}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:"white", marginBottom:5, letterSpacing:"-.3px" }}>Bergabung ke Grup</div>
                <div style={{ fontSize:13.5, color:"rgba(255,255,255,.45)", lineHeight:1.5 }}>Atur nama tampilan sebelum chat di <span style={{ color:"#25D366", fontWeight:600 }}>Artapedia Community</span></div>
              </div>
            </div>
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11.5, fontWeight:600, color:"rgba(255,255,255,.4)", marginBottom:8, textTransform:"uppercase", letterSpacing:".7px" }}>Nama Kamu</div>
              <div style={{ borderRadius:14, padding:"1.5px", background: focused?"linear-gradient(135deg,#128C7E,#25D366)":"rgba(255,255,255,.08)", transition:"background .2s" }}>
                <div style={{ borderRadius:12.5, background:"#0f1319", padding:"11px 16px", display:"flex", alignItems:"center", gap:10 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={focused?"#25D366":"rgba(255,255,255,.3)"}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  <input type="text" placeholder="Nama tampilan (2–20 karakter)" value={name}
                    onChange={e=>{ setName(e.target.value); setErr(""); }}
                    onKeyDown={e=>e.key==="Enter"&&save()}
                    onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
                    maxLength={20} autoFocus
                    style={{ flex:1, fontSize:15, border:"none", outline:"none", background:"transparent", color:"rgba(255,255,255,.9)", fontWeight:500 }} />
                  <span style={{ fontSize:11, color:"rgba(255,255,255,.2)" }}>{name.length}/20</span>
                </div>
              </div>
              {err && <div style={{ fontSize:12, color:"#fc8181", marginTop:6, paddingLeft:2 }}>⚠ {err}</div>}
            </div>
            <button onClick={save} disabled={loading||name.trim().length<2}
              style={{ width:"100%", padding:"14px", borderRadius:14, background:name.trim().length>=2?"linear-gradient(135deg,#128C7E,#25D366)":"rgba(255,255,255,.06)", border:"none", color:name.trim().length>=2?"white":"rgba(255,255,255,.3)", fontSize:15, fontWeight:700, cursor:loading||name.trim().length<2?"not-allowed":"pointer", transition:"all .2s", boxShadow:name.trim().length>=2?"0 4px 16px rgba(37,211,102,.35)":"none" }}>
              {loading?<span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span style={{ width:16, height:16, border:"2px solid rgba(255,255,255,.35)", borderTopColor:"white", borderRadius:"50%", display:"inline-block", animation:"spin .7s linear infinite" }} />Menyimpan...</span>:"Masuk ke Grup →"}
            </button>
            <div style={{ textAlign:"center", marginTop:12, fontSize:11.5, color:"rgba(255,255,255,.18)" }}>🔒 Nama hanya terlihat di grup ini</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────── */
export default function ChatPage() {
  const router = useRouter();
  const { token, name: ctxName, updateName, ready } = useUser();
  const [userName, setUserName] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recording, setRecording] = useState(false);
  const [lastTs, setLastTs] = useState(null);
  const [onlineCount] = useState(() => 847 + Math.floor(Math.random()*120));
  const [groupSettings, setGroupSettings] = useState({ name:"Artapedia Community", desc:"", photo:null, closed:false, pinnedMsgId:null, isAdmin:false });
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [imagePreview, setImagePreview] = useState(null);

  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const mediaRecRef  = useRef(null);
  const audioChunks  = useRef([]);
  const fileInputRef = useRef(null);

  // Known member names from messages
  const knownNames = [...new Set(messages.map(m => m.displayName).filter(Boolean))];
  const mentionMatches = mentionQuery !== null
    ? [...knownNames, ...Object.keys(AI_PERSONAS)].filter(n => n.toLowerCase().includes(mentionQuery.toLowerCase()) && n !== userName).slice(0, 6)
    : [];

  useEffect(() => { if (ready) setUserName(ctxName||null); }, [ready, ctxName]);

  useEffect(() => {
    loadMessages();
    fetch("/api/chat/group-settings").then(r=>r.json()).then(d=>setGroupSettings(d)).catch(()=>{});
  }, []);

  useEffect(() => { const id = setInterval(poll, 3000); return () => clearInterval(id); }, [lastTs]);

  async function loadMessages() {
    try {
      const r = await fetch(`/api/chat/messages?limit=60${token ? `&token=${encodeURIComponent(token)}` : ""}`);
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
      const r = await fetch(
        `/api/chat/messages?after=${encodeURIComponent(lastTs)}${token ? `&token=${encodeURIComponent(token)}` : ""}`
      );
      const data = await r.json();
      if (Array.isArray(data) && data.length) {
        setMessages(prev => {
          const ids = new Set(prev.map(m=>m.id));
          const fresh = data.filter(m=>!ids.has(m.id));
          if (!fresh.length) return prev;
          // Update existing messages for reactions/poll changes
          return [...prev, ...fresh];
        });
        setLastTs(data[data.length-1]?.createdAt);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 80);
      }
    } catch {}
  }, [lastTs]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages.length]);

  /* Handle @mention input */
  function handleInputChange(e) {
    const val = e.target.value;
    setInput(val);
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atIdx = textBefore.lastIndexOf("@");
    const slashIdx = textBefore.lastIndexOf("/");

    if (atIdx !== -1 && atIdx >= textBefore.lastIndexOf(" ") && !textBefore.slice(atIdx+1).includes(" ")) {
      setMentionQuery(textBefore.slice(atIdx+1));
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }

    // AI command suggestions handled in UI
    if (slashIdx !== -1 && slashIdx === 0) {
      // Could show command hints — handled in UI overlay
    }
  }

  function insertMention(name) {
    const cursorPos = inputRef.current?.selectionStart || input.length;
    const before = input.slice(0, cursorPos);
    const after = input.slice(cursorPos);
    const atIdx = before.lastIndexOf("@");
    const newInput = before.slice(0, atIdx) + "@" + name + " " + after;
    setInput(newInput);
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function sendMsg(type, extra={}) {
    if (!token || !userName) return;
    if (groupSettings.closed && !groupSettings.isAdmin) return;
    setSending(true);
    try {
      const mentions = [];
      if (type === "text" && extra.message) {
        const m = extra.message.match(/@(\w[\w\s]*)/g);
        if (m) mentions.push(...m.map(s=>s.slice(1).trim()));
      }
      const msg = input.trim();
      const isCommand = type === "text" && (msg.startsWith("/tanya ") || msg.startsWith("/kurs") || msg.startsWith("/cek-otp"));

      const body = { token, displayName:userName, type,
        ...(type==="text" && { message:msg }),
        ...(replyTo && { replyTo:replyTo.id, replyToName:replyTo.displayName, replyToPreview:replyTo.type==="text"?replyTo.message?.slice(0,80):"[stiker/suara]" }),
        ...(mentions.length && { mentions }),
        ...(isCommand && { isCommand:true }),
        ...extra };

      const r = await fetch("/api/chat/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      if (!r.ok) {
        // Grup bisa ditutup admin tepat saat pesan ini dikirim. Statusnya
        // diperbarui di sini supaya kolom ketik langsung ikut tertutup, bukan
        // menunggu polling berikutnya sementara pesannya diam-diam hilang.
        const err = await r.json().catch(() => null);
        if (err?.closed) {
          setGroupSettings(g => ({ ...g, closed: true }));
          alert(err.error || "Room Chat sedang ditutup admin.");
        }
        return;
      }
      const d = await r.json();
      if (type === "text") setInput("");
      setReplyTo(null);
      setMentionQuery(null);
      const local = { id:d.msgId, mine:true, displayName:userName, type, createdAt:d.createdAt||new Date().toISOString(), ...extra, message:body.message||"", reactions:{}, pinned:false, mentions, replyTo:body.replyTo||null, replyToName:body.replyToName||null, replyToPreview:body.replyToPreview||null };
      setMessages(prev=>[...prev, local]);
      setLastTs(local.createdAt);
      const aiBody = { message:body.message||"[stiker/suara]", type, displayName:userName, isCommand };
      setTimeout(() => fetch("/api/chat/ai-reply", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(aiBody) }).catch(()=>{}), isCommand?500:1800+Math.random()*1400);
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

  function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) { alert("Gambar maksimal 500KB"); return; }
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function sendImage() {
    if (!imagePreview) return;
    await sendMsg("image", { imageData:imagePreview });
    setImagePreview(null);
  }

  async function handleReact(msgId, emoji) {
    if (!token) return;
    try {
      const r = await fetch("/api/chat/react", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ token, msgId, emoji }) });
      const d = await r.json();
      if (d.ok) setMessages(prev => prev.map(m => m.id===msgId ? { ...m, reactions:d.reactions } : m));
    } catch {}
  }

  async function handlePin(msgId, currentlyPinned) {
    if (!groupSettings.isAdmin) return;
    try {
      const r = await fetch("/api/chat/pin", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ msgId, unpin:currentlyPinned }) });
      const d = await r.json();
      if (d.ok) {
        setMessages(prev => prev.map(m => ({ ...m, pinned: !currentlyPinned && m.id===msgId })));
        setGroupSettings(g => ({ ...g, pinnedMsgId: currentlyPinned?null:msgId }));
      }
    } catch {}
  }

  async function handleDelete(msgId, scope) {
    try {
      const r = await fetch("/api/chat/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msgId, token, scope })
      });
      const d = await r.json();
      if (!d.ok) return;
      // Dikeluarkan dari daftar di layar, bukan menunggu polling berikutnya.
      // Jeda tiga detik antara menekan hapus dan pesannya benar-benar hilang
      // terasa seperti tombolnya tidak bekerja.
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      if (groupSettings.pinnedMsgId === msgId) {
        setGroupSettings((g) => ({ ...g, pinnedMsgId: null }));
      }
    } catch {}
  }

  async function handleVote(msgId, optionId) {
    if (!token) return;
    try {
      const r = await fetch("/api/chat/vote", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ token, msgId, optionId }) });
      const d = await r.json();
      if (d.ok) setMessages(prev => prev.map(m => m.id===msgId ? { ...m, pollOptions:d.pollOptions } : m));
    } catch {}
  }

  /* Group messages by date */
  const grouped = [];
  let lastDate = null;
  messages.forEach((msg, i) => {
    const d = dateLabel(msg.createdAt);
    if (d !== lastDate) { grouped.push({ type:"date", label:d, key:`d-${i}` }); lastDate=d; }
    grouped.push({ type:"msg", msg, key:msg.id||i, prev:messages[i-1]?.displayName, next:messages[i+1]?.displayName });
  });

  const pinnedMsg = groupSettings.pinnedMsgId ? messages.find(m=>m.id===groupSettings.pinnedMsgId) : null;
  const isCommandInput = input.startsWith("/") && input.length > 1;
  const cmdMatches = isCommandInput ? AI_COMMANDS.filter(c=>c.cmd.startsWith(input.split(" ")[0])) : [];

  if (!ready) return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"#0d1117", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:18 }}>
      <div style={{ position:"relative", width:96, height:96, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"radial-gradient(circle, rgba(247,124,34,.28), transparent 68%)", filter:"blur(10px)" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/maskot-sm.webp" alt="" style={{ width:76, height:76, objectFit:"contain", animation:"chatBob 1.8s ease-in-out infinite", filter:"drop-shadow(0 8px 14px rgba(0,0,0,.5))" }} />
      </div>
      <div style={{ width:118, height:4, borderRadius:99, background:"rgba(255,255,255,.08)", overflow:"hidden" }}>
        <div style={{ width:"42%", height:"100%", borderRadius:99, background:"linear-gradient(90deg,#f77c22,#2e86ff)", animation:"chatBar 1.1s ease-in-out infinite" }} />
      </div>
      <span style={{ color:"rgba(255,255,255,.45)", fontSize:13, letterSpacing:".2px" }}>Menyiapkan Room Chat…</span>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes chatBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes chatBar{0%{transform:translateX(-120%)}100%{transform:translateX(280%)}}
        @media (prefers-reduced-motion: reduce){
          img[alt=""]{animation:none!important}
          [style*="chatBar"]{animation:none!important}
        }
      `}</style>
    </div>
  );

  if (!token) return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"#0d1117", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:52 }}>🔒</div>
      <p style={{ color:"rgba(255,255,255,.65)", fontWeight:600, fontSize:16 }}>Login dulu untuk akses grup chat</p>
      <button onClick={()=>router.push("/")} style={{ padding:"12px 28px", borderRadius:12, background:"linear-gradient(135deg,#128C7E,#25D366)", color:"white", fontWeight:700, border:"none", cursor:"pointer", fontSize:15, boxShadow:"0 4px 16px rgba(37,211,102,.35)" }}>Kembali</button>
    </div>
  );

  return (
    /* FULL SCREEN wrapper */
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", flexDirection:"column", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", background:"#0d1117", overflow:"hidden" }}>

      {/* ── Name Modal ── */}
      {ready && !userName && <SetNameModal token={token} onSaved={async n => { await updateName(n).catch(()=>{}); setUserName(n); }} />}

      {/* ── Settings Panel ── */}
      {showSettings && (
        <GroupSettingsPanel settings={groupSettings} onClose={()=>setShowSettings(false)}
          onSaved={upd => setGroupSettings(g => ({ ...g, ...upd }))} />
      )}

      {/* ── Poll Creator ── */}
      {showPoll && (
        <PollCreator onSend={(q,opts) => sendMsg("poll", { pollQuestion:q, pollOptions:opts })} onClose={()=>setShowPoll(false)} />
      )}

      {/* ── Image preview ── */}
      {imagePreview && (
        <div style={{ position:"fixed", inset:0, zIndex:80, background:"rgba(0,0,0,.85)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="preview" style={{ maxWidth:"90vw", maxHeight:"70vh", borderRadius:12, objectFit:"contain" }} />
          <div style={{ display:"flex", gap:12 }}>
            <button onClick={()=>setImagePreview(null)} style={{ padding:"11px 24px", borderRadius:10, background:"rgba(255,255,255,.1)", border:"none", color:"rgba(255,255,255,.7)", fontSize:14, cursor:"pointer" }}>Batal</button>
            <button onClick={sendImage} disabled={sending} style={{ padding:"11px 28px", borderRadius:10, background:"linear-gradient(135deg,#128C7E,#25D366)", border:"none", color:"white", fontSize:14, fontWeight:700, cursor:"pointer" }}>Kirim Foto</button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      {/* env(safe-area-inset-top): di iPhone dan di dalam Telegram, bagian
          atas layar tertutup poni/bilah aplikasi. Tanpa ini tombol keluar
          dan nama grup tertimbun di baliknya. */}
      <div style={{ background:"linear-gradient(180deg,rgba(7,94,84,.98),rgba(12,110,97,.95))", display:"flex", alignItems:"center", gap:8, padding:"calc(10px + env(safe-area-inset-top)) 6px 10px 2px", flexShrink:0, boxShadow:"0 3px 22px rgba(0,0,0,.55)", borderBottom:"2px solid rgba(247,124,34,.55)", zIndex:10 }}>

        {/* Exit button */}
        <button onClick={() => router.back()}
          style={{ padding:8, display:"flex", color:"white", flexShrink:0, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", transition:"background .15s" }}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.12)"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}
          aria-label="Keluar chat">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>

        {/* Group avatar */}
        <div style={{ position:"relative", flexShrink:0 }}>
          {groupSettings.photo
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={groupSettings.photo} alt="grup" style={{ width:44, height:44, borderRadius:"50%", objectFit:"cover", boxShadow:"0 0 0 2.5px rgba(37,211,102,.4)", border:"none" }} />
            /* Bawaannya dulu emoji 🎌 — dua bendera Jepang, yang tidak ada
                 hubungannya dengan toko nokos Indonesia. Diganti maskot sendiri. */
            : <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#f77c22,#0a1e50)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", boxShadow:"0 0 0 2.5px rgba(247,124,34,.45)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/maskot-sm.webp" alt="" style={{ width:38, height:38, objectFit:"contain", marginTop:4 }} />
              </div>}
          <div style={{ position:"absolute", bottom:1, right:1, width:12, height:12, borderRadius:"50%", background:"#25D366", border:"2.5px solid #075E54", boxShadow:"0 0 4px rgba(37,211,102,.6)" }} />
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:"white", fontSize:16, fontWeight:700, letterSpacing:"-.2px", lineHeight:1.2 }}>{groupSettings.name}</div>
          <div style={{ color:"rgba(255,255,255,.55)", fontSize:11.5, marginTop:1.5, display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#25D366", flexShrink:0, boxShadow:"0 0 5px #25D366" }} />
            {onlineCount.toLocaleString("id-ID")} online
            {groupSettings.closed && <span style={{ background:"rgba(239,68,68,.2)", color:"#f87171", borderRadius:99, padding:"1px 8px", fontSize:10.5, fontWeight:600, marginLeft:4 }}>TUTUP</span>}
          </div>
        </div>

        {/* Header actions */}
        <div style={{ display:"flex", gap:2, flexShrink:0 }}>
          {/* Settings (admin only) */}
          {groupSettings.isAdmin && (
            <button onClick={()=>setShowSettings(true)} style={{ background:"none", border:"none", padding:8, cursor:"pointer", display:"flex", borderRadius:"50%", transition:"background .15s" }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.12)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              aria-label="Pengaturan grup">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,.8)"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
            </button>
          )}
          <button style={{ background:"none", border:"none", padding:8, cursor:"pointer", display:"flex", borderRadius:"50%", transition:"background .15s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.12)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,.8)"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
          </button>
        </div>
      </div>

      {/* ── Pinned message bar ── */}
      {pinnedMsg && (
        <div style={{ background:"rgba(37,211,102,.07)", borderBottom:"1px solid rgba(37,211,102,.15)", padding:"8px 14px", display:"flex", alignItems:"center", gap:10, flexShrink:0, cursor:"pointer" }}
          onClick={() => { const el = document.getElementById(`msg-${pinnedMsg.id}`); el?.scrollIntoView({ behavior:"smooth", block:"center" }); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366" style={{ flexShrink:0 }}><path d="M16 3H8v2h2v9l-2 2v2h4v5h2v-5h4v-2l-2-2V5h2V3zm-4 11V5h2v9h-2z"/></svg>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#25D366", marginBottom:1 }}>📌 Pesan Penting</div>
            <div style={{ fontSize:12.5, color:"rgba(255,255,255,.55)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{pinnedMsg.message || "[media]"}</div>
          </div>
          {groupSettings.isAdmin && (
            <button onClick={e=>{ e.stopPropagation(); handlePin(pinnedMsg.id, true); }} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,.3)", padding:4, display:"flex", borderRadius:"50%", flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          )}
        </div>
      )}

      {/* ── Messages ── */}
      <div style={{ flex:1, overflowY:"auto", padding:"10px 10px 4px", position:"relative" }} className="chat-scroll">
        {/* Latar komik berlapis. Tiga lapisan dengan kedalaman berbeda:
            garis kecepatan yang jauh, raster halftone dua warna di tengah,
            dan cahaya lembut dari atas. Satu raster datar saja terbaca sebagai
            tekstur; bertumpuk begini terbaca sebagai halaman komik. */}
        <div className="chat-bg-rays" />
        <div className="chat-bg-tone" />
        <div className="chat-bg-glow" />

        {grouped.length === 0 && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:12, padding:"40px 20px" }}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"rgba(37,211,102,.07)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, border:"1px solid rgba(37,211,102,.1)" }}>💬</div>
            <div style={{ textAlign:"center" }}>
              <p style={{ color:"rgba(255,255,255,.45)", fontSize:15, fontWeight:600, margin:"0 0 6px" }}>Belum ada pesan</p>
              <p style={{ color:"rgba(255,255,255,.2)", fontSize:12.5, margin:"0 0 6px" }}>Mulai percakapan di Artapedia Community!</p>
              <p style={{ color:"rgba(255,255,255,.2)", fontSize:12, margin:0 }}>Tips: ketik <span style={{ color:"#25D366" }}>/tanya</span>, <span style={{ color:"#25D366" }}>/kurs</span>, atau <span style={{ color:"#25D366" }}>/cek-otp</span> untuk tanya AI</p>
            </div>
          </div>
        )}

        {grouped.map(item => item.type === "date" ? (
          <div key={item.key} style={{ display:"flex", alignItems:"center", gap:10, margin:"14px 0 10px" }}>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,.05)" }} />
            <div style={{ background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.07)", borderRadius:99, padding:"4px 14px", fontSize:11.5, color:"rgba(255,255,255,.4)", fontWeight:500 }}>{item.label}</div>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,.05)" }} />
          </div>
        ) : (
          <div key={item.key} id={`msg-${item.msg.id}`}>
            {/* "Punyaku atau bukan" ditentukan SERVER dan datang sebagai
                item.msg.mine. Dulu dibandingkan di sini dengan token milik
                sendiri, yang berarti token semua orang harus ikut dikirim ke
                setiap peramban — dan kode akun di web ini adalah kredensial. */}
            <MsgBubble msg={item.msg} isMine={item.msg.mine === true}
              onReply={m=>{ setReplyTo(m); inputRef.current?.focus(); }}
              prevSender={item.prev} nextSender={item.next}
              token={token} isAdmin={groupSettings.isAdmin}
              onPin={handlePin} onReact={handleReact} onVote={handleVote} onDelete={handleDelete} />
          </div>
        ))}
        <div ref={bottomRef} style={{ height:4 }} />
      </div>

      {/* ── Reply bar ── */}
      {replyTo && (
        <div style={{ background:"rgba(15,19,25,.98)", borderTop:"1px solid rgba(255,255,255,.05)", padding:"8px 12px 8px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{ width:3, height:36, background:"linear-gradient(180deg,#25D366,#128C7E)", borderRadius:2, flexShrink:0 }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#25D366", marginBottom:2 }}>{replyTo.displayName}</div>
            <div style={{ fontSize:12.5, color:"rgba(255,255,255,.35)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{replyTo.type==="text"?replyTo.message:"[media]"}</div>
          </div>
          <button onClick={()=>setReplyTo(null)} style={{ background:"rgba(255,255,255,.07)", border:"none", padding:6, cursor:"pointer", display:"flex", borderRadius:"50%", flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,.45)"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      )}

      {/* ── @mention autocomplete ── */}
      {mentionQuery !== null && mentionMatches.length > 0 && (
        <div style={{ background:"rgba(15,19,25,.98)", borderTop:"1px solid rgba(255,255,255,.06)", padding:"6px 0", flexShrink:0 }}>
          {mentionMatches.map((name, i) => {
            const persona = AI_PERSONAS[name];
            const col = persona ? persona.color : getNameColor(name);
            return (
              <button key={name} onClick={() => insertMention(name)}
                style={{ width:"100%", padding:"8px 16px", background: i===mentionIndex?"rgba(37,211,102,.08)":"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:10, textAlign:"left" }}>
                <div style={{ width:30, height:30, borderRadius:"50%", background:`${col}22`, border:`1px solid ${col}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                  {persona ? persona.emoji : getInitials(name)}
                </div>
                <span style={{ fontSize:13.5, color:"rgba(255,255,255,.8)", fontWeight:500 }}>{name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── AI command hints ── */}
      {cmdMatches.length > 0 && (
        <div style={{ background:"rgba(15,19,25,.98)", borderTop:"1px solid rgba(255,255,255,.06)", padding:"4px 0", flexShrink:0 }}>
          {cmdMatches.map(c => (
            <button key={c.cmd} onClick={()=>{ setInput(c.cmd+" "); inputRef.current?.focus(); }}
              style={{ width:"100%", padding:"8px 16px", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:10, textAlign:"left" }}>
              <span style={{ fontSize:13, color:"#25D366", fontWeight:700, minWidth:80 }}>{c.cmd}</span>
              <span style={{ fontSize:12.5, color:"rgba(255,255,255,.4)" }}>{c.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      {/* env(safe-area-inset-bottom): di iPhone dan di dalam Telegram, bilah
          bawah menutupi tombol kirim kalau tidak diberi ruang. */}
      <div style={{ background:"rgba(10,13,20,.98)", padding:"8px 10px calc(10px + env(safe-area-inset-bottom))", display:"flex", alignItems:"flex-end", gap:8, flexShrink:0, borderTop:"1px solid rgba(247,124,34,.18)", boxShadow:"0 -6px 22px rgba(0,0,0,.35)" }}>

        {/* Toolbar */}
        <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
          {/* Image upload */}
          <button onClick={()=>fileInputRef.current?.click()} className="chat-btn3d" aria-label="Kirim gambar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,.5)"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleImageFile} />
          {/* Poll (admin only) */}
          {groupSettings.isAdmin && (
            <button onClick={()=>setShowPoll(true)} className="chat-btn3d" aria-label="Buat poll">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="rgba(255,255,255,.5)"><path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z"/></svg>
            </button>
          )}
        </div>

        {/* Input container */}
        <div style={{ flex:1, background:"rgba(255,255,255,.06)", borderRadius:24, display:"flex", alignItems:"center", padding:"7px 12px", gap:8, minHeight:48, border:"1px solid rgba(255,255,255,.07)", position:"relative", transition:"border-color .2s" }}>

          {/* Emoji toggle */}
          <div style={{ position:"relative", flexShrink:0 }}>
            <button style={{ background:"none", border:"none", padding:2, cursor:"pointer", display:"flex" }} onClick={()=>setShowEmoji(v=>!v)} aria-label="Emoji & Stiker">
              <svg width="24" height="24" viewBox="0 0 24 24" fill={showEmoji?"#25D366":"rgba(255,255,255,.4)"}><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
            </button>
            {showEmoji && (
              <>
                <div style={{ position:"fixed", inset:0, zIndex:49 }} onClick={()=>setShowEmoji(false)} />
                <div style={{ position:"absolute", bottom:"calc(100% + 8px)", left:0, width:300, background:"rgba(15,19,25,.97)", borderRadius:16, boxShadow:"0 8px 32px rgba(0,0,0,.5)", overflow:"hidden", zIndex:50, border:"1px solid rgba(255,255,255,.07)" }}>
                  <div style={{ display:"flex", padding:"10px 10px 6px", gap:3, borderBottom:"1px solid rgba(255,255,255,.05)" }}>
                    {QUICK_EMOJI.map(e=>(
                      <button key={e} onClick={()=>setInput(v=>v+e)} style={{ flex:1, background:"none", border:"none", cursor:"pointer", fontSize:20, padding:"3px 1px", borderRadius:6, transition:"transform .15s" }}
                        onMouseEnter={ev=>ev.currentTarget.style.transform="scale(1.25)"}
                        onMouseLeave={ev=>ev.currentTarget.style.transform="scale(1)"}>{e}</button>
                    ))}
                  </div>
                  {STICKER_PACKS.map((pack, pi) => (
                    <div key={pi}>
                      <div style={{ padding:"6px 10px 3px", fontSize:11, color:"rgba(255,255,255,.3)", fontWeight:600, textTransform:"uppercase", letterSpacing:".7px" }}>{pack.label}</div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, padding:"0 8px 8px" }}>
                        {pack.s.map(s=>(
                          <button key={s} onClick={()=>{ sendMsg("sticker",{stickerCode:s}); setShowEmoji(false); }}
                            style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, padding:5, borderRadius:8, lineHeight:1, transition:"transform .1s" }}
                            onMouseEnter={ev=>ev.currentTarget.style.transform="scale(1.2)"}
                            onMouseLeave={ev=>ev.currentTarget.style.transform="scale(1)"}>{s}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Text input */}
          <input ref={inputRef} type="text" value={input} onChange={handleInputChange}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey && input.trim()) { sendMsg("text"); return; }
              if (e.key === "Escape") { setMentionQuery(null); setShowEmoji(false); }
            }}
            onFocus={e=>e.currentTarget.closest("div").style.borderColor="rgba(37,211,102,.3)"}
            onBlur={e=>e.currentTarget.closest("div").style.borderColor="rgba(255,255,255,.07)"}
            placeholder={groupSettings.closed&&!groupSettings.isAdmin?"Grup ditutup oleh admin":"Ketik pesan... (@ mention, / command)"}
            disabled={groupSettings.closed && !groupSettings.isAdmin}
            maxLength={500}
            style={{ flex:1, fontSize:14.5, border:"none", outline:"none", background:"transparent", color:"rgba(255,255,255,.88)", minWidth:0 }} />
        </div>

        {/* Send / Mic */}
        {input.trim() ? (
          <button onClick={()=>sendMsg("text")} disabled={sending||(groupSettings.closed&&!groupSettings.isAdmin)}
            className="chat-send3d" aria-label="Kirim pesan">
            {sending
              ? <div style={{ width:22, height:22, border:"2.5px solid rgba(255,255,255,.3)", borderTopColor:"white", borderRadius:"50%", animation:"spin .7s linear infinite" }} />
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            }
          </button>
        ) : (
          <button onPointerDown={startRecording} onPointerUp={stopRecording} onPointerLeave={stopRecording}
            className={`chat-send3d ${recording ? "is-rec" : ""}`} aria-label="Rekam suara">
            {recording
              ? <span style={{ width:16, height:16, borderRadius:3, background:"white", display:"block" }} />
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
            }
          </button>
        )}
      </div>

      {/* Recording toast */}
      {recording && (
        <div style={{ position:"fixed", top:68, left:"50%", transform:"translateX(-50%)", background:"rgba(220,38,38,.92)", color:"white", borderRadius:99, padding:"10px 22px", display:"flex", alignItems:"center", gap:10, fontSize:13, fontWeight:600, boxShadow:"0 6px 24px rgba(220,38,38,.5)", zIndex:200, backdropFilter:"blur(8px)" }}>
          <span style={{ width:10, height:10, borderRadius:"50%", background:"white", display:"inline-block", animation:"pulse 1s infinite" }} />
          Merekam... lepas untuk kirim
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.75)} }
        @keyframes modalIn { from{opacity:0;transform:scale(.87) translateY(18px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes slideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }
        .chat-scroll::-webkit-scrollbar       { width: 3px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 99px; }
      `}</style>
    </div>
  );
}
