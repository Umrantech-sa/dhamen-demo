"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CopyButton({ value, className, label }: { value: string; className?: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={`Copy ${label ?? ""}`.trim()}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(value);
        setDone(true);
        toast.success(`${label ?? "Value"} copied`);
        setTimeout(() => setDone(false), 1200);
      }}
      className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground", className)}
    >
      {done ? <CheckIcon className="size-3.5 text-emerald-600" /> : <CopyIcon className="size-3.5" />}
    </button>
  );
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[0.8rem] tracking-tight", className)}>{children}</span>;
}
