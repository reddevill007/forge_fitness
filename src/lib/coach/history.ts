import type { CoachContent, CoachMessage } from "@/src/lib/coach/types";

export const COACH_STARTERS = [
  { label: "Create a workout", prompt: "Create me a 45-minute Pull workout." },
  { label: "Analyze my progress", prompt: "Am I getting stronger?" },
  { label: "Muscle gaps", prompt: "Which muscle am I neglecting?" },
  { label: "Best PR", prompt: "What's my best PR?" },
];

export function threadTitleFromPrompt(prompt: string) {
  const clean = prompt.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 52 ? `${clean.slice(0, 50).trimEnd()}…` : clean;
}

export function threadPreview(messages: CoachMessage[]) {
  const last = [...messages].reverse().find((message) => message.text.trim());
  if (!last) return "Empty chat";
  const text = last.text.replace(/\s+/g, " ").trim();
  return text.length > 92 ? `${text.slice(0, 90).trimEnd()}…` : text;
}

export function formatCoachStamp(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function groupCoachThreads<T extends { updatedAt: string }>(threads: T[]) {
  const buckets: Array<{ label: string; items: T[] }> = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier", items: [] },
  ];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfWeek = startOfToday - 6 * 86_400_000;

  for (const thread of threads) {
    const stamp = new Date(thread.updatedAt).getTime();
    if (Number.isNaN(stamp) || stamp >= startOfToday) buckets[0].items.push(thread);
    else if (stamp >= startOfYesterday) buckets[1].items.push(thread);
    else if (stamp >= startOfWeek) buckets[2].items.push(thread);
    else buckets[3].items.push(thread);
  }

  return buckets.filter((bucket) => bucket.items.length > 0);
}

export function lastThreadStorageKey(uid: string) {
  return `forge.coach.lastThread.${uid}`;
}

export function sanitizeStoredMessages(messages: CoachMessage[]): CoachMessage[] {
  return messages.map((message) => ({
    ...message,
    blocks: (message.blocks ?? []).filter((block) => block.type !== "confirmation_card"),
  }));
}

export function capCoachContents(contents: CoachContent[]) {
  return contents.slice(-40);
}
