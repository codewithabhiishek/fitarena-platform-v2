"use client";

import { useState } from "react";

export default function LandingPage({ onEnterAuth }) {
  const CHALLENGE_PREVIEWS = [
    { icon: "👑", title: "Pushup King", tag: "STRENGTH", color: "#39FF14", record: "120 Reps", leader: "Marcus K." },
    { icon: "💀", title: "Deadlift Beast", tag: "POWER", color: "#00BFFF", record: "240 KG", leader: "Elena V." },
    { icon: "🛡️", title: "Plank God", tag: "ENDURANCE", color: "#FF69B4", record: "6:15 Min", leader: "Abhishek D." },
  ];

  const FEATURES = [
    {
      icon: "📱",
      tag: "QR UNLOCK",
      title: "Station QR Unlocks",
      desc: "Scan QR codes posted right on gym racks and machines to unlock daily competitive challenges.",
    },
    {
      icon: "🏆",
      tag: "COMPETITION",
      title: "Real-Time Leaderboards",
      desc: "Climb verified gym ranks, personal best tiers, and compete with fellow athletes in real time.",
    },
    {
      icon: "🎖️",
      tag: "PROGRESSION",
      title: "Badges & XP Levels",
      desc: "Earn XP for every verified rep and set. Unlock coveted cosmetic badges and maintain fire streaks.",
    },
    {
      icon: "🥤",
      tag: "REWARDS",
      title: "Gym Perks Vault",
      desc: "Redeem hard-earned workout points for free protein shakes, personal training, and gym gear.",
    },
    {
      icon: "⚡",
      tag: "AI MOTIVATION",
      title: "AI Workout Coach",
      desc: "Get fierce, personalized daily motivational quotes generated for your workout focus.",
    },
    {
      icon: "🎛️",
      tag: "ADMIN TOOLS",
      title: "Coach Control Center",
      desc: "Gym owners and coaches can generate print-ready QR codes, verify submissions, and manage events.",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0", fontFamily: "var(--font-barlow),'DM Sans',sans-serif", paddingBottom: 60 }}>
      {/* ── Top Navigation ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,10,0.95)", borderBottom: "1px solid #1a1a1a", backdropFilter: "blur(16px)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: "#39FF14", letterSpacing: "-0.03em" }}>FitArena</span>
            <span style={{ background: "#39FF1422", color: "#39FF14", border: "1px solid #39FF1444", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              ELITE
            </span>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={() => onEnterAuth("login")}
              style={{ background: "transparent", border: "none", color: "#aaa", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer", padding: "8px 12px" }}
            >
              Sign In
            </button>
            <button
              onClick={() => onEnterAuth("signup")}
              style={{ background: "#39FF14", color: "#000", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", transition: "transform 0.15s" }}
            >
              Enter Arena →
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 20px 36px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#39FF1415", border: "1px solid #39FF1444", borderRadius: 99, padding: "6px 16px", color: "#39FF14", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#39FF14" }} />
          <span>COMPETE · EARN BADGES · CLIMB LEADERBOARDS</span>
        </div>

        <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.08, margin: "0 auto 20px", maxWidth: 840, textTransform: "uppercase" }}>
          TURN EVERY WORKOUT INTO AN <span style={{ color: "#39FF14", textShadow: "0 0 25px rgba(57,255,20,0.3)" }}>ELITE COMPETITION.</span>
        </h1>

        <p style={{ fontSize: 16, color: "#a0a0a0", maxWidth: 640, margin: "0 auto 32px", lineHeight: 1.6 }}>
          The competitive gym operating system. Unlock daily station challenges via QR code, record verified personal bests, climb live gym leaderboards, and redeem earned XP for gym rewards.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: 36 }}>
          <button
            onClick={() => onEnterAuth("signup")}
            style={{ background: "#39FF14", color: "#000", border: "none", borderRadius: 12, padding: "16px 36px", fontSize: 14, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", boxShadow: "0 0 30px rgba(57,255,20,0.35)", transition: "all 0.15s" }}
          >
            ▶ Launch Free Account
          </button>
          <button
            onClick={() => onEnterAuth("login")}
            style={{ background: "#161616", color: "#39FF14", border: "1px solid #333", borderRadius: 12, padding: "16px 28px", fontSize: 14, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}
          >
            Athlete Portal Login
          </button>
        </div>

        {/* Trust Badges */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", fontSize: 12, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          <span>✔ 100% Free For Athletes</span>
          <span>✔ Live Station QR Unlocks</span>
          <span>✔ Instant AI Workout Quotes</span>
          <span>✔ Gym Reward Perks</span>
        </div>
      </section>

      {/* ── Live Challenge Showcase ── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px 48px" }}>
        <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 20, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222", paddingBottom: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#39FF14", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              ⚡ FEATURED GYM ARENA CHALLENGES
            </div>
            <div style={{ fontSize: 11, color: "#666", fontWeight: 700, textTransform: "uppercase" }}>
              LIVE CYCLE
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {CHALLENGE_PREVIEWS.map((ch, i) => (
              <div key={i} style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 14, padding: 18, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: ch.color }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 32 }}>{ch.icon}</span>
                  <span style={{ background: ch.color + "22", color: ch.color, border: `1px solid ${ch.color}44`, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>
                    {ch.tag}
                  </span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px", color: "#f0f0f0" }}>{ch.title}</h3>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
                  Current Record: <strong style={{ color: ch.color }}>{ch.record}</strong> by {ch.leader}
                </div>
                <button
                  onClick={() => onEnterAuth("signup")}
                  style={{ width: "100%", background: "#161616", border: "1px solid #282828", color: "#f0f0f0", borderRadius: 8, padding: "8px 0", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer" }}
                >
                  Join Challenge →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities Grid ── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px 48px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#39FF14", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>
            SYSTEM CAPABILITIES
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em" }}>
            ENGINEERED FOR SERIOUS PERFORMANCE
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 16, padding: 22, transition: "border-color 0.2s" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#39FF14", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
                {f.tag}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f0f0f0", margin: "0 0 8px" }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px 20px", textAlign: "center" }}>
        <div style={{ background: "linear-gradient(135deg,#111,#0d1a0d)", border: "1px solid #39FF1444", borderRadius: 20, padding: "40px 20px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 900, textTransform: "uppercase", marginBottom: 12 }}>
            READY TO CLIMB YOUR GYM LEADERBOARD?
          </h2>
          <p style={{ fontSize: 14, color: "#aaa", maxWidth: 500, margin: "0 auto 24px" }}>
            Join athletes competing today. Zero setup, instant challenge verification.
          </p>
          <button
            onClick={() => onEnterAuth("signup")}
            style={{ background: "#39FF14", color: "#000", border: "none", borderRadius: 12, padding: "16px 36px", fontSize: 14, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", boxShadow: "0 0 30px rgba(57,255,20,0.4)" }}
          >
            Enter FitArena Free →
          </button>
        </div>
      </section>
    </div>
  );
}
