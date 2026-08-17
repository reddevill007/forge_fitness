import { FOCUS_MUSCLES, groupFocusMuscles, uniqueMuscleNames } from "@/src/lib/focus-muscles";
import { getCatalogMuscleNames } from "@/src/lib/exercise-catalog";

export async function GET() {
  try {
    const catalog = await getCatalogMuscleNames();
    const items = uniqueMuscleNames([...FOCUS_MUSCLES, ...catalog]);
    return Response.json({ items, groups: groupFocusMuscles(items) });
  } catch {
    return Response.json({ items: FOCUS_MUSCLES, groups: groupFocusMuscles([...FOCUS_MUSCLES]) });
  }
}
