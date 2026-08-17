"use client";

import { useRouter } from "next/navigation";
import { WorkoutSummary } from "@/src/components/forge-app";

export default function WorkoutSummaryRoute() {
  const router = useRouter();
  return <WorkoutSummary onDone={() => router.push("/analytics")} />;
}
