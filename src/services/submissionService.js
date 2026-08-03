import { db } from "../firebase/client";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, onSnapshot } from "firebase/firestore";

const _approvingInFlight = new Set();
const _rejectingInFlight = new Set();

export async function submitScore({ userId, challengeId, score }) {
  const unlockRef = doc(db, "unlocked_challenges", `${userId}_${challengeId}`);
  const unlockSnap = await getDoc(unlockRef);
  if (!unlockSnap.exists()) {
    throw new Error("UNLOCK_REQUIRED: You must scan the QR code before submitting.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const submissionsRef = collection(db, "submissions");
  const q = query(submissionsRef, 
    where("user_id", "==", userId), 
    where("challenge_id", "==", challengeId),
    where("submission_date", "==", today)
  );
  
  const existing = await getDocs(q);
  if (!existing.empty) {
    throw new Error("You've already submitted for this challenge today.");
  }

  const newRef = doc(collection(db, "submissions"));
  const newSubmission = {
    user_id: userId,
    challenge_id: challengeId,
    score,
    status: "pending",
    submitted_at: new Date().toISOString(),
    submission_date: today
  };
  await setDoc(newRef, newSubmission);
  return { id: newRef.id, ...newSubmission };
}

export async function getSubmissionsForChallenge(challengeId) {
  const submissionsRef = collection(db, "submissions");
  const q = query(submissionsRef, where("challenge_id", "==", challengeId), orderBy("submitted_at", "desc"));
  const querySnapshot = await getDocs(q);
  
  const data = [];
  querySnapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() });
  });

  for (const s of data) {
    const uDoc = await getDoc(doc(db, "users", s.user_id));
    if (uDoc.exists()) {
      s.users = { name: uDoc.data().name, avatar_url: uDoc.data().avatar_url };
    }
  }

  return data;
}

export async function getMySubmissions(userId) {
  const submissionsRef = collection(db, "submissions");
  const q = query(submissionsRef, where("user_id", "==", userId), orderBy("submitted_at", "desc"));
  const querySnapshot = await getDocs(q);
  
  const data = [];
  querySnapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() });
  });

  for (const s of data) {
    const cDoc = await getDoc(doc(db, "challenges", s.challenge_id));
    if (cDoc.exists()) {
      const c = cDoc.data();
      s.challenges = { title: c.title, type: c.type, icon: c.icon, color: c.color, points: c.points };
    }
  }

  return data;
}

export async function getPendingSubmissions() {
  const submissionsRef = collection(db, "submissions");
  const q = query(submissionsRef, where("status", "==", "pending"), orderBy("submitted_at", "asc"));
  const querySnapshot = await getDocs(q);
  
  const data = [];
  querySnapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() });
  });

  for (const s of data) {
    const [uDoc, cDoc] = await Promise.all([
      getDoc(doc(db, "users", s.user_id)),
      getDoc(doc(db, "challenges", s.challenge_id))
    ]);
    if (uDoc.exists()) {
      s.users = { name: uDoc.data().name, avatar_url: uDoc.data().avatar_url };
    }
    if (cDoc.exists()) {
      const c = cDoc.data();
      s.challenges = { title: c.title, type: c.type, points: c.points };
    }
  }

  return data;
}

export async function approveSubmission(submissionId) {
  if (_approvingInFlight.has(submissionId)) {
    throw new Error("DUPLICATE: This submission is already being processed.");
  }
  _approvingInFlight.add(submissionId);

  try {
    const res = await fetch("/api/approve-submission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to approve");
    return data;
  } finally {
    _approvingInFlight.delete(submissionId);
  }
}

export async function rejectSubmission(submissionId) {
  if (_rejectingInFlight.has(submissionId)) {
    throw new Error("DUPLICATE: This submission is already being processed.");
  }
  _rejectingInFlight.add(submissionId);

  try {
    const res = await fetch("/api/reject-submission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to reject");
    return data;
  } finally {
    _rejectingInFlight.delete(submissionId);
  }
}

export function subscribeToSubmissions(callback) {
  const q = query(collection(db, "submissions"));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    callback();
  });
  return unsubscribe;
}
