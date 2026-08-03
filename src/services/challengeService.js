import { db } from "../firebase/client";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, onSnapshot } from "firebase/firestore";

export async function getChallenges() {
  const challengesRef = collection(db, "challenges");
  const q = query(challengesRef, where("active", "==", true), orderBy("created_at", "desc"));
  const querySnapshot = await getDocs(q);
  
  const challenges = [];
  querySnapshot.forEach((doc) => {
    challenges.push({ id: doc.id, ...doc.data() });
  });
  return challenges;
}

export async function getChallengeById(id) {
  const docRef = doc(db, "challenges", id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error("Challenge not found");
  }
  return { id: docSnap.id, ...docSnap.data() };
}

export async function getChallengeStats() {
  const submissionsRef = collection(db, "submissions");
  const q = query(submissionsRef, where("status", "==", "approved"));
  const querySnapshot = await getDocs(q);

  const result = {};
  querySnapshot.forEach((doc) => {
    const row = doc.data();
    const cid = row.challenge_id;
    if (!result[cid]) {
      result[cid] = { topScore: 0, participants: new Set() };
    }
    if (row.score > result[cid].topScore) {
      result[cid].topScore = row.score;
    }
    result[cid].participants.add(row.user_id);
  });

  for (const cid in result) {
    result[cid].participants = result[cid].participants.size;
  }
  
  return result;
}

export async function getMyBestScores(userId) {
  if (!userId) return {};

  const submissionsRef = collection(db, "submissions");
  const q = query(submissionsRef, where("user_id", "==", userId), where("status", "==", "approved"));
  const querySnapshot = await getDocs(q);

  const best = {};
  querySnapshot.forEach((doc) => {
    const row = doc.data();
    const cid = row.challenge_id;
    if (!best[cid] || row.score > best[cid]) {
      best[cid] = row.score;
    }
  });
  return best;
}

export async function createChallenge(userId, challenge) {
  const newRef = doc(collection(db, "challenges"));
  const newChallenge = {
    ...challenge,
    created_by: userId,
    created_at: new Date().toISOString(),
    active: true
  };
  await setDoc(newRef, newChallenge);
  return { id: newRef.id, ...newChallenge };
}

export async function updateChallenge(id, updates) {
  const docRef = doc(db, "challenges", id);
  await updateDoc(docRef, updates);
  return { id, ...updates };
}

export async function deactivateChallenge(id) {
  return updateChallenge(id, { active: false });
}

export function subscribeToChallenges(callback) {
  const q = query(collection(db, "challenges"));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    callback();
  });
  return unsubscribe;
}

export async function getMyPendingChallengeIds(userId) {
  if (!userId) return new Set();

  const submissionsRef = collection(db, "submissions");
  const q = query(submissionsRef, where("user_id", "==", userId), where("status", "==", "pending"));
  const querySnapshot = await getDocs(q);

  const pending = new Set();
  querySnapshot.forEach((doc) => {
    pending.add(doc.data().challenge_id);
  });
  return pending;
}
