"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FitArena.jsx — Main app, UI identical to original, fully wired to Supabase
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { SignIn, SignUp } from "@clerk/nextjs";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useChallenges } from "../hooks/useChallenges";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { submitScore, getPendingSubmissions, approveSubmission, rejectSubmission } from "../services/submissionService";
import { createChallenge, deactivateChallenge, updateChallenge } from "../services/challengeService";
import { updateUserProfile } from "../services/userService";
import { QRCodeSVG } from "qrcode.react";
import { usePostHog } from "posthog-js/react";
import LandingPage from "./LandingPage";

// ─── STATIC DATA ─────────────────────────────────────────────────────────────
// BADGES and REWARDS remain static (cosmetic/store data, not from DB yet)
const BADGES = {
  pushup_king:         { label:"Pushup King",         icon:"👑", color:"#39FF14" },
  deadlift_beast:      { label:"Deadlift Beast",       icon:"💀", color:"#00BFFF" },
  consistency_monster: { label:"Consistency Monster",  icon:"🔥", color:"#FF6B35" },
  elite_member:        { label:"Elite Member",         icon:"⚡", color:"#FFD700" },
  squat_lord:          { label:"Squat Lord",           icon:"🦵", color:"#C77DFF" },
  plank_god:           { label:"Plank God",            icon:"🛡️", color:"#FF69B4" },
};

const REWARDS = [
  { id:"r1", title:"Free Protein Shake",        cost:500,  icon:"🥤", available:true  },
  { id:"r2", title:"Personal Training Session", cost:2000, icon:"🏅", available:true  },
  { id:"r3", title:"Gym Merch Bundle",          cost:1500, icon:"👕", available:false },
  { id:"r4", title:"Month Free Membership",     cost:5000, icon:"💎", available:true  },
];

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  app:      { minHeight:"100vh", background:"#0a0a0a", color:"#f0f0f0", fontFamily:"var(--font-barlow),'DM Sans',sans-serif", position:"relative", overflowX:"hidden" },
  nav:      { position:"fixed", bottom:0, left:0, right:0, background:"rgba(12,12,12,0.97)", borderTop:"1px solid #1a1a1a", display:"flex", justifyContent:"space-around", padding:"8px 0 calc(8px + env(safe-area-inset-bottom))", zIndex:100, backdropFilter:"blur(20px)" },
  navBtn:   (a)=>({ display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"6px 16px", border:"none", background:"none", cursor:"pointer", color:a?"#39FF14":"#555", transition:"all 0.2s", fontSize:10, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase" }),
  page:     { maxWidth:480, margin:"0 auto", padding:"16px 16px 90px" },
  card:     { background:"#111", border:"1px solid #1e1e1e", borderRadius:16, padding:"20px", marginBottom:12 },
  neonBtn:  { background:"#39FF14", color:"#000", border:"none", borderRadius:12, padding:"14px 28px", fontWeight:800, fontSize:14, letterSpacing:"0.05em", cursor:"pointer", width:"100%", textTransform:"uppercase", transition:"all 0.15s" },
  ghostBtn: { background:"transparent", color:"#39FF14", border:"1px solid #39FF14", borderRadius:12, padding:"12px 20px", fontWeight:700, fontSize:13, cursor:"pointer", textTransform:"uppercase", letterSpacing:"0.05em", transition:"all 0.15s" },
  tag:      (c)=>({ display:"inline-block", background:c+"22", color:c, border:`1px solid ${c}44`, borderRadius:8, padding:"3px 10px", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }),
  sTitle:   { fontSize:11, fontWeight:700, letterSpacing:"0.15em", textTransform:"uppercase", color:"#555", marginBottom:12, marginTop:24 },
  h1:       { fontSize:28, fontWeight:900, letterSpacing:"-0.02em", color:"#f0f0f0", margin:0 },
  h2:       { fontSize:20, fontWeight:800, letterSpacing:"-0.01em", color:"#f0f0f0", margin:0 },
  input:    { width:"100%", background:"#0d0d0d", border:"1px solid #222", borderRadius:12, padding:"14px 16px", color:"#f0f0f0", fontSize:16, outline:"none", boxSizing:"border-box", fontFamily:"inherit" },
  errBox:   { background:"#FF444422", border:"1px solid #FF444444", color:"#FF6666", borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:10 },
  infoBox:  { background:"#39FF1411", border:"1px solid #39FF1433", color:"#39FF14", borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:10 },
};

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────

function Confetti({ active }) {
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    const cols = ["#39FF14","#FFD700","#00BFFF","#FF6B35","#C77DFF"];
    setParticles(
      Array.from({ length: 30 }, (_, i) => ({
        left:  Math.random() * 100,
        dur:   1.5 + Math.random() * 1.5,
        delay: Math.random() * 0.5,
        color: cols[i % cols.length],
        round: i % 3 === 0,
      }))
    );
  }, []);
  if (!active || particles.length === 0) return null;
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:999 }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position:       "absolute",
          left:           `${p.left}%`,
          top:            "-10px",
          width:          8,
          height:         8,
          background:     p.color,
          borderRadius:   p.round ? "50%" : 2,
          animation:      `fall ${p.dur}s ease-in forwards`,
          animationDelay: `${p.delay}s`,
        }} />
      ))}
      <style>{`@keyframes fall{to{transform:translateY(105vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div style={{ fontSize:48 }}>⚡</div>
      <div style={{ fontSize:22, fontWeight:900, color:"#39FF14" }}>FitArena</div>
      <div style={{ display:"flex", gap:6, marginTop:8 }}>
        {[0,1,2].map(i=><div key={i} style={{ width:8,height:8,borderRadius:"50%",background:"#39FF14",animation:`p 1s ${i*0.2}s ease-in-out infinite` }} />)}
      </div>
      <style>{`@keyframes p{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  );
}

function StreakFire({ count }) {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
      <span style={{ fontSize:28,animation:"fl 1s ease-in-out infinite alternate" }}>🔥</span>
      <div>
        <div style={{ fontSize:26,fontWeight:900,color:"#FF6B35",lineHeight:1 }}>{count}</div>
        <div style={{ fontSize:10,color:"#666",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em" }}>day streak</div>
      </div>
      <style>{`@keyframes fl{from{transform:scale(1)}to{transform:scale(1.1) rotate(-5deg)}}`}</style>
    </div>
  );
}

function XPBar({ xp, level }) {
  const levelStart = (level - 1) * 500;
  const withinLevel = Math.max(0, xp - levelStart);
  const pct = Math.min((withinLevel / 500) * 100, 100);
  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
        <span style={{ fontSize:11,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em" }}>Level {level}</span>
        <span style={{ fontSize:11,color:"#39FF14",fontWeight:700 }}>{withinLevel} / 500 XP</span>
      </div>
      <div style={{ height:6,background:"#1a1a1a",borderRadius:99,overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#39FF14,#00FF88)",borderRadius:99,boxShadow:"0 0 10px #39FF1488",transition:"width 1s ease" }} />
      </div>
    </div>
  );
}

// Bug 4 Fix: Accept an optional avatarUrl prop.
// When present, attempt to render an <img> tag (the actual uploaded photo).
// If the image fails to load (broken URL, 404, etc.), imgError state flips to
// true and React re-renders the initials div — the user never sees a blank circle.
function Avatar({ initials, size=44, color="#39FF14", rank, avatarUrl }) {
  const rc={1:"#FFD700",2:"#C0C0C0",3:"#CD7F32"};
  const [imgError, setImgError] = useState(false);
  const borderColor = rc[rank] || "#222";
  const baseStyle = {
    width:size, height:size, borderRadius:"50%",
    border:`2px solid ${borderColor}`,
    flexShrink:0,
    boxShadow:rank===1?`0 0 16px ${rc[1]}66`:"none",
    display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden",
  };
  // Show image only when a URL is provided AND it hasn't errored
  if (avatarUrl && !imgError) {
    return (
      <div style={baseStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded avatars use user-provided remote URLs */}
        <img
          src={avatarUrl}
          alt={initials}
          style={{ width:"100%", height:"100%", objectFit:"cover" }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }
  // Initials fallback — shown when no URL given, or image failed to load
  return (
    <div style={{ ...baseStyle, background:color+"22", fontSize:size*0.32, fontWeight:900, color }}>
      {initials}
    </div>
  );
}

function ScoreBar({ value, max, color }) {
  return (
    <div style={{ height:4,background:"#1a1a1a",borderRadius:99,marginTop:8 }}>
      <div style={{ height:"100%",width:`${Math.min((value/Math.max(max,1))*100,100)}%`,background:color,borderRadius:99,boxShadow:`0 0 8px ${color}88` }} />
    </div>
  );
}

// ─── AI QUOTE ────────────────────────────────────────────────────────────────
// Cache strategy:
//   - Quotes are stored in sessionStorage under "fitarena_quote"
//   - Structure: { text: "...", createdAt: <unix ms> }
//   - Cache is valid for 6 hours; older entries trigger a fresh fetch
//   - A module-level Set prevents parallel in-flight requests across
//     React Strict Mode double-invocations and rapid tab switches
const quoteCacheKey = (name) => `fitarena_quote_${name}`;
const QUOTE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in ms
const FALLBACK_QUOTE  = "Discipline beats motivation.";
let   _quoteFetchInFlight = false; // module-level guard — survives remounts

function readQuoteCache(userName) {
  try {
    const raw = sessionStorage.getItem(quoteCacheKey(userName));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.createdAt < QUOTE_CACHE_TTL) return cached.text;
    console.log("[AIQuote] Cache expired — will re-fetch");
    return null;
  } catch { return null; }
}

function writeQuoteCache(userName, text) {
  try {
    sessionStorage.setItem(quoteCacheKey(userName), JSON.stringify({ text, createdAt: Date.now() }));
  } catch { /* sessionStorage unavailable (private mode etc.) — silently ignore */ }
}

function AIQuote({ userName }) {
  const cached = readQuoteCache(userName);

  // If a valid cached quote exists, start in the loaded state immediately —
  // no spinner, no delay, zero API calls.
  const [quote, setQuote]     = useState(cached ?? "");
  const [loading, setLoading] = useState(!cached);
  const [loaded, setLoaded]   = useState(!!cached);

  async function fetchQuote(force = false) {
    // Return cached version unless forced (↻ button) or cache is missing
    if (!force) {
      const hit = readQuoteCache(userName);
      if (hit) {
        console.log("[AIQuote] Using cached quote");
        setQuote(hit);
        setLoading(false);
        setLoaded(true);
        return;
      }
    }

    // In-flight guard — prevents parallel requests from Strict Mode
    // double-effects, rapid tab switches, or component remounts
    if (_quoteFetchInFlight) {
      console.log("[AIQuote] Fetch already in flight — skipping duplicate request");
      return;
    }
    _quoteFetchInFlight = true;
    setLoading(true);

    console.log("[AIQuote] Fetching new quote from Groq");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `1-sentence gym motivational quote for ${userName}. Raw, cinematic, under 20 words. No hashtags.`,
          max_tokens: 80,
        }),
      });
      if (!res.ok) throw new Error(`api error ${res.status}`);
      const { text } = await res.json();
      writeQuoteCache(userName, text);
      setQuote(text);
    } catch (err) {
      console.log("[AIQuote] Groq fetch failed:", err.message);
      // Fall back to last cached quote (even if expired) or static fallback
      const stale = (() => {
        try {
          const raw = sessionStorage.getItem(quoteCacheKey(userName));
          return raw ? JSON.parse(raw).text : null;
        } catch { return null; }
      })();
      setQuote(stale ?? FALLBACK_QUOTE);
    } finally {
      _quoteFetchInFlight = false;
      setLoading(false);
      setLoaded(true);
    }
  }

  useEffect(() => {
    // Guard: skip empty string and the "Athlete" placeholder that renders
    // while the profile is still loading. This prevents 2–3 sequential Groq
    // calls as userName transitions "" → "Athlete" → "John" on mount.
    if (!userName || userName === "Athlete") return;
    fetchQuote();
  }, [userName]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ ...S.card, background:"linear-gradient(135deg,#111,#0d1a0d)", borderColor:"#39FF1422", position:"relative", overflow:"hidden" }}>
      <div style={{ fontSize:11,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:"#39FF14",marginBottom:10,display:"flex",alignItems:"center",gap:6 }}>
        <span>⚡</span> AI Motivator
      </div>
      {loading
        ? <div style={{ display:"flex",gap:6 }}>{[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:"50%",background:"#39FF14",animation:`p 1s ${i*0.2}s ease-in-out infinite` }} />)}</div>
        : <p style={{ fontSize:17,fontWeight:700,color:"#e8e8e8",lineHeight:1.5,margin:0 }}>&ldquo;{quote}&rdquo;</p>
      }
      {loaded && <button onClick={()=>fetchQuote(true)} style={{ background:"none",border:"none",color:"#39FF1488",fontSize:11,cursor:"pointer",marginTop:8,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",padding:0 }}>↻ New Quote</button>}
    </div>
  );
}

// ─── AUTH PAGE ───────────────────────────────────────────────────────────────
function AuthPage({ initialMode = "login", onBack }) {
  const [mode, setMode] = useState(initialMode);

  return (
    <div style={{ minHeight:"100vh",background:"#050505",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative" }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{ position:"absolute",top:24,left:24,background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",display:"flex",alignItems:"center",gap:6 }}
        >
          ← Back to Overview
        </button>
      )}
      <div style={{ textAlign:"center",marginBottom:32 }}>
        <div style={{ fontSize:56,marginBottom:8 }}>⚡</div>
        <div style={{ fontSize:40,fontWeight:900,color:"#39FF14",letterSpacing:"-0.03em",lineHeight:1 }}>FitArena</div>
        <div style={{ fontSize:13,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",marginTop:6 }}>Elite Gym Challenges</div>
      </div>
      <div style={{ width:"100%",maxWidth:400 }}>
        <div style={{ display:"flex",background:"#0d0d0d",borderRadius:12,padding:4,marginBottom:24 }}>
          {["login","signup"].map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{ flex:1,padding:"10px",borderRadius:10,border:"none",background:mode===m?"#39FF14":"transparent",color:mode===m?"#000":"#555",fontWeight:800,cursor:"pointer",fontSize:13,textTransform:"capitalize",transition:"all 0.2s" }}>
              {m==="login"?"Sign In":"Sign Up"}
            </button>
          ))}
        </div>
        {mode === "login" ? <SignIn routing="hash" /> : <SignUp routing="hash" />}
      </div>
    </div>
  );
}

// ─── CHALLENGE DETAIL ────────────────────────────────────────────────────────
function ChallengeDetail({ challenge, userId, onBack, onSubmitted }) {
  const posthog = usePostHog();
  const fallback = `Push your limits in this elite ${challenge.type} challenge. Only the strongest rise to the top.`;
  const [desc, setDesc]           = useState("");
  const [loadingDesc, setLDesc]   = useState(true);
  const [score, setScore]         = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confetti, setConfetti]   = useState(false);
  const [err, setErr]             = useState(null);

  useEffect(()=>{
    async function go(){
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: `2-sentence fierce description for "${challenge.title}" (${challenge.type} challenge). Competitive, no hashtags.`, max_tokens: 80 }),
        });
        if (!res.ok) throw new Error("api error");
        const { text } = await res.json();
        setDesc(text);
      } catch { setDesc(fallback); }
      setLDesc(false);
    }
    go();
  }, [challenge.id, challenge.title, challenge.type, fallback]);

  async function handleSubmit(){
    if (!score || !userId) return;
    const parsedScore = Math.floor(Number(score));
    if (!Number.isFinite(parsedScore) || parsedScore < 1 || parsedScore > 99999) {
      setErr("Score must be between 1 and 99,999.");
      return;
    }
    setSubmitting(true); setErr(null);
    try {
      await submitScore({ userId, challengeId:challenge.id, score:parsedScore });
      posthog?.capture("score_submitted", { challenge_id: challenge.id, challenge_type: challenge.type, score: parsedScore });
      setSubmitted(true); setConfetti(true);
      setTimeout(()=>setConfetti(false),3000);
      // Notify parent to refetch challenge stats
      if (onSubmitted) onSubmitted();
    } catch(e){ setErr(e.message); }
    setSubmitting(false);
  }

  return (
    <div>
      <Confetti active={confetti} />
      <button onClick={onBack} style={{ background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:20,display:"flex",alignItems:"center",gap:6,padding:0 }}>← Back</button>

      <div style={{ ...S.card, background:`linear-gradient(135deg,#111,${challenge.color}11)`, borderColor:challenge.color+"33", textAlign:"center", padding:"32px 20px" }}>
        <div style={{ fontSize:64,marginBottom:12 }}>{challenge.icon}</div>
        <h1 style={{ ...S.h1,fontSize:26,marginBottom:8 }}>{challenge.title}</h1>
        <div style={S.tag(challenge.color)}>{challenge.type}</div>
        {loadingDesc
          ? <div style={{ margin:"16px 0",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>{[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:"50%",background:challenge.color,animation:`p 1s ${i*0.2}s ease-in-out infinite` }} />)}</div>
          : <p style={{ color:"#aaa",fontSize:15,lineHeight:1.6,marginTop:16 }}>{desc}</p>
        }
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12 }}>
        {[{label:"Your Score",val:challenge.myScore||0,color:challenge.color},{label:"Top Score",val:challenge.topScore||0,color:"#FFD700"},{label:"Players",val:challenge.participants||0,color:"#aaa"}].map(s=>(
          <div key={s.label} style={{ ...S.card,textAlign:"center",padding:"14px 8px",marginBottom:0 }}>
            <div style={{ fontSize:22,fontWeight:900,color:s.color }}>{s.val}</div>
            <div style={{ fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {!submitted ? (
        <div style={S.card}>
          <div style={{ ...S.sTitle,marginTop:0 }}>Submit Today&apos;s Score</div>
          {err && <div style={S.errBox}>{err}</div>}
          <input style={{ ...S.input,marginBottom:12 }} type="number" min="1" max="99999" placeholder={`Enter ${challenge.type==="Plank"?"seconds":"reps"}...`} value={score} onChange={e=>setScore(e.target.value)} />
          <button style={{ ...S.neonBtn,opacity:score&&!submitting?1:0.4 }} onClick={handleSubmit} disabled={!score||submitting}>
            {submitting?"⏳ Submitting...":"🚀 Submit Score"}
          </button>
        </div>
      ):(
        <div style={{ ...S.card,textAlign:"center",borderColor:"#39FF1444" }}>
          <div style={{ fontSize:48,marginBottom:8 }}>🎉</div>
          <div style={{ fontSize:20,fontWeight:900,color:"#39FF14",marginBottom:4 }}>Score Submitted!</div>
          <div style={{ color:"#888",fontSize:14 }}>Pending review. Keep grinding!</div>
          <div style={{ marginTop:16,fontSize:28,fontWeight:900,color:challenge.color }}>{score} {challenge.type==="Plank"?"sec":"reps"}</div>
        </div>
      )}

      <div style={S.card}>
        <div style={{ ...S.sTitle,marginTop:0 }}>Your Progress</div>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
          <span style={{ fontSize:13,color:"#aaa" }}>vs. top score</span>
          <span style={{ fontSize:13,color:challenge.color,fontWeight:700 }}>{challenge.topScore?Math.round(((challenge.myScore||0)/challenge.topScore)*100):0}%</span>
        </div>
        <ScoreBar value={challenge.myScore||0} max={challenge.topScore||1} color={challenge.color} />
        <div style={{ marginTop:16,display:"flex",justifyContent:"space-between" }}>
          <span style={{ fontSize:13,color:"#666" }}>⏰ {challenge.deadline}</span>
          <span style={{ fontSize:13,color:"#FFD700",fontWeight:700 }}>+{challenge.points} pts reward</span>
        </div>
      </div>
    </div>
  );
}

// ─── HOME ────────────────────────────────────────────────────────────────────
function HomePage({ profile, challenges, onChallenge }) {
  return (
    <div style={S.page}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,paddingTop:8 }}>
        <div>
          <div style={{ fontSize:12,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:4 }}>{profile.gym||"Your Gym"}</div>
          <h1 style={{ ...S.h1,fontSize:24 }}>Welcome back,</h1>
          <h1 style={{ ...S.h1,color:"#39FF14" }}>{(profile.name||"Athlete").split(" ")[0]} 👊</h1>
        </div>
        <Avatar initials={profile.initials} avatarUrl={profile.avatar_url} size={52} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12 }}>
        <div style={{ ...S.card,marginBottom:0 }}>
          <div style={{ fontSize:28,fontWeight:900,color:"#39FF14" }}>{(profile.points||0).toLocaleString()}</div>
          <div style={{ fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em" }}>Total Points</div>
        </div>
        <div style={{ ...S.card,marginBottom:0 }}><StreakFire count={profile.streak||0} /></div>
      </div>
      <div style={S.card}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <span style={{ fontSize:13,color:"#888",fontWeight:700 }}>🏆 Rank: <span style={{ color:"#FFD700" }}>{profile.rank}</span></span>
          <span style={S.tag("#39FF14")}>Lv.{profile.level||1}</span>
        </div>
        <XPBar xp={profile.xp||0} level={profile.level||1} />
      </div>
      {profile.streakAlert && (
        <div style={{ background:"#FF6B3511", border:"1px solid #FF6B3533",
          borderRadius:10, padding:"10px 14px", fontSize:13,
          color:"#FF6B35", marginBottom:12, fontWeight:700 }}>
          {profile.streakAlert}
        </div>
      )}
      <AIQuote userName={(profile.name||"Athlete").split(" ")[0]} />
      <div style={S.sTitle}>Active Challenges</div>
      {challenges.length===0 && <div style={{ color:"#555",fontSize:14,textAlign:"center",padding:"24px 0" }}>Scan a gym QR code to unlock a challenge.</div>}
      {challenges.map(ch=>(
        <button key={ch.id} onClick={()=>onChallenge(ch)} style={{ ...S.card,width:"100%",textAlign:"left",cursor:"pointer",display:"block",marginBottom:8,transition:"border-color 0.2s" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor=ch.color+"66"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="#1e1e1e"}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10 }}>
            <span style={{ fontSize:28 }}>{ch.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800,fontSize:15,color:"#f0f0f0",marginBottom:2 }}>{ch.title}</div>
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <span style={S.tag(ch.color)}>{ch.type}</span>
                <span style={{ fontSize:11,color:"#555" }}>⏰ {ch.deadline}</span>
              </div>
            </div>
            <span style={{ fontSize:13,fontWeight:800,color:"#FFD700" }}>+{ch.points}pts</span>
          </div>
          <ScoreBar value={ch.myScore||0} max={Math.max(ch.topScore||1,1)} color={ch.color} />
          <div style={{ display:"flex",justifyContent:"space-between",marginTop:6 }}>
            <span style={{ fontSize:11,color:"#555" }}>Your: {ch.myScore||0}</span>
            <span style={{ fontSize:11,color:"#555" }}>Top: {ch.topScore||0}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
function LeaderboardPage({ profile }) {
  const [tab, setTab]   = useState("active this week");
  const [tvMode, setTv] = useState(false);
  const { board, loading, error } = useLeaderboard(20, tab, tvMode);
  const rc={1:"#FFD700",2:"#C0C0C0",3:"#CD7F32"};
  const re={1:"🥇",2:"🥈",3:"🥉"};

  // Merge current user into board — mark them so we can highlight
  const myId = profile?.id;
  const enriched = board.map(p => ({
    ...p,
    isMe: p.id === myId,
    rank: Number(p.position ?? p.rank),
  }));

  // If user isn't in top 20, append them at their real position
  const userInBoard = enriched.some(p => p.isMe);
  const displayBoard = userInBoard || !profile
    ? enriched
    : [
        ...enriched,
        {
          id: profile.id,
          rank: profile.leaderboardPosition ?? enriched.length + 1,
          name: profile.name,
          initials: profile.initials,
          points: profile.points || 0,
          streak: profile.streak || 0,
          change: "same",
          isMe: true,
        },
      ];

  if (loading) {
    return (
      <div style={S.page}>
        <h2 style={{ ...S.h2,paddingTop:8,marginBottom:20 }}>Leaderboard 🏆</h2>
        <div style={{ display:"flex",gap:6,justifyContent:"center",padding:"48px 0" }}>
          {[0,1,2].map(i=><div key={i} style={{ width:8,height:8,borderRadius:"50%",background:"#39FF14",animation:`p 1s ${i*0.2}s ease-in-out infinite` }} />)}
        </div>
        <style>{`@keyframes p{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.page}>
        <h2 style={{ ...S.h2,paddingTop:8,marginBottom:20 }}>Leaderboard 🏆</h2>
        <div style={S.errBox}>Failed to load leaderboard: {error}</div>
      </div>
    );
  }

  // Need at least 3 entries for the podium
  // filteredBoard is now just displayBoard — real filtering is done server-side
  // in getLeaderboard() via last_active date filter based on the selected tab.
  const filteredBoard = displayBoard;

  const top3 = filteredBoard.slice(0, 3);
  const hasPodium = top3.length >= 3;

  if (tvMode) return (
    <div style={{ position:"fixed",inset:0,background:"#050505",zIndex:200,padding:32,overflowY:"auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:32 }}>
        <div style={{ fontSize:36,fontWeight:900,color:"#39FF14" }}>FitArena Live</div>
        <button onClick={()=>setTv(false)} style={{ ...S.ghostBtn,width:"auto" }}>✕ Exit</button>
      </div>
      <div style={{ fontSize:14,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",marginBottom:24 }}>{tab.charAt(0).toUpperCase()+tab.slice(1)} Leaderboard</div>
      {displayBoard.slice(0,8).map(p=>(
        <div key={p.id||p.rank} style={{ display:"flex",alignItems:"center",gap:20,padding:"16px 20px",marginBottom:8,borderRadius:12,background:p.rank<=3?rc[p.rank]+"11":p.isMe?"#39FF1411":"#0d0d0d",border:`1px solid ${p.rank<=3?rc[p.rank]+"33":p.isMe?"#39FF1433":"#111"}` }}>
          <span style={{ fontSize:32,minWidth:48,textAlign:"center" }}>{re[p.rank]||`#${p.rank}`}</span>
          <Avatar initials={p.initials} avatarUrl={p.avatar_url} size={48} color={p.rank<=3?rc[p.rank]:p.isMe?"#39FF14":"#555"} rank={p.rank} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:22,fontWeight:900,color:p.isMe?"#39FF14":"#f0f0f0" }}>{p.name}</div>
            <div style={{ fontSize:14,color:"#555" }}>🔥 {p.streak} day streak</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:28,fontWeight:900,color:p.rank<=3?rc[p.rank]:"#f0f0f0" }}>{(p.points||0).toLocaleString()}</div>
            <div style={{ fontSize:12,color:"#555" }}>points</div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={S.page}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,paddingTop:8 }}>
        <h2 style={S.h2}>Leaderboard 🏆</h2>
        <button onClick={()=>setTv(true)} style={{ ...S.ghostBtn,fontSize:11,padding:"8px 14px" }}>📺 TV Mode</button>
      </div>
      <div style={{ display:"flex",gap:6,marginBottom:20,overflowX:"auto",paddingBottom:4 }}>
        {["active today","active this week","active this month","all-time"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:"8px 16px",borderRadius:99,border:`1px solid ${tab===t?"#39FF14":"#222"}`,background:tab===t?"#39FF1422":"transparent",color:tab===t?"#39FF14":"#555",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",textTransform:"capitalize" }}>{t}</button>
        ))}
      </div>

      {hasPodium && (
        <div style={{ ...S.card,background:"linear-gradient(135deg,#111,#0d1a0d)",borderColor:"#39FF1422",marginBottom:16 }}>
          <div style={{ display:"flex",justifyContent:"center",alignItems:"flex-end",gap:16,padding:"8px 0 16px" }}>
            {[top3[1],top3[0],top3[2]].map((p,i)=>{
              const sz=[52,68,52],cr=["🥈","👑","🥉"],fs=[11,13,11];
              return (
                <div key={p.id||p.rank} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:i===1?32:24 }}>{cr[i]}</div>
                  <Avatar initials={p.initials} avatarUrl={p.avatar_url} size={sz[i]} color={rc[p.rank]||"#555"} rank={p.rank} />
                  <div style={{ fontSize:fs[i],fontWeight:800,color:p.isMe?"#39FF14":(rc[p.rank]||"#555"),marginTop:6 }}>{(p.name||"").split(" ")[0]}</div>
                  <div style={{ fontSize:i===1?15:13,fontWeight:900,color:"#f0f0f0" }}>{(p.points||0).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filteredBoard.map(p=>(
        <div key={p.id||p.rank} style={{ ...S.card,display:"flex",alignItems:"center",gap:12,marginBottom:8,padding:"14px 16px",borderColor:p.isMe?"#39FF1444":"#1e1e1e",background:p.isMe?"#39FF1408":"#111" }}>
          <div style={{ width:28,textAlign:"center",fontSize:p.rank<=3?20:14,fontWeight:900,color:rc[p.rank]||"#555" }}>{re[p.rank]||`#${p.rank}`}</div>
          <Avatar initials={p.initials} avatarUrl={p.avatar_url} size={38} color={p.isMe?"#39FF14":rc[p.rank]||"#444"} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800,fontSize:14,color:p.isMe?"#39FF14":"#f0f0f0" }}>{p.name}{p.isMe?" (You)":""}</div>
            <div style={{ fontSize:11,color:"#555" }}>🔥 {p.streak||0} days</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontWeight:900,fontSize:16,color:p.rank<=3?rc[p.rank]:"#f0f0f0" }}>{(p.points||0).toLocaleString()}</div>
            <div style={{ fontSize:10,color:p.change==="up"?"#39FF14":p.change==="down"?"#FF4444":"#555" }}>{p.change==="up"?"▲":p.change==="down"?"▼":"—"}</div>
          </div>
        </div>
      ))}

      {filteredBoard.length === 0 && (
        <div style={{ color:"#555",fontSize:14,textAlign:"center",padding:"24px 0" }}>No athletes ranked yet. Be the first!</div>
      )}
    </div>
  );
}

function ChallengeCard({ ch, badge, onChallenge }) {
  const accentColor = badge === "completed" ? "#39FF14"
                    : badge === "submitted"  ? "#FFD700"
                    : ch.color;
  const badgeLabel  = badge === "completed" ? "✅ Completed"
                    : badge === "submitted"  ? "⏳ Awaiting approval"
                    : "🔓 Unlocked";
  const badgeColor  = badge === "completed" ? "#39FF1422"
                    : badge === "submitted"  ? "#FFD70022"
                    : ch.color + "22";
  const badgeBorder = badge === "completed" ? "#39FF1444"
                    : badge === "submitted"  ? "#FFD70044"
                    : ch.color + "44";

  return (
    <div style={{ ...S.card, marginBottom:10, borderLeft:`3px solid ${accentColor}` }}>
      <div style={{ display:"flex",alignItems:"flex-start",gap:12 }}>
        <span style={{ fontSize:32 }}>{ch.icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap" }}>
            <div style={{ fontWeight:800,fontSize:15,color:"#f0f0f0" }}>{ch.title}</div>
            <span style={{ fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:badgeColor,border:`1px solid ${badgeBorder}`,color:accentColor,whiteSpace:"nowrap" }}>
              {badgeLabel}
            </span>
          </div>
          <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:8 }}>
            <span style={S.tag(ch.color)}>{ch.type}</span>
            <span style={{ fontSize:11,color:"#FFD700",fontWeight:700 }}>+{ch.points} pts</span>
            <span style={{ fontSize:11,color:"#555" }}>👥 {ch.participants||0} joined</span>
          </div>
          {ch.myScore > 0 && (
            <div style={{ fontSize:12,color:"#39FF14",fontWeight:700 }}>Your best: {ch.myScore}</div>
          )}
          <div style={{ fontSize:12,color:ch.deadline==="Ends today"?"#FF6B35":"#555",marginTop:2 }}>⏰ {ch.deadline}</div>
        </div>
      </div>
      <div style={{ display:"flex",gap:8,marginTop:12 }}>
        <button
          onClick={()=>onChallenge(ch)}
          disabled={badge==="submitted"}
          style={{ ...S.neonBtn,flex:1,fontSize:12,padding:"10px 16px",opacity:badge==="submitted"?0.45:1 }}
        >
          {badge==="completed" ? "📊 Submit Again" : badge==="submitted" ? "⏳ Pending…" : "🏋️ Submit Score"}
        </button>
      </div>
    </div>
  );
}

// ─── CHALLENGES PAGE ─────────────────────────────────────────────────────────
// Shows only challenges the user has unlocked (via QR scan), submitted to,
// or completed. Locked challenges stay hidden — the physical QR poster is
// the only entry point, keeping the real-gym flow intact.
//
// Challenge states (mutually exclusive display labels):
//   completed  — myScore > 0 (approved submission exists)
//   submitted  — myPending = true (awaiting admin approval)
//   unlocked   — id is in unlockedIds (QR scanned, not yet submitted)
//   locked     — none of the above (hidden by default)

function ChallengesPage({ challenges, unlockedIds, onChallenge, notice }) {
  // Partition challenges into visible buckets
  const completed = challenges.filter(ch => ch.myScore > 0);
  const submitted = challenges.filter(ch => ch.myPending && !ch.myScore);
  const unlocked  = challenges.filter(ch =>
    unlockedIds.has(ch.id) && !ch.myScore && !ch.myPending
  );

  const hasAnything = completed.length > 0 || submitted.length > 0 || unlocked.length > 0;

  return (
    <div style={S.page}>
      <h2 style={{ ...S.h2,paddingTop:8,marginBottom:4 }}>My Challenges 🎯</h2>
      <p style={{ color:"#555",fontSize:14,marginBottom:20 }}>Your active, submitted and completed challenges</p>
      {notice && <div style={S.errBox}>{notice}</div>}

      {/* ── Empty state ── */}
      {!hasAnything && (
        <div style={{ ...S.card,textAlign:"center",borderColor:"#39FF1422",padding:"36px 24px",marginBottom:12 }}>
          <div style={{ fontSize:52,marginBottom:16 }}>📱</div>
          <div style={{ fontSize:16,fontWeight:800,color:"#f0f0f0",marginBottom:8 }}>No challenges yet</div>
          <div style={{ fontSize:13,color:"#555",lineHeight:1.7,maxWidth:260,margin:"0 auto" }}>
            Scan the QR posters around your gym with your phone camera to unlock challenges and start earning XP.
          </div>
          <div style={{ marginTop:20,display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:8,background:"#39FF1411",border:"1px solid #39FF1433",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>📷</div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:12,fontWeight:700,color:"#39FF14" }}>How to unlock</div>
              <div style={{ fontSize:11,color:"#555" }}>Point camera → tap link → done</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Unlocked (ready to submit) ── */}
      {unlocked.length > 0 && (
        <>
          <div style={{ ...S.sTitle,marginTop:4 }}>Ready to Submit</div>
          {unlocked.map(ch => <ChallengeCard key={ch.id} ch={ch} badge="unlocked" onChallenge={onChallenge} />)}
        </>
      )}

      {/* ── Submitted (awaiting approval) ── */}
      {submitted.length > 0 && (
        <>
          <div style={{ ...S.sTitle }}>Awaiting Approval</div>
          {submitted.map(ch => <ChallengeCard key={ch.id} ch={ch} badge="submitted" onChallenge={onChallenge} />)}
        </>
      )}

      {/* ── Completed ── */}
      {completed.length > 0 && (
        <>
          <div style={{ ...S.sTitle }}>Completed</div>
          {completed.map(ch => <ChallengeCard key={ch.id} ch={ch} badge="completed" onChallenge={onChallenge} />)}
        </>
      )}
    </div>
  );
}

// ─── PROFILE PAGE ────────────────────────────────────────────────────────────
function ProfilePage({ profile, onSignOut, onProfileUpdated }) {
  const posthog = usePostHog();
  const rankDisplay = profile.leaderboardPosition != null
    ? `#${profile.leaderboardPosition}`
    : "—";

  // ── Edit modal state ─────────────────────────────────────────────────────
  const [editing, setEditing]   = useState(false);
  const [editName, setEditName] = useState(profile.name || "");
  const [editGym,  setEditGym]  = useState(profile.gym  || "");
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState(null);
  const [savedOk,  setSavedOk]  = useState(false);
  const [redeemedIds, setRedeemedIds]   = useState(new Set());
  const [redeemingId, setRedeemingId]   = useState(null);
  const [redeemErr,   setRedeemErr]     = useState(null);

  // BUG FIX: Load existing redemptions from the DB on mount so they
  // survive page refreshes (previously only stored in-memory state).
  useEffect(() => {
    async function loadRedemptions() {
      const { data } = await supabase
        .from("redemptions")
        .select("reward_id")
        .eq("user_id", profile.id);
      if (data) setRedeemedIds(new Set(data.map(r => r.reward_id)));
    }
    loadRedemptions();
  }, [profile.id]);

  const [dbRewards, setDbRewards] = useState([]);
  useEffect(() => {
    let active = true;
    const REWARD_ICONS = {
      r1: "🥤",
      r2: "🏅",
      r3: "👕",
      r4: "💎",
    };
    supabase
      .from("rewards")
      .select("*")
      .then(({ data, error }) => {
        if (active && !error && data && data.length > 0) {
          setDbRewards(data.map(item => ({
            ...item,
            icon: REWARD_ICONS[item.id] || "🎁"
          })));
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const displayRewards = dbRewards.length > 0 ? dbRewards : REWARDS;

  // Keep inputs in sync if the profile prop updates after a refetch
  useEffect(() => {
    if (!editing) {
      setEditName(profile.name || "");
      setEditGym(profile.gym  || "");
    }
  }, [profile.name, profile.gym, editing]);

  function openEdit() {
    setEditName(profile.name || "");
    setEditGym(profile.gym  || "");
    setSaveErr(null);
    setSavedOk(false);
    setEditing(true);
  }

  async function handleSave() {
    if (!editName.trim()) { setSaveErr("Name cannot be empty."); return; }
    setSaving(true); setSaveErr(null);
    try {
      await updateUserProfile(profile.id, { name: editName.trim(), gym: editGym.trim() });
      setSavedOk(true);
      setEditing(false);
      onProfileUpdated(); // refetch in background — don't await, avoids spinner flash
      setTimeout(() => setSavedOk(false), 3000);
    } catch(e) {
      setSaveErr(e.message || "Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !saving) handleSave();
    if (e.key === "Escape") setEditing(false);
  }

  async function handleRedeem(r) {
    const canAfford = (profile.points || 0) >= r.cost;
    if (!canAfford || !r.available || redeemedIds.has(r.id) || redeemingId === r.id) return;
    setRedeemingId(r.id);
    setRedeemErr(null);

    const { data: result, error } = await supabase.rpc("redeem_reward", {
      p_reward_id: r.id,
    });

    if (error) {
      setRedeemErr(error.message || "Redemption failed. Please try again.");
      setRedeemingId(null);
      return;
    }

    if (!result?.success) {
      if (result?.error === "already_redeemed") {
        setRedeemErr("You have already redeemed this reward.");
        setRedeemedIds(prev => new Set([...prev, r.id]));
      } else if (result?.error === "insufficient_points") {
        setRedeemErr("Insufficient points. Your balance may have changed.");
      } else {
        setRedeemErr("This reward is not currently available.");
      }
      setRedeemingId(null);
      return;
    }

    setRedeemedIds(prev => new Set([...prev, r.id]));
    posthog?.capture("reward_redeemed", { reward_id: r.id, reward_title: r.title, cost: r.cost });
    onProfileUpdated();
    setRedeemingId(null);
  }

  return (
    <div style={S.page}>
      {/* ── Edit Profile Modal ───────────────────────────────────────────── */}
      {editing && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px" }}>
          <div style={{ ...S.card,width:"100%",maxWidth:380,padding:"28px 24px" }}>
            <div style={{ ...S.sTitle,marginTop:0,marginBottom:20 }}>✏️ Edit Profile</div>
            {saveErr && <div style={{ background:"#FF444422",border:"1px solid #FF4444",borderRadius:8,padding:"8px 12px",color:"#FF6666",fontSize:13,marginBottom:14 }}>{saveErr}</div>}
            <label style={{ display:"block",fontSize:12,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6 }}>Name</label>
            <input
              style={{ ...S.input,marginBottom:16 }}
              value={editName}
              onChange={e=>setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Your name"
              maxLength={50}
              autoFocus
            />
            <label style={{ display:"block",fontSize:12,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6 }}>Gym</label>
            <input
              style={{ ...S.input,marginBottom:24 }}
              value={editGym}
              onChange={e=>setEditGym(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Your gym (optional)"
              maxLength={60}
            />
            <div style={{ display:"flex",gap:10 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ ...S.neonBtn,flex:1,opacity:saving?0.5:1 }}
              >
                {saving ? "Saving…" : "💾 Save"}
              </button>
              <button
                onClick={()=>setEditing(false)}
                disabled={saving}
                style={{ ...S.ghostBtn,flex:1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {savedOk && (
        <div style={{ background:"#39FF1422",border:"1px solid #39FF1444",borderRadius:10,padding:"10px 16px",marginBottom:12,color:"#39FF14",fontSize:13,fontWeight:700,textAlign:"center" }}>
          ✅ Profile updated!
        </div>
      )}
      <div style={{ ...S.card,textAlign:"center",padding:"32px 20px",background:"linear-gradient(135deg,#111,#0d1a0d)",borderColor:"#39FF1422",marginBottom:12 }}>
        <Avatar initials={profile.initials} avatarUrl={profile.avatar_url} size={80} color="#39FF14" />
        <h2 style={{ ...S.h2,marginTop:16,marginBottom:4 }}>{profile.name}</h2>
        <div style={{ color:"#555",fontSize:13,marginBottom:16 }}>{profile.gym||"No gym set"} · Member since {profile.joinDate}</div>
        <div style={{ display:"flex",gap:8,justifyContent:"center" }}>
          <button onClick={openEdit} style={{ ...S.ghostBtn,fontSize:12,padding:"8px 16px" }}>✏️ Edit Profile</button>
          <button onClick={onSignOut} style={{ background:"#FF444422",border:"1px solid #FF444444",color:"#FF6666",borderRadius:12,fontSize:12,padding:"8px 16px",cursor:"pointer",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em" }}>🚪 Sign Out</button>
        </div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
        {[
          {val:(profile.points||0).toLocaleString(), label:"Points", color:"#39FF14"},
          {val:rankDisplay,                           label:"Rank",   color:"#FFD700"},
        ].map(s=>(
          <div key={s.label} style={{ ...S.card,textAlign:"center",padding:"14px 8px",marginBottom:0 }}>
            <div style={{ fontSize:20,fontWeight:900,color:s.color }}>{s.val}</div>
            <div style={{ fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12 }}>
        {[
          {val:`${profile.streak||0}🔥`,        label:"Current Streak", color:"#FF6B35"},
          {val:`${profile.longest_streak||0}🏆`, label:"Best Streak",    color:"#C77DFF"},
        ].map(s=>(
          <div key={s.label} style={{ ...S.card,textAlign:"center",padding:"14px 8px",marginBottom:0 }}>
            <div style={{ fontSize:20,fontWeight:900,color:s.color }}>{s.val}</div>
            <div style={{ fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10 }}>
          <span style={{ fontWeight:800,color:"#f0f0f0" }}>Progress</span>
          <span style={S.tag("#39FF14")}>{profile.rank}</span>
        </div>
        <XPBar xp={profile.xp||0} level={profile.level||1} />
      </div>
      <div style={S.sTitle}>Badges Earned</div>
      <div style={S.card}>
        <div style={{ display:"flex",flexWrap:"wrap",gap:10 }}>
          {(profile.badges||[]).filter(b=>BADGES[b]).map(b=>(
            <div key={b} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:BADGES[b].color+"11",border:`1px solid ${BADGES[b].color}44`,borderRadius:99 }}>
              <span style={{ fontSize:18 }}>{BADGES[b].icon}</span>
              <span style={{ fontSize:12,fontWeight:700,color:BADGES[b].color }}>{BADGES[b].label}</span>
            </div>
          ))}
          {Object.entries(BADGES).filter(([k])=>!(profile.badges||[]).includes(k)).map(([k,v])=>(
            <div key={k} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:"#111",border:"1px solid #1e1e1e",borderRadius:99,opacity:0.4 }}>
              <span style={{ fontSize:18,filter:"grayscale(1)" }}>{v.icon}</span>
              <span style={{ fontSize:12,fontWeight:700,color:"#555" }}>{v.label}</span>
              <span style={{ fontSize:10,color:"#444" }}>🔒</span>
            </div>
          ))}
        </div>
      </div>
      <div style={S.sTitle}>Rewards Store</div>
      {redeemErr && (
        <div style={{ background:"#FF444422",border:"1px solid #FF4444",borderRadius:8,padding:"8px 12px",color:"#FF6666",fontSize:13,marginBottom:10 }}>
          {redeemErr}
        </div>
      )}
      {displayRewards.map(r=>{
        const canAfford = (profile.points||0) >= r.cost;
        const alreadyRedeemed = redeemedIds.has(r.id);
        const isRedeeming = redeemingId === r.id;
        return (
          <div key={r.id} style={{ ...S.card,display:"flex",alignItems:"center",gap:14,marginBottom:8,opacity:r.available?1:0.5 }}>
            <span style={{ fontSize:32 }}>{r.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700,fontSize:14,color:"#f0f0f0" }}>{r.title}</div>
              <div style={{ fontSize:12,color:"#FFD700",fontWeight:700 }}>⭐ {r.cost} pts</div>
            </div>
            <button
              style={{ ...S.ghostBtn,fontSize:11,padding:"8px 14px",opacity:(canAfford&&r.available&&!alreadyRedeemed)?1:0.3 }}
              disabled={isRedeeming || alreadyRedeemed || !canAfford || !r.available}
              onClick={() => handleRedeem(r)}
            >
              {alreadyRedeemed ? "✅ Redeemed!" : isRedeeming ? "…" : "Redeem"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────
function AdminPage({ userId, challenges, refetchChallenges }) {
  const [tab, setTab]         = useState("challenges");
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [editTitle, setEditTitle]               = useState("");
  const [editErr, setEditErr]                   = useState(null);
  const [editSaving, setEditSaving]             = useState(false);
  const [confirmEndChallenge, setConfirmEndChallenge] = useState(null);
  const [endErr, setEndErr]                     = useState(null);
  const [aiDesc, setAiDesc]   = useState("");
  const [genLoading, setGenL] = useState(false);
  const [newCh, setNewCh]     = useState({ title:"", type:"Pushup", points:100 });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState(null);
  const [pending, setPending] = useState([]);
  const [loadingP, setLoadingP] = useState(false);
  const [loadingErr, setLoadingErr] = useState(null);
  const [showQR, setShowQR]       = useState(null); // null or challenge id
  const [qrUrl, setQrUrl]         = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrErr, setQrErr]         = useState(null);
  const [analyticsStats, setAnalyticsStats] = useState({ submissionsToday: "—", activeMembers: "—" });

  useEffect(() => {
    if (!showQR) {
      setQrUrl("");
      setQrErr(null);
      return;
    }

    let cancelled = false;
    setQrLoading(true);
    setQrErr(null);

    async function generateQR() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/generate-qr-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ""}`,
          },
          body: JSON.stringify({ challengeId: showQR }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to generate QR code.");
        if (!cancelled) setQrUrl(json.url);
      } catch (err) {
        if (!cancelled) setQrErr(err.message);
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    }

    generateQR();
    return () => { cancelled = true; };
  }, [showQR]);

  useEffect(() => {
    if (tab !== "analytics") return;

    async function fetchAnalytics() {
      try {
        const today = new Date().toISOString().slice(0, 10);

        const { count: subCount } = await supabase
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .gte("submitted_at", today);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

        const { count: memberCount } = await supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .gte("last_active", thirtyDaysAgo.toISOString());

        setAnalyticsStats({
          submissionsToday: subCount?.toString() ?? "—",
          activeMembers: memberCount?.toString() ?? "—",
        });
      } catch {
        // silently keep "—" on error
      }
    }

    // Also fetch current pending count so the analytics card isn't stale
    // when the user goes straight to analytics without visiting submissions first.
    getPendingSubmissions()
      .then(rows => {
        const filtered = (rows ?? []).filter(s => s.user_id !== userId);
        setPending(filtered);
      })
      .catch(() => {});

    fetchAnalytics();
  }, [tab, userId]);

  useEffect(() => {
    if (tab !== "submissions") return;

    setLoadingP(true);
    setLoadingErr(null);

    getPendingSubmissions()
      .then(rows => {
        const filtered = (rows ?? []).filter(s => s.user_id !== userId);
        setPending(filtered);
      })
      .catch(err => setLoadingErr(err?.message ?? "Failed to load submissions"))
      .finally(() => setLoadingP(false));

    // Real-time: refresh list on new submissions OR status changes
    // (INSERT = new submission; UPDATE = another admin approved/rejected)
    const channel = supabase
      .channel("admin-submissions-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "submissions" },
        () => {
          getPendingSubmissions()
            .then(rows => {
              const filtered = (rows ?? []).filter(s => s.user_id !== userId);
              setPending(filtered);
            })
            .catch(() => {});
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "submissions" },
        () => {
          getPendingSubmissions()
            .then(rows => {
              const filtered = (rows ?? []).filter(s => s.user_id !== userId);
              setPending(filtered);
            })
            .catch(() => {});
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [tab, userId]);







  async function handleCreate(){
    if(!newCh.title.trim()) return;
    // Bug 4 Fix: reject zero or negative points before hitting the DB.
    if (!newCh.points || newCh.points < 1) {
      setCreateErr("Points reward must be at least 1.");
      return;
    }
    setCreating(true); setCreateErr(null);
    try {
      // Bug 2 Fix: include the AI-generated description so it's persisted to the DB.
      // Previously aiDesc was displayed in the UI but silently dropped here.
      await createChallenge(userId, { ...newCh, description: aiDesc || undefined });
      setNewCh({title:"",type:"Pushup",points:100}); setAiDesc("");
      refetchChallenges();
    } catch(e){ setCreateErr(e.message); }
    setCreating(false);
  }

  async function genDesc(){
    if(!newCh.title) return;
    setGenL(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `2-sentence fierce gym challenge description for "${newCh.title}" (${newCh.type}). Competitive, no hashtags.`, max_tokens: 80 }),
      });
      if (!res.ok) throw new Error("api error");
      const { text } = await res.json();
      setAiDesc(text);
    } catch { setAiDesc("Push limits and claim your spot at the top. Only the elite survive."); }
    setGenL(false);
  }

  const [actionErr, setActionErr]         = useState(null);
  const [processingId, setProcessingId]   = useState(null);
  // Layer 3 — frontend idempotency: track IDs already actioned this session.
  // Even if a realtime UPDATE echoes back a submission that was just approved,
  // the button is permanently disabled for that ID in this admin session.
  const [processedIds, setProcessedIds]   = useState(new Set());

  async function handleApprove(id) {
    // Block if already processed in this session (double-click / realtime echo guard)
    if (processedIds.has(id)) {
      console.warn("[Admin] handleApprove blocked — already processed:", id);
      setActionErr("This submission has already been actioned.");
      return;
    }
    // Block if another approval is in flight
    if (processingId) {
      console.warn("[Admin] handleApprove blocked — another approval in flight");
      return;
    }

    setProcessingId(id);
    setActionErr(null);

    try {
      const result = await approveSubmission(id);
      console.log("[Admin] ✅ Submission approved and points awarded:", result);

      // Mark as processed so the button stays dead even if realtime re-adds it
      setProcessedIds(prev => new Set([...prev, id]));
      setPending(p => p.filter(s => s.id !== id));
      refetchChallenges();
    } catch (e) {
      console.error("[Admin] handleApprove failed:", e.message);

      if (e.message.startsWith("ALREADY_PROCESSED") || e.message.startsWith("DUPLICATE")) {
        // Another admin already actioned it — remove from UI silently
        setProcessedIds(prev => new Set([...prev, id]));
        setPending(p => p.filter(s => s.id !== id));
        setActionErr("This submission was already processed by another admin. Points were NOT double-awarded.");
      } else if (e.message.startsWith("SELF_APPROVAL")) {
        setActionErr("🚫 You cannot approve your own submission.");
      } else {
        setActionErr(`Approve failed: ${e.message}`);
      }
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id) {
    if (processedIds.has(id)) {
      console.warn("[Admin] handleReject blocked — already processed:", id);
      setActionErr("This submission has already been actioned.");
      return;
    }
    if (processingId) return;

    setProcessingId(id);
    setActionErr(null);

    try {
      await rejectSubmission(id);
      console.log("[Admin] ✅ Submission rejected:", id);
      setProcessedIds(prev => new Set([...prev, id]));
      setPending(p => p.filter(s => s.id !== id));
    } catch (e) {
      console.error("[Admin] handleReject failed:", e.message);

      if (e.message.startsWith("ALREADY_PROCESSED") || e.message.startsWith("DUPLICATE")) {
        setProcessedIds(prev => new Set([...prev, id]));
        setPending(p => p.filter(s => s.id !== id));
        setActionErr("This submission was already processed by another admin.");
      } else {
        setActionErr(`Reject failed: ${e.message}`);
      }
    } finally {
      setProcessingId(null);
    }
  }

  async function handleEditSave() {
    if (!editTitle.trim()) { setEditErr("Title cannot be empty."); return; }
    setEditSaving(true); setEditErr(null);
    try {
      await updateChallenge(editingChallenge.id, { title: editTitle.trim() });
      await refetchChallenges();
      setEditingChallenge(null);
    } catch(err) {
      setEditErr(err.message || "Failed to update.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleConfirmEnd() {
    setEndErr(null);
    try {
      await deactivateChallenge(confirmEndChallenge.id);
      await refetchChallenges();
      setConfirmEndChallenge(null);
    } catch(err) {
      setEndErr(err.message || "Failed to end challenge.");
    }
  }

  return (
    <div style={S.page}>
      {/* ── Edit Challenge Title Modal ───────────────────────────────────── */}
      {editingChallenge && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px" }}>
          <div style={{ ...S.card,width:"100%",maxWidth:380,padding:"28px 24px" }}>
            <div style={{ ...S.sTitle,marginTop:0,marginBottom:20 }}>✏️ Edit Challenge Title</div>
            {editErr && <div style={{ background:"#FF444422",border:"1px solid #FF4444",borderRadius:8,padding:"8px 12px",color:"#FF6666",fontSize:13,marginBottom:14 }}>{editErr}</div>}
            <label style={{ display:"block",fontSize:12,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6 }}>Title</label>
            <input
              style={{ ...S.input,marginBottom:24 }}
              value={editTitle}
              onChange={e=>setEditTitle(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!editSaving) handleEditSave(); if(e.key==="Escape") setEditingChallenge(null); }}
              placeholder="Challenge title"
              maxLength={80}
              autoFocus
            />
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={handleEditSave} disabled={editSaving} style={{ ...S.neonBtn,flex:1,opacity:editSaving?0.5:1 }}>{editSaving?"Saving…":"💾 Save"}</button>
              <button onClick={()=>setEditingChallenge(null)} disabled={editSaving} style={{ ...S.ghostBtn,flex:1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Confirm End Challenge Modal ──────────────────────────────────── */}
      {confirmEndChallenge && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px" }}>
          <div style={{ ...S.card,width:"100%",maxWidth:380,padding:"28px 24px" }}>
            <div style={{ ...S.sTitle,marginTop:0,marginBottom:12,color:"#FF4444" }}>⚠️ End Challenge?</div>
            <div style={{ fontSize:14,color:"#ccc",marginBottom:20,lineHeight:1.5 }}>
              End <strong style={{ color:"#f0f0f0" }}>{confirmEndChallenge.title}</strong>? This cannot be undone.
            </div>
            {endErr && <div style={{ background:"#FF444422",border:"1px solid #FF4444",borderRadius:8,padding:"8px 12px",color:"#FF6666",fontSize:13,marginBottom:14 }}>{endErr}</div>}
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={handleConfirmEnd} style={{ flex:1,background:"#FF444422",border:"1px solid #FF4444",color:"#FF4444",borderRadius:12,fontSize:13,padding:"12px",cursor:"pointer",fontWeight:700 }}>Yes, End It</button>
              <button onClick={()=>setConfirmEndChallenge(null)} style={{ ...S.ghostBtn,flex:1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ paddingTop:8,marginBottom:20 }}>
        <div style={{ ...S.tag("#FF6B35"),marginBottom:8 }}>Admin</div>
        <h2 style={S.h2}>Control Center 🎛️</h2>
      </div>
      <div style={{ display:"flex",gap:6,marginBottom:20,overflowX:"auto" }}>
        {["challenges","submissions","analytics"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:"8px 16px",borderRadius:99,border:`1px solid ${tab===t?"#FF6B35":"#222"}`,background:tab===t?"#FF6B3522":"transparent",color:tab===t?"#FF6B35":"#555",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",textTransform:"capitalize" }}>{t}</button>
        ))}
      </div>

      {tab==="challenges" && (
        <div>
          <div style={{ ...S.sTitle,marginTop:0 }}>Create New Challenge</div>
          <div style={S.card}>
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {createErr && <div style={S.errBox}>{createErr}</div>}
              <input style={S.input} placeholder="Challenge name..." value={newCh.title} onChange={e=>setNewCh({...newCh,title:e.target.value})} />
              <select style={{ ...S.input,cursor:"pointer" }} value={newCh.type} onChange={e=>setNewCh({...newCh,type:e.target.value})}>
                {["Pushup","Deadlift","Squat","Plank","Attendance"].map(t=><option key={t}>{t}</option>)}
              </select>
              <input style={S.input} type="number" min="1" placeholder="Points reward" value={newCh.points} onChange={e=>setNewCh({...newCh,points:Number(e.target.value)||0})} />
              {aiDesc && <div style={{ padding:12,background:"#0d1a0d",borderRadius:10,border:"1px solid #39FF1422",fontSize:13,color:"#aaa",lineHeight:1.6 }}><span style={{ color:"#39FF14",fontSize:11,fontWeight:700 }}>AI: </span>{aiDesc}</div>}
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={genDesc} disabled={genLoading} style={{ ...S.ghostBtn,flex:1,fontSize:12,padding:"10px",opacity:genLoading?0.4:1,cursor:genLoading?"not-allowed":"pointer" }}>{genLoading?"⏳ Generating...":"⚡ AI Generate Desc"}</button>
                <button onClick={handleCreate} style={{ ...S.neonBtn,flex:1,fontSize:12,padding:"10px",opacity:creating?0.5:1 }} disabled={creating}>{creating?"Creating...":"✓ Create"}</button>
              </div>
            </div>
          </div>
          <div style={S.sTitle}>Active Challenges ({challenges.length})</div>
          {challenges.map(ch=>(
            <div key={ch.id} style={{ ...S.card,display:"flex",alignItems:"center",gap:12,marginBottom:8 }}>
              <span style={{ fontSize:24 }}>{ch.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700,fontSize:14,color:"#f0f0f0" }}>{ch.title}</div>
                <div style={{ fontSize:11,color:"#555" }}>{ch.participants||0} participants · {ch.deadline}</div>
              </div>
              <div style={{ display:"flex",gap:6 }}>
                <button
                  style={{ ...S.ghostBtn,fontSize:11,padding:"6px 10px" }}
                  onClick={() => { setEditingChallenge(ch); setEditTitle(ch.title); setEditErr(null); }}
                >Edit</button>
                <button onClick={()=>setShowQR(ch.id)} style={{ ...S.ghostBtn,fontSize:11,padding:"6px 10px" }}>📱 QR</button>
                <button onClick={()=>{ setConfirmEndChallenge(ch); setEndErr(null); }} style={{ background:"#FF444422",border:"1px solid #FF444444",color:"#FF4444",borderRadius:8,fontSize:11,padding:"6px 10px",cursor:"pointer",fontWeight:700 }}>End</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="submissions" && (
        <div>
          <div style={{ ...S.sTitle,marginTop:0 }}>Pending Approvals ({pending.length})</div>
          {actionErr && (
            <div style={{ background:"#FF444422",border:"1px solid #FF4444",borderRadius:10,padding:"10px 14px",marginBottom:12,color:"#FF4444",fontSize:13,fontWeight:600 }}>
              ⚠️ {actionErr}
            </div>
          )}
          {loadingErr && (
            <div style={{ background:"#FF444422",border:"1px solid #FF4444",borderRadius:10,padding:"10px 14px",marginBottom:12,color:"#FF4444",fontSize:13,fontWeight:600 }}>
              ⚠️ Error loading submissions: {loadingErr}
            </div>
          )}
          {loadingP && <div style={{ color:"#555",textAlign:"center",padding:"24px 0" }}>Loading...</div>}
          {!loadingP && !loadingErr && pending.length===0 && <div style={{ color:"#555",fontSize:14,textAlign:"center",padding:"24px 0" }}>No pending submissions.</div>}
          {pending.map(s=>(
            <div key={s.id} style={{ ...S.card,marginBottom:10,opacity:processingId===s.id?0.6:1,transition:"opacity 0.2s" }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:8 }}>
                <div style={{ fontWeight:700,color:"#f0f0f0" }}>{s.users?.name||"Unknown"}</div>
                <span style={{ fontSize:11,color:"#555" }}>{new Date(s.submitted_at).toLocaleDateString()}</span>
              </div>
              <div style={{ fontSize:13,color:"#888",marginBottom:4 }}>
                {s.challenges?.title||"Challenge"} · <span style={{ color:"#39FF14",fontWeight:700 }}>{s.score} {s.challenges?.type==="Plank"?"sec":"reps"}</span>
              </div>
              {s.challenges?.points != null && (
                <div style={{ fontSize:11,color:"#FFD700",fontWeight:700,marginBottom:12 }}>
                  🏆 Approving awards {s.challenges.points} pts
                </div>
              )}
              <div style={{ display:"flex",gap:8 }}>
                <button
                  onClick={()=>handleApprove(s.id)}
                  disabled={!!processingId || processedIds.has(s.id)}
                  style={{ ...S.neonBtn,flex:1,fontSize:12,padding:"10px",opacity:(processingId||processedIds.has(s.id))?0.4:1,cursor:(processingId||processedIds.has(s.id))?"not-allowed":"pointer" }}
                >
                  {processingId===s.id ? "⏳ Processing..." : processedIds.has(s.id) ? "✓ Done" : "✓ Approve"}
                </button>
                <button
                  onClick={()=>handleReject(s.id)}
                  disabled={!!processingId || processedIds.has(s.id)}
                  style={{ background:"#FF444422",border:"1px solid #FF444444",color:"#FF4444",borderRadius:10,flex:1,fontSize:12,padding:"10px",cursor:(processingId||processedIds.has(s.id))?"not-allowed":"pointer",fontWeight:700,opacity:(processingId||processedIds.has(s.id))?0.4:1 }}
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="analytics" && (
        <div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12 }}>
            {[
              {val:challenges.length.toString(), label:"Active Challenges", icon:"🎯"},
              {val:pending.length.toString(),    label:"Pending Reviews",   icon:"📋"},
              {val:analyticsStats.submissionsToday, label:"Submissions Today", icon:"📊"},
              {val:analyticsStats.activeMembers,    label:"Active (30d)",      icon:"👥"},
            ].map(s=>(
              <div key={s.label} style={{ ...S.card,marginBottom:0,textAlign:"center" }}>
                <div style={{ fontSize:24,marginBottom:4 }}>{s.icon}</div>
                <div style={{ fontSize:24,fontWeight:900,color:"#39FF14" }}>{s.val}</div>
                <div style={{ fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={S.sTitle}>Challenge Engagement</div>
          {challenges.map(ch=>(
            <div key={ch.id} style={{ ...S.card,marginBottom:8 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:8 }}>
                <span style={{ fontWeight:700,fontSize:14,color:"#f0f0f0" }}>{ch.icon} {ch.title}</span>
                <span style={{ fontSize:13,fontWeight:700,color:ch.color }}>{ch.participants||0}</span>
              </div>
              <ScoreBar value={ch.participants||0} max={150} color={ch.color} />
            </div>
          ))}
        </div>
      )}

      {/* ── QR Code Modal ─────────────────────────────────────────────────── */}
      {showQR && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.95)",
          zIndex:2000, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:20, padding:20
        }}>
          <div style={{ fontSize:11,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:"#555" }}>
            Challenge QR Code
          </div>
          {qrErr ? (
            <div style={S.errBox}>{qrErr}</div>
          ) : qrLoading || !qrUrl ? (
            <div style={{ color:"#888",fontSize:14 }}>Generating QR code...</div>
          ) : (
            <div style={{ background:"#fff",padding:16,borderRadius:16,boxShadow:"0 0 40px #39FF1444" }}>
              <QRCodeSVG value={qrUrl} size={220} level="H" fgColor="#000000" bgColor="#ffffff" />
            </div>
          )}
          <div style={{ fontSize:13,color:"#888",textAlign:"center",maxWidth:280,lineHeight:1.6 }}>
            Post this at your gym. This QR code expires after 4 hours.
          </div>
          <button onClick={()=>setShowQR(null)} style={{ ...S.neonBtn,width:200 }}>
            ✕ Close
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function FitArena() {
  const posthog = usePostHog();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, refetch: refetchProfile } = useProfile();
  const { challenges, loading: chLoading, refetch: refetchChallenges } = useChallenges(profile?.isAdmin);

  const [page, setPage]                   = useState("home");
  const [selectedChallenge, setChallenge] = useState(null);
  const [prevPage, setPrevPage]           = useState("challenges");
  const [authMode, setAuthMode]           = useState(null);

  // ── Unlocked challenges verified and persisted by the server ────────────────
  // A challenge is "unlocked" when the user scans its QR code.
  // Completed challenges (myScore > 0) are always visible regardless.
  //
  const [unlockedIds, setUnlockedIds] = useState(() => new Set());
  const [unlockError, setUnlockError] = useState(null);

  useEffect(() => {
    if (!user) {
      setUnlockedIds(new Set());
      setUnlockError(null);
      posthog?.reset();
      return;
    }
    // Identify the user in PostHog for session attribution
    posthog?.identify(user.id, { email: user.email });
    
    // Sync user profile
    fetch('/api/sync-user', { method: 'POST' }).catch(console.error);
    
    // Fetch unlocked challenges
    fetch('/api/unlocked-challenges')
      .then(r => r.json())
      .then(data => {
         if(data.ids) setUnlockedIds(new Set(data.ids));
      })
      .catch(() => setUnlockedIds(new Set()));
  }, [user, posthog]);

  const unlockChallenge = useCallback(async ({ challengeId, expiresAt, token }) => {
    setUnlockError(null);
    if (!token || !expiresAt) {
      setUnlockError("This QR link is invalid. Please scan the current gym poster.");
      return false;
    }

    try {
      const res = await fetch("/api/record-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, expiresAt, token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to unlock this challenge.");
      setUnlockedIds(prev => new Set([...prev, challengeId]));
      posthog?.capture("challenge_unlocked_via_qr", { challenge_id: challengeId });
      return true;
    } catch (err) {
      setUnlockError(err.message);
      return false;
    }
  }, [posthog]);

  useEffect(() => {
    const raw = sessionStorage.getItem("fitarena_open_challenge");
    if (!raw || !challenges.length || !user) return;
    sessionStorage.removeItem("fitarena_open_challenge");
    let pending;
    try { pending = JSON.parse(raw); } catch { pending = { id: raw }; }
    const target = challenges.find(ch => ch.id === pending.id);
    if (!target) return;

    unlockChallenge({ challengeId: target.id, expiresAt: pending.expiresAt, token: pending.token })
      .then((verified) => {
        if (verified) {
          setChallenge(target);
          setPage("challenge_detail");
        } else {
          setPage("challenges");
        }
      });
  }, [challenges, user, unlockChallenge]);

  const NAV = [
    { id:"home",        icon:"🏠", label:"Home"       },
    { id:"challenges",  icon:"🎯", label:"Challenges"  },
    { id:"leaderboard", icon:"🏆", label:"Ranks"       },
    { id:"profile",     icon:"👤", label:"Profile"     },
    // Admin tab only rendered for users with is_admin = true in the DB
    ...(profile?.isAdmin ? [{ id:"admin", icon:"⚙️", label:"Admin" }] : []),
  ];

  // ── Still determining auth state ─────────────────────────────────────────
  if (authLoading) return <Spinner />;

  // ── Not signed in ─────────────────────────────────────────────────────────
  if (!user) {
    if (authMode) {
      return (
        <div style={S.app}>
          <AuthPage initialMode={authMode} onBack={() => setAuthMode(null)} />
        </div>
      );
    }
    return <LandingPage onEnterAuth={(mode) => setAuthMode(mode)} />;
  }

  // ── Profile loading (first load only) ────────────────────────────────────
  // Only block render if profile has never loaded. Subsequent refetches
  // (e.g. after Edit Profile saves) must NOT unmount the page tree —
  // that would dismiss the modal and make the save appear broken.
  if (!profile) return <Spinner />;

  // Bug 5 Fix: use chLoading to avoid a flash of empty challenge lists on first
  // load. The guard only fires while challenges.length is still 0 (i.e. the
  // very first fetch). Subsequent background refetches leave the UI mounted.
  if (chLoading && challenges.length === 0) return <Spinner />;

  const myChallenges = challenges.filter((challenge) =>
    unlockedIds.has(challenge.id) || challenge.myScore > 0 || challenge.myPending
  );

  function goChallenge(ch) {
    setPrevPage(page);
    setChallenge(ch);
    setPage("challenge_detail");
  }
  function goBack() {
    setChallenge(null);
    setPage(prevPage);
  }


  return (
    <div style={S.app}>
      {/* Top bar */}
      <div style={{ position:"fixed",top:0,left:0,right:0,height:48,background:"rgba(10,10,10,0.97)",borderBottom:"1px solid #1a1a1a",display:"flex",alignItems:"center",justifyContent:"center",zIndex:90,backdropFilter:"blur(20px)" }}>
        <span style={{ fontSize:18,fontWeight:900,color:"#39FF14",letterSpacing:"-0.03em" }}>⚡ FitArena</span>
      </div>

      {/* Pages */}
      <div style={{ paddingTop:48 }}>
        {page==="home"             && <HomePage       profile={profile} challenges={myChallenges} onChallenge={goChallenge} />}
        {page==="challenges"       && <ChallengesPage challenges={challenges} unlockedIds={unlockedIds} onChallenge={goChallenge} notice={unlockError} />}
        {page==="challenge_detail" && selectedChallenge && (
          <div style={S.page}>
            <ChallengeDetail
              challenge={selectedChallenge}
              userId={user.id}
              onBack={goBack}
              onSubmitted={refetchChallenges}
            />
          </div>
        )}
        {page==="leaderboard"      && <LeaderboardPage profile={profile} />}
        {page==="profile"          && <ProfilePage     profile={profile} onSignOut={signOut} onProfileUpdated={refetchProfile} />}
        {page==="admin" && (profile?.isAdmin ? <AdminPage userId={user.id} challenges={challenges} refetchChallenges={refetchChallenges} /> : <div style={{padding:"40px 24px",textAlign:"center",color:"#555",fontSize:14}}>🚫 Access denied. Admins only.</div>)}
      </div>

      {/* Bottom nav */}
      <nav style={S.nav}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>{ setPage(n.id); setChallenge(null); }} style={S.navBtn(page===n.id||(page==="challenge_detail"&&n.id==="challenges"))}>
            <span style={{ fontSize:20 }}>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
