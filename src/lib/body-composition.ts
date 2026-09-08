import type { BodySex, UserProfile } from "@/src/lib/firebase/types";
import type { BodyMeasurement, BodyMeasurementSource, BodySegmentMass } from "@/src/types/fitness";

export type BodyCompositionWrite = {
  measuredAt?: string;
  source?: BodyMeasurementSource;
  weightKg?: number;
  heightCm?: number;
  age?: number;
  sex?: BodySex;
  waistCm?: number;
  hipsCm?: number;
  chestCm?: number;
  armsCm?: number;
  thighsCm?: number;
  calvesCm?: number;
  moistureKg?: number;
  proteinKg?: number;
  mineralKg?: number;
  fatKg?: number;
  fatFreeMassKg?: number;
  skeletalMuscleKg?: number;
  bodyFatPercent?: number;
  bmi?: number;
  waistHipRatio?: number;
  subcutaneousFatKg?: number;
  visceralFatIndex?: number;
  obesityType?: string;
  leftArmMuscleKg?: number;
  leftArmFatKg?: number;
  rightArmMuscleKg?: number;
  rightArmFatKg?: number;
  trunkMuscleKg?: number;
  trunkFatKg?: number;
  leftLegMuscleKg?: number;
  leftLegFatKg?: number;
  rightLegMuscleKg?: number;
  rightLegFatKg?: number;
  targetWeightKg?: number;
  weightControlKg?: number;
  fatControlKg?: number;
  muscleControlKg?: number;
  basalMetabolismKcal?: number;
  healthScore?: number;
  bodyAge?: number;
};

const POSITIVE_KEYS = [
  "weightKg",
  "heightCm",
  "age",
  "waistCm",
  "hipsCm",
  "chestCm",
  "armsCm",
  "thighsCm",
  "calvesCm",
  "moistureKg",
  "proteinKg",
  "mineralKg",
  "fatKg",
  "fatFreeMassKg",
  "skeletalMuscleKg",
  "bodyFatPercent",
  "bmi",
  "waistHipRatio",
  "subcutaneousFatKg",
  "visceralFatIndex",
  "leftArmMuscleKg",
  "leftArmFatKg",
  "rightArmMuscleKg",
  "rightArmFatKg",
  "trunkMuscleKg",
  "trunkFatKg",
  "leftLegMuscleKg",
  "leftLegFatKg",
  "rightLegMuscleKg",
  "rightLegFatKg",
  "targetWeightKg",
  "basalMetabolismKcal",
  "bodyAge",
] as const satisfies ReadonlyArray<keyof BodyCompositionWrite>;

const SIGNED_KEYS = ["weightControlKg", "fatControlKg", "muscleControlKg"] as const;

function asFinite(value: unknown) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(n) ? n : undefined;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round0(value: number) {
  return Math.round(value);
}

function parseMeasuredAt(value?: string) {
  const raw = value?.trim();
  if (!raw) {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString();
  }
  const dotted = raw.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (dotted) {
    const iso = `${dotted[1]}-${dotted[2].padStart(2, "0")}-${dotted[3].padStart(2, "0")}T12:00:00`;
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  return new Date().toISOString();
}

function parseSex(value: unknown): BodySex | undefined {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === "m" || raw === "male" || raw === "man") return "male";
  if (raw === "f" || raw === "female" || raw === "woman") return "female";
  return undefined;
}

function segment(muscleKg?: number, fatKg?: number): BodySegmentMass | undefined {
  if (muscleKg == null && fatKg == null) return undefined;
  return { muscleKg, fatKg };
}

export function normalizeBodyCompositionWrite(raw: Record<string, unknown> | undefined): BodyCompositionWrite {
  const input = raw ?? {};
  const next: BodyCompositionWrite = {};
  for (const key of POSITIVE_KEYS) {
    const value = asFinite(input[key]);
    if (value == null || value <= 0) continue;
    if (key === "age" || key === "bodyAge" || key === "basalMetabolismKcal") {
      next[key] = round0(value);
    } else {
      next[key] = round1(value);
    }
  }
  for (const key of SIGNED_KEYS) {
    const value = asFinite(input[key]);
    if (value == null || value === 0) continue;
    next[key] = round1(value);
  }
  const score = asFinite(input.healthScore);
  if (score != null && score >= 0) next.healthScore = Math.min(100, round0(score));
  const sex = parseSex(input.sex);
  if (sex) next.sex = sex;
  const obesityType = typeof input.obesityType === "string" ? input.obesityType.trim() : "";
  if (obesityType) next.obesityType = obesityType.slice(0, 48);
  const source = input.source === "scan" || input.source === "chat" || input.source === "manual"
    ? input.source
    : undefined;
  if (source) next.source = source;
  if (typeof input.measuredAt === "string" && input.measuredAt.trim()) {
    next.measuredAt = parseMeasuredAt(input.measuredAt);
  }
  return next;
}

export function compositionWriteHasData(write: BodyCompositionWrite) {
  return Boolean(
    write.weightKg
    || write.bodyFatPercent
    || write.fatKg
    || write.skeletalMuscleKg
    || write.bmi
    || write.visceralFatIndex
    || write.obesityType
    || write.bodyAge,
  );
}

export function compositionToMeasurement(write: BodyCompositionWrite): Omit<BodyMeasurement, "id"> {
  const bodyFat = write.bodyFatPercent
    ?? (write.fatKg && write.weightKg ? round1((write.fatKg / write.weightKg) * 100) : undefined);
  const segmental = {
    leftArm: segment(write.leftArmMuscleKg, write.leftArmFatKg),
    rightArm: segment(write.rightArmMuscleKg, write.rightArmFatKg),
    trunk: segment(write.trunkMuscleKg, write.trunkFatKg),
    leftLeg: segment(write.leftLegMuscleKg, write.leftLegFatKg),
    rightLeg: segment(write.rightLegMuscleKg, write.rightLegFatKg),
  };
  const hasSegment = Object.values(segmental).some(Boolean);
  return {
    measuredAt: write.measuredAt || parseMeasuredAt(),
    source: write.source ?? "scan",
    weight: write.weightKg,
    bodyFat,
    waist: write.waistCm,
    hips: write.hipsCm,
    chest: write.chestCm,
    arms: write.armsCm,
    thighs: write.thighsCm,
    calves: write.calvesCm,
    moistureKg: write.moistureKg,
    proteinKg: write.proteinKg,
    mineralKg: write.mineralKg,
    fatKg: write.fatKg,
    fatFreeMassKg: write.fatFreeMassKg,
    skeletalMuscleKg: write.skeletalMuscleKg,
    bmi: write.bmi,
    waistHipRatio: write.waistHipRatio,
    subcutaneousFatKg: write.subcutaneousFatKg,
    visceralFatIndex: write.visceralFatIndex,
    obesityType: write.obesityType,
    targetWeightKg: write.targetWeightKg,
    weightControlKg: write.weightControlKg,
    fatControlKg: write.fatControlKg,
    muscleControlKg: write.muscleControlKg,
    basalMetabolismKcal: write.basalMetabolismKcal,
    healthScore: write.healthScore,
    bodyAge: write.bodyAge,
    segmental: hasSegment ? segmental : undefined,
  };
}

export function compositionToProfilePatch(write: BodyCompositionWrite): Partial<UserProfile> {
  const patch: Partial<UserProfile> = {};
  if (write.heightCm) patch.heightCm = write.heightCm;
  if (write.age) patch.age = Math.round(write.age);
  if (write.sex) patch.sex = write.sex;
  return patch;
}

function finalizeReport(write: BodyCompositionWrite, fallbackSource?: unknown): BodyCompositionWrite {
  const next = { ...write };
  if (!next.source) {
    next.source = fallbackSource === "chat" || fallbackSource === "manual" ? fallbackSource : "scan";
  }
  if (!next.measuredAt) next.measuredAt = parseMeasuredAt();
  return next;
}

export function reportsFromCompositionArgs(raw: Record<string, unknown> | undefined): BodyCompositionWrite[] {
  const input = raw ?? {};
  const list = Array.isArray(input.reports) ? input.reports : [];
  const fromArray = list
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => finalizeReport(
      normalizeBodyCompositionWrite({ ...item, source: item.source ?? input.source }),
      item.source ?? input.source,
    ))
    .filter(compositionWriteHasData);
  if (fromArray.length) {
    return [...fromArray].sort((a, b) => (a.measuredAt ?? "").localeCompare(b.measuredAt ?? ""));
  }
  const single = finalizeReport(normalizeBodyCompositionWrite(input), input.source);
  return compositionWriteHasData(single) ? [single] : [];
}

export function compositionDateLabel(iso?: string) {
  if (!iso) return "Scan";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Scan";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function compositionDelta(current?: number, previous?: number) {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 10) / 10;
}

export function hasComposition(item?: BodyMeasurement | null) {
  if (!item) return false;
  if (item.source === "scan" || item.source === "chat") {
    return Boolean(
      item.weight
      || item.bodyFat
      || item.fatKg
      || item.skeletalMuscleKg
      || item.bmi
      || item.obesityType
      || item.healthScore
      || item.bodyAge,
    );
  }
  return Boolean(
    item.fatKg
    || item.skeletalMuscleKg
    || item.moistureKg
    || item.visceralFatIndex
    || item.bodyAge
    || item.obesityType
    || item.healthScore
    || item.segmental
    || item.targetWeightKg,
  );
}

export function compositionSummary(write: BodyCompositionWrite | BodyMeasurement) {
  const both = write as BodyCompositionWrite & Partial<BodyMeasurement>;
  const weight = both.weightKg ?? both.weight;
  const fat = both.bodyFatPercent ?? both.bodyFat;
  const muscle = both.skeletalMuscleKg;
  const parts = [
    weight != null ? `${weight} kg` : null,
    fat != null ? `${fat}% fat` : null,
    muscle != null ? `${muscle} kg muscle` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Body composition check-in";
}

export function compositionReportsSummary(reports: BodyCompositionWrite[]) {
  if (!reports.length) return "Body composition check-in";
  if (reports.length === 1) return compositionSummary(reports[0]);
  const first = compositionDateLabel(reports[0].measuredAt);
  const last = compositionDateLabel(reports.at(-1)?.measuredAt);
  return `${reports.length} reports · ${first} → ${last}`;
}

export const BODY_MASS_PARTS = [
  { key: "moistureKg", label: "Water", color: "var(--blue)" },
  { key: "proteinKg", label: "Protein", color: "var(--lime)" },
  { key: "mineralKg", label: "Minerals", color: "var(--yellow)" },
  { key: "fatKg", label: "Fat", color: "var(--orange)" },
] as const;

export const BODY_SEGMENTS: Array<{ id: keyof NonNullable<BodyMeasurement["segmental"]>; label: string }> = [
  { id: "leftArm", label: "Left arm" },
  { id: "rightArm", label: "Right arm" },
  { id: "trunk", label: "Trunk" },
  { id: "leftLeg", label: "Left leg" },
  { id: "rightLeg", label: "Right leg" },
];
