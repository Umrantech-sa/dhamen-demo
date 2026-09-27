import { cn } from "@/lib/utils";
import { sar } from "@/lib/format";

export function Money({ value, className, sign, currencyClassName }: { value: number | undefined | null; className?: string; sign?: "+" | "-"; currencyClassName?: string }) {
  return (
    <span className={cn("tabular-nums whitespace-nowrap", className)}>
      {sign && <span>{sign}</span>}
      <span className={cn("mr-1 text-[0.7em] font-medium text-muted-foreground", currencyClassName)}>SAR</span>
      {sar(value)}
    </span>
  );
}
