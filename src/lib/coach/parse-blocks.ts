import type { CoachBlock, CoachMessage } from "@/src/lib/coach/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const BLOCK_TYPES = new Set([
  "text",
  "pr_card",
  "workout_preview",
  "workout_card",
  "exercise_card",
  "muscle_map",
  "progress_chart",
  "volume_chart",
  "recommendation_card",
  "confirmation_card",
  "exercise_preview",
  "actions",
]);

function normalizeBlock(value: unknown): CoachBlock | null {
  if (!isRecord(value) || typeof value.type !== "string" || !BLOCK_TYPES.has(value.type)) return null;
  // The model often emits confirmation_card without a write payload. Real cards are injected from pending writes.
  if (value.type === "confirmation_card") return null;
  return value as CoachBlock;
}

export function parseCoachReply(raw: string): Pick<CoachMessage, "text" | "blocks"> {
  const blocks: CoachBlock[] = [];
  let text = raw.trim();
  const fence = /```forge-ui\s*([\s\S]*?)```/gi;
  text = text.replace(fence, (_match, json: string) => {
    try {
      const parsed = JSON.parse(String(json).trim()) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const block = normalizeBlock(item);
        if (block) blocks.push(block);
      }
    } catch {
      /* ignore malformed model JSON */
    }
    return "";
  });

  text = text.replace(/```json\s*([\s\S]*?)```/gi, (match, json: string) => {
    try {
      const parsed = JSON.parse(String(json).trim()) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const looksLikeBlocks = items.some((item) => isRecord(item) && typeof item.type === "string" && BLOCK_TYPES.has(item.type));
      if (!looksLikeBlocks) return match;
      for (const item of items) {
        const block = normalizeBlock(item);
        if (block) blocks.push(block);
      }
      return "";
    } catch {
      return match;
    }
  });

  return { text: text.trim(), blocks };
}
