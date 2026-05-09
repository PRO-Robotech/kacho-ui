import { useMemo, useState, type ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getByPath } from "@/lib/path";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Path в row для local-sort. Если не задан — колонка не сортируется. */
  sortKey?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  loading?: boolean;
  /** Дефолтная сортировка — индекс колонки + направление. */
  defaultSort?: { col: number; dir: "asc" | "desc" };
}

export function ResourceTable<T>({
  rows,
  columns,
  rowKey,
  empty,
  loading,
  defaultSort,
}: Props<T>) {
  const [sort, setSort] = useState<{ col: number; dir: "asc" | "desc" } | null>(
    defaultSort ?? null,
  );

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const sortKey = columns[sort.col]?.sortKey;
    if (!sortKey) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = getByPath(a, sortKey);
      const bv = getByPath(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, columns, sort]);

  const onHeaderClick = (idx: number) => {
    if (!columns[idx].sortKey) return;
    setSort((s) => {
      if (!s || s.col !== idx) return { col: idx, dir: "asc" };
      if (s.dir === "asc") return { col: idx, dir: "desc" };
      return null;
    });
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {columns.map((col, i) => {
              const sortable = !!col.sortKey;
              const active = sort?.col === i;
              const Icon = !active
                ? ChevronsUpDown
                : sort.dir === "asc"
                ? ChevronUp
                : ChevronDown;
              return (
                <th
                  key={i}
                  className={cn(
                    "text-left px-4 py-2 font-medium text-muted-foreground select-none",
                    sortable && "cursor-pointer hover:text-foreground",
                    col.className,
                  )}
                  onClick={() => onHeaderClick(i)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sortable && col.header && (
                      <Icon
                        className={cn(
                          "h-3 w-3 opacity-50",
                          active && "opacity-100 text-foreground",
                        )}
                      />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                Загрузка…
              </td>
            </tr>
          )}
          {!loading && sortedRows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                {empty ?? "Ресурсов не найдено"}
              </td>
            </tr>
          )}
          {!loading &&
            sortedRows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-border hover:bg-muted/30">
                {columns.map((col, i) => (
                  <td key={i} className={cn("px-4 py-2 align-middle", col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
