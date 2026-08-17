import { getExerciseById } from "@/src/lib/exercise-catalog";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const exercise = await getExerciseById(id);
  if (!exercise) {
    return Response.json({ message: "Exercise not found." }, { status: 404 });
  }
  return Response.json({ item: exercise });
}
