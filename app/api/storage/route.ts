export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_PREFIXES = ["bodyPhotos/", "customExercises/"];

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function storageBucket() {
  return process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? "";
}

function apiKey() {
  return process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? "";
}

function objectUrl(path: string) {
  const bucket = storageBucket();
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}`;
}

async function uidFromIdToken(idToken: string) {
  const key = apiKey();
  if (!key) throw new Error("Firebase is not configured.");
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const data = (await res.json()) as { users?: Array<{ localId?: string }>; error?: { message?: string } };
  const uid = data.users?.[0]?.localId;
  if (!res.ok || !uid) throw new Error(data.error?.message || "Sign in again to upload.");
  return uid;
}

function tokenFrom(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function assertOwnedPath(uid: string, path: string) {
  const prefix = `users/${uid}/`;
  if (!path.startsWith(prefix)) throw new Error("That file path is not allowed.");
  const rest = path.slice(prefix.length);
  if (!ALLOWED_PREFIXES.some((allowed) => rest.startsWith(allowed))) {
    throw new Error("That file path is not allowed.");
  }
  if (path.includes("..") || path.includes("//")) throw new Error("That file path is not allowed.");
}

function downloadUrl(path: string, downloadTokens: string) {
  return `${objectUrl(path)}?alt=media&token=${encodeURIComponent(downloadTokens)}`;
}

export async function POST(request: Request) {
  if (!storageBucket() || !apiKey()) return jsonError("Firebase Storage is not configured.", 503);

  const idToken = tokenFrom(request);
  if (!idToken) return jsonError("Sign in to upload.", 401);

  let uid: string;
  try {
    uid = await uidFromIdToken(idToken);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Sign in again to upload.", 401);
  }

  const form = await request.formData();
  const file = form.get("file");
  const path = String(form.get("path") ?? "");
  if (!(file instanceof File) || !path) return jsonError("Choose a file to upload.", 400);

  try {
    assertOwnedPath(uid, path);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "That file path is not allowed.", 403);
  }

  if (file.size > MAX_BYTES) return jsonError("Keep the file under 12 MB.", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";
  const upload = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${storageBucket()}/o?name=${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Firebase ${idToken}`,
        "Content-Type": contentType,
      },
      body: bytes,
    },
  );
  const payload = (await upload.json()) as { downloadTokens?: string; error?: { message?: string } };
  if (!upload.ok || !payload.downloadTokens) {
    return jsonError(payload.error?.message || "Firebase Storage rejected the upload.", upload.status || 502);
  }

  return Response.json({ path, url: downloadUrl(path, payload.downloadTokens) });
}

export async function DELETE(request: Request) {
  if (!storageBucket() || !apiKey()) return jsonError("Firebase Storage is not configured.", 503);

  const idToken = tokenFrom(request);
  if (!idToken) return jsonError("Sign in to delete that file.", 401);

  let uid: string;
  try {
    uid = await uidFromIdToken(idToken);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Sign in again.", 401);
  }

  const path = String(new URL(request.url).searchParams.get("path") ?? "");
  if (!path) return jsonError("Missing file path.", 400);

  try {
    assertOwnedPath(uid, path);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "That file path is not allowed.", 403);
  }

  const res = await fetch(objectUrl(path), {
    method: "DELETE",
    headers: { Authorization: `Firebase ${idToken}` },
  });
  if (!res.ok && res.status !== 404) {
    const payload = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return jsonError(payload.error?.message || "Could not delete that file.", res.status);
  }

  return Response.json({ ok: true });
}
