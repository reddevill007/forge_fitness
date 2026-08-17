import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirebaseConfig, isFirebaseConfigured } from "@/src/lib/firebase/config";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let persistenceReady: Promise<void> | null = null;

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = getApps()[0] ?? initializeApp(getFirebaseConfig());
  }
  return app;
}

export function getFirebaseAuth() {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!auth) {
    auth = getAuth(firebaseApp);
    persistenceReady = setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  }
  return auth;
}

export function getFirebaseDb() {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!db) {
    if (typeof window === "undefined") {
      db = getFirestore(firebaseApp);
    } else {
      try {
        db = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch {
        db = getFirestore(firebaseApp);
      }
    }
  }
  return db;
}

export function getFirebaseStorage() {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!storage) {
    try {
      const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      storage = bucket ? getStorage(firebaseApp, `gs://${bucket}`) : getStorage(firebaseApp);
    } catch {
      storage = getStorage(firebaseApp);
    }
  }
  return storage;
}

export async function ensureAuthPersistence() {
  getFirebaseAuth();
  await persistenceReady;
}
