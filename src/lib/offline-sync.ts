import { waitForPendingWrites } from "firebase/firestore";
import { getFirebaseDb } from "@/src/lib/firebase/client";
import type { ActiveSessionProgress, StoredSession } from "@/src/lib/firebase/types";
import { idbGet, idbSet } from "@/src/lib/offline-cache";

const OUTBOX_KEY = "sync-outbox";
const SESSION_KEY = (uid: string) => `active-session:${uid}`;

export type LocalSessionState = {
  progress: ActiveSessionProgress | null;
  pendingSync: boolean;
  clearedAt: string | null;
};

export type OfflineOutboxItem =
  | {
      id: string;
      kind: "active-session";
      uid: string;
      progress: ActiveSessionProgress;
    }
  | {
      id: string;
      kind: "clear-active-session";
      uid: string;
    }
  | {
      id: string;
      kind: "complete-session";
      uid: string;
      session: StoredSession;
    };

type OutboxProcessor = (item: OfflineOutboxItem) => Promise<void>;

let queue: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>) {
  const next = queue.then(task, task);
  queue = next.then(() => undefined, () => undefined);
  return next;
}

export function isBrowserOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

export function newerProgress(
  local: ActiveSessionProgress | null | undefined,
  remote: ActiveSessionProgress | null | undefined,
) {
  if (!local) return remote ?? null;
  if (!remote) return local;
  return local.updatedAt >= remote.updatedAt ? local : remote;
}

export function mergeSessionState(
  local: LocalSessionState | null,
  remote: ActiveSessionProgress | null,
) {
  if (local?.clearedAt) {
    if (!remote || remote.updatedAt <= local.clearedAt) return null;
    return remote;
  }
  return newerProgress(local?.progress ?? null, remote);
}

export async function loadLocalSessionState(uid: string) {
  return idbGet<LocalSessionState>(SESSION_KEY(uid));
}

export async function saveLocalSessionState(uid: string, state: LocalSessionState) {
  await idbSet(SESSION_KEY(uid), state);
}

export async function readOutbox() {
  return (await idbGet<OfflineOutboxItem[]>(OUTBOX_KEY)) ?? [];
}

async function writeOutbox(items: OfflineOutboxItem[]) {
  await idbSet(OUTBOX_KEY, items);
}

function coalesce(items: OfflineOutboxItem[], incoming: OfflineOutboxItem) {
  if (incoming.kind === "active-session") {
    return [
      ...items.filter((item) => !(item.kind === "active-session" && item.uid === incoming.uid)),
      incoming,
    ];
  }
  if (incoming.kind === "clear-active-session") {
    return [
      ...items.filter((item) => !(
        (item.kind === "active-session" || item.kind === "clear-active-session")
        && item.uid === incoming.uid
      )),
      incoming,
    ];
  }
  return [...items.filter((item) => item.id !== incoming.id), incoming];
}

export async function enqueueOutbox(item: OfflineOutboxItem) {
  await withLock(async () => {
    const items = await readOutbox();
    await writeOutbox(coalesce(items, item));
  });
}

export async function pendingOutboxForUser(uid: string) {
  const items = await readOutbox();
  return items.filter((item) => item.uid === uid);
}

export async function flushOutbox(process: OutboxProcessor, uid?: string) {
  if (!isBrowserOnline()) return;
  await withLock(async () => {
    while (true) {
      if (!isBrowserOnline()) return;
      const items = await readOutbox();
      const item = items.find((entry) => !uid || entry.uid === uid);
      if (!item) break;
      try {
        await process(item);
      } catch {
        return;
      }
      const latest = await readOutbox();
      const current = latest.find((entry) => entry.id === item.id);
      if (!current) continue;
      const unchanged = item.kind === "active-session" && current.kind === "active-session"
        ? current.progress.updatedAt === item.progress.updatedAt
        : JSON.stringify(current) === JSON.stringify(item);
      if (unchanged) {
        await writeOutbox(latest.filter((entry) => entry.id !== item.id));
      }
    }
    const db = getFirebaseDb();
    if (db) await waitForPendingWrites(db).catch(() => undefined);
  });
}
