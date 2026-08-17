"use client";

import Image from "next/image";

function canOptimize(src: string) {
  return (
    src.startsWith("/")
    || src.includes("cdn.jsdelivr.net")
    || src.includes("firebasestorage.googleapis.com")
    || src.includes("firebasestorage.app")
    || src.includes("storage.googleapis.com")
  );
}

export function ExerciseStill({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  if (canOptimize(src)) {
    return <Image className={className} src={src} alt={alt} width={width} height={height} unoptimized />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={src} alt={alt} width={width} height={height} />
  );
}
