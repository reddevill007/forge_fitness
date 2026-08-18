import type { ActivityLevel, BodySex, UserProfile } from "@/src/lib/firebase/types";

export const ACTIVITY_OPTIONS: Array<{ id: ActivityLevel; label: string; hint: string }> = [
  { id: "sedentary", label: "Sedentary", hint: "Desk work, little training" },
  { id: "light", label: "Light", hint: "1–3 sessions / week" },
  { id: "moderate", label: "Moderate", hint: "3–5 sessions / week" },
  { id: "active", label: "Active", hint: "6–7 sessions / week" },
  { id: "very_active", label: "Very active", hint: "Two-a-days or a physical job" },
];

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export type BodyMetrics = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: BodySex;
  activityLevel: ActivityLevel;
  goal: UserProfile["goal"];
  bmi: number;
  bmiLabel: string;
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  calorieNote: string;
};

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function parsePositive(value: string | number | undefined | null) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function calcBmi(weightKg: number, heightCm: number) {
  const meters = heightCm / 100;
  if (weightKg <= 0 || meters <= 0) return null;
  return round1(weightKg / (meters * meters));
}

export function bmiLabel(bmi: number) {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy range";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function calcBmr(weightKg: number, heightCm: number, age: number, sex: BodySex) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === "male" ? 5 : -161));
}

export function calorieTarget(tdee: number, goal: UserProfile["goal"]) {
  if (goal === "hypertrophy") {
    return { calories: tdee + 250, note: "Lean surplus for muscle" };
  }
  if (goal === "strength") {
    return { calories: tdee + 150, note: "Small surplus for strength" };
  }
  return { calories: tdee, note: "Maintenance calories" };
}

export function proteinTarget(weightKg: number, goal: UserProfile["goal"]) {
  const perKg = goal === "hypertrophy" ? 2 : goal === "strength" ? 1.8 : 1.6;
  return Math.round(weightKg * perKg);
}

export function fatTarget(weightKg: number) {
  return Math.round(weightKg * 0.8);
}

export function carbTarget(calories: number, proteinG: number, fatG: number) {
  const remaining = calories - proteinG * 4 - fatG * 9;
  return Math.max(0, Math.round(remaining / 4));
}

export function computeBodyMetrics(input: {
  weightKg?: number;
  heightCm?: number;
  age?: number;
  sex?: BodySex;
  activityLevel?: ActivityLevel;
  goal?: UserProfile["goal"];
}): BodyMetrics | null {
  const weightKg = parsePositive(input.weightKg);
  const heightCm = parsePositive(input.heightCm);
  const age = parsePositive(input.age);
  const sex = input.sex;
  const activityLevel = input.activityLevel ?? "moderate";
  const goal = input.goal ?? "hypertrophy";
  if (!weightKg || !heightCm || !age || !sex) return null;

  const bmi = calcBmi(weightKg, heightCm);
  if (!bmi) return null;
  const bmr = calcBmr(weightKg, heightCm, age, sex);
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIER[activityLevel]);
  const { calories, note } = calorieTarget(tdee, goal);
  const proteinG = proteinTarget(weightKg, goal);
  const fatG = fatTarget(weightKg);
  const carbsG = carbTarget(calories, proteinG, fatG);

  return {
    weightKg,
    heightCm,
    age,
    sex,
    activityLevel,
    goal,
    bmi,
    bmiLabel: bmiLabel(bmi),
    bmr,
    tdee,
    calories,
    proteinG,
    fatG,
    carbsG,
    calorieNote: note,
  };
}

export function formatKg(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: Number.isInteger(value) ? 0 : 1 });
}
