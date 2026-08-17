"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Command, LogOut, Menu, Moon, MoreHorizontal, Search, Sparkles, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { ForgeMark, Scribble } from "@/src/components/doodles";
import { CoachHost } from "@/src/components/coach/coach-host";
import { GlobalSearch } from "@/src/components/global-search";
import { IconButton } from "@/src/components/ui";
import { OfflineBanner } from "@/src/components/offline-banner";
import { useOnlineStatus } from "@/src/lib/offline";
import { useAuth } from "@/src/lib/firebase/auth-context";
import { useUserData } from "@/src/lib/firebase/user-data-context";
import { useCoach } from "@/src/lib/coach/context";
import { navItems, routeFromPathname } from "@/src/lib/nav";
import { useTheme } from "@/src/lib/theme";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "FF";
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const page = routeFromPathname(pathname);
  const { dark, setDark } = useTheme();
  const online = useOnlineStatus();
  const { user, logout } = useAuth();
  const { profile, activeWorkout, sessions } = useUserData();
  const coach = useCoach();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  const displayName = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Athlete";
  const avatar = initials(displayName);
  const sessionCount = sessions.filter((session) => session.completedAt).length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app-frame">
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
        <div className="sidebar-panel">
          <Link className="brand" href="/">
            <ForgeMark />
            <span>FORGE</span>
          </Link>
          <nav aria-label="Primary navigation">
            {navItems.map(({ id, href, label, icon: Icon }) => (
              <Link
                key={id}
                className={page === id ? "active" : ""}
                href={href}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={19} strokeWidth={2.1} />
                <span>{label}</span>
                {page === id && <span className="nav-dash" />}
              </Link>
            ))}
          </nav>
          <button className="sidebar-coach" type="button" onClick={() => coach?.openPanel()}>
            <Sparkles size={20} />
            <strong>Ask Coach</strong>
            <p>{activeWorkout ? `Active: ${activeWorkout.name}` : "Your training history, on call."}</p>
            <Scribble />
          </button>
          <Link className="profile-chip" href="/settings" onClick={() => setSidebarOpen(false)}>
            <span className="avatar">{avatar}</span>
            <span>
              <strong>{displayName}</strong>
              <small>{sessionCount} sessions logged</small>
            </span>
            <MoreHorizontal size={18} />
          </Link>
          <button
            className="sidebar-logout"
            type="button"
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <main className="main-shell">
        <OfflineBanner />
        <header className="topbar">
          <IconButton label="Open menu" onClick={() => setSidebarOpen(true)}>
            <Menu size={21} />
          </IconButton>
          <button className="global-search" type="button" onClick={() => setGlobalSearchOpen(true)}>
            <Search size={18} />
            <span>Search exercises, workouts, muscles…</span>
            <kbd>
              <Command size={12} /> K
            </kbd>
          </button>
          <div className="topbar-actions">
            {!online && <span className="offline-pill">Offline</span>}
            <IconButton label={dark ? "Use light theme" : "Use dark theme"} onClick={() => setDark(!dark)}>
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </IconButton>
            <IconButton label="Open Coach" onClick={() => coach?.openPanel()}>
              <Sparkles size={19} />
            </IconButton>
            <IconButton label="Notifications">
              <Bell size={19} />
              <i />
            </IconButton>
          </div>
        </header>
        <div className="page-shell">{children}</div>
      </main>

      {globalSearchOpen && (
        <GlobalSearch
          onClose={() => setGlobalSearchOpen(false)}
          onNavigate={(href) => {
            router.push(href);
            setGlobalSearchOpen(false);
          }}
        />
      )}
      <CoachHost />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <AppShellInner>{children}</AppShellInner>;
}
