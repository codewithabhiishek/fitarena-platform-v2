// src/app/api/ai/route.js
// Server-side proxy for Groq API calls.
// The key lives in GROQ_API_KEY (no NEXT_PUBLIC_ prefix) and is
// never sent to the browser.
//
// Rate limiting is backed by Upstash Redis via @upstash/ratelimit.
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your env.

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Build the rate limiter once per cold start.
// If Upstash env vars are missing the app still starts but the /api/ai
// endpoint will return 500 with a clear message — better than silently
// skipping rate limiting.
let ratelimit = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }),
    // 5 requests per IP per 60-second sliding window
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    analytics: true,
    prefix: "fitarena:rl:ai",
  });
}

export async function POST(request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  if (!ratelimit) {
    return NextResponse.json(
      { error: "Rate limiter is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN." },
      { status: 500 }
    );
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

  const { success, limit, remaining, reset } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
        },
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { prompt, max_tokens = 80 } = body;
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json(
      { error: "Request body must include a non-empty 'prompt' string." },
      { status: 400 }
    );
  }

  if (prompt.length > 2000) {
    return NextResponse.json({ error: "Prompt too long." }, { status: 400 });
  }
  const safeTokens = Math.min(typeof max_tokens === "number" ? max_tokens : 80, 200);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: safeTokens,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!res.ok) {
      const errText = await res.text();
      console.error("[/api/ai] Groq error:", res.status, errText);
      const groqErr = new Error(`Groq API error ${res.status}: ${errText}`);
      Sentry.captureException(groqErr, { extra: { status: res.status } });
      return NextResponse.json(
        { error: "AI service error. Please try again." },
        { status: res.status }
      );
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ text });
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[/api/ai] Groq request timed out");
      Sentry.captureException(new Error("Groq API request timed out"), { extra: { ip } });
      return NextResponse.json({ error: "AI request timed out. Please try again." }, { status: 504 });
    }
    console.error("[/api/ai] Fetch failed:", err.message);
    Sentry.captureException(err, { extra: { ip } });
    return NextResponse.json({ error: "Failed to reach Groq API." }, { status: 502 });
  }
}
