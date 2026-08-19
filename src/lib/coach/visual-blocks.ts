import type { CoachBlock } from "@/src/lib/coach/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function exerciseCardFromData(data: Record<string, unknown>): CoachBlock {
  return {
    type: "exercise_card",
    name: String(data.name || "Exercise"),
    exerciseId: typeof data.id === "string" ? data.id : undefined,
    target: typeof data.target === "string" ? data.target : undefined,
    secondary: stringList(data.secondary),
    equipment: typeof data.equipment === "string" ? data.equipment : undefined,
    bodyPart: typeof data.bodyPart === "string" ? data.bodyPart : undefined,
    prescription: typeof data.prescription === "string" ? data.prescription : undefined,
    instructions: stringList(data.instructions),
    gifUrl: typeof data.gifUrl === "string" ? data.gifUrl : undefined,
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    videoUrl: typeof data.videoUrl === "string" ? data.videoUrl : undefined,
  };
}

export function visualsFromTool(name: string, data: Record<string, unknown>): CoachBlock[] {
  if (data.error) return [];
  if (name === "get_exercise" && typeof data.name === "string") {
    return [exerciseCardFromData(data)];
  }
  if (name === "search_exercises" && Array.isArray(data.items)) {
    return data.items.filter(isRecord).slice(0, 3).map(exerciseCardFromData);
  }
  if (name === "show_body_map") {
    const muscles = stringList(data.muscles);
    const related = Array.isArray(data.related) ? data.related.filter(isRecord).slice(0, 3).map(exerciseCardFromData) : [];
    if (!muscles.length && related.length === 0) return [];
    const map: CoachBlock = {
      type: "muscle_map",
      title: typeof data.title === "string" ? data.title : muscles.join(" · "),
      exerciseNames: related.map((item) => item.type === "exercise_card" ? item.name : "").filter(Boolean),
      bodyParts: muscles,
    };
    return muscles.length ? [map, ...related] : related;
  }
  if (name === "get_muscle_volume" && Array.isArray(data.muscles)) {
    const rows = data.muscles.filter(isRecord);
    const bodyParts = rows.map((row) => String(row.muscle || "")).filter(Boolean);
    const exerciseNames = [...new Set(rows.flatMap((row) => stringList(row.exercises)))].slice(0, 8);
    if (!bodyParts.length && !exerciseNames.length) return [];
    return [{
      type: "muscle_map",
      title: "Muscle map",
      exerciseNames,
      bodyParts,
      muscles: rows.map((row) => ({
        name: String(row.muscle || ""),
        sets: Number(row.sets) || 0,
        status: typeof row.status === "string" ? row.status : undefined,
      })),
    }];
  }
  return [];
}

export function mergeCoachVisuals(blocks: CoachBlock[], extras: CoachBlock[]): CoachBlock[] {
  const next = [...blocks];
  for (const extra of extras) {
    if (extra.type === "exercise_card") {
      const index = next.findIndex((block) => (
        block.type === "exercise_card" && block.name.trim().toLowerCase() === extra.name.trim().toLowerCase()
      ));
      if (index >= 0 && next[index]?.type === "exercise_card") {
        next[index] = { ...next[index], ...extra };
      } else {
        next.push(extra);
      }
      continue;
    }
    if (extra.type === "muscle_map") {
      const index = next.findIndex((block) => block.type === "muscle_map");
      if (index >= 0 && next[index]?.type === "muscle_map") {
        const current = next[index];
        next[index] = {
          ...current,
          title: current.title || extra.title,
          exerciseNames: current.exerciseNames.length ? current.exerciseNames : extra.exerciseNames,
          bodyParts: current.bodyParts?.length ? current.bodyParts : extra.bodyParts,
          muscles: current.muscles?.length ? current.muscles : extra.muscles,
        };
      } else {
        next.push(extra);
      }
    }
  }
  return next;
}

function looksLikeHowToList(text: string) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const numbered = lines.filter((line) => /^\d+[\.\)]\s+\S/.test(line)).length;
  return numbered >= 2 || /here'?s how to/i.test(text);
}

function stripHowToFromText(text: string) {
  let next = text.replace(/\r\n/g, "\n").trim();
  const howTo = next.search(/\n*\s*here'?s how to/i);
  if (howTo >= 0) next = next.slice(0, howTo).trim();
  const list = next.search(/\n+\s*(?:\d+[\.\)]|[-*•])\s+\S/);
  if (list >= 0) next = next.slice(0, list).trim();
  next = next
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^here'?s how to/i.test(trimmed)) return false;
      if (/^\d+[\.\)]\s+\S/.test(trimmed)) return false;
      return true;
    })
    .join("\n");
  return next.replace(/\n{3,}/g, "\n\n").trim();
}

function slimExerciseRecord(data: Record<string, unknown>) {
  const { instructions, summary, gifUrl, imageUrl, videoUrl, ...rest } = data;
  return {
    ...rest,
    hasInstructions: Array.isArray(instructions) && instructions.length > 0,
    cue: typeof summary === "string" ? String(summary).slice(0, 160) : undefined,
    hasGif: Boolean(gifUrl),
    hasVideo: Boolean(videoUrl || imageUrl),
  };
}

export function slimCoachToolPayload(name: string, data: Record<string, unknown>): Record<string, unknown> {
  if (data.error) return data;
  if (name === "get_exercise") {
    return {
      ...slimExerciseRecord(data),
      note: "The exercise card already shows the GIF, muscle map, and numbered how-to. Spoken reply: 1-2 sentences. Do not list steps.",
    };
  }
  if (name === "search_exercises" && Array.isArray(data.items)) {
    return {
      ...data,
      items: data.items.filter(isRecord).map(slimExerciseRecord),
      note: "Exercise cards already show the how-to. Spoken reply: 1-2 sentences. Do not list steps.",
    };
  }
  if (name === "show_body_map" && Array.isArray(data.related)) {
    return {
      ...data,
      related: data.related.filter(isRecord).map(slimExerciseRecord),
      note: "The map and exercise cards are already rendered. Spoken reply: 1-2 sentences. Do not list how-to steps.",
    };
  }
  return data;
}

export function pruneDuplicateCoachCopy(text: string, blocks: CoachBlock[]): { text: string; blocks: CoachBlock[] } {
  const hasCard = blocks.some((block) => block.type === "exercise_card");
  const nextBlocks = hasCard
    ? blocks.filter((block) => block.type !== "text" || !looksLikeHowToList(block.text))
    : blocks;
  return {
    text: hasCard ? stripHowToFromText(text) : text.trim(),
    blocks: nextBlocks,
  };
}
