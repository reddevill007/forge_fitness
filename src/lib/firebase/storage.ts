import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "@/src/lib/firebase/client";

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

export async function uploadCustomExerciseMedia(
  uid: string,
  exerciseId: string,
  kind: "gif" | "image",
  file: File,
) {
  assertExerciseMediaFile(file);
  const store = getFirebaseStorage();
  if (!store) throw new Error("Firebase Storage is not configured.");
  const path = `users/${uid}/customExercises/${exerciseId}/${kind}.${extensionFor(file)}`;
  const fileRef = ref(store, path);
  await uploadBytes(fileRef, file, { contentType: file.type || "image/gif" });
  return getDownloadURL(fileRef);
}
