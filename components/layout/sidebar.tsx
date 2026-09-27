"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV.map((group) => (
        <div key={group.section}>
          <div className="mb-1.5 px-2 text-[10.5px] font-semibold tracking-wider text-muted-foreground/80 uppercase">{group.section}</div>
          <div className="grid gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active && "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className={cn("size-4 text-muted-foreground group-hover:text-sidebar-accent-foreground", active && "text-sidebar-accent-foreground")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      <div className="mt-auto rounded-xl border border-dashed border-violet-200 bg-violet-50/60 p-3 text-xs text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
        <div className="mb-1 flex items-center gap-1.5 font-semibold">
          <ShieldCheckIcon className="size-3.5" /> Dhamen Sandbox
        </div>
        Integration Guide v1.5 · api-version 2. Mock API with seeded data — reset it any time in Settings.
      </div>
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
      <SidebarNav />
    </aside>
  );
}
