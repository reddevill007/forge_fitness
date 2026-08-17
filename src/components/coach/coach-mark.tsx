export function CoachMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="Atlas, Forge coach">
      <ellipse cx="32" cy="36" rx="18.5" ry="20" fill="var(--paper-2)" stroke="currentColor" strokeWidth="2.4" />
      <path d="M15 35c-3.2 1.2-4.4 5.2-2.2 7.6M49 35c3.2 1.2 4.4 5.2 2.2 7.6" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M16 23c7.5-5 24.5-5 32 0v7.5c-8 3.6-24 3.6-32 0z" fill="var(--ink)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 16.5l2 4.2 4.5.6-3.3 3.2.8 4.4-4-2.2-4 2.2.8-4.4-3.3-3.2 4.5-.6z" fill="var(--lime)" stroke="var(--paper-2)" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M21.5 31.5c2.8-1.8 6.6-1.8 8.8.2M33.8 31.5c2.8-1.8 6.6-1.8 8.8.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="25.5" cy="37.2" r="2" fill="currentColor" />
      <circle cx="38.5" cy="37.2" r="2" fill="currentColor" />
      <path d="M26 45.5c3.6 3.4 9.4 3.2 12.2-1.2" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M32 50.5v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="27.5" y="53.2" width="13" height="6.2" rx="2.2" fill="var(--orange)" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="30.4" cy="56.3" r="1.1" fill="var(--paper-2)" />
    </svg>
  );
}

export function CoachPortrait({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 176" role="img" aria-label="Atlas, Forge coach">
      <path d="M28 168c8-38 22-58 52-58s44 20 52 58" fill="var(--lime)" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M48 132c10 8 22 12 32 12s22-4 32-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="80" cy="78" rx="34" ry="38" fill="var(--paper-2)" stroke="currentColor" strokeWidth="3.2" />
      <path d="M48 76c-6 2-8 10-4 14M112 76c6 2 8 10 4 14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 54c14-10 46-10 60 0v14c-15 7-45 7-60 0z" fill="var(--ink)" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M80 40l4.2 8.6 9.2 1.2-6.8 6.6 1.6 9-8.2-4.4-8.2 4.4 1.6-9-6.8-6.6 9.2-1.2z" fill="var(--lime)" stroke="var(--paper-2)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M60 70c5.4-3.4 12.4-3.2 16.4.6M84 70c5.4-3.4 12.4-3.2 16.4.6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="68" cy="82" r="3.4" fill="currentColor" />
      <circle cx="92" cy="82" r="3.4" fill="currentColor" />
      <path d="M68 98c7 7 18 6.6 23-2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M80 108v8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="71" y="114" width="24" height="11" rx="3.4" fill="var(--orange)" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="76.4" cy="119.4" r="1.8" fill="var(--paper-2)" />
      <path d="M118 96l22-6 6 28-22 7z" fill="var(--paper-2)" stroke="currentColor" strokeWidth="2.6" />
      <path d="M122 104h16M122 111h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 48c10-8 18-10 28-8M132 42c12 4 18 12 20 22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
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
