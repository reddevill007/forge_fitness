"use client";

import { useId } from "react";

type DoodleProps = {
  className?: string;
};

export function ForgeMark({ className = "" }: DoodleProps) {
  return (
    <svg className={className} viewBox="0 0 52 52" role="img" aria-label="Forge Fitness">
      <path d="M8 19c3-5 8-8 14-8h8c6 0 11 3 14 8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M14 17v18M38 17v18M8 23v8M44 23v8M14 26h24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M24 5l2 4 4 1-4 2-2 4-1-4-4-2 4-1z" fill="var(--lime)" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function DumbbellDoodle({ className = "" }: DoodleProps) {
  return (
    <svg className={className} viewBox="0 0 190 120" aria-hidden="true">
      <path d="M39 48l13 28m-22-23l12 27M148 40l13 28m-23-23l13 27M47 65l98-8" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <path d="M20 53c6-10 14-14 19-12M162 35c7 3 11 9 12 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M82 30c4-6 10-9 18-8M94 88c8 6 17 7 27 1" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 7" />
      <path d="M94 9l3 7 7 2-7 3-3 7-3-7-7-3 7-2z" fill="var(--lime)" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function RunnerDoodle({ className = "" }: DoodleProps) {
  return (
    <svg className={className} viewBox="0 0 180 210" aria-hidden="true">
      <circle cx="104" cy="33" r="18" fill="var(--lime)" stroke="currentColor" strokeWidth="4" />
      <path d="M92 57c-19 16-22 34-10 51l20 22m2-68c18 9 29 21 34 37m-49 7-29 25-24 2m68-4 25 28 27 3M82 79l-34 6-18-13" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 171c24 7 53 6 87-2M11 189c50 6 96 4 139-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 8" />
      <path d="M151 34l3 7 8 2-8 3-3 8-3-8-8-3 8-2z" fill="var(--yellow)" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function BodyMap({
  className = "",
  view = "front",
}: DoodleProps & { view?: "front" | "back" }) {
  const isFront = view === "front";
  return (
    <svg className={className} viewBox="0 0 240 430" role="img" aria-label={`${view} muscle activation map`}>
      <g fill="var(--paper-2)" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="120" cy="37" r="24" />
        <path d="M99 63c-13 5-27 16-33 35l-20 78 18 5 26-63-4 102 22 74-16 103 22 2 14-98 13 98 22-2-17-103 22-74-5-102 27 63 18-5-21-78c-5-19-19-30-32-35-14 9-42 9-56 0z" />
      </g>
      {isFront ? (
        <g stroke="var(--ink)" strokeWidth="1.5">
          <path d="M91 83c7-10 18-15 29-13v48c-18 0-29-12-29-35zM149 83c-7-10-18-15-29-13v48c18 0 29-12 29-35z" fill="var(--lime)" />
          <path d="M81 77c-8 5-14 12-17 25l19 8 9-28zM159 77c8 5 14 12 17 25l-19 8-9-28z" fill="var(--orange)" />
          <path d="M91 121h29v62H90zM120 121h29l1 62h-30z" fill="var(--lime-soft)" />
          <path d="M91 220l17 73-10 62h20l9-61-7-74zM149 220l-17 73 10 62h20l-10-62 17-73z" fill="var(--blue-soft)" />
        </g>
      ) : (
        <g stroke="var(--ink)" strokeWidth="1.5">
          <path d="M91 77c9-8 18-9 29-8v89c-17-8-29-34-29-81zM149 77c-9-8-18-9-29-8v89c17-8 29-34 29-81z" fill="var(--lime)" />
          <path d="M83 83l-17 17 17 18 10-35zM157 83l17 17-17 18-10-35z" fill="var(--orange)" />
          <path d="M91 220l17 73-10 62h20l9-61-7-74zM149 220l-17 73 10 62h20l-10-62 17-73z" fill="var(--yellow-soft)" />
        </g>
      )}
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".35">
        <path d="M109 30c7 3 15 3 22 0M111 48c6 3 12 3 18 0M120 119v100M98 188c15 5 29 5 44 0" />
      </g>
      <path d="M25 46c11-8 20-12 30-12M21 58c10-4 18-6 25-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MiniChart({ values, color = "var(--lime)" }: { values: number[]; color?: string }) {
  const id = useId().replace(/:/g, "");
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(values.length - 1, 1);
  const coords = values.map((value, index) => ({
    x: 6 + (index / span) * 88,
    y: 36 - ((value - min) / (max - min || 1)) * 26,
  }));
  const last = coords.at(-1) ?? { x: 94, y: 22 };
  let line = `M ${coords[0].x} ${coords[0].y}`;
  if (coords.length === 2) {
    line += ` L ${coords[1].x} ${coords[1].y}`;
  } else if (coords.length > 2) {
    for (let i = 0; i < coords.length - 1; i += 1) {
      const p0 = coords[i - 1] ?? coords[i];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] ?? p2;
      line += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
    }
  }
  return (
    <svg className="mini-chart" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`mini-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.38" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M6 40H94" stroke="currentColor" opacity=".1" strokeDasharray="3 4" />
      {coords.length > 1 && (
        <path d={`${line} L ${last.x} 40 L 6 40 Z`} fill={`url(#mini-${id})`} />
      )}
      {coords.length > 1 && (
        <path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      )}
      {coords.map((point, index) => (
        <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={point === last ? 2.8 : 1.6} fill={color} />
      ))}
      <circle cx={last.x} cy={last.y} r="4.4" fill="var(--paper-2)" />
      <circle cx={last.x} cy={last.y} r="2.5" fill={color} />
    </svg>
  );
}

export function Scribble({ className = "" }: DoodleProps) {
  return (
    <svg className={className} viewBox="0 0 160 40" preserveAspectRatio="none" aria-hidden="true">
      <path d="M4 25c31-16 66-19 104-7 20 7 37 4 48-5M8 31c38-8 82-7 132 1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
