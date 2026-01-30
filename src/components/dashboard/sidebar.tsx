"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Activity, AlertTriangle, Flame, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/events", label: "Events", icon: Activity },
  { href: "/dashboard/risk", label: "Risk Analysis", icon: AlertTriangle },
  { href: "/dashboard/incidents", label: "Incidents", icon: Flame },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-800 p-4">
      <div className="mb-8">
        <h1 className="text-lg font-bold tracking-tight">Sentinel</h1>
        <p className="text-xs text-zinc-500">AI Code Safety</p>
      </div>

      <nav className="space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-md border border-zinc-800 bg-zinc-900 p-3">
        <p className="text-xs font-medium text-zinc-400">Repository</p>
        <p className="mt-1 truncate text-sm">SAY-5/Sentinel</p>
      </div>
    </aside>
  );
}
