import { db, storage } from "../firebase/client";
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs, where, getCountFromServer } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function getUserProfile(userId) {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error("User profile not found");
  }
  return docSnap.data();
}

export async function updateUserProfile(userId, updates) {
  const docRef = doc(db, "users", userId);
  const safeUpdates = {};
  if (updates.name !== undefined) safeUpdates.name = updates.name;
  if (updates.gym !== undefined) safeUpdates.gym = updates.gym;
  if (updates.avatar_url !== undefined) safeUpdates.avatar_url = updates.avatar_url;
  
  if (Object.keys(safeUpdates).length > 0) {
    await updateDoc(docRef, safeUpdates);
  }
}

export async function uploadAvatar(userId, file) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;
  const storageRef = ref(storage, path);
  
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  
  const bustUrl = `${downloadUrl}?t=${Date.now()}`;
  await updateUserProfile(userId, { avatar_url: bustUrl });
  return bustUrl;
}

export async function getLeaderboard(limitCount = 20, period = "all-time") {
  let since = null;
  if (period === "daily" || period === "active today") {
    since = new Date().toISOString().slice(0, 10);
  } else if (period === "weekly" || period === "active this week") {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 7);
    since = d.toISOString().slice(0, 10);
  } else if (period === "monthly" || period === "active this month") {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    since = d.toISOString().slice(0, 10);
  }

  const usersRef = collection(db, "users");
  let q;
  if (since) {
    q = query(usersRef, where("last_active", ">=", since), orderBy("last_active", "desc"), orderBy("points", "desc"), limit(limitCount));
  } else {
    q = query(usersRef, orderBy("points", "desc"), limit(limitCount));
  }

  const querySnapshot = await getDocs(q);
  const users = [];
  querySnapshot.forEach((doc) => {
    users.push(doc.data());
  });

  if (since) {
    users.sort((a, b) => b.points - a.points);
  }

  return users.map((u, i) => ({ ...u, position: i + 1 }));
}

export async function getUserRank(userId) {
  const user = await getUserProfile(userId).catch(() => null);
  if (!user) return null;

  const usersRef = collection(db, "users");
  const q = query(usersRef, where("points", ">", user.points));
  
  try {
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count + 1;
  } catch (error) {
    console.error("[getUserRank] Error:", error);
    return null;
  }
}
