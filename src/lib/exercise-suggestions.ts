import { anatomeResolveExercise } from "@/src/lib/anatome";
import { fetchExercise, fetchExercises } from "@/src/lib/exercises-client";
import type { Exercise } from "@/src/types/fitness";

export type AlternativeSuggestFor = {
  exerciseId: string;
  name: string;
  target: string;
  secondary?: string[];
};

function uniqueExercises(items: Exercise[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function rankAlternatives(base: AlternativeSuggestFor, baseEquipment: string | undefined, items: Exercise[]) {
  const baseName = base.name.trim().toLowerCase();
  return [...items].sort((a, b) => {
    const aSameEquip = baseEquipment && a.equipment === baseEquipment ? 0 : 1;
    const bSameEquip = baseEquipment && b.equipment === baseEquipment ? 0 : 1;
    if (aSameEquip !== bSameEquip) return aSameEquip - bSameEquip;
    const aTarget = a.target === base.target ? 0 : 1;
    const bTarget = b.target === base.target ? 0 : 1;
    if (aTarget !== bTarget) return aTarget - bTarget;
    const aName = a.name.trim().toLowerCase();
    const bName = b.name.trim().toLowerCase();
    const aSimilar = aName.includes(baseName) || baseName.includes(aName) ? 1 : 0;
    const bSimilar = bName.includes(baseName) || baseName.includes(bName) ? 1 : 0;
    if (aSimilar !== bSimilar) return aSimilar - bSimilar;
    return a.name.localeCompare(b.name);
  });
}

export async function fetchAlternativeSuggestions(
  forExercise: AlternativeSuggestFor,
  excludeIds: string[] = [],
): Promise<Exercise[]> {
  const excluded = new Set([forExercise.exerciseId, ...excludeIds]);
  const catalog = await fetchExercise(forExercise.exerciseId);
  const equipment = catalog?.equipment;

  const muscles = [
    forExercise.target,
    ...(forExercise.secondary ?? []),
    ...(catalog?.secondary_muscles ?? []),
  ]
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const uniqueMuscles = [...new Set(muscles)].slice(0, 3);

  const batches = await Promise.all([
    equipment
      ? fetchExercises({ muscle: forExercise.target, equipment, limit: 16 }).catch(() => ({ items: [] }))
      : Promise.resolve({ items: [] }),
    ...uniqueMuscles.map((muscle) =>
      fetchExercises({ muscle, limit: 16 }).catch(() => ({ items: [] })),
    ),
  ]);

  let items = uniqueExercises(batches.flatMap((batch) => batch.items)).filter((item) => !excluded.has(item.id));

  if (items.length < 6) {
    try {
      const resolved = await anatomeResolveExercise(forExercise.name);
      const names = (resolved.alternatives ?? []).map((alt) => alt.name).filter(Boolean);
      const lookedUp = await Promise.all(
        names.slice(0, 6).map((name) => fetchExercises({ q: name, limit: 1 }).then((data) => data.items[0] ?? null)),
      );
      items = uniqueExercises([...items, ...lookedUp.filter((item): item is Exercise => Boolean(item))])
        .filter((item) => !excluded.has(item.id));
    } catch {
      // Anatome is optional; catalog muscle matches are enough.
    }
  }

  return rankAlternatives(forExercise, equipment, items).slice(0, 12);
}
