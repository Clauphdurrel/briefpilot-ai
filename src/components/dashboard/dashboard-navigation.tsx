"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FolderKanban, LayoutDashboard, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Projets", href: "/dashboard/projects", icon: FolderKanban },
  { name: "Briefs", href: "/dashboard/briefs", icon: FileText },
  { name: "Paramètres", href: "/dashboard/settings", icon: Settings },
];

export function DashboardNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation du dashboard" className="grid grid-cols-2 gap-1 md:grid-cols-1">
      {navigation.map(({ name, href, icon: Icon }) => {
        const active = pathname === href ||
          (href !== "/dashboard" && pathname.startsWith(`${href}/`));

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {name}
          </Link>
        );
      })}
    </nav>
  );
}
