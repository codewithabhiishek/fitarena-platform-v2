import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — short enough to prevent sharing abuse
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createUserClient(jwt) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

function signChallenge(challengeId, expiresAt) {
  return crypto
    .createHmac("sha256", process.env.UNLOCK_TOKEN_SECRET)
    .update(`${challengeId}:${expiresAt}`)
    .digest("hex");
}

export async function POST(request) {
  const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.UNLOCK_TOKEN_SECRET) {
    return NextResponse.json({ error: "QR signing is not configured." }, { status: 500 });
  }

  let challengeId;
  try {
    ({ challengeId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!UUID_PATTERN.test(challengeId || "")) {
    return NextResponse.json({ error: "Invalid challengeId." }, { status: 400 });
  }

  const supabase = createUserClient(jwt);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id")
    .eq("id", challengeId)
    .eq("active", true)
    .maybeSingle();
  if (!challenge) {
    return NextResponse.json({ error: "Active challenge not found." }, { status: 404 });
  }

  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const token = signChallenge(challengeId, expiresAt);
  const origin = new URL(request.url).origin;
  const url = `${origin}/c/${challengeId}?expires=${expiresAt}&token=${token}`;
  return NextResponse.json({ url, expiresAt });
}
