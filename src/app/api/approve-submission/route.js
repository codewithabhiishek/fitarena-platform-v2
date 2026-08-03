import { NextResponse } from "next/server";
import { adminDb } from "../../../firebase/admin";
import { auth } from "@clerk/nextjs/server";

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let submissionId;
  try {
    ({ submissionId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const adminRef = adminDb.collection('users').doc(userId);
    const adminDoc = await adminRef.get();
    if (!adminDoc.exists || !adminDoc.data().is_admin) {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    await adminDb.runTransaction(async (transaction) => {
      const submissionRef = adminDb.collection('submissions').doc(submissionId);
      const submissionDoc = await transaction.get(submissionRef);

      if (!submissionDoc.exists) throw new Error("Submission not found");
      
      const submission = submissionDoc.data();
      if (submission.status !== 'pending') throw new Error("Submission is not pending");

      const challengeRef = adminDb.collection('challenges').doc(submission.challenge_id);
      const challengeDoc = await transaction.get(challengeRef);
      if (!challengeDoc.exists) throw new Error("Challenge not found");
      
      const challenge = challengeDoc.data();
      
      const userRef = adminDb.collection('users').doc(submission.user_id);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error("User not found");
      
      const user = userDoc.data();

      const newPoints = (user.points || 0) + (challenge.points || 0);
      const newXp = (user.xp || 0) + (challenge.points || 0);
      const newLevel = Math.floor(newXp / 500) + 1;
      
      const todayDate = new Date().toISOString().slice(0, 10);
      let newStreak = user.streak || 0;
      let newLongestStreak = user.longest_streak || 0;
      
      const lastActiveDate = user.last_active ? user.last_active.slice(0, 10) : null;
      if (lastActiveDate !== todayDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDate = yesterday.toISOString().slice(0, 10);

        if (lastActiveDate === yesterdayDate) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
        
        if (newStreak > newLongestStreak) newLongestStreak = newStreak;
      }

      let newBadges = [...(user.badges || [])];
      
      if (newStreak >= 7 && !newBadges.includes("consistency_monster")) newBadges.push("consistency_monster");
      if (newLevel >= 10 && !newBadges.includes("elite_member")) newBadges.push("elite_member");
      
      if (challenge.type === "Pushup" && submission.score >= 50 && !newBadges.includes("pushup_king")) newBadges.push("pushup_king");
      if (challenge.type === "Deadlift" && submission.score >= 405 && !newBadges.includes("deadlift_beast")) newBadges.push("deadlift_beast");
      if (challenge.type === "Squat" && submission.score >= 315 && !newBadges.includes("squat_lord")) newBadges.push("squat_lord");
      if (challenge.type === "Plank" && submission.score >= 180 && !newBadges.includes("plank_god")) newBadges.push("plank_god");

      transaction.update(submissionRef, { status: "approved" });
      transaction.update(userRef, {
        points: newPoints,
        xp: newXp,
        level: newLevel,
        streak: newStreak,
        longest_streak: newLongestStreak,
        last_active: new Date().toISOString(),
        badges: newBadges
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error approving submission:", error);
    return NextResponse.json({ error: error.message || "Failed to approve submission" }, { status: 500 });
  }
}
