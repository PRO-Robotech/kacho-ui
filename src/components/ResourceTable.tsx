// ResourceTable — тонкая обёртка над antd Table.
//
// Сохраняет старый API (Column<T>, sortKey) для совместимости с
// ResourceListPage и тестами, но делегирует рендер в antd.

import { type ReactNode, useMemo } from "react";
import { Table } from "antd";
import type { ColumnType, TableProps } from "antd/es/table";
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
  defaultSort?: { col: number; dir: "asc" | "desc" };
  /** Если задан — клик по строке вызывает callback (для drill-down в detail).
   *  Cells, у которых внутри есть button/link с stopPropagation, не триггерят. */
  onRowClick?: (row: T) => void;
}

export function ResourceTable<T extends object>({
  rows,
  columns,
  rowKey,
  empty,
  loading,
  defaultSort,
  onRowClick,
}: Props<T>) {
  const antColumns: ColumnType<T>[] = useMemo(
    () =>
      columns.map((c, idx) => {
        const col: ColumnType<T> = {
          title: c.header,
          key: String(idx),
          className: c.className,
          render: (_value, row) => c.cell(row),
        };
        if (c.sortKey) {
          col.sorter = (a: T, b: T) => {
            const av = getByPath(a, c.sortKey!);
            const bv = getByPath(b, c.sortKey!);
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            if (typeof av === "number" && typeof bv === "number") return av - bv;
            return String(av).localeCompare(String(bv));
          };
          if (defaultSort && defaultSort.col === idx) {
            col.defaultSortOrder = defaultSort.dir === "asc" ? "ascend" : "descend";
          }
        }
        return col;
      }),
    [columns, defaultSort],
  );

  const tableProps: TableProps<T> = {
    columns: antColumns,
    dataSource: rows,
    rowKey: (row) => rowKey(row),
    pagination: false,
    size: "small",
    loading,
    locale: {
      emptyText: empty ?? "Ресурсов не найдено",
    },
    onRow: onRowClick
      ? (row) => ({
          onClick: () => onRowClick(row),
          style: { cursor: "pointer" },
        })
      : undefined,
  };

  return <Table<T> {...tableProps} />;
}
