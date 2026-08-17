import {
  Activity,
  BarChart3,
  CalendarDays,
  Dumbbell,
  History,
  Home,
  Scale,
  Search,
  Settings,
  Trophy,
} from "lucide-react";

export type AppRoute =
  | "home"
  | "workouts"
  | "exercises"
  | "muscles"
  | "history"
  | "analytics"
  | "records"
  | "body"
  | "programs"
  | "settings";

export const navItems: Array<{
  id: AppRoute;
  href: string;
  label: string;
  icon: typeof Home;
}> = [
  { id: "home", href: "/", label: "Home", icon: Home },
  { id: "workouts", href: "/workouts", label: "Workouts", icon: Dumbbell },
  { id: "exercises", href: "/exercises", label: "Exercises", icon: Search },
  { id: "muscles", href: "/muscles", label: "Muscle map", icon: Activity },
  { id: "history", href: "/history", label: "History", icon: History },
  { id: "analytics", href: "/analytics", label: "Analytics", icon: BarChart3 },
  { id: "records", href: "/records", label: "Records", icon: Trophy },
  { id: "body", href: "/body", label: "Body", icon: Scale },
  { id: "programs", href: "/programs", label: "Programs", icon: CalendarDays },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
];

export function routeFromPathname(pathname: string): AppRoute {
  const match = navItems.find((item) =>
    item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.id ?? "home";
}
