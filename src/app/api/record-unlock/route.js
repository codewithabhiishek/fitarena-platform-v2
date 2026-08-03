import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb } from "../../../firebase/admin";
import { auth } from "@clerk/nextjs/server";

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

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
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.UNLOCK_TOKEN_SECRET) {
    return NextResponse.json({ error: "QR unlocking is not configured." }, { status: 500 });
  }

  let challengeId, token, expiresAt;
  try {
    ({ challengeId, token, expiresAt } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  
  if (!tokenIsValid(challengeId, expiresAt, token)) {
    return NextResponse.json({ error: "Invalid or expired QR code." }, { status: 403 });
  }

  try {
    const challengeDoc = await adminDb.collection("challenges").doc(challengeId).get();
    if (!challengeDoc.exists || !challengeDoc.data().active) {
      return NextResponse.json({ error: "This challenge is no longer active." }, { status: 410 });
    }

    const unlockId = `${userId}_${challengeId}`;
    await adminDb.collection("unlocked_challenges").doc(unlockId).set({
      user_id: userId,
      challenge_id: challengeId,
      unlocked_at: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[record-unlock] Failed to store unlock:", error);
    return NextResponse.json({ error: "Unable to record unlock." }, { status: 500 });
  }
}
