import type { Exercise, ExerciseMedia } from "@/src/types/fitness";
import { resolveDatasetMedia } from "@/src/lib/dataset-media";

export type ResolvedExerciseMedia = {
  src: string;
  poster?: string;
  type: "image" | "video";
  attribution?: string;
  isPrivate: boolean;
};

export interface ExerciseMediaProvider {
  resolve(exercise: Exercise, userMedia?: ExerciseMedia[]): ResolvedExerciseMedia;
}

export class LayeredExerciseMediaProvider implements ExerciseMediaProvider {
  resolve(exercise: Exercise, userMedia: ExerciseMedia[] = []): ResolvedExerciseMedia {
    const userDefault = userMedia.find(
      (media) => media.exerciseId === exercise.id && media.kind === "user-video" && media.isDefault,
    );
    const gif = resolveDatasetMedia(exercise.gif_url);
    const poster = resolveDatasetMedia(exercise.image);

    if (userDefault) {
      return {
        src: userDefault.url,
        poster,
        type: "video",
        isPrivate: userDefault.private !== false,
      };
    }

    if (gif) {
      return {
        src: gif,
        poster,
        type: "image",
        attribution: exercise.attribution,
        isPrivate: false,
      };
    }

    return {
      src: poster,
      type: "image",
      attribution: exercise.attribution,
      isPrivate: false,
    };
  }
}

export const exerciseMediaProvider = new LayeredExerciseMediaProvider();
