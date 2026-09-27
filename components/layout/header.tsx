"use client";

import { BellIcon, MenuIcon, WalletIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDemo } from "@/lib/client/use-api";
import type { Overview } from "@/lib/client/types";
import { sar, timeAgo } from "@/lib/format";
import { ApiInspector } from "./api-inspector";
import { CommandPalette } from "./command-palette";
import { SidebarNav } from "./sidebar";

export function Logo({ className }: { className?: string }) {
  return <Image src="/umrantech-logo.png" alt="Umran Tech" width={148} height={45} priority className={className} />;
}

export function Header() {
  const { data } = useDemo<Overview>("overview", { pollMs: 30000 });
  const [menu, setMenu] = useState(false);
  const recent = data?.recentNotifications ?? [];

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-card/90 px-3 backdrop-blur supports-backdrop-filter:bg-card/75 sm:px-4">
      <button className="flex size-8 items-center justify-center rounded-lg border lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu">
        <MenuIcon className="size-4" />
      </button>
      <Link href="/" className="flex shrink-0 items-center gap-3">
        <Logo className="h-8 w-auto" />
        <span className="hidden h-6 w-px bg-border sm:block" />
        <span className="hidden leading-tight sm:block">
          <span className="block text-sm font-semibold">Dhamen Escrow Console</span>
          <span className="block text-[11px] text-muted-foreground">Pay-In / Pay-Out · Authority portal</span>
        </span>
      </Link>
      <span className="hidden rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-600/20 md:inline">SANDBOX</span>

      <div className="ml-auto flex items-center gap-2">
        <CommandPalette />
        <Link
          href="/escrow"
          className="hidden items-center gap-2 rounded-lg border bg-card px-2.5 py-1 text-xs xl:flex"
          title="Authority virtual account balance (GET /get-authority-balance)"
        >
          <WalletIcon className="size-3.5 text-violet-600" />
          <span className="text-muted-foreground">Authority VA</span>
          <span className="font-semibold tabular-nums">SAR {sar(data?.authorityBalance)}</span>
        </Link>
        <ApiInspector />
        <Popover>
          <PopoverTrigger render={<button className="relative flex size-8 items-center justify-center rounded-lg border bg-card" aria-label="Notifications" />}>
            <BellIcon className="size-4" />
            {recent.length > 0 && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-orange-500 ring-2 ring-card" />}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b px-3 py-2 text-sm font-semibold">Webhook notifications</div>
            <div className="max-h-80 overflow-y-auto">
              {recent.map((n) => (
                <div key={n.id} className="border-b px-3 py-2 text-xs last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{n.payload.NotificationType.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-muted-foreground">
                    #{n.id} · {String((n.payload.Payment as { PaymentID?: string })?.PaymentID ?? (n.payload.Supplier as { SupplierName?: string })?.SupplierName ?? "")}
                  </div>
                </div>
              ))}
            </div>
            <Link href="/notifications" className="block border-t px-3 py-2 text-center text-xs font-medium text-primary hover:bg-muted/50">
              View all notifications
            </Link>
          </PopoverContent>
        </Popover>
        <div className="hidden items-center gap-2 border-l pl-3 sm:flex">
          <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-orange-400 text-xs font-semibold text-white">UT</div>
          <div className="hidden leading-tight 2xl:block">
            <div className="text-xs font-medium">Operations Admin</div>
            <div className="text-[11px] text-muted-foreground">Umran Tech</div>
          </div>
        </div>
      </div>

      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>
              <Logo className="h-8 w-auto" />
            </SheetTitle>
          </SheetHeader>
          <SidebarNav onNavigate={() => setMenu(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
