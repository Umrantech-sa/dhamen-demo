"use client";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Clickable card with a switch. Not a <label>: Base UI's Switch would receive the forwarded click and toggle twice. */
export function SwitchCard({ checked, onChange, title, description, className }: { checked: boolean; onChange: (v: boolean) => void; title: string; description: string; className?: string }) {
  return (
    <div
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("[data-slot=switch]")) onChange(!checked);
      }}
      className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition select-none", checked ? "border-primary/40 bg-primary/5" : "bg-card hover:bg-muted/40", className)}
    >
      <Switch checked={checked} onCheckedChange={(v) => onChange(v)} aria-label={title} className="mt-0.5" />
      <span className="grid gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </div>
  );
}
