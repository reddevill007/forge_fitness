import { AuthGuard } from "@/src/components/auth-guard";
import { CoachHost } from "@/src/components/coach/coach-host";
import { OfflineBanner } from "@/src/components/offline-banner";

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <OfflineBanner />
      {children}
      <CoachHost />
    </AuthGuard>
  );
}
