import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const MODEL = "gemini-2.5-flash";

type GeneratedExercise = {
  name: string;
  target: string;
  secondaryMuscles: string[];
  equipment: string;
  bodyPart: string;
  instructions: string[];
};

const TARGETS = [
  "pectorals",
  "lats",
  "upper back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "adductors",
];

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "Coach is not configured." }, { status: 503 });
  }

  let prompt = "";
  try {
    const body = await request.json() as { prompt?: string };
    prompt = body.prompt?.trim() ?? "";
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!prompt) {
    return Response.json({ error: "Enter an exercise name first." }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `Generate structured data for this resistance-training exercise: "${prompt}".
Return JSON only with keys: name, target, secondaryMuscles, equipment, bodyPart, instructions.
target must be one of: ${TARGETS.join(", ")}.
secondaryMuscles is an array of short muscle names.
instructions is an array of 4 to 7 concise coaching cues, one action per item.
Do not mention being an AI. Do not invent a user history.`,
      config: {
        temperature: 0.3,
        responseMimeType: "application/json",
        maxOutputTokens: 1024,
      },
    });

    const parsed = JSON.parse(response.text ?? "{}") as Partial<GeneratedExercise>;
    const target = TARGETS.includes((parsed.target ?? "").toLowerCase())
      ? (parsed.target ?? "").toLowerCase()
      : "shoulders";
    const payload: GeneratedExercise = {
      name: parsed.name?.trim() || prompt,
      target,
      secondaryMuscles: Array.isArray(parsed.secondaryMuscles)
        ? parsed.secondaryMuscles.map((item) => String(item)).filter(Boolean).slice(0, 4)
        : [],
      equipment: parsed.equipment?.trim() || "dumbbell",
      bodyPart: parsed.bodyPart?.trim() || "other",
      instructions: Array.isArray(parsed.instructions)
        ? parsed.instructions.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
        : [],
    };
    return Response.json(payload);
  } catch {
    return Response.json({ error: "Coach could not generate that exercise." }, { status: 500 });
  }
}
