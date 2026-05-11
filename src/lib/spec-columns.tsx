// spec-columns — преобразование ResourceSpec.columns в Column<row> для ResourceTable.
// Та же логика, что в ResourceListPage, вынесена для переиспользования
// (например, на Subnet detail в tab "IP-адреса" мы рендерим Addresses-таблицу
// с теми же колонками, что и /folders/X/addresses).

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Typography } from "antd";
import type { Column } from "@/components/ResourceTable";
import { CopyableId } from "@/components/CopyableId";
import { StatusBadge } from "@/components/StatusBadge";
import { getByPath, type ResourceColumn, type ResourceSpec } from "@/lib/resource-registry";

// Опции для рендеринга generic-форматов, которым нужен контекст вокруг ячейки.
// Сейчас используется только `folderId` для построения SPA-ссылок в format:
// "references" (used_by → /folders/<folderId>/compute/instances/<id> и т.п.).
export interface FormatCellOpts {
  folderId?: string | null;
}

// referrerHref — маппинг kacho.cloud.reference.Reference.referrer → SPA-route.
// Структурирован как switch по `referrer.type`, чтобы при появлении новых
// referrer-типов (compute_disk, nlb_target_group, ...) дописывать один case.
// Возвращает `null` если folderId не известен или тип не поддерживается —
// caller тогда рендерит plain-текст (forward-compat fallback).
export function referrerHref(
  folderId: string | null | undefined,
  referrer: { type?: string; id?: string } | undefined,
): string | null {
  if (!folderId) return null;
  const t = referrer?.type;
  const id = referrer?.id;
  if (!t || !id) return null;
  switch (t) {
    case "compute_instance":
      return `/folders/${folderId}/compute/instances/${id}`;
    default:
      return null;
  }
}

export function buildSpecColumns(
  spec: ResourceSpec,
  opts: FormatCellOpts = {},
): Column<Record<string, unknown>>[] {
  return spec.columns.map((c) => ({
    header: c.header,
    className: c.className,
    cell: (row) => (c.render ? c.render(row) : formatCellByFormat(c, row, opts)),
    sortKey:
      c.format === "datetime" || c.format === "text" || c.format === "uid-short"
        ? c.path
        : undefined,
  }));
}

export function formatCellByFormat(
  c: ResourceColumn,
  row: Record<string, unknown>,
  opts: FormatCellOpts = {},
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
    case "references":
      // Generic renderer для output-only списков kacho.cloud.reference.Reference
      // (типичный shape: [{ referrer: { type, id }, type }, ...]). Показываем
      // первый referrer как "<type> <short-id>"; полный id — в tooltip;
      // "+N" — если рефереров больше одного. Для известных referrer-типов
      // short-id рендерится как SPA-<Link> на detail-страницу ресурса
      // (compute_instance → /folders/<f>/compute/instances/<id>); для прочих —
      // plain code (forward-compat fallback). Клик внутри <a> не триггерит
      // row-navigation (см. ResourceTable.tsx — есть skip на `closest('a')`).
      if (Array.isArray(v) && v.length > 0) {
        const first = v[0] as { referrer?: { type?: string; id?: string } } | undefined;
        const refType = first?.referrer?.type ?? "?";
        const refId = first?.referrer?.id ?? "";
        const shortId = refId.length > 12 ? `${refId.slice(0, 12)}…` : refId;
        const more = v.length > 1 ? ` +${v.length - 1}` : "";
        const folderId =
          opts.folderId ?? (getByPath<string>(row, "folder_id") || null);
        const href = referrerHref(folderId, first?.referrer);
        return (
          <span style={{ fontSize: 12 }} title={refId || undefined}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {refType}
            </Typography.Text>{" "}
            {href ? (
              <Link to={href} onClick={(e) => e.stopPropagation()}>
                <Typography.Text code style={{ fontSize: 12 }}>
                  {shortId || "—"}
                </Typography.Text>
              </Link>
            ) : (
              <Typography.Text code style={{ fontSize: 12 }}>
                {shortId || "—"}
              </Typography.Text>
            )}
            {more && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {more}
              </Typography.Text>
            )}
          </span>
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
