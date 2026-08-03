import { NextResponse } from "next/server";
import { adminDb } from "../../../firebase/admin";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function POST(req) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);

      const name = clerkUser.firstName 
        ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() 
        : clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] || "Athlete";

      // Create default user profile
      await userRef.set({
        id: userId,
        name: name,
        gym: "",
        avatar_url: clerkUser.imageUrl || "",
        points: 0,
        xp: 0,
        level: 1,
        streak: 0,
        longest_streak: 0,
        last_active: new Date().toISOString(),
        badges: [],
        rank: "Rookie",
        is_admin: false,
        created_at: new Date().toISOString()
      });
      return NextResponse.json({ success: true, created: true });
    }
    
    return NextResponse.json({ success: true, created: false });
  } catch (error) {
    console.error("Error syncing user:", error);
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }
}
