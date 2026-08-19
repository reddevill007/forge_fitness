export type AnatomyKind = "overview" | "breakdown";

export type AnatomyPlate = {
  id: string;
  label: string;
  file: string;
  chapter: string;
  kind: AnatomyKind;
  parentId?: string;
  blurb: string;
};

export const ANATOMY_PLATES: AnatomyPlate[] = [
  {
    id: "full-body",
    label: "Full body",
    file: "full_body_anatomy.png",
    chapter: "System maps",
    kind: "overview",
    blurb: "Anterior, lateral, and posterior maps, plus chains and joint actions.",
  },
  {
    id: "upper-body",
    label: "Upper body",
    file: "upper_body_anatomy.png",
    chapter: "System maps",
    kind: "overview",
    parentId: "full-body",
    blurb: "Chest, back, shoulders, arms, and neck as one connected map.",
  },
  {
    id: "neck",
    label: "Neck",
    file: "neck_anatomy.png",
    chapter: "Upper breakdown",
    kind: "breakdown",
    parentId: "upper-body",
    blurb: "Sternocleidomastoid, scalenes, splenius, and upper traps.",
  },
  {
    id: "shoulder",
    label: "Shoulders",
    file: "shoulder_anatomy.png",
    chapter: "Upper breakdown",
    kind: "breakdown",
    parentId: "upper-body",
    blurb: "Deltoid heads and the rotator cuff underneath.",
  },
  {
    id: "chest",
    label: "Chest",
    file: "chest_anatomy.png",
    chapter: "Upper breakdown",
    kind: "breakdown",
    parentId: "upper-body",
    blurb: "Pectoralis major heads, pec minor, and serratus.",
  },
  {
    id: "back",
    label: "Back",
    file: "back_anatomy.png",
    chapter: "Upper breakdown",
    kind: "breakdown",
    parentId: "upper-body",
    blurb: "Lats, traps, rhomboids, and the lumbar erectors.",
  },
  {
    id: "full-arm",
    label: "Arm connection",
    file: "full_arm_anatomy.png",
    chapter: "Arm breakdown",
    kind: "overview",
    parentId: "upper-body",
    blurb: "Shoulder to wrist as one kinetic chain.",
  },
  {
    id: "biceps",
    label: "Biceps",
    file: "biceps_anatomy.png",
    chapter: "Arm breakdown",
    kind: "breakdown",
    parentId: "full-arm",
    blurb: "Biceps brachii, brachialis, and the elbow flexors.",
  },
  {
    id: "triceps",
    label: "Triceps",
    file: "triceps_anatomy.png",
    chapter: "Arm breakdown",
    kind: "breakdown",
    parentId: "full-arm",
    blurb: "Long, lateral, and medial heads of the triceps.",
  },
  {
    id: "forearms",
    label: "Forearms",
    file: "forearms_anatomy.png",
    chapter: "Arm breakdown",
    kind: "breakdown",
    parentId: "full-arm",
    blurb: "Flexors, extensors, and grip musculature.",
  },
  {
    id: "core",
    label: "Core & abs",
    file: "core_and_abs_anatomy.png",
    chapter: "Core breakdown",
    kind: "breakdown",
    parentId: "full-body",
    blurb: "Rectus, obliques, transverse abdominis, and QL.",
  },
  {
    id: "lower-body",
    label: "Lower body",
    file: "lower_body_anatomy.png",
    chapter: "Lower breakdown",
    kind: "overview",
    parentId: "full-body",
    blurb: "Hips, thighs, and lower legs as one posterior-chain system.",
  },
  {
    id: "glutes",
    label: "Glutes",
    file: "glutes_anatomy.png",
    chapter: "Lower breakdown",
    kind: "breakdown",
    parentId: "lower-body",
    blurb: "Glute max, med, min, and the hip complex.",
  },
  {
    id: "quadriceps",
    label: "Quadriceps",
    file: "quadriceps_anatomy.png",
    chapter: "Lower breakdown",
    kind: "breakdown",
    parentId: "lower-body",
    blurb: "Rectus femoris and the three vastus heads.",
  },
  {
    id: "hamstrings",
    label: "Hamstrings",
    file: "hamstrings_anatomy.png",
    chapter: "Lower breakdown",
    kind: "breakdown",
    parentId: "lower-body",
    blurb: "Biceps femoris, semitendinosus, and semimembranosus.",
  },
  {
    id: "adductor",
    label: "Adductors",
    file: "adductor_anatomy.png",
    chapter: "Lower breakdown",
    kind: "breakdown",
    parentId: "lower-body",
    blurb: "Inner-thigh adductors and the groin complex.",
  },
  {
    id: "lower-legs",
    label: "Lower legs",
    file: "lower_legs_anatomy.png",
    chapter: "Lower breakdown",
    kind: "breakdown",
    parentId: "lower-body",
    blurb: "Gastrocnemius, soleus, and tibialis anterior.",
  },
];

const PLATE_BY_ID = new Map(ANATOMY_PLATES.map((plate) => [plate.id, plate]));

export const ANATOMY_CHAPTERS = [...new Set(ANATOMY_PLATES.map((plate) => plate.chapter))].map((title) => ({
  title,
  plates: ANATOMY_PLATES.filter((plate) => plate.chapter === title),
}));

const SLUG_TO_PLATE: Record<string, string> = {
  chest: "chest",
  deltoids: "shoulder",
  biceps: "biceps",
  triceps: "triceps",
  forearm: "forearms",
  hands: "full-arm",
  abs: "core",
  obliques: "core",
  quadriceps: "quadriceps",
  adductors: "adductor",
  gluteal: "glutes",
  hamstring: "hamstrings",
  calves: "lower-legs",
  tibialis: "lower-legs",
  ankles: "lower-legs",
  feet: "lower-legs",
  neck: "neck",
  "upper-back": "back",
  "lower-back": "back",
  trapezius: "back",
};

const NAME_TO_PLATE: Record<string, string> = {
  chest: "chest",
  pecs: "chest",
  pectorals: "chest",
  "upper chest": "chest",
  "lower chest": "chest",
  serratus: "chest",
  shoulders: "shoulder",
  delts: "shoulder",
  deltoids: "shoulder",
  "front delts": "shoulder",
  "side delts": "shoulder",
  "rear delts": "shoulder",
  "rotator cuff": "shoulder",
  biceps: "biceps",
  brachialis: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  forearm: "forearms",
  grip: "forearms",
  wrists: "forearms",
  "wrist flexors": "forearms",
  "wrist extensors": "forearms",
  arms: "full-arm",
  "arm connection": "full-arm",
  abs: "core",
  core: "core",
  abdominals: "core",
  "lower abs": "core",
  "deep core": "core",
  obliques: "core",
  waist: "core",
  back: "back",
  lats: "back",
  "upper back": "back",
  "lower back": "back",
  traps: "back",
  rhomboids: "back",
  spine: "back",
  neck: "neck",
  glutes: "glutes",
  gluteal: "glutes",
  hips: "glutes",
  quads: "quadriceps",
  quadriceps: "quadriceps",
  thighs: "quadriceps",
  "hip flexors": "quadriceps",
  hamstrings: "hamstrings",
  hamstring: "hamstrings",
  adductors: "adductor",
  "inner thighs": "adductor",
  groin: "adductor",
  calves: "lower-legs",
  soleus: "lower-legs",
  tibialis: "lower-legs",
  shins: "lower-legs",
  "lower legs": "lower-legs",
  "full body": "full-body",
  "upper body": "upper-body",
  "lower body": "lower-body",
};

const SITE_TO_PLATE: Record<string, string> = {
  chest: "chest",
  arms: "full-arm",
  waist: "core",
  hips: "glutes",
  thighs: "quadriceps",
  calves: "lower-legs",
};

export function anatomyPlateSrc(plate: AnatomyPlate) {
  return `/body-anatomy/${plate.file}`;
}

export function anatomyPlateById(id: string | null | undefined) {
  if (!id) return undefined;
  return PLATE_BY_ID.get(id);
}

export function anatomyPageNumber(plate: AnatomyPlate) {
  return ANATOMY_PLATES.findIndex((item) => item.id === plate.id) + 1;
}

export function anatomyPageLabel(plate: AnatomyPlate) {
  return String(anatomyPageNumber(plate)).padStart(2, "0");
}

export function overviewFor(plate: AnatomyPlate) {
  if (plate.kind === "overview") return plate;
  return plate.parentId ? PLATE_BY_ID.get(plate.parentId) : undefined;
}

export function childrenFor(plate: AnatomyPlate) {
  return ANATOMY_PLATES.filter((item) => item.parentId === plate.id);
}

export function breakdownsFor(plate: AnatomyPlate) {
  const root = plate.kind === "overview" ? plate : overviewFor(plate);
  if (!root) return [];
  return childrenFor(root).filter((item) => item.kind === "breakdown");
}

export function resolveAnatomyPlate(query: string | null | undefined): AnatomyPlate | undefined {
  if (!query) return undefined;
  const key = query.trim().toLowerCase();
  if (!key || key === "—") return undefined;
  const id = PLATE_BY_ID.has(key)
    ? key
    : NAME_TO_PLATE[key] ?? SLUG_TO_PLATE[key];
  return id ? PLATE_BY_ID.get(id) : undefined;
}

export function anatomyPlateForSite(siteId: string) {
  return anatomyPlateById(SITE_TO_PLATE[siteId]);
}

export const FULL_BODY_PLATE = ANATOMY_PLATES[0];
