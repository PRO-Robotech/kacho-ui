// spec-columns — преобразование ResourceSpec.columns в Column<row> для ResourceTable.
// Та же логика, что в ResourceListPage, вынесена для переиспользования
// (например, на Subnet detail в tab "IP-адреса" мы рендерим Addresses-таблицу
// с теми же колонками, что и /folders/X/addresses).

import type { ReactNode } from "react";
import { Typography } from "antd";
import type { Column } from "@/components/ResourceTable";
import { CopyableId } from "@/components/CopyableId";
import { StatusBadge } from "@/components/StatusBadge";
import { getByPath, type ResourceColumn, type ResourceSpec } from "@/lib/resource-registry";

export function buildSpecColumns(
  spec: ResourceSpec,
): Column<Record<string, unknown>>[] {
  return spec.columns.map((c) => ({
    header: c.header,
    className: c.className,
    cell: (row) => (c.render ? c.render(row) : formatCellByFormat(c, row)),
    sortKey:
      c.format === "datetime" || c.format === "text" || c.format === "uid-short"
        ? c.path
        : undefined,
  }));
}

export function formatCellByFormat(
  c: ResourceColumn,
  row: Record<string, unknown>,
): ReactNode {
  const v = getByPath(row, c.path);
  switch (c.format) {
    case "status":
      return <StatusBadge state={typeof v === "string" ? v : undefined} />;
    case "uid-short":
      return typeof v === "string" && v ? (
        <CopyableId id={v} />
      ) : (
        <Typography.Text type="secondary">—</Typography.Text>
      );
    case "datetime":
      return typeof v === "string" && v ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(v).toLocaleString()}
        </Typography.Text>
      ) : (
        <Typography.Text type="secondary">—</Typography.Text>
      );
    case "code":
      return typeof v === "string" || typeof v === "number" ? (
        <Typography.Text code style={{ fontSize: 12 }}>
          {String(v)}
        </Typography.Text>
      ) : (
        <Typography.Text type="secondary">—</Typography.Text>
      );
    case "list":
      if (Array.isArray(v) && v.length > 0) {
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {v.map((item, i) => (
              <span
                key={i}
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                {String(item)}
              </span>
            ))}
          </div>
        );
      }
      return <Typography.Text type="secondary">—</Typography.Text>;
    case "text":
    default:
      if (v == null || v === "")
        return <Typography.Text type="secondary">—</Typography.Text>;
      return String(v);
  }
}
