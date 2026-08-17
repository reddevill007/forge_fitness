import { resolveDatasetMedia } from "@/src/lib/dataset-media";
import type { Exercise, WorkoutExercise } from "@/src/types/fitness";

export function workoutStillUrl(
  exercise: Pick<WorkoutExercise, "gifUrl" | "imageUrl">,
  catalog?: Pick<Exercise, "gif_url" | "image"> | null,
) {
  return (
    resolveDatasetMedia(exercise.gifUrl)
    || resolveDatasetMedia(catalog?.gif_url)
    || resolveDatasetMedia(exercise.imageUrl)
    || resolveDatasetMedia(catalog?.image)
    || ""
  );
}
