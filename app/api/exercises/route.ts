import { getExerciseById, getExercises, matchesExerciseGroup, withResolvedMedia } from "@/src/lib/exercise-catalog";
import type { Exercise } from "@/src/types/fitness";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = (url.searchParams.get("id") ?? "").trim();
    if (id) {
      const exercise = await getExerciseById(id);
      if (!exercise) {
        return Response.json({ message: "Exercise not found." }, { status: 404 });
      }
      return Response.json({ item: exercise });
    }

    const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const muscle = (url.searchParams.get("muscle") ?? "").trim().toLowerCase();
    const equipment = (url.searchParams.get("equipment") ?? "").trim().toLowerCase();
    const group = (url.searchParams.get("group") ?? "").trim().toLowerCase();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const requestedLimit = Number(url.searchParams.get("limit") ?? 24);
    const limit = Math.min(48, Math.max(1, requestedLimit));

    const exercises = await getExercises();
    const filtered = exercises.filter((exercise) => {
      const matchesQuery =
        !query ||
        exercise.name.toLowerCase().includes(query) ||
        exercise.target.toLowerCase().includes(query) ||
        exercise.body_part.toLowerCase().includes(query) ||
        exercise.equipment.toLowerCase().includes(query) ||
        exercise.category.toLowerCase().includes(query);
      const matchesMuscle =
        !muscle ||
        exercise.target.toLowerCase() === muscle ||
        exercise.secondary_muscles.some((item) => item.toLowerCase() === muscle);
      const matchesEquipment = !equipment || exercise.equipment.toLowerCase() === equipment;
      return matchesQuery && matchesMuscle && matchesEquipment && matchesExerciseGroup(exercise, group);
    });

    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit).map((exercise: Exercise) => withResolvedMedia(exercise));

    return Response.json({
      items,
      page,
      limit,
      total: filtered.length,
      pages: Math.ceil(filtered.length / limit),
    });
  } catch {
    return Response.json(
      { message: "The exercise library is taking a breather. Please try again." },
      { status: 500 },
    );
  }
}
