import { getFirebaseAuth } from "@/src/lib/firebase/client";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/gif",
  "image/webp",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName === "jpeg") return "jpg";
  if (fromName && ["gif", "png", "jpg", "webp"].includes(fromName)) return fromName;
  if (file.type === "image/gif") return "gif";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function assertExerciseMediaFile(file: File) {
  if (file.type && !ALLOWED_TYPES.has(file.type) && !file.type.startsWith("image/")) {
    throw new Error("Use a GIF, PNG, JPG, or WebP.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Keep the file under 12 MB.");
  }
}

async function idToken() {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) throw new Error("Not signed in");
  return user.getIdToken();
}

async function uploadStoredFile(path: string, file: File) {
  const token = await idToken();
  const body = new FormData();
  body.set("path", path);
  body.set("file", file);
  const res = await fetch("/api/storage", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !payload.url) throw new Error(payload.error || "Could not upload that file.");
  return { path, url: payload.url };
}

export async function uploadCustomExerciseMedia(
  uid: string,
  exerciseId: string,
  kind: "gif" | "image",
  file: File,
) {
  assertExerciseMediaFile(file);
  const path = `users/${uid}/customExercises/${exerciseId}/${kind}.${extensionFor(file)}`;
  const stored = await uploadStoredFile(path, file);
  return stored.url;
}

export async function uploadBodyPhoto(uid: string, photoId: string, file: File) {
  assertExerciseMediaFile(file);
  const path = `users/${uid}/bodyPhotos/${photoId}.${extensionFor(file)}`;
  return uploadStoredFile(path, file);
}

export async function deleteStoredFile(path: string) {
  if (!path) return;
  try {
    const token = await idToken();
    await fetch(`/api/storage?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Best-effort cleanup; the Firestore doc is the source of truth.
  }
}
