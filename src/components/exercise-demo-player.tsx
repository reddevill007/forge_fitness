"use client";

import { Image as ImageIcon, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ExerciseStill } from "@/src/components/exercise-still";
import { isDirectVideoUrl, toYoutubeEmbedUrl } from "@/src/lib/video-embed";
import { resolveDatasetMedia } from "@/src/lib/dataset-media";

type Source = "gif" | "video";

function ytCommand(iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
}

function parsePlayerState(data: unknown): number | null {
  if (typeof data !== "string" || data[0] !== "{") return null;
  try {
    const payload = JSON.parse(data) as { event?: string; info?: unknown };
    if (payload.event === "onStateChange" && typeof payload.info === "number") return payload.info;
    if (payload.event === "infoDelivery" && payload.info && typeof payload.info === "object") {
      const state = (payload.info as { playerState?: number }).playerState;
      return typeof state === "number" ? state : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function ExerciseDemoPlayer({
  title,
  videoUrl,
  gifUrl,
  imageUrl,
  label,
  alt,
  preferGif,
}: {
  title: string;
  videoUrl?: string | null;
  gifUrl?: string | null;
  imageUrl?: string | null;
  label?: string;
  alt?: string;
  preferGif?: boolean;
}) {
  const youtube = videoUrl ? toYoutubeEmbedUrl(videoUrl, true) : null;
  const fileVideo = videoUrl && isDirectVideoUrl(videoUrl) ? videoUrl : null;
  const still = resolveDatasetMedia(gifUrl || undefined) || resolveDatasetMedia(imageUrl || undefined);
  const hasVideo = Boolean(youtube || fileVideo);
  const hasGif = Boolean(still);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const initial: Source = preferGif && hasGif ? "gif" : hasVideo ? "video" : "gif";
  const [source, setSource] = useState<Source>(initial);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    setSource(preferGif && hasGif ? "gif" : hasVideo ? "video" : "gif");
    setPlaying(true);
    setMuted(true);
  }, [title, hasGif, hasVideo, preferGif, videoUrl]);

  useEffect(() => {
    if (!youtube) return;
    const node = iframeRef.current;
    if (!node) return;

    function handshake() {
      const frame = iframeRef.current;
      if (!frame) return;
      frame.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: title }), "*");
      ytCommand(frame, "addEventListener", ["onStateChange"]);
      ytCommand(frame, "mute");
      ytCommand(frame, "playVideo");
    }

    function onMessage(event: MessageEvent) {
      const state = parsePlayerState(event.data);
      if (state !== 0) return;
      ytCommand(iframeRef.current, "seekTo", [0, true]);
      ytCommand(iframeRef.current, "playVideo");
    }

    handshake();
    node.addEventListener("load", handshake);
    window.addEventListener("message", onMessage);
    return () => {
      node.removeEventListener("load", handshake);
      window.removeEventListener("message", onMessage);
    };
  }, [youtube, title]);

  function togglePlay() {
    const next = !playing;
    setPlaying(next);
    if (fileVideo && videoRef.current) {
      if (next) void videoRef.current.play();
      else videoRef.current.pause();
      return;
    }
    ytCommand(iframeRef.current, next ? "playVideo" : "pauseVideo");
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (fileVideo && videoRef.current) {
      videoRef.current.muted = next;
      return;
    }
    ytCommand(iframeRef.current, next ? "mute" : "unMute");
  }

  if (!hasVideo && !hasGif) {
    return (
      <div className="exercise-demo exercise-demo-empty">
        <p>No demo yet. Paste a YouTube Shorts URL on this exercise.</p>
      </div>
    );
  }

  const showVideo = source === "video" && hasVideo;
  const portrait = Boolean(showVideo && youtube);
  const badge = label === ""
    ? ""
    : showVideo
      ? (label ?? (youtube ? "Shorts · loop" : "Video · loop"))
      : (label ?? "Dataset GIF");

  return (
    <div className="demo-player">
      {hasVideo && hasGif && (
        <div className="demo-source-tabs" role="tablist" aria-label="Demo source">
          <button type="button" role="tab" className={source === "gif" ? "active" : ""} onClick={() => setSource("gif")}>
            <ImageIcon size={14} /> GIF
          </button>
          <button type="button" role="tab" className={source === "video" ? "active" : ""} onClick={() => setSource("video")}>
            <Play size={14} /> Shorts
          </button>
        </div>
      )}
      <div className={`exercise-demo ${portrait ? "is-shorts" : ""}`}>
        {showVideo && youtube && (
          <>
            <iframe
              key={youtube}
              ref={iframeRef}
              className="exercise-demo-frame"
              src={youtube}
              title={`${title} video`}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              tabIndex={-1}
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <i className="shorts-chrome-mask" aria-hidden="true" />
          </>
        )}
        {showVideo && fileVideo && (
          <video
            ref={videoRef}
            className="exercise-demo-frame"
            src={fileVideo}
            autoPlay
            muted={muted}
            loop
            playsInline
            controls={false}
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
          />
        )}
        {!showVideo && still && (
          <ExerciseStill className="exercise-gif" src={still} alt={alt ?? `${title} demonstration`} width={440} height={780} />
        )}
        {badge ? <span>{badge}</span> : null}
      </div>
      {showVideo && (
        <div className="demo-controls">
          <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            {muted ? "Muted" : "Sound"}
          </button>
          <em>Loops · no YouTube bar</em>
        </div>
      )}
    </div>
  );
}
