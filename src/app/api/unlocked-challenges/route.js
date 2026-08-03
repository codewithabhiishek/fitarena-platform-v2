import { NextResponse } from "next/server";
import { adminDb } from "../../../firebase/admin";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const snapshot = await adminDb.collection("unlocked_challenges")
      .where("user_id", "==", userId)
      .get();
      
    const ids = [];
    snapshot.forEach(doc => {
      ids.push(doc.data().challenge_id);
    });
    
    return NextResponse.json({ ids });
  } catch (error) {
    console.error("Error fetching unlocked challenges:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
