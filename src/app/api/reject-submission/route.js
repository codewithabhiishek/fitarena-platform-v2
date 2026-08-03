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

    const submissionRef = adminDb.collection('submissions').doc(submissionId);
    await submissionRef.update({ status: 'rejected' });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting submission:", error);
    return NextResponse.json({ error: error.message || "Failed to reject submission" }, { status: 500 });
  }
}
