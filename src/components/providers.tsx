"use client";

import { CoachProvider } from "@/src/lib/coach/context";
import { AuthProvider } from "@/src/lib/firebase/auth-context";
import { UserDataProvider } from "@/src/lib/firebase/user-data-context";
import { ThemeProvider } from "@/src/lib/theme";
import { ServiceWorkerRegister } from "@/src/lib/offline";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UserDataProvider>
          <CoachProvider>
            <ServiceWorkerRegister />
            {children}
          </CoachProvider>
        </UserDataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
