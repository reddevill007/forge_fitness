export function CoachMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="Coach">
      <path d="M12 28c4-11 12-18 20-18s16 7 20 18" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M18 30c2 14 8 22 14 22s12-8 14-22" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M22 31h20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 8l2.2 4.6 5 .7-3.6 3.6.8 5-4.4-2.4-4.4 2.4.8-5-3.6-3.6 5-.7z" fill="var(--lime)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 18l1.4 3 3.2.4-2.4 2.3.6 3.2-2.8-1.6-2.8 1.6.6-3.2-2.4-2.3 3.2-.4z" fill="var(--yellow)" stroke="currentColor" strokeWidth="1.2" />
      <path d="M50 14l1.4 3 3.2.4-2.4 2.3.6 3.2-2.8-1.6-2.8 1.6.6-3.2-2.4-2.3 3.2-.4z" fill="var(--orange)" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function CoachThinkingDoodle({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 36" aria-hidden="true">
      <path d="M8 22c18-12 38-14 62-6 14 5 28 3 42-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="coach-scribble" />
      <path d="M18 8l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.4-2.5 1.4.5-2.8-2-2 2.8-.4z" fill="var(--lime)" className="coach-spark" />
      <path d="M58 4l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.4-2.5 1.4.5-2.8-2-2 2.8-.4z" fill="var(--yellow)" className="coach-spark delay" />
      <path d="M96 10l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.4-2.5 1.4.5-2.8-2-2 2.8-.4z" fill="var(--orange)" className="coach-spark delay-2" />
    </svg>
  );
}
