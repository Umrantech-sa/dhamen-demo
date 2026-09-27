"use client";

import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PickerItem {
  id: string;
  label: string;
  sub?: string;
  right?: ReactNode;
  keywords?: string;
  disabled?: boolean;
}

/** Searchable combobox used to select customers / suppliers. */
export function EntityPicker({
  items,
  value,
  onChange,
  placeholder = "Select…",
  emptyText = "No matches",
  className,
  allowClear,
  invalid,
}: {
  items: PickerItem[];
  value?: string;
  onChange: (id: string | undefined) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  allowClear?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            data-invalid={invalid || undefined}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-invalid:border-destructive",
              className,
            )}
          />
        }
      >
        {selected ? (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{selected.label}</span>
            {selected.sub && <span className="truncate text-[11px] text-muted-foreground">{selected.sub}</span>}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <span className="flex items-center gap-1">
          {allowClear && selected && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <XIcon className="size-3.5" />
            </span>
          )}
          <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name, ID, IBAN…" autoFocus />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.sub ?? ""} ${item.keywords ?? ""} ${item.id}`}
                  disabled={item.disabled}
                  data-checked={item.id === value}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                >
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate">{item.label}</span>
                    {item.sub && <span className="truncate text-[11px] text-muted-foreground">{item.sub}</span>}
                  </span>
                  {item.right}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
