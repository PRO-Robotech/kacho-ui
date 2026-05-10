// Реестр ресурсов: метаданные для generic ListPage / DetailPage / Create-Edit.
// Scope: 7 ресурсов verbatim YC proto.
// apiPath содержит полный путь с доменным префиксом (verbatim из proto google.api.http annotations).

import type { ReactNode } from "react";
import type { FormField } from "./form-schema";
import { setByPath } from "./path";
import { CopyableId } from "@/components/CopyableId";
import { CopyableName } from "@/components/CopyableName";
import { RefNameLink } from "@/components/RefNameLink";
import { LabelsCell } from "@/components/LabelsCell";
import { StatusBadge } from "@/components/StatusBadge";

export interface ResourceColumn {
  header: string;
  // Путь в плоском объекте: "name", "status", "zone_id"
  path: string;
  format?: "text" | "uid-short" | "datetime" | "status" | "code" | "list";
  className?: string;
  render?: (row: Record<string, unknown>) => ReactNode;
}

export interface ResourceSpec {
  id: string;
  // route path в SPA (без leading slash)
  route: string;
  // Полный URL-path для REST: /<domain>/v1/<plural>
  // Verbatim из proto google.api.http annotations.
  apiPath: string;
  // ключ массива в List response: "networks", "organizations"
  payloadKey: string;
  // singular label для UI
  singular: string;
  // plural label
  plural: string;
  description?: string;
  /** Service-domain заголовок (отображается в breadcrumb перед именем категории).
   *  Примеры: "Virtual Private Cloud", "Resource Manager", "Администрирование". */
  serviceTitle?: string;
  // global = cluster-scoped, folder = только в выбранном folder
  scope: "global" | "folder";
  // поддерживаемые операции
  ops: {
    create: boolean;
    update: boolean;
    delete: boolean;
    restart?: boolean;
    start?: boolean;
    stop?: boolean;
  };
  // колонки для list-таблицы
  columns: ResourceColumn[];
  // schema полей формы (если undefined — fallback к JSON-editor)
  fields?: FormField[];
  // Path-template для drill-down link при клике на строку (плейсхолдер `:id`).
  // Если задан — кнопка в строке ведёт сюда вместо DetailPage. Используется
  // для иерархического drill-flow Org → Clouds → Folders → VPC.
  childRoute?: string;
  // skeleton-объект для Create-формы
  template: (ctx: { folderId?: string; cloudId?: string; organizationId?: string }) => unknown;
  // Опциональная нормализация payload перед отправкой на API.
  // Используется для конвертации form-internal представления (wrapper-объекты, toggle-поля)
  // в wire format (plain arrays, oneof etc.).
  sanitize?: (obj: Record<string, unknown>) => Record<string, unknown>;
}

// Pool kinds — соответствуют proto enum AddressPoolKind.
const POOL_KINDS = [
  { value: "EXTERNAL_PUBLIC", label: "EXTERNAL_PUBLIC" },
  { value: "EXTERNAL_TEST", label: "EXTERNAL_TEST" },
  { value: "RESERVED_INTERNAL", label: "RESERVED_INTERNAL" },
];

// Общие колонки
const COL_NAME: ResourceColumn = {
  header: "Name",
  path: "name",
  format: "text",
  className: "font-medium",
};
const COL_CREATED: ResourceColumn = {
  header: "Created",
  path: "created_at",
  format: "datetime",
};
const COL_ID: ResourceColumn = {
  header: "ID",
  path: "id",
  format: "uid-short",
};

// Strict — для resource-manager/organization-manager (Cloud, Folder, Organization).
// Совпадает с backend validate.Name (verbatim YC `/[a-z]([-a-z0-9]{0,61}[a-z0-9])?/`).
const FIELD_NAME: FormField = {
  name: "name",
  label: "Name",
  type: "string",
  required: true,
  placeholder: "my-resource",
  description: "Lowercase, цифры, дефисы. Начинается с буквы, длина 2..63.",
  pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$",
};

// Permissive — для VPC ресурсов (Network/Subnet/Address/RouteTable).
// Совпадает с backend validate.NameVPC (verbatim YC `/|[a-zA-Z]([-_a-zA-Z0-9]{0,61}[a-zA-Z0-9])?/`).
// YC принимает empty / uppercase / underscore — UI не должен блокировать заранее.
const FIELD_NAME_VPC: FormField = {
  name: "name",
  label: "Name",
  type: "string",
  placeholder: "my-network",
  description: "Буквы (любой регистр), цифры, `-`, `_`. Начинается с буквы, длина до 63. Можно оставить пустым.",
  pattern: "^([a-zA-Z]([-_a-zA-Z0-9]{0,61}[a-zA-Z0-9])?)?$",
};

const FIELD_DESCRIPTION: FormField = {
  name: "description",
  label: "Description",
  type: "text",
  rows: 2,
};

// Hidden поля для folder-context
const FIELD_FOLDER_ID: FormField = {
  name: "folder_id",
  label: "Folder",
  type: "string",
  hidden: true,
};

export const REGISTRY: Record<string, ResourceSpec> = {
  // ====== organization-manager ======
  // proto: GET /organization-manager/v1/organizations

  organizations: {
    id: "organizations",
    route: "organizations",
    apiPath: "/organization-manager/v1/organizations",
    payloadKey: "organizations",
    singular: "Organization",
    plural: "Organizations",
    description: "Корневой уровень иерархии ресурсов Kachō.",
    serviceTitle: "Resource Manager",
    scope: "global",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      { header: "Title", path: "title", format: "text" },
      COL_CREATED,
      COL_ID,
    ],
    fields: [
      FIELD_NAME,
      { name: "title", label: "Title", type: "string", placeholder: "My Organization" },
      FIELD_DESCRIPTION,
    ],
    childRoute: "/organizations/:id/clouds",
    template: () => ({ name: "", title: "", description: "" }),
  },

  // ====== resource-manager ======
  // proto: GET /resource-manager/v1/clouds

  clouds: {
    id: "clouds",
    route: "clouds",
    apiPath: "/resource-manager/v1/clouds",
    payloadKey: "clouds",
    singular: "Cloud",
    plural: "Clouds",
    description: "Billing-scope внутри Organization.",
    serviceTitle: "Resource Manager",
    scope: "global",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      { header: "Org", path: "organization_id", format: "uid-short" },
      COL_CREATED,
      COL_ID,
    ],
    fields: [
      FIELD_NAME,
      {
        name: "organization_id",
        label: "Organization",
        type: "ref",
        refResource: "organizations",
        required: true,
      },
      FIELD_DESCRIPTION,
    ],
    childRoute: "/clouds/:id/folders",
    template: ({ organizationId }) => ({
      name: "",
      organization_id: organizationId ?? "",
      description: "",
    }),
  },

  // proto: GET /resource-manager/v1/folders

  folders: {
    id: "folders",
    route: "folders",
    apiPath: "/resource-manager/v1/folders",
    payloadKey: "folders",
    singular: "Folder",
    plural: "Folders",
    description: "Isolation-scope для domain-ресурсов.",
    serviceTitle: "Resource Manager",
    scope: "global",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      { header: "Cloud", path: "cloud_id", format: "uid-short" },
      { header: "Status", path: "status", format: "status" },
      COL_CREATED,
      COL_ID,
    ],
    fields: [
      FIELD_NAME,
      {
        name: "cloud_id",
        label: "Cloud",
        type: "ref",
        refResource: "clouds",
        required: true,
      },
      FIELD_DESCRIPTION,
    ],
    // Folder drill-down → /folders/:id; FolderDefaultRedirect там перебрасывает
    // дальше на /folders/:id/networks (первый VPC-ресурс).
    childRoute: "/folders/:id",
    template: ({ cloudId }) => ({
      name: "",
      cloud_id: cloudId ?? "",
      description: "",
    }),
  },

  // ====== vpc ======
  // proto: GET /vpc/v1/networks

  networks: {
    id: "networks",
    route: "networks",
    apiPath: "/vpc/v1/networks",
    payloadKey: "networks",
    singular: "Network",
    plural: "Облачные сети",
    description: "VPC Networks.",
    serviceTitle: "Virtual Private Cloud",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      {
        header: "Имя",
        path: "name",
        render: (row) => <CopyableName name={(row.name as string) ?? ""} fallback={row.id as string} />,
      },
      {
        header: "Идентификатор",
        path: "id",
        render: (row) => <CopyableId id={(row.id as string) ?? ""} />,
      },
      {
        header: "Описание",
        path: "description",
        format: "text",
      },
      {
        header: "Группа безопасности по умолчанию",
        path: "default_security_group_id",
        render: (row) => (
          <RefNameLink
            specId="security-groups"
            refId={row.default_security_group_id as string | undefined}
            maxChars={42}
          />
        ),
      },
      {
        header: "Статус",
        path: "status",
        render: (row) => <StatusBadge state={row.status as string | undefined} />,
      },
      {
        header: "Дата создания",
        path: "created_at",
        format: "datetime",
      },
      {
        header: "Метки",
        path: "labels",
        render: (row) => (
          <LabelsCell labels={row.labels as Record<string, string> | undefined} />
        ),
      },
    ],
    fields: [
      FIELD_NAME_VPC,
      FIELD_DESCRIPTION,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      description: "",
      labels: {},
    }),
  },

  // proto: GET /vpc/v1/subnets

  subnets: {
    id: "subnets",
    route: "subnets",
    apiPath: "/vpc/v1/subnets",
    payloadKey: "subnets",
    singular: "Subnet",
    plural: "Подсети",
    description: "VPC Subnets (folder-scoped).",
    serviceTitle: "Virtual Private Cloud",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      {
        header: "Имя",
        path: "name",
        render: (row) => <CopyableName name={(row.name as string) ?? ""} fallback={row.id as string} />,
      },
      {
        header: "Идентификатор",
        path: "id",
        render: (row) => <CopyableId id={(row.id as string) ?? ""} />,
      },
      {
        header: "Сеть",
        path: "network_id",
        render: (row) => (
          <RefNameLink specId="networks" refId={row.network_id as string | undefined} />
        ),
      },
      {
        header: "Описание",
        path: "description",
        format: "text",
      },
      {
        header: "IPv4 CIDR",
        path: "v4_cidr_blocks",
        format: "list",
      },
      {
        header: "IPv6 CIDR",
        path: "v6_cidr_blocks",
        format: "list",
      },
      {
        header: "Зона доступности",
        path: "zone_id",
        format: "text",
      },
      {
        header: "Статус",
        path: "status",
        render: (row) => <StatusBadge state={row.status as string | undefined} />,
      },
      {
        header: "Метки",
        path: "labels",
        render: (row) => (
          <LabelsCell labels={row.labels as Record<string, string> | undefined} />
        ),
      },
      {
        header: "Таблица маршрутизации",
        path: "route_table_id",
        render: (row) => (
          <RefNameLink
            specId="route-tables"
            refId={row.route_table_id as string | undefined}
            asTag
          />
        ),
      },
    ],
    fields: [
      FIELD_NAME_VPC,
      {
        name: "network_id",
        label: "Network",
        type: "ref",
        refResource: "networks",
        refFolderScoped: true,
        required: true,
        immutable: true, // backend: applySubnetMask immutable check
      },
      {
        name: "zone_id",
        label: "Zone",
        type: "ref",
        refResource: "zones",
        required: true,
        immutable: true,
      },
      {
        name: "v4_cidr_blocks",
        label: "IPv4 CIDR Blocks",
        type: "array",
        itemLabel: "CIDR",
        description: "Массив IPv4 CIDR-блоков (RFC 1918).",
        immutable: true,
        // В Edit поле не показывается — после Create управляется через
        // SubnetCidrManager на DetailPage (verbs :add-cidr-blocks /
        // :remove-cidr-blocks). См. YC verbatim Subnet docs.
        editHidden: true,
        newItem: () => ({ value: "10.0.0.0/24" }),
        itemFields: [
          {
            name: "value",
            label: "CIDR",
            type: "string",
            required: true,
            placeholder: "10.0.0.0/24",
          },
        ],
      },
      {
        name: "route_table_id",
        label: "Route Table",
        type: "ref",
        refResource: "route-tables",
        refFolderScoped: true,
        placeholder: "— без таблицы —",
        description: "Опционально. Если задано, маршрутизация подсети идёт через этот RT.",
      },
      FIELD_DESCRIPTION,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      network_id: "",
      zone_id: "",
      v4_cidr_blocks: [{ value: "10.0.0.0/24" }],
      description: "",
    }),
    // Конвертирует [{value: "10.0.0.0/24"}, ...] → ["10.0.0.0/24", ...] для wire format.
    sanitize: (obj) => {
      const raw = obj["v4_cidr_blocks"];
      if (Array.isArray(raw)) {
        obj = {
          ...obj,
          v4_cidr_blocks: raw.map((item) =>
            typeof item === "object" && item !== null && "value" in (item as object)
              ? (item as Record<string, unknown>)["value"]
              : item
          ),
        };
      }
      return obj;
    },
  },

  // proto: GET /vpc/v1/addresses

  addresses: {
    id: "addresses",
    route: "addresses",
    apiPath: "/vpc/v1/addresses",
    payloadKey: "addresses",
    singular: "Address",
    plural: "Публичные IP-адреса",
    serviceTitle: "Virtual Private Cloud",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      {
        header: "Имя",
        path: "name",
        render: (row) => <CopyableName name={(row.name as string) ?? ""} fallback={row.id as string} />,
      },
      {
        header: "Идентификатор",
        path: "id",
        render: (row) => <CopyableId id={(row.id as string) ?? ""} />,
      },
      {
        header: "IP-адрес",
        path: "external_ipv4_address.address",
        render: (row) => {
          const ext = (row.external_ipv4_address as { address?: string } | undefined)?.address;
          const int = (row.internal_ipv4_address as { address?: string } | undefined)?.address;
          const ip = ext || int;
          if (!ip) return <span className="text-muted-foreground">—</span>;
          return <span className="font-mono text-xs">{ip}</span>;
        },
      },
      {
        header: "Используется",
        path: "used",
        render: (row) => (row.used ? "Да" : <span className="text-muted-foreground">Нет</span>),
      },
      {
        header: "Версия",
        path: "ip_version",
        render: (row) => {
          const v = (row.ip_version as string | undefined) ?? "";
          if (!v) return <span className="text-muted-foreground">—</span>;
          // IPV4 / IPV6 / IP_VERSION_UNSPECIFIED
          return v.replace(/^IP_VERSION_/, "").replace(/^IPV/, "IPv");
        },
      },
      {
        header: "Вид",
        path: "type",
        render: (row) => {
          const t = (row.type as string | undefined) ?? "";
          if (t === "EXTERNAL") return "Публичный";
          if (t === "INTERNAL") return "Внутренний";
          return <span className="text-muted-foreground">—</span>;
        },
      },
      {
        header: "Защита от DDoS-атак",
        path: "external_ipv4_address.requirements.ddos_protection_provider",
        render: (row) => {
          const ext = row.external_ipv4_address as
            | { requirements?: { ddos_protection_provider?: string } }
            | undefined;
          const provider = ext?.requirements?.ddos_protection_provider;
          if (!provider) return <span className="text-muted-foreground">—</span>;
          return provider;
        },
      },
      {
        header: "Защита от удаления",
        path: "deletion_protection",
        render: (row) =>
          row.deletion_protection ? "Да" : <span className="text-muted-foreground">Нет</span>,
      },
      {
        header: "Ресурс",
        path: "references",
        render: (row) => {
          const refs = (row.references as Array<{ type?: string; referrer?: string }> | undefined) ?? [];
          if (refs.length === 0) return <span className="text-muted-foreground">—</span>;
          const r = refs[0];
          return (
            <span className="text-xs">
              {r.type ? `${r.type}: ` : ""}
              <span className="font-mono">{r.referrer ?? "—"}</span>
              {refs.length > 1 ? ` +${refs.length - 1}` : ""}
            </span>
          );
        },
      },
      {
        header: "Дата создания",
        path: "created_at",
        format: "datetime",
      },
      {
        header: "Метки",
        path: "labels",
        render: (row) => (
          <LabelsCell labels={row.labels as Record<string, string> | undefined} />
        ),
      },
    ],
    fields: [
      FIELD_NAME_VPC,
      {
        name: "_address_kind",
        label: "Address Kind",
        type: "enum",
        required: true,
        default: "external",
        description: "External — публичный IP; Internal — внутри subnet.",
        options: [
          { value: "external", label: "External IPv4" },
          { value: "internal", label: "Internal IPv4" },
        ],
      },
      // External fields — видны только при _address_kind=external (oneof активная ветка).
      {
        name: "external_ipv4_address_spec.zone_id",
        label: "Zone (External)",
        type: "ref",
        refResource: "zones",
        description: "Зона для External IP. Оставьте address пустым для auto-allocation.",
        visibleWhen: { field: "_address_kind", equals: "external" },
      },
      {
        name: "external_ipv4_address_spec.address",
        label: "Address (External, необязательно)",
        type: "string",
        placeholder: "пусто = auto-allocated",
        description: "Если пусто — адрес выделяется автоматически.",
        visibleWhen: { field: "_address_kind", equals: "external" },
      },
      // Internal fields — видны только при _address_kind=internal.
      {
        name: "internal_ipv4_address_spec.subnet_id",
        label: "Subnet (Internal)",
        type: "ref",
        refResource: "subnets",
        refFolderScoped: true,
        description: "Subnet для Internal IP. Адрес выделяется автоматически.",
        visibleWhen: { field: "_address_kind", equals: "internal" },
      },
      {
        name: "internal_ipv4_address_spec.address",
        label: "Address (Internal, необязательно)",
        type: "string",
        placeholder: "пусто = auto-allocated",
        description: "Если пусто — адрес выделяется из subnet автоматически.",
        visibleWhen: { field: "_address_kind", equals: "internal" },
      },
      {
        name: "deletion_protection",
        label: "Deletion Protection",
        type: "bool",
        default: false,
      },
      FIELD_DESCRIPTION,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      description: "",
      _address_kind: "external",
      external_ipv4_address_spec: { zone_id: "", address: "" },
      deletion_protection: false,
    }),
    // Убирает поле-переключатель _address_kind и неактивный oneof из payload.
    sanitize: (obj) => {
      const kind = obj["_address_kind"];
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k === "_address_kind") continue;
        if (k === "external_ipv4_address_spec" && kind !== "external") continue;
        if (k === "internal_ipv4_address_spec" && kind !== "internal") continue;
        result[k] = v;
      }
      return result;
    },
  },

  // proto: GET /vpc/v1/routeTables (YC использует camelCase в URL)

  "route-tables": {
    id: "route-tables",
    route: "route-tables",
    apiPath: "/vpc/v1/routeTables",
    payloadKey: "route_tables",
    singular: "Route Table",
    plural: "Таблицы маршрутизации",
    serviceTitle: "Virtual Private Cloud",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      { header: "Network", path: "network_id", format: "uid-short" },
      COL_CREATED,
      COL_ID,
    ],
    fields: [
      FIELD_NAME_VPC,
      {
        name: "network_id",
        label: "Network",
        type: "ref",
        refResource: "networks",
        refFolderScoped: true,
        required: true,
      },
      {
        name: "static_routes",
        label: "Static Routes",
        type: "array",
        itemLabel: "Route",
        description: "Full-replace при Update.",
        newItem: () => ({ destination_prefix: "10.10.0.0/16", next_hop_address: "10.0.0.1" }),
        itemFields: [
          {
            name: "destination_prefix",
            label: "Destination CIDR",
            type: "string",
            required: true,
            placeholder: "10.10.0.0/16",
          },
          {
            name: "next_hop_address",
            label: "Next Hop",
            type: "string",
            required: true,
            placeholder: "10.0.0.1",
          },
        ],
      },
      FIELD_DESCRIPTION,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      network_id: "",
      description: "",
      static_routes: [],
    }),
  },

  // proto: GET /vpc/v1/securityGroups (YC использует camelCase в URL)

  "security-groups": {
    id: "security-groups",
    route: "security-groups",
    apiPath: "/vpc/v1/securityGroups",
    payloadKey: "security_groups",
    singular: "Security Group",
    plural: "Группы безопасности",
    description: "VPC Security Groups (folder-scoped, привязаны к Network).",
    serviceTitle: "Virtual Private Cloud",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      { header: "Network", path: "network_id", format: "uid-short" },
      { header: "Status", path: "status", format: "status" },
      { header: "Default", path: "default_for_network", format: "text" },
      COL_CREATED,
      COL_ID,
    ],
    fields: [
      FIELD_NAME_VPC,
      {
        name: "network_id",
        label: "Network",
        type: "ref",
        refResource: "networks",
        refFolderScoped: true,
        required: true,
      },
      FIELD_DESCRIPTION,
      {
        name: "rules",
        label: "Rules",
        type: "sg-rules",
        description: "Direction + protocol/ports + target (cidr | другая SG | predefined). Без правил — default-deny.",
      },
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      network_id: "",
      description: "",
      rules: [],
    }),
    // Чистит UI-дискриминаторы (_protocol_mode/_ports_any/_target_kind) и
    // неактивные ветки oneof перед PATCH/POST. См. SgRulesEditor.
    sanitize: (obj) => {
      const raw = obj["rules"];
      if (!Array.isArray(raw)) return obj;
      const clean = raw.map((r) => sanitizeSgRule(r as Record<string, unknown>));
      return { ...obj, rules: clean };
    },
  },

  // ====== System (kacho-only admin: Region / Zone / AddressPool) ======
  // НЕ verbatim-YC: эти ресурсы exposed через apiGW REST для admin UI.
  // На external TLS endpoint (yc CLI compat) НЕ публикуются — см. kacho-vpc CLAUDE.md.
  // Sync RPC (без Operation envelope), backend handler возвращает ресурс напрямую.

  regions: {
    id: "regions",
    route: "regions",
    apiPath: "/vpc/v1/regions",
    payloadKey: "regions",
    singular: "Region",
    plural: "Регионы",
    description: "Глобальные регионы инфраструктуры. Admin-only.",
    serviceTitle: "Администрирование",
    scope: "global",
    ops: { create: true, update: true, delete: true },
    columns: [
      { header: "ID", path: "id", format: "text", className: "font-mono" },
      { header: "Name", path: "name", format: "text" },
      COL_CREATED,
    ],
    fields: [
      {
        name: "id",
        label: "Region ID",
        type: "string",
        required: true,
        immutable: true,
        placeholder: "ru-central1",
        description: "Lower-snake-kebab. Immutable PK.",
        pattern: "^[a-z][a-z0-9-]*$",
      },
      { name: "name", label: "Name", type: "string", placeholder: "Russia Central 1" },
    ],
    template: () => ({ id: "", name: "" }),
  },

  zones: {
    id: "zones",
    route: "zones",
    apiPath: "/vpc/v1/zones",
    payloadKey: "zones",
    singular: "Zone",
    plural: "Зоны",
    description: "Зоны доступности внутри Region. Admin-only.",
    serviceTitle: "Администрирование",
    scope: "global",
    ops: { create: true, update: true, delete: true },
    columns: [
      { header: "ID", path: "id", format: "text", className: "font-mono" },
      { header: "Region", path: "region_id", format: "text" },
      { header: "Name", path: "name", format: "text" },
      COL_CREATED,
    ],
    fields: [
      {
        name: "id",
        label: "Zone ID",
        type: "string",
        required: true,
        immutable: true,
        placeholder: "ru-central1-a",
        pattern: "^[a-z][a-z0-9-]*$",
      },
      {
        name: "region_id",
        label: "Region",
        type: "ref",
        refResource: "regions",
        required: true,
        immutable: true,
      },
      { name: "name", label: "Name", type: "string", placeholder: "Zone A" },
    ],
    template: () => ({ id: "", region_id: "", name: "" }),
  },

  "address-pools": {
    id: "address-pools",
    route: "address-pools",
    apiPath: "/vpc/v1/addressPools",
    payloadKey: "pools",
    singular: "Address Pool",
    plural: "Пулы адресов",
    description: "Глобальные пулы внешних IP. Admin-only. Привязка к Zone опциональна (NULL = global default).",
    serviceTitle: "Администрирование",
    scope: "global",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      { header: "Kind", path: "kind", format: "text" },
      { header: "Zone", path: "zone_id", format: "text" },
      { header: "CIDRs", path: "cidr_blocks", format: "list" },
      { header: "Default", path: "is_default", format: "text" },
      { header: "Selector", path: "selector_labels", format: "code" },
      COL_ID,
    ],
    fields: [
      {
        name: "name",
        label: "Name",
        type: "string",
        placeholder: "default-zone-a",
      },
      { name: "description", label: "Description", type: "text", rows: 2 },
      {
        name: "kind",
        label: "Kind",
        type: "enum",
        options: POOL_KINDS,
        required: true,
        default: "EXTERNAL_PUBLIC",
        immutable: true,
      },
      {
        name: "zone_id",
        label: "Zone",
        type: "ref",
        refResource: "zones",
        immutable: true,
        description: "Опционально. Если пусто — глобальный пул (fallback).",
      },
      {
        name: "cidr_blocks",
        label: "CIDR Blocks",
        type: "array",
        itemLabel: "CIDR",
        description: "IPv4 CIDR-блоки, из которых аллоцируются адреса.",
        newItem: () => ({ value: "198.51.100.0/24" }),
        itemFields: [
          {
            name: "value",
            label: "CIDR",
            type: "string",
            required: true,
            placeholder: "198.51.100.0/24",
          },
        ],
      },
      {
        name: "is_default",
        label: "Default for zone+kind",
        type: "bool",
        default: false,
        description: "Один is_default=true на (zone, kind).",
      },
      {
        name: "selector_priority",
        label: "Selector priority",
        type: "int",
        default: 0,
        description: "Tie-break при равенстве specificity. Higher wins.",
      },
    ],
    template: () => ({
      name: "",
      description: "",
      kind: "EXTERNAL_PUBLIC",
      zone_id: "",
      cidr_blocks: [{ value: "198.51.100.0/24" }],
      is_default: false,
      selector_priority: 0,
    }),
    // Конвертирует [{value: "..."}, ...] → ["...", ...] для wire format
    // (аналогично subnets.v4_cidr_blocks).
    sanitize: (obj) => {
      const raw = obj["cidr_blocks"];
      if (Array.isArray(raw)) {
        obj = {
          ...obj,
          cidr_blocks: raw.map((item) =>
            typeof item === "object" && item !== null && "value" in (item as object)
              ? (item as Record<string, unknown>)["value"]
              : item
          ),
        };
      }
      return obj;
    },
  },
};

// Экспортирована для тестов.
export function sanitizeSgRule(r: Record<string, unknown>): Record<string, unknown> {
  const protoMode = (r._protocol_mode as string | undefined)
    ?? (r.protocol_name ? "name"
      : typeof r.protocol_number === "number" ? "number"
      : "any");
  const portsAny = typeof r._ports_any === "boolean"
    ? r._ports_any
    : !r.ports;
  const targetKind = (r._target_kind as string | undefined)
    ?? (r.cidr_blocks ? "cidr"
      : r.security_group_id ? "sg"
      : r.predefined_target ? "predefined"
      : "cidr");

  const out: Record<string, unknown> = {};
  // copy non-discriminator persistent fields
  for (const [k, v] of Object.entries(r)) {
    if (k.startsWith("_")) continue;
    out[k] = v;
  }
  // protocol oneof-like
  if (protoMode === "any") {
    delete out.protocol_name;
    delete out.protocol_number;
  } else if (protoMode === "name") {
    delete out.protocol_number;
  } else if (protoMode === "number") {
    delete out.protocol_name;
  }
  // ports
  if (portsAny) {
    delete out.ports;
  }
  // target oneof — оставляем только нужный
  if (targetKind === "cidr") {
    delete out.security_group_id;
    delete out.predefined_target;
  } else if (targetKind === "sg") {
    delete out.cidr_blocks;
    delete out.predefined_target;
  } else if (targetKind === "predefined") {
    delete out.cidr_blocks;
    delete out.security_group_id;
  }
  return out;
}

export function getResource(id: string): ResourceSpec | undefined {
  return REGISTRY[id];
}

export function getByPath<T = unknown>(obj: unknown, path: string): T | undefined {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj) as T | undefined;
}

// applyDefaults — для Create-формы прогоняем все поля и подставляем default-ы
export function applyFieldDefaults(
  fields: FormField[] | undefined,
  obj: Record<string, unknown>,
): Record<string, unknown> {
  if (!fields) return obj;
  let cur = obj;
  for (const f of fields) {
    if (f.type === "string" && f.default !== undefined) {
      cur = setByPath(cur, f.name, getByPath(cur, f.name) ?? f.default);
    } else if (f.type === "int" && f.default !== undefined) {
      cur = setByPath(cur, f.name, getByPath(cur, f.name) ?? f.default);
    } else if (f.type === "enum" && f.default !== undefined) {
      cur = setByPath(cur, f.name, getByPath(cur, f.name) ?? f.default);
    } else if (f.type === "bool" && f.default !== undefined) {
      cur = setByPath(cur, f.name, getByPath(cur, f.name) ?? f.default);
    }
  }
  return cur;
}
