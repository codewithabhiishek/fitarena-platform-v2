import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb } from "../../../firebase/admin";
import { auth } from "@clerk/nextjs/server";

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

function signChallenge(challengeId, expiresAt) {
  return crypto
    .createHmac("sha256", process.env.UNLOCK_TOKEN_SECRET)
    .update(`${challengeId}:${expiresAt}`)
    .digest("hex");
}

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.UNLOCK_TOKEN_SECRET) {
    return NextResponse.json({ error: "QR signing is not configured." }, { status: 500 });
  }

  let challengeId;
  try {
    ({ challengeId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const adminRef = adminDb.collection("users").doc(userId);
  const adminDoc = await adminRef.get();
  if (!adminDoc.exists || !adminDoc.data().is_admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const challengeRef = adminDb.collection("challenges").doc(challengeId);
  const challengeDoc = await challengeRef.get();
  if (!challengeDoc.exists || !challengeDoc.data().active) {
    return NextResponse.json({ error: "Active challenge not found." }, { status: 404 });
  }

  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const token = signChallenge(challengeId, expiresAt);
  const origin = new URL(request.url).origin;
  const url = `${origin}/c/${challengeId}?expires=${expiresAt}&token=${token}`;
  return NextResponse.json({ url, expiresAt });
}
