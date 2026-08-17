export function youtubeVideoId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const queryId = parsed.searchParams.get("v");
      if (queryId) return queryId;
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v") {
        return parts[1] ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function toYoutubeEmbedUrl(url: string, loop = false): string | null {
  const id = youtubeVideoId(url);
  if (!id) return null;
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    controls: "0",
    fs: "0",
    disablekb: "1",
    iv_load_policy: "3",
    cc_load_policy: "0",
    autohide: "1",
    enablejsapi: "1",
  });
  if (loop) {
    params.set("autoplay", "1");
    params.set("mute", "1");
  }
  if (typeof window !== "undefined") {
    params.set("origin", window.location.origin);
    params.set("widget_referrer", window.location.origin);
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function isYoutubeShortsUrl(url: string) {
  return /\/shorts\//i.test(url.trim()) || Boolean(youtubeVideoId(url));
}

export function youtubePoster(url: string): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function isDirectVideoUrl(url: string): boolean {
  try {
    const path = new URL(url.includes("://") ? url : `https://${url}`).pathname.toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(path);
  } catch {
    return false;
  }
}

export function isLoopableVideoUrl(url: string): boolean {
  return Boolean(youtubeVideoId(url) || isDirectVideoUrl(url));
}
