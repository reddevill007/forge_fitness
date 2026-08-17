const DB_NAME = "forge-offline";
const STORE = "responses";
const RUNTIME_CACHE = "forge-runtime-v1";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key: string, value: unknown) {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(key: string) {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cachedJson<T>(key: string, loader: () => Promise<T>): Promise<T> {
  try {
    const data = await loader();
    await idbSet(key, data).catch(() => undefined);
    return data;
  } catch (error) {
    const hit = await idbGet<T>(key).catch(() => null);
    if (hit) return hit;
    throw error;
  }
}

export async function cacheResponse(request: Request, response: Response) {
  if (typeof caches === "undefined" || !response.ok) return;
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response.clone());
}

export async function matchCached(request: Request | string) {
  if (typeof caches === "undefined") return undefined;
  const cache = await caches.open(RUNTIME_CACHE);
  return cache.match(request);
}
