// spec-columns — преобразование ResourceSpec.columns в Column<row> для ResourceTable.
// Та же логика, что в ResourceListPage, вынесена для переиспользования
// (например, на Subnet detail в tab "IP-адреса" мы рендерим Addresses-таблицу
// с теми же колонками, что и /folders/X/addresses).

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Tag, Typography } from "antd";
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

// referrerMeta — human-readable label + цвет antd-<Tag> для типа referrer'а.
// Известные типы получают короткие user-facing метки ("VM", "Disk", ...) и
// семантический цвет; unknown — fallback на сам `type` без цвета (neutral Tag),
// чтобы forward-compat при появлении новых referrer-типов работал визуально.
// Цвета — из стандартной палитры antd (см. https://ant.design/components/tag).
export function referrerMeta(type: string | undefined): { label: string; color?: string } {
  switch (type) {
    case "compute_instance":
      return { label: "VM", color: "blue" };
    case "compute_disk":
      return { label: "Disk", color: "cyan" };
    case "compute_image":
      return { label: "Image", color: "geekblue" };
    case "compute_snapshot":
      return { label: "Snapshot", color: "purple" };
    case "nlb_target_group":
      return { label: "NLB TG", color: "gold" };
    default:
      return { label: type || "?" };
  }
}

// ReferrerLink — общий рендер одного referrer'а как «<Tag>{label}</Tag> {id}»,
// обёрнутого в <Link> если href доступен (compute_instance → SPA-route), либо
// в plain <span> для unknown referrer-типов (forward-compat fallback). Клик по
// link останавливает propagation, чтобы row-onClick в ResourceTable не
// триггерил navigation на parent-ресурс (см. ResourceTable.tsx — там есть
// дополнительный skip на closest('a'), это просто defense-in-depth).
export function ReferrerLink({
  folderId,
  referrer,
}: {
  folderId: string | null | undefined;
  referrer: { type?: string; id?: string } | undefined;
}): ReactNode {
  const meta = referrerMeta(referrer?.type);
  const id = referrer?.id ?? "";
  const href = referrerHref(folderId, referrer);
  const inner = (
    <>
      <Tag color={meta.color} style={{ margin: 0, fontSize: 11 }}>
        {meta.label}
      </Tag>
      <Typography.Text code style={{ fontSize: 12 }} title={id || undefined}>
        {id || "—"}
      </Typography.Text>
    </>
  );
  if (href) {
    return (
      <Link
        to={href}
        onClick={(e) => e.stopPropagation()}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        {inner}
      </Link>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{inner}</span>
  );
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
      // первый referrer как «<Tag>{label}</Tag> {id}»; full id — в tooltip + as
      // visible text (~20 chars, помещается в cell); "+N" — `<Tag>` если
      // рефереров больше одного. Для известных referrer-типов вся группа
      // обёрнута в SPA-<Link>; для прочих — plain (forward-compat fallback).
      // Клик внутри <a> не триггерит row-navigation (см. ResourceTable.tsx —
      // есть skip на `closest('a')`).
      if (Array.isArray(v) && v.length > 0) {
        const first = v[0] as { referrer?: { type?: string; id?: string } } | undefined;
        const more = v.length > 1 ? v.length - 1 : 0;
        const folderId =
          opts.folderId ?? (getByPath<string>(row, "folder_id") || null);
        const restTitle = more
          ? (v.slice(1) as Array<{ referrer?: { type?: string; id?: string } }>)
              .map((r) => `${r.referrer?.type ?? "?"} ${r.referrer?.id ?? ""}`)
              .join("\n")
          : undefined;
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <ReferrerLink folderId={folderId} referrer={first?.referrer} />
            {more > 0 && (
              <Tag style={{ margin: 0, fontSize: 11 }} title={restTitle}>
                +{more}
              </Tag>
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
