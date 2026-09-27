"use client";

import { Building2Icon, CreditCardIcon, PlusIcon, SearchIcon, UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, Command } from "@/components/ui/command";
import { demo } from "@/lib/client/api";
import type { CustomerView, InvoiceView, SupplierView } from "@/lib/client/types";
import { NAV } from "./nav";
import { sar } from "@/lib/format";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ customers: CustomerView[]; suppliers: SupplierView[]; invoices: InvoiceView[] }>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    Promise.all([demo.get<CustomerView[]>("customers"), demo.get<SupplierView[]>("suppliers"), demo.get<InvoiceView[]>("invoices")])
      .then(([customers, suppliers, invoices]) => setData({ customers, suppliers, invoices }))
      .catch(() => undefined);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden h-8 w-64 items-center gap-2 rounded-lg border bg-card px-2.5 text-sm whitespace-nowrap text-muted-foreground transition hover:border-foreground/20 xl:flex"
      >
        <SearchIcon className="size-4" />
        Search customers, payments…
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="flex size-8 items-center justify-center rounded-lg border bg-card xl:hidden" aria-label="Search">
        <SearchIcon className="size-4" />
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} className="sm:max-w-xl">
        <Command>
          <CommandInput placeholder="Type a name, identity number, VIBAN or payment reference…" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Quick actions">
              <CommandItem onSelect={() => go("/payments?new=1")}>
                <PlusIcon /> New payment link
              </CommandItem>
              <CommandItem onSelect={() => go("/customers?new=1")}>
                <PlusIcon /> New customer
              </CommandItem>
              <CommandItem onSelect={() => go("/suppliers?new=1")}>
                <PlusIcon /> New supplier
              </CommandItem>
              <CommandItem onSelect={() => go("/payouts?new=1")}>
                <PlusIcon /> New split payout
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Pages">
              {NAV.flatMap((g) => g.items).map((i) => (
                <CommandItem key={i.href} value={`page ${i.label}`} onSelect={() => go(i.href)}>
                  <i.icon /> {i.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {data && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Customers">
                  {data.customers.map((c) => (
                    <CommandItem
                      key={c.customerId}
                      value={`customer ${c.name} ${c.identityNumber} ${c.viban} ${c.email ?? ""} ${c.mobile ?? ""}`}
                      onSelect={() => go(`/customers/${c.customerId}`)}
                    >
                      <UserIcon /> {c.name}
                      <span className="ml-auto font-mono text-xs text-muted-foreground">{c.identityNumber}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup heading="Suppliers">
                  {data.suppliers.map((s) => (
                    <CommandItem key={s.supplierId} value={`supplier ${s.name} ${s.identityNumber} ${s.iban} ${s.viban}`} onSelect={() => go(`/suppliers/${s.supplierId}`)}>
                      <Building2Icon /> {s.name}
                      <span className="ml-auto font-mono text-xs text-muted-foreground">{s.identityNumber}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup heading="Payments">
                  {data.invoices.slice(0, 60).map((i) => (
                    <CommandItem
                      key={i.invoiceId}
                      value={`payment ${i.paymentReferenceId} ${i.name} ${i.customerIdentifier} ${i.invoiceId}`}
                      onSelect={() => go(`/payments/${i.invoiceId}`)}
                    >
                      <CreditCardIcon /> {i.paymentReferenceId}
                      <span className="text-xs text-muted-foreground">{i.name}</span>
                      <span className="ml-auto text-xs tabular-nums">SAR {sar(i.amount)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
