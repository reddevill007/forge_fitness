export const FOCUS_MUSCLE_GROUPS: Array<{ region: string; muscles: string[] }> = [
  { region: "Chest", muscles: ["Chest", "Upper Chest", "Lower Chest", "Serratus"] },
  { region: "Shoulders", muscles: ["Front Delts", "Side Delts", "Rear Delts", "Rotator Cuff"] },
  { region: "Arms", muscles: ["Biceps", "Triceps", "Brachialis", "Forearms", "Wrist Flexors", "Wrist Extensors", "Wrists", "Grip"] },
  { region: "Back", muscles: ["Lats", "Upper Back", "Rhomboids", "Traps", "Lower Back", "Levator Scapulae"] },
  { region: "Core", muscles: ["Abs", "Lower Abs", "Obliques", "Deep Core"] },
  { region: "Legs", muscles: ["Quads", "Hamstrings", "Glutes", "Adductors", "Abductors", "Hip Flexors", "Inner Thighs"] },
  { region: "Lower leg", muscles: ["Calves", "Soleus", "Tibialis", "Ankle Stabilizers"] },
  { region: "Neck", muscles: ["Neck"] },
];

export const FOCUS_MUSCLES = FOCUS_MUSCLE_GROUPS.flatMap((group) => group.muscles);

const KNOWN = new Map(FOCUS_MUSCLES.map((muscle) => [muscle.toLowerCase(), muscle]));

const ALIASES: Record<string, string> = {
  pectorals: "Chest",
  pecs: "Chest",
  chest: "Chest",
  "upper chest": "Upper Chest",
  "lower chest": "Lower Chest",
  "pectoralis major": "Chest",
  "pectoralis minor": "Upper Chest",
  delts: "Front Delts",
  deltoids: "Front Delts",
  shoulders: "Front Delts",
  "front delts": "Front Delts",
  "front deltoids": "Front Delts",
  "anterior delts": "Front Delts",
  "anterior deltoids": "Front Delts",
  "side delts": "Side Delts",
  "lateral delts": "Side Delts",
  "lateral deltoids": "Side Delts",
  "middle delts": "Side Delts",
  "rear delts": "Rear Delts",
  "rear deltoids": "Rear Delts",
  "posterior delts": "Rear Delts",
  "posterior deltoids": "Rear Delts",
  "rotator cuff": "Rotator Cuff",
  traps: "Traps",
  trapezius: "Traps",
  "upper-back": "Upper Back",
  "upper back": "Upper Back",
  back: "Upper Back",
  lats: "Lats",
  "latissimus dorsi": "Lats",
  rhomboids: "Rhomboids",
  "lower-back": "Lower Back",
  "lower back": "Lower Back",
  spine: "Lower Back",
  "erector spinae": "Lower Back",
  "levator scapulae": "Levator Scapulae",
  biceps: "Biceps",
  "biceps brachii": "Biceps",
  triceps: "Triceps",
  "triceps brachii": "Triceps",
  brachialis: "Brachialis",
  forearm: "Forearms",
  forearms: "Forearms",
  "wrist flexors": "Wrist Flexors",
  "wrist extensors": "Wrist Extensors",
  wrists: "Wrists",
  "grip muscles": "Grip",
  abs: "Abs",
  abdominals: "Abs",
  "rectus abdominis": "Abs",
  "lower abs": "Lower Abs",
  core: "Deep Core",
  "deep core": "Deep Core",
  transversus: "Deep Core",
  "transverse abdominis": "Deep Core",
  obliques: "Obliques",
  serratus: "Serratus",
  "serratus anterior": "Serratus",
  quads: "Quads",
  quadriceps: "Quads",
  "quadriceps femoris": "Quads",
  hamstring: "Hamstrings",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  gluteal: "Glutes",
  adductors: "Adductors",
  abductors: "Abductors",
  "hip flexors": "Hip Flexors",
  groin: "Inner Thighs",
  "inner thighs": "Inner Thighs",
  calves: "Calves",
  soleus: "Soleus",
  tibialis: "Tibialis",
  shins: "Tibialis",
  "ankle stabilizers": "Ankle Stabilizers",
  neck: "Neck",
  sternocleidomastoid: "Neck",
};

export function displayMuscleName(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (!key || key === "cardiovascular system") return null;
  return KNOWN.get(key) ?? ALIASES[key] ?? titleMuscle(raw);
}

function titleMuscle(raw: string) {
  return raw
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function parseFocusMuscles(focus: string | undefined | null): string[] {
  if (!focus?.trim()) return [];
  const seen = new Set<string>();
  const selected: string[] = [];
  for (const part of focus.split(/[·,|/]+/)) {
    const match = displayMuscleName(part);
    if (!match || seen.has(match)) continue;
    seen.add(match);
    selected.push(match);
  }
  return selected;
}

export function formatFocusMuscles(muscles: string[]): string {
  return muscles.join(" · ");
}

export const FOCUS_MUSCLE_COLORS = [
  "#c9f43d",
  "#f09a61",
  "#5ec8ff",
  "#f5c542",
  "#e879a9",
  "#7dd3c0",
  "#c084fc",
  "#fb7185",
  "#86efac",
  "#38bdf8",
  "#a3e635",
  "#fbbf24",
];

export function focusMuscleColor(index: number) {
  return FOCUS_MUSCLE_COLORS[index % FOCUS_MUSCLE_COLORS.length];
}

export function uniqueMuscleNames(names: string[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const name of names) {
    const label = displayMuscleName(name);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    items.push(label);
  }
  return items;
}

export function groupFocusMuscles(muscles: string[]): Array<{ region: string; muscles: string[] }> {
  const remaining = new Set(muscles);
  const groups: Array<{ region: string; muscles: string[] }> = [];
  for (const group of FOCUS_MUSCLE_GROUPS) {
    const items = group.muscles.filter((muscle) => remaining.has(muscle));
    items.forEach((muscle) => remaining.delete(muscle));
    if (items.length) groups.push({ region: group.region, muscles: items });
  }
  const extra = [...remaining].sort((a, b) => a.localeCompare(b));
  if (extra.length) groups.push({ region: "Other", muscles: extra });
  return groups;
}
