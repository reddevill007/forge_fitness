"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { WorkoutsPage } from "@/src/components/forge-app";

function WorkoutsRouteInner() {
  const router = useRouter();
  return <WorkoutsPage onStart={() => router.push("/workout")} />;
}

export default function WorkoutsRoute() {
  return (
    <Suspense fallback={<div className="empty-state"><h3>Loading workouts…</h3></div>}>
      <WorkoutsRouteInner />
    </Suspense>
  );
}
