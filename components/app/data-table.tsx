"use client";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, InboxIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => string | number | undefined;
  className?: string;
  align?: "left" | "right";
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  loading,
  pageSize = 10,
  initialSort,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting your search or filters.",
  footer,
}: {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  emptyTitle?: string;
  emptyDescription?: string;
  footer?: ReactNode;
}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const list = rows ?? [];
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort || !sort) return list;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = col.sort!(a) ?? "";
      const vb = col.sort!(b) ?? "";
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  }, [rows, columns, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cn("h-9 px-3 text-left text-xs font-medium whitespace-nowrap text-muted-foreground", c.align === "right" && "text-right", c.className)}>
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn("inline-flex items-center gap-1 hover:text-foreground", c.align === "right" && "flex-row-reverse")}
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUpIcon className="size-3" />
                        ) : (
                          <ArrowDownIcon className="size-3" />
                        )
                      ) : (
                        <ArrowUpDownIcon className="size-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-3">
                      <Skeleton className="h-4 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              visible.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn("border-b transition-colors last:border-0 hover:bg-muted/40", onRowClick && "cursor-pointer")}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-3 py-2.5 align-middle", c.align === "right" && "text-right", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!loading && !sorted.length && <EmptyState icon={InboxIcon} title={emptyTitle} description={emptyDescription} />}
      {!loading && sorted.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <div>
            Showing <span className="font-medium text-foreground">{current * pageSize + 1}</span>–
            <span className="font-medium text-foreground">{Math.min(sorted.length, (current + 1) * pageSize)}</span> of{" "}
            <span className="font-medium text-foreground">{sorted.length}</span>
            {footer}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <ChevronLeftIcon />
            </Button>
            <span className="px-2">
              Page {current + 1} / {pages}
            </span>
            <Button variant="outline" size="icon-sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
