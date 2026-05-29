// resource-detail-extensions — реестр доменных расширений detail-страницы.
//
// ResourceShell остаётся generic (Обзор/связанные/Операции/JSON + формы-панели).
// Доменно-специфичный контент конкретного ресурса (доп. строки Обзора, доменные
// табы — SG-правила, RouteTable-маршруты, Instance NIC/power, TG targets, IPAM,
// IAM access-bindings — кнопки-действия в шапке) подключается ЗДЕСЬ, по spec.id,
// переиспользуя уже существующие доменные компоненты/логику кастом-страниц.
//
// Так раскатка эталона на все ресурсы не теряет доменную функциональность и не
// раздувает ResourceShell. Карта миграции:
// docs/superpowers/specs/2026-05-30-kacho-ui-rollout-migration-map.json

import { type ReactNode } from "react";
import { Tag, Typography } from "antd";
import type { DetailTab } from "@/components/DetailShell";
import { RefNameLink } from "@/components/RefNameLink";
import { getByPath } from "@/lib/resource-registry";

export interface DescItem {
  label: string;
  value: ReactNode;
}

export interface DetailExtCtx {
  data: Record<string, unknown>;
  projectId: string | null;
  /** Базовый URL detail-страницы ресурса (без хвостов /edit, /json, /<tab>). */
  detailBase: string;
  navigate: (to: string) => void;
}

export interface DetailExtension {
  overviewExtra?: (ctx: DetailExtCtx) => DescItem[];
  headerActions?: (ctx: DetailExtCtx) => ReactNode;
  extraTabs?: (ctx: DetailExtCtx) => DetailTab[];
  hideOperations?: boolean;
  title?: (data: Record<string, unknown>) => string | undefined;
}

// ─────────────────────────── helpers ───────────────────────────

const dash = <Typography.Text type="secondary">—</Typography.Text>;

function txt(v: unknown): ReactNode {
  const s = v == null ? "" : String(v);
  return s ? s : dash;
}

function mono(v: unknown): ReactNode {
  const s = v == null ? "" : String(v);
  return s ? <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{s}</span> : dash;
}

function boolTag(v: unknown, yes = "Да", no = "Нет"): ReactNode {
  return v ? <Tag color="green">{yes}</Tag> : <Tag>{no}</Tag>;
}

function chips(items: string[] | undefined, color?: string): ReactNode {
  if (!items || items.length === 0) return dash;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
      {items.map((c) => (
        <Tag key={c} color={color} style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
          {c}
        </Tag>
      ))}
    </span>
  );
}

function refLinks(ids: string[] | undefined, specId: string): ReactNode {
  if (!ids || ids.length === 0) return dash;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8 }}>
      {ids.map((id) => (
        <RefNameLink key={id} specId={specId} refId={id} maxChars={28} />
      ))}
    </span>
  );
}

// ── SecurityGroup rules (порт из SecurityGroupDetailPage) ──
interface SgRule {
  id?: string;
  direction?: string;
  description?: string;
  protocol_name?: string;
  protocol_number?: number;
  ports?: { from_port?: number | string; to_port?: number | string };
  cidr_blocks?: { v4_cidr_blocks?: string[]; v6_cidr_blocks?: string[] };
  security_group_id?: string;
  predefined_target?: string;
}

function sgProtocol(r: SgRule): string {
  if (r.protocol_name) return r.protocol_name;
  if (typeof r.protocol_number === "number") return `proto ${r.protocol_number}`;
  return "Any";
}
function sgPorts(r: SgRule): string {
  if (!r.ports) return "—";
  const f = r.ports.from_port;
  const t = r.ports.to_port;
  if (f == null && t == null) return "—";
  if (f === t || t == null) return String(f);
  return `${f}–${t}`;
}
function sgTarget(r: SgRule): { kind: string; value: string } {
  if (r.cidr_blocks) {
    const v4 = r.cidr_blocks.v4_cidr_blocks ?? [];
    const v6 = r.cidr_blocks.v6_cidr_blocks ?? [];
    return { kind: "CIDR", value: [...v4, ...v6].join(", ") || "—" };
  }
  if (r.security_group_id) return { kind: "SG", value: r.security_group_id };
  if (r.predefined_target) return { kind: "Predefined", value: r.predefined_target };
  return { kind: "—", value: "—" };
}

function RulesTable({ rules }: { rules: SgRule[] }) {
  if (rules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Правил нет — трафик блокируется (default-deny).
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-3 py-2">Протокол</th>
            <th className="text-left px-3 py-2">Диапазон портов</th>
            <th className="text-left px-3 py-2">Тип источника</th>
            <th className="text-left px-3 py-2">Источник</th>
            <th className="text-left px-3 py-2">Описание</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r, i) => {
            const tgt = sgTarget(r);
            return (
              <tr key={r.id ?? i} className="border-t border-border hover:bg-muted/20">
                <td className="px-3 py-2">{sgProtocol(r)}</td>
                <td className="px-3 py-2">{sgPorts(r)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{tgt.kind}</td>
                <td className="px-3 py-2 font-mono text-xs">{tgt.value}</td>
                <td className="px-3 py-2 text-xs">{r.description || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── RouteTable static_routes ──
interface StaticRoute {
  destination_prefix?: string;
  next_hop_address?: string;
  gateway_id?: string;
}
function StaticRoutesTable({ routes }: { routes: StaticRoute[] }) {
  if (routes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Статических маршрутов нет.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-3 py-2">Префикс назначения</th>
            <th className="text-left px-3 py-2">Next hop</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r, i) => (
            <tr key={i} className="border-t border-border hover:bg-muted/20">
              <td className="px-3 py-2 font-mono text-xs">{r.destination_prefix || "—"}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.next_hop_address || r.gateway_id || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Address: вычисление IP/семейства/вида ──
function addressInfo(data: Record<string, unknown>): { ip: string; family: string; kind: string } {
  const ext4 = getByPath<{ address?: string }>(data, "external_ipv4_address");
  const int4 = getByPath<{ address?: string }>(data, "internal_ipv4_address");
  const ext6 = getByPath<{ address?: string }>(data, "external_ipv6_address");
  const int6 = getByPath<{ address?: string }>(data, "internal_ipv6_address");
  if (ext4?.address) return { ip: ext4.address, family: "IPv4", kind: "Внешний" };
  if (int4?.address) return { ip: int4.address, family: "IPv4", kind: "Внутренний" };
  if (ext6?.address) return { ip: ext6.address, family: "IPv6", kind: "Внешний" };
  if (int6?.address) return { ip: int6.address, family: "IPv6", kind: "Внутренний" };
  return { ip: "", family: "—", kind: "—" };
}

// ─────────────────────────── реестр ───────────────────────────

export const DETAIL_EXTENSIONS: Record<string, DetailExtension> = {
  networks: {
    overviewExtra: ({ data }) => [
      {
        label: "Группа безопасности по умолчанию",
        value: (
          <RefNameLink
            specId="security-groups"
            refId={getByPath<string>(data, "default_security_group_id")}
            maxChars={42}
          />
        ),
      },
    ],
  },

  subnets: {
    overviewExtra: ({ data }) => [
      { label: "Зона", value: mono(getByPath<string>(data, "zone_id")) },
      {
        label: "Сеть",
        value: <RefNameLink specId="networks" refId={getByPath<string>(data, "network_id")} maxChars={42} />,
      },
      {
        label: "Таблица маршрутизации",
        value: getByPath<string>(data, "route_table_id") ? (
          <RefNameLink specId="route-tables" refId={getByPath<string>(data, "route_table_id")} maxChars={42} />
        ) : (
          dash
        ),
      },
      { label: "IPv4 CIDR-блоки", value: chips(getByPath<string[]>(data, "v4_cidr_blocks"), "blue") },
      { label: "IPv6 CIDR-блоки", value: chips(getByPath<string[]>(data, "v6_cidr_blocks"), "geekblue") },
    ],
  },

  "route-tables": {
    overviewExtra: ({ data }) => [
      {
        label: "Сеть",
        value: <RefNameLink specId="networks" refId={getByPath<string>(data, "network_id")} maxChars={42} />,
      },
    ],
    extraTabs: ({ data }) => {
      const routes = (getByPath<StaticRoute[]>(data, "static_routes") ?? []) as StaticRoute[];
      return [
        {
          id: "static-routes",
          label: "Статические маршруты",
          count: routes.length,
          render: () => <StaticRoutesTable routes={routes} />,
        },
      ];
    },
  },

  "security-groups": {
    overviewExtra: ({ data }) => [
      {
        label: "Сеть",
        value: getByPath<string>(data, "network_id") ? (
          <RefNameLink specId="networks" refId={getByPath<string>(data, "network_id")} maxChars={42} />
        ) : (
          dash
        ),
      },
      { label: "Default для сети", value: boolTag(getByPath<boolean>(data, "default_for_network")) },
    ],
    extraTabs: ({ data }) => {
      const all = (getByPath<SgRule[]>(data, "rules") ?? []) as SgRule[];
      const ingress = all.filter((r) => (r.direction ?? "INGRESS").toUpperCase() === "INGRESS");
      const egress = all.filter((r) => (r.direction ?? "").toUpperCase() === "EGRESS");
      return [
        { id: "ingress", label: "Входящий трафик", count: ingress.length, render: () => <RulesTable rules={ingress} /> },
        { id: "egress", label: "Исходящий трафик", count: egress.length, render: () => <RulesTable rules={egress} /> },
      ];
    },
  },

  addresses: {
    overviewExtra: ({ data }) => {
      const info = addressInfo(data);
      return [
        { label: "IP-адрес", value: mono(info.ip) },
        { label: "Версия", value: txt(info.family) },
        { label: "Вид", value: txt(info.kind) },
        { label: "Используется", value: txt(getByPath<string>(data, "used_by") || "") },
        { label: "Защита от удаления", value: boolTag(getByPath<boolean>(data, "deletion_protection")) },
      ];
    },
  },

  gateways: {
    overviewExtra: ({ data }) => [
      { label: "Тип", value: txt(getByPath<string>(data, "type") || "SHARED_EGRESS_GATEWAY") },
    ],
  },

  "network-interfaces": {
    overviewExtra: ({ data }) => [
      {
        label: "Подсеть",
        value: <RefNameLink specId="subnets" refId={getByPath<string>(data, "subnet_id")} maxChars={42} />,
      },
      { label: "MAC-адрес", value: mono(getByPath<string>(data, "mac_address")) },
      { label: "IPv4-адреса", value: refLinks(getByPath<string[]>(data, "v4_address_ids"), "addresses") },
      { label: "IPv6-адреса", value: refLinks(getByPath<string[]>(data, "v6_address_ids"), "addresses") },
      { label: "Группы безопасности", value: refLinks(getByPath<string[]>(data, "security_group_ids"), "security-groups") },
    ],
  },
};

export function detailExtension(specId: string): DetailExtension | undefined {
  return DETAIL_EXTENSIONS[specId];
}
