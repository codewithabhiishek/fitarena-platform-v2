import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function initAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;

  const config = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project"
  };

  if (serviceAccount) {
    config.credential = cert(serviceAccount);
  } else {
    // During build time, if we don't have a service account, we can still
    // initialize with a dummy credential to prevent next build from crashing
    // or we can rely on applicationDefault if available.
    try {
        const { applicationDefault } = require("firebase-admin/app");
        config.credential = applicationDefault();
    } catch (e) {
        // Ignore
    }
  }

  return initializeApp(config);
}

const adminApp = initAdmin();
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
