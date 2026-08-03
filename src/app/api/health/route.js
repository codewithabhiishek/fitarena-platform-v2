import { NextResponse } from "next/server";
import { adminDb } from "../../../firebase/admin";

export async function GET() {
  const start = Date.now();

  try {
    // Attempt a lightweight query to verify DB is reachable
    await adminDb.collection("users").limit(1).get();

    return NextResponse.json({
      status: "ok",
      db: "connected",
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
