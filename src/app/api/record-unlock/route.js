import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — must match generate-qr-token
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

function userClient(jwt) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function tokenIsValid(challengeId, expiresAt, token) {
  if (!TOKEN_PATTERN.test(token || "")) return false;
  if (!Number.isSafeInteger(expiresAt)) return false;
  if (expiresAt <= Date.now() || expiresAt > Date.now() + TOKEN_TTL_MS) return false;

  const expected = crypto
    .createHmac("sha256", process.env.UNLOCK_TOKEN_SECRET)
    .update(`${challengeId}:${expiresAt}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
}

export async function POST(request) {
  const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.UNLOCK_TOKEN_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "QR unlocking is not configured." }, { status: 500 });
  }

  let challengeId, token, expiresAt;
  try {
    ({ challengeId, token, expiresAt } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!UUID_PATTERN.test(challengeId || "") || !tokenIsValid(challengeId, expiresAt, token)) {
    return NextResponse.json({ error: "Invalid or expired QR code." }, { status: 403 });
  }

  const auth = userClient(jwt);
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = serviceClient();
  const { data: challenge } = await service
    .from("challenges")
    .select("id")
    .eq("id", challengeId)
    .eq("active", true)
    .maybeSingle();
  if (!challenge) {
    return NextResponse.json({ error: "This challenge is no longer active." }, { status: 410 });
  }

  const { error } = await service
    .from("unlocked_challenges")
    .upsert({ user_id: user.id, challenge_id: challengeId }, { onConflict: "user_id,challenge_id" });
  if (error) {
    console.error("[record-unlock] Failed to store unlock:", error.message);
    return NextResponse.json({ error: "Unable to record unlock." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
