"use client";

import { ActivityIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { JsonView } from "@/components/app/json-view";
import { getCalls, subscribeCalls, type CallRecord } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";

const EMPTY: CallRecord[] = [];

export function MethodTag({ method }: { method: string }) {
  const color =
    method === "GET"
      ? "bg-sky-100 text-sky-700"
      : method === "PUT"
        ? "bg-amber-100 text-amber-800"
        : method === "DELETE"
          ? "bg-rose-100 text-rose-700"
          : "bg-emerald-100 text-emerald-700";
  return <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold", color)}>{method}</span>;
}

export function StatusTag({ status }: { status: number }) {
  return <span className={cn("font-mono text-[11px] font-semibold", status === 200 ? "text-emerald-600" : "text-rose-600")}>{status}</span>;
}

export function ApiInspector() {
  const calls = useSyncExternalStore(subscribeCalls, getCalls, () => EMPTY);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const current = calls.find((c) => c.id === selected) ?? calls[0];
  const last = calls[0];

  return (
    <>
      <Button variant="outline" size="sm" className="hidden gap-1.5 bg-card md:inline-flex" onClick={() => setOpen(true)}>
        <ActivityIcon className="size-3.5" />
        API
        {last && <span className={cn("size-1.5 rounded-full", last.status === 200 ? "bg-emerald-500" : "bg-rose-500")} />}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="border-b p-4">
            <SheetTitle>API inspector</SheetTitle>
            <SheetDescription>Requests this browser session sent to the Dhamen API, with headers from Appendix A.</SheetDescription>
          </SheetHeader>
          {!calls.length ? (
            <div className="p-6 text-sm text-muted-foreground">No calls yet. Create a customer or a payment link to see live request/response pairs here.</div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] md:grid-cols-[240px_1fr] md:grid-rows-1">
              <div className="max-h-48 overflow-y-auto border-b md:max-h-none md:border-r md:border-b-0">
                {calls.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className={cn("flex w-full flex-col gap-1 border-b px-3 py-2 text-left text-xs hover:bg-muted/50", current?.id === c.id && "bg-muted")}
                  >
                    <div className="flex items-center gap-2">
                      <MethodTag method={c.method} />
                      <StatusTag status={c.status} />
                      <span className="ml-auto text-muted-foreground">{c.durationMs}ms</span>
                    </div>
                    <div className="truncate font-mono text-[11px]">{c.path.replace("/api/payments/", "")}</div>
                  </button>
                ))}
              </div>
              {current && (
                <div className="min-h-0 space-y-3 overflow-y-auto p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <MethodTag method={current.method} />
                    <span className="font-mono">{current.path}</span>
                    <StatusTag status={current.status} />
                    <span className="text-muted-foreground">{fmtDate(current.at)}</span>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Headers</div>
                    <JsonView
                      value={{ "Content-Type": "application/json", "App-key": "••••••••-••••", "App-id": "••••••••-••••", ClientId: "••••••••-••••", "api-version": "2" }}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Request body</div>
                    <JsonView value={current.request} />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Response</div>
                    <JsonView value={current.response} />
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
