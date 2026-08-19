import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/src/lib/firebase/client";
import type { StoredCoachThread } from "@/src/lib/coach/types";

function db() {
  const firestore = getFirebaseDb();
  if (!firestore) throw new Error("Firebase is not configured");
  return firestore;
}

function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => omitUndefined(item)) as T;
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue;
      next[key] = omitUndefined(item);
    }
    return next as T;
  }
  return value;
}

function threadsRef(uid: string) {
  return collection(db(), "users", uid, "coachThreads");
}

function nowIso() {
  return new Date().toISOString();
}

export function subscribeCoachThreads(
  uid: string,
  onChange: (threads: StoredCoachThread[]) => void,
): Unsubscribe {
  const q = query(threadsRef(uid), orderBy("updatedAt", "desc"), limit(40));
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<StoredCoachThread, "id">),
      })));
    },
    () => onChange([]),
  );
}

export async function getCoachThread(uid: string, threadId: string) {
  const snap = await getDoc(doc(threadsRef(uid), threadId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<StoredCoachThread, "id">) };
}

export async function saveCoachThread(
  uid: string,
  thread: Omit<StoredCoachThread, "updatedAt"> & { updatedAt?: string },
) {
  const payload: StoredCoachThread = {
    ...thread,
    updatedAt: thread.updatedAt ?? nowIso(),
  };
  await setDoc(doc(threadsRef(uid), thread.id), omitUndefined(payload));
  return payload;
}

export async function deleteCoachThread(uid: string, threadId: string) {
  await deleteDoc(doc(threadsRef(uid), threadId));
}
