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

export interface ResourceColumn {
  header: string;
  // Путь в плоском объекте: "name", "status", "zone_id"
  path: string;
  format?: "text" | "uid-short" | "datetime" | "status" | "code" | "list" | "references";
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
  /** Path-template для internal/infra-проекции ресурса (плейсхолдер `{id}`).
   *  Если задан — на DetailPage появляется tab "jsonint", который делает
   *  GET <internalGetPath с подставленным {id}> и pretty-print'ит JSON-ответ.
   *  Пример: "/vpc/v1/networks/{id}/internal". Большинство ресурсов его не имеют. */
  internalGetPath?: string;
}

// Pool kinds — UI упрощено до одного типа "External". Backend enum
// AddressPoolKind остаётся (UNSPECIFIED/EXTERNAL_PUBLIC/EXTERNAL_TEST/
// RESERVED_INTERNAL) — мы всегда отправляем EXTERNAL_PUBLIC. EXTERNAL_TEST/
// RESERVED_INTERNAL — legacy/future, скрыты от пользователя.
const POOL_KINDS = [{ value: "EXTERNAL_PUBLIC", label: "External" }];

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

// Compute name-regex — lowercase-only (kacho-compute/CLAUDE.md §5,
// verbatim YC `/|[a-z]([-_a-z0-9]{0,61}[a-z0-9])?/`). НЕ NameVPC (там uppercase ок).
const FIELD_NAME_COMPUTE: FormField = {
  name: "name",
  label: "Name",
  type: "string",
  placeholder: "my-disk",
  description: "Lowercase, цифры, `-`, `_`. Начинается с буквы, длина до 63. Можно оставить пустым.",
  pattern: "^([a-z]([-_a-z0-9]{0,61}[a-z0-9])?)?$",
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

// Generic labels editor — map<string,string> через LabelsEditor (key=value rows
// + "Добавить метку"). Подключается ко всем VPC-ресурсам.
const FIELD_LABELS: FormField = {
  name: "labels",
  label: "Метки",
  type: "labels",
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
      FIELD_LABELS,
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
      FIELD_LABELS,
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
      FIELD_LABELS,
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
    internalGetPath: "/vpc/v1/networks/{id}/internal",
    singular: "Network",
    plural: "Облачные сети",
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
      FIELD_LABELS,
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
        newItem: () => ({ value: "" }),
        itemFields: [
          {
            name: "value",
            label: "CIDR",
            type: "string",
            required: true,
            placeholder: "<ip>/<prefix>",
          },
        ],
      },
      {
        name: "v6_cidr_blocks",
        label: "IPv6 CIDR Blocks",
        type: "array",
        itemLabel: "CIDR",
        description: "Опционально. IPv6 CIDR-блоки подсети.",
        // Показывается и в Create, и в Edit: kacho-proto принимает v6_cidr_blocks
        // в UpdateSubnetRequest (soft-immutable на бэкенде — поле принимается, но
        // изменение значения не применяется; см. applySubnetMask). В Edit-форме
        // редактируемо так же, как остальные mutable-поля; реальное добавление
        // CIDR после создания — через verbs :add-cidr-blocks / :remove-cidr-blocks
        // на DetailPage (как для v4_cidr_blocks).
        newItem: () => ({ value: "" }),
        itemFields: [
          {
            name: "value",
            label: "CIDR",
            type: "string",
            required: true,
            placeholder: "<ipv6>/<prefix>",
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
      FIELD_LABELS,
      FIELD_DESCRIPTION,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      network_id: "",
      zone_id: "",
      // v4_cidr_blocks больше не обязателен при создании (kacho-proto снял
      // (required) с CreateSubnetRequest.v4_cidr_blocks; kacho-vpc допускает
      // подсеть без IPv4 CIDR — добавляется позже через :add-cidr-blocks).
      v4_cidr_blocks: [],
      v6_cidr_blocks: [],
      description: "",
    }),
    // Конвертирует [{value: "10.0.0.0/24"}, ...] → ["10.0.0.0/24", ...] для wire
    // format (для v4_cidr_blocks и v6_cidr_blocks). Пустой список передаётся как
    // [] — оба поля опциональны и на create, и на update (soft-immutable).
    sanitize: (obj) => {
      const out: Record<string, unknown> = { ...obj };
      for (const key of ["v4_cidr_blocks", "v6_cidr_blocks"]) {
        const raw = out[key];
        if (Array.isArray(raw)) {
          out[key] = raw
            .map((item) =>
              typeof item === "object" && item !== null && "value" in (item as object)
                ? (item as Record<string, unknown>)["value"]
                : item,
            )
            .filter((v) => typeof v === "string" && v);
        }
      }
      return out;
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
        // `used_by` — output-only список kacho.cloud.reference.Reference
        // (см. Address.used_by в types.ts). Для эфемерных compute-NIC адресов
        // referrer.type=compute_instance, referrer.id=<instance id>.
        // Generic rendering — format: "references" из spec-columns.tsx.
        header: "Ресурс",
        path: "used_by",
        format: "references",
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
      // Discriminator + spec'ы — create-only (Address spec иммутабелен, см.
      // CLAUDE.md kacho-vpc §4.4). Скрываем в edit-форме.
      {
        name: "_address_kind",
        label: "Address Kind",
        type: "enum",
        required: true,
        default: "external",
        description: "External — публичный IPv4; Internal — IPv4/IPv6 из CIDR подсети.",
        options: [
          { value: "external", label: "External IPv4" },
          { value: "internal", label: "Internal IPv4" },
          { value: "internal_v6", label: "Internal IPv6" },
        ],
        editHidden: true,
      },
      {
        name: "external_ipv4_address_spec.zone_id",
        label: "Zone (External)",
        type: "ref",
        refResource: "zones",
        description: "Зона для External IP. Оставьте address пустым для auto-allocation.",
        visibleWhen: { field: "_address_kind", equals: "external" },
        editHidden: true,
      },
      {
        name: "external_ipv4_address_spec.address",
        label: "Address (External, необязательно)",
        type: "string",
        placeholder: "пусто = auto-allocated",
        description: "Если пусто — адрес выделяется автоматически.",
        visibleWhen: { field: "_address_kind", equals: "external" },
        editHidden: true,
      },
      {
        name: "internal_ipv4_address_spec.subnet_id",
        label: "Subnet (Internal)",
        type: "ref",
        refResource: "subnets",
        refFolderScoped: true,
        description: "Subnet для Internal IP. Адрес выделяется автоматически.",
        visibleWhen: { field: "_address_kind", equals: "internal" },
        editHidden: true,
      },
      {
        name: "internal_ipv4_address_spec.address",
        label: "Address (Internal, необязательно)",
        type: "string",
        placeholder: "пусто = auto-allocated",
        description: "Если пусто — адрес выделяется из subnet автоматически.",
        visibleWhen: { field: "_address_kind", equals: "internal" },
        editHidden: true,
      },
      {
        name: "internal_ipv6_address_spec.subnet_id",
        label: "Subnet (Internal IPv6)",
        type: "ref",
        refResource: "subnets",
        refFolderScoped: true,
        description: "Subnet для Internal IPv6. Адрес выделяется из v6_cidr_blocks подсети.",
        visibleWhen: { field: "_address_kind", equals: "internal_v6" },
        editHidden: true,
      },
      {
        name: "deletion_protection",
        label: "Deletion Protection",
        type: "bool",
        default: false,
      },
      FIELD_LABELS,
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
        if (k === "internal_ipv6_address_spec" && kind !== "internal_v6") continue;
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
        header: "Статические маршруты",
        path: "static_routes",
        render: (row) => {
          const routes = (row.static_routes as Array<{
            destination_prefix?: string;
            next_hop_address?: string;
          }> | undefined) ?? [];
          if (routes.length === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {routes.map((r, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.destination_prefix ?? "?"} → {r.next_hop_address ?? "?"}
                </span>
              ))}
            </div>
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
        newItem: () => ({ destination_prefix: "", next_hop_address: "" }),
        itemFields: [
          {
            name: "destination_prefix",
            label: "Destination CIDR",
            type: "string",
            required: true,
            placeholder: "<ip>/<prefix>",
          },
          {
            name: "next_hop_address",
            label: "Next Hop",
            type: "string",
            required: true,
            placeholder: "<ip-address>",
          },
        ],
      },
      FIELD_LABELS,
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

  // proto: GET /vpc/v1/networkInterfaces — AWS-ENI-подобный ресурс (эпик KAC-2).
  // Публичная проекция: tenant-facing намерение + результат (id/name/привязки/
  // выделенные tenant-адреса/status). Инфра-поля (hv_id/sid/host_iface/...) —
  // только во InternalNetworkInterfaceService, тут не показываются (см. workspace
  // CLAUDE.md §«Инфра-чувствительные данные»). Мутации (Create/Update/Delete/
  // Attach/Detach) async → Operation, как у остальных VPC-ресурсов.

  "network-interfaces": {
    id: "network-interfaces",
    route: "network-interfaces",
    apiPath: "/vpc/v1/networkInterfaces",
    payloadKey: "network_interfaces",
    internalGetPath: "/vpc/v1/networkInterfaces/{id}/internal",
    singular: "Network Interface",
    plural: "Сетевые интерфейсы",
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
        header: "Подсеть",
        path: "subnet_id",
        render: (row) => (
          <RefNameLink specId="subnets" refId={row.subnet_id as string | undefined} />
        ),
      },
      {
        // NIC теперь ссылается на Address-ресурсы по id (v4_address_ids).
        // Здесь — компактно число привязанных IPv4-адресов; сами адреса
        // (с IP-значением) видны на DetailPage / в ресурсе Address.
        header: "IPv4-адреса",
        path: "v4_address_ids",
        render: (row) => {
          const ids = row.v4_address_ids as string[] | undefined;
          const n = Array.isArray(ids) ? ids.length : 0;
          return n > 0 ? <span className="font-mono text-xs">{n}</span> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        header: "IPv6-адреса",
        path: "v6_address_ids",
        render: (row) => {
          const ids = row.v6_address_ids as string[] | undefined;
          const n = Array.isArray(ids) ? ids.length : 0;
          return n > 0 ? <span className="font-mono text-xs">{n}</span> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        header: "Статус",
        path: "status",
        format: "status",
      },
      {
        // `used_by` — output-only kacho.cloud.reference.Reference, заполняется
        // когда compute-инстанс присоединяет NIC ({referrer:{type:"compute_instance",
        // id:"<instance id>"}, type:"USED_BY"}). instance_id у NIC больше нет.
        header: "Используется",
        path: "used_by",
        render: (row) => {
          const ub = row.used_by as
            | { referrer?: { type?: string; id?: string } }
            | undefined;
          const ref = ub?.referrer;
          if (!ref?.id) return <span className="text-muted-foreground">—</span>;
          if (ref.type === "compute_instance") {
            return <RefNameLink specId="compute-instances" refId={ref.id} asTag />;
          }
          return <span className="font-mono text-xs">{ref.type ?? "?"}: {ref.id}</span>;
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
        name: "subnet_id",
        label: "Подсеть",
        type: "ref",
        refResource: "subnets",
        refFolderScoped: true,
        required: true,
        immutable: true,
        description: "Subnet, в которой создаётся интерфейс. Менять нельзя после создания.",
      },
      // NIC ссылается на Address-ресурсы по id (модель KAC-2/KAC-7): NIC
      // больше не хранит IP-строки, а держит список id внутренних Address'ов
      // из своей подсети. Здесь — ref-list на ресурс `addresses`, отфильтрованный
      // по subnet_id формы (GET /vpc/v1/addresses?subnet_id=<form.subnet_id>),
      // с «+ Создать адрес» прямо в дропдауне (InlineResourceCreateForm
      // с pre-filled internal_ipv4_address_spec.subnet_id — «создать» = «выделить
      // IPv4 из CIDR этой подсети»). На success id появляется в списке.
      {
        name: "v4_address_ids",
        label: "IPv4-адреса (Address-ресурсы)",
        type: "array",
        itemLabel: "Address",
        description: "Опционально. Address-ресурсы из выбранной подсети. Можно создать новый прямо в дропдауне.",
        newItem: () => ({ value: "" }),
        itemFields: [
          {
            name: "value",
            label: "Address",
            type: "ref",
            refResource: "addresses",
            required: true,
            // `addresses` ресурс folder-scoped — ListAddressesRequest.folder_id
            // (required). RefSelect авто-добавляет ?folder_id=<folder-context>;
            // refQueryFromField докидывает &subnet_id=<form.subnet_id> сверху.
            // Итог: GET /vpc/v1/addresses?folder_id=<folder>&subnet_id=<subnet>.
            refFolderScoped: true,
            refQueryFromField: { param: "subnet_id", field: "subnet_id" },
            createResource: "addresses",
            createTitle: "Выделить IPv4-адрес из подсети",
            createPresetFields: (form) => ({
              _address_kind: "internal",
              "internal_ipv4_address_spec.subnet_id": form["subnet_id"] ?? "",
            }),
          },
        ],
      },
      {
        name: "v6_address_ids",
        label: "IPv6-адреса (Address-ресурсы)",
        type: "array",
        itemLabel: "Address",
        description: "Опционально. IPv6 Address-ресурсы из выбранной подсети. Можно создать новый прямо в дропдауне.",
        newItem: () => ({ value: "" }),
        itemFields: [
          {
            name: "value",
            label: "Address",
            type: "ref",
            refResource: "addresses",
            required: true,
            // см. комментарий у v4_address_ids — folder-scoped + subnet_id-фильтр.
            refFolderScoped: true,
            refQueryFromField: { param: "subnet_id", field: "subnet_id" },
            createResource: "addresses",
            createTitle: "Выделить IPv6-адрес из подсети",
            createPresetFields: (form) => ({
              _address_kind: "internal_v6",
              "internal_ipv6_address_spec.subnet_id": form["subnet_id"] ?? "",
            }),
          },
        ],
      },
      // TODO(KAC-7): инициализировать default-значением из
      // subnet → network.default_security_group_id (при смене subnet_id:
      // GET /vpc/v1/subnets/<id> → networkId → GET /vpc/v1/networks/<id> →
      // defaultSecurityGroupId). Generic-форма не поддерживает динамический
      // default от другого поля — отложено.
      // TODO(KAC-7): SG-create pre-fill сетью, разрешённой subnet_id формы,
      // требует dependent-lookup subnet_id → subnet.network_id — generic-форма
      // его не умеет; пока в SG-create-форме сеть выбирает пользователь.
      {
        name: "security_group_ids",
        label: "Группы безопасности",
        type: "array",
        itemLabel: "SG",
        description: "Опционально. Если не задано — действует SG по умолчанию для сети. Можно создать новую группу прямо в дропдауне.",
        newItem: () => ({ value: "" }),
        itemFields: [
          {
            name: "value",
            label: "Security Group",
            type: "ref",
            refResource: "security-groups",
            refFolderScoped: true,
            required: true,
            createResource: "security-groups",
            createTitle: "Создать группу безопасности",
          },
        ],
      },
      FIELD_LABELS,
      FIELD_DESCRIPTION,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      subnet_id: "",
      v4_address_ids: [],
      v6_address_ids: [],
      security_group_ids: [],
      description: "",
      labels: {},
    }),
    // Конвертирует [{value: "..."}, ...] → ["...", ...] для wire format
    // (как subnets.v4_cidr_blocks / instance NIC security_group_ids).
    sanitize: (obj) => {
      const out: Record<string, unknown> = { ...obj };
      for (const key of ["v4_address_ids", "v6_address_ids", "security_group_ids"]) {
        const raw = out[key];
        if (Array.isArray(raw)) {
          out[key] = raw
            .map((item) =>
              typeof item === "object" && item !== null && "value" in (item as object)
                ? (item as Record<string, unknown>)["value"]
                : item,
            )
            .filter((v) => typeof v === "string" && v);
        }
      }
      return out;
    },
  },

  // proto: GET /vpc/v1/securityGroups (YC использует camelCase в URL)

  "security-groups": {
    id: "security-groups",
    route: "security-groups",
    apiPath: "/vpc/v1/securityGroups",
    payloadKey: "security_groups",
    singular: "Security Group",
    plural: "Группы безопасности",
    serviceTitle: "Virtual Private Cloud",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      {
        header: "Network",
        path: "network_id",
        // network_id у SG теперь опционален (kacho-proto снял (required) с
        // CreateSecurityGroupRequest.network_id; kacho-vpc допускает SG без сети).
        render: (row) => {
          const nid = row.network_id as string | undefined;
          return nid ? <RefNameLink specId="networks" refId={nid} asTag /> : <span className="text-muted-foreground">—</span>;
        },
      },
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
        // Опционально: SG можно создать без привязки к сети (kacho-vpc).
        placeholder: "— без сети —",
        description: "Опционально. Если не задано — группа безопасности не привязана к сети.",
      },
      FIELD_LABELS,
      FIELD_DESCRIPTION,
      {
        name: "rules",
        label: "Rules",
        type: "sg-rules",
        description: "Direction + protocol/ports + target (cidr | другая SG | predefined). Без правил — default-deny.",
        // В Update RPC backend ждёт `rule_specs`, не `rules` (verbatim YC).
        // В edit-форме скрываем — правила меняются через спец-RPC UpdateRules /
        // UpdateRule на отдельной вкладке.
        editHidden: true,
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
    // Пустой network_id выбрасываем — SG может быть без привязки к сети.
    sanitize: (obj) => {
      const out: Record<string, unknown> = { ...obj };
      if (!out["network_id"]) delete out["network_id"];
      const raw = out["rules"];
      if (Array.isArray(raw)) {
        out["rules"] = raw.map((r) => sanitizeSgRule(r as Record<string, unknown>));
      }
      return out;
    },
  },

  // proto: GET /vpc/v1/gateways

  gateways: {
    id: "gateways",
    route: "gateways",
    apiPath: "/vpc/v1/gateways",
    payloadKey: "gateways",
    singular: "Gateway",
    plural: "Шлюзы",
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
        header: "Метки",
        path: "labels",
        render: (row) => (
          <LabelsCell labels={row.labels as Record<string, string> | undefined} />
        ),
      },
      COL_CREATED,
    ],
    fields: [
      FIELD_NAME_VPC,
      FIELD_LABELS,
      FIELD_DESCRIPTION,
      // shared_egress_gateway — пока единственный oneof-вариант, без полей.
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      description: "",
      shared_egress_gateway: {},
    }),
  },

  // ====== compute (Disk / Image / Snapshot / Instance) ======
  // proto: GET /compute/v1/{disks|images|snapshots|instances}. Name-regex lowercase-only
  // (kacho-compute/CLAUDE.md §5: `^([a-z]([-_a-z0-9]{0,61}[a-z0-9])?)?$`).

  // disk-types — read-only справочник, используется как refResource в dropdown'ах.
  "disk-types": {
    id: "disk-types",
    route: "disk-types",
    apiPath: "/compute/v1/diskTypes",
    payloadKey: "disk_types",
    singular: "Disk Type",
    plural: "Типы дисков",
    serviceTitle: "Compute Cloud",
    scope: "global",
    ops: { create: false, update: false, delete: false },
    columns: [
      { header: "ID", path: "id", format: "text", className: "font-mono" },
      { header: "Описание", path: "description", format: "text" },
      { header: "Зоны", path: "zone_ids", format: "list" },
    ],
    template: () => ({}),
  },

  // compute-zones — read-only справочник зон. kacho-compute — owner Geography
  // (Region/Zone перенесены из vpc, эпик KAC-15; см. workspace CLAUDE.md
  // §«Кросс-доменные ссылки на ресурсы»). Admin-CRUD — registry-запись `zones`.
  "compute-zones": {
    id: "compute-zones",
    route: "compute-zones",
    apiPath: "/compute/v1/zones",
    payloadKey: "zones",
    singular: "Zone",
    plural: "Зоны (Compute)",
    serviceTitle: "Compute Cloud",
    scope: "global",
    ops: { create: false, update: false, delete: false },
    columns: [
      { header: "ID", path: "id", format: "text", className: "font-mono" },
      { header: "Регион", path: "region_id", format: "text" },
      { header: "Статус", path: "status", format: "status" },
    ],
    template: () => ({}),
  },

  "compute-disks": {
    id: "compute-disks",
    route: "disks",
    apiPath: "/compute/v1/disks",
    payloadKey: "disks",
    singular: "Disk",
    plural: "Диски",
    serviceTitle: "Compute Cloud",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      {
        header: "Имя",
        path: "name",
        render: (row) => <CopyableName name={(row.name as string) ?? ""} fallback={row.id as string} />,
      },
      { header: "Идентификатор", path: "id", render: (row) => <CopyableId id={(row.id as string) ?? ""} /> },
      { header: "Статус", path: "status", format: "status" },
      { header: "Зона", path: "zone_id", format: "text" },
      { header: "Тип", path: "type_id", format: "text" },
      {
        header: "Размер",
        path: "size",
        render: (row) => <span className="font-mono text-xs">{fmtBytesGiB(row.size)}</span>,
      },
      {
        header: "Источник",
        path: "source_image_id",
        render: (row) => {
          const img = row.source_image_id as string | undefined;
          const snap = row.source_snapshot_id as string | undefined;
          if (img) return <RefNameLink specId="compute-images" refId={img} asTag />;
          if (snap) return <RefNameLink specId="compute-snapshots" refId={snap} asTag />;
          return <span className="text-muted-foreground">—</span>;
        },
      },
      {
        header: "Привязан к ВМ",
        path: "instance_ids",
        render: (row) => {
          const ids = (row.instance_ids as string[] | undefined) ?? [];
          if (ids.length === 0) return <span className="text-muted-foreground">—</span>;
          return <RefNameLink specId="compute-instances" refId={ids[0]} asTag />;
        },
      },
      { header: "Дата создания", path: "created_at", format: "datetime" },
      {
        header: "Метки",
        path: "labels",
        render: (row) => <LabelsCell labels={row.labels as Record<string, string> | undefined} />,
      },
    ],
    fields: [
      FIELD_NAME_COMPUTE,
      { name: "zone_id", label: "Зона", type: "ref", refResource: "compute-zones", required: true, immutable: true },
      { name: "type_id", label: "Тип диска", type: "ref", refResource: "disk-types", immutable: true,
        placeholder: "network-ssd (по умолчанию)" },
      { name: "size", label: "Размер (ГиБ)", type: "int", required: true, default: 10, min: 4,
        description: "Минимум — размер источника (image/snapshot), либо 4 ГиБ. В Update только увеличение." },
      {
        name: "_disk_source", label: "Источник", type: "enum", default: "blank",
        description: "Пустой диск, либо клон из образа / снимка.",
        options: [
          { value: "blank", label: "Пустой диск" },
          { value: "image", label: "Из образа" },
          { value: "snapshot", label: "Из снимка" },
        ],
        editHidden: true,
      },
      { name: "image_id", label: "Образ", type: "ref", refResource: "compute-images", refFolderScoped: true,
        visibleWhen: { field: "_disk_source", equals: "image" }, editHidden: true },
      { name: "snapshot_id", label: "Снимок", type: "ref", refResource: "compute-snapshots", refFolderScoped: true,
        visibleWhen: { field: "_disk_source", equals: "snapshot" }, editHidden: true },
      FIELD_LABELS,
      FIELD_DESCRIPTION,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      zone_id: "",
      type_id: "",
      size: 10,
      _disk_source: "blank",
      description: "",
      labels: {},
    }),
    // ГиБ → байты для size; вырезаем _disk_source-дискриминатор и неактивный oneof.
    sanitize: (obj) => {
      const out: Record<string, unknown> = {};
      const src = obj["_disk_source"];
      for (const [k, v] of Object.entries(obj)) {
        if (k === "_disk_source") continue;
        if (k === "image_id" && src !== "image") continue;
        if (k === "snapshot_id" && src !== "snapshot") continue;
        if (k === "size") { out[k] = gibToBytes(v); continue; }
        out[k] = v;
      }
      return out;
    },
  },

  "compute-images": {
    id: "compute-images",
    route: "images",
    apiPath: "/compute/v1/images",
    payloadKey: "images",
    singular: "Image",
    plural: "Образы",
    serviceTitle: "Compute Cloud",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      {
        header: "Имя",
        path: "name",
        render: (row) => <CopyableName name={(row.name as string) ?? ""} fallback={row.id as string} />,
      },
      { header: "Идентификатор", path: "id", render: (row) => <CopyableId id={(row.id as string) ?? ""} /> },
      { header: "Статус", path: "status", format: "status" },
      { header: "Семейство", path: "family", format: "text" },
      {
        header: "Мин. размер диска",
        path: "min_disk_size",
        render: (row) => <span className="font-mono text-xs">{fmtBytesGiB(row.min_disk_size)}</span>,
      },
      {
        header: "ОС",
        path: "os.type",
        render: (row) => {
          const t = (row.os as { type?: string } | undefined)?.type;
          return t ? t : <span className="text-muted-foreground">—</span>;
        },
      },
      { header: "Дата создания", path: "created_at", format: "datetime" },
      {
        header: "Метки",
        path: "labels",
        render: (row) => <LabelsCell labels={row.labels as Record<string, string> | undefined} />,
      },
    ],
    fields: [
      FIELD_NAME_COMPUTE,
      { name: "family", label: "Семейство", type: "string", placeholder: "ubuntu-2204-lts",
        description: "Опционально. Lowercase, 3..63, начинается с буквы.", immutable: true,
        pattern: "^([a-z][-a-z0-9]{1,61}[a-z0-9])?$" },
      {
        name: "_image_source", label: "Источник", type: "enum", default: "disk", required: true,
        options: [
          { value: "disk", label: "Из диска" },
          { value: "snapshot", label: "Из снимка" },
          { value: "image", label: "Из другого образа" },
          { value: "uri", label: "По URI (pre-signed URL)" },
        ],
        editHidden: true,
      },
      { name: "disk_id", label: "Диск", type: "ref", refResource: "compute-disks", refFolderScoped: true,
        visibleWhen: { field: "_image_source", equals: "disk" }, editHidden: true },
      { name: "snapshot_id", label: "Снимок", type: "ref", refResource: "compute-snapshots", refFolderScoped: true,
        visibleWhen: { field: "_image_source", equals: "snapshot" }, editHidden: true },
      { name: "image_id", label: "Исходный образ", type: "ref", refResource: "compute-images", refFolderScoped: true,
        visibleWhen: { field: "_image_source", equals: "image" }, editHidden: true },
      { name: "uri", label: "URI", type: "string", placeholder: "https://...", visibleWhen: { field: "_image_source", equals: "uri" }, editHidden: true },
      { name: "min_disk_size", label: "Мин. размер диска (ГиБ)", type: "int", min: 4,
        description: "Опционально. Если задано — диски из образа не могут быть меньше.", immutable: true },
      FIELD_LABELS,
      FIELD_DESCRIPTION,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      _image_source: "disk",
      description: "",
      labels: {},
    }),
    sanitize: (obj) => {
      const out: Record<string, unknown> = {};
      const src = obj["_image_source"];
      for (const [k, v] of Object.entries(obj)) {
        if (k === "_image_source") continue;
        if (k === "disk_id" && src !== "disk") continue;
        if (k === "snapshot_id" && src !== "snapshot") continue;
        if (k === "image_id" && src !== "image") continue;
        if (k === "uri" && src !== "uri") continue;
        if (k === "min_disk_size") {
          if (v === undefined || v === null || v === "") continue;
          out[k] = gibToBytes(v); continue;
        }
        if (k === "family" && (v === undefined || v === "")) continue;
        out[k] = v;
      }
      return out;
    },
  },

  "compute-snapshots": {
    id: "compute-snapshots",
    route: "snapshots",
    apiPath: "/compute/v1/snapshots",
    payloadKey: "snapshots",
    singular: "Snapshot",
    plural: "Снимки дисков",
    serviceTitle: "Compute Cloud",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      {
        header: "Имя",
        path: "name",
        render: (row) => <CopyableName name={(row.name as string) ?? ""} fallback={row.id as string} />,
      },
      { header: "Идентификатор", path: "id", render: (row) => <CopyableId id={(row.id as string) ?? ""} /> },
      { header: "Статус", path: "status", format: "status" },
      {
        header: "Исходный диск",
        path: "source_disk_id",
        render: (row) => <RefNameLink specId="compute-disks" refId={row.source_disk_id as string | undefined} asTag />,
      },
      {
        header: "Размер диска",
        path: "disk_size",
        render: (row) => <span className="font-mono text-xs">{fmtBytesGiB(row.disk_size)}</span>,
      },
      { header: "Дата создания", path: "created_at", format: "datetime" },
      {
        header: "Метки",
        path: "labels",
        render: (row) => <LabelsCell labels={row.labels as Record<string, string> | undefined} />,
      },
    ],
    fields: [
      FIELD_NAME_COMPUTE,
      { name: "disk_id", label: "Исходный диск", type: "ref", refResource: "compute-disks", refFolderScoped: true,
        required: true, immutable: true },
      FIELD_LABELS,
      FIELD_DESCRIPTION,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      disk_id: "",
      description: "",
      labels: {},
    }),
  },

  "compute-instances": {
    id: "compute-instances",
    route: "instances",
    apiPath: "/compute/v1/instances",
    payloadKey: "instances",
    singular: "Instance",
    plural: "Виртуальные машины",
    serviceTitle: "Compute Cloud",
    scope: "folder",
    ops: { create: true, update: true, delete: true, start: true, stop: true, restart: true },
    columns: [
      {
        header: "Имя",
        path: "name",
        render: (row) => <CopyableName name={(row.name as string) ?? ""} fallback={row.id as string} />,
      },
      { header: "Идентификатор", path: "id", render: (row) => <CopyableId id={(row.id as string) ?? ""} /> },
      { header: "Статус", path: "status", format: "status" },
      { header: "Зона", path: "zone_id", format: "text" },
      { header: "Платформа", path: "platform_id", format: "text" },
      {
        header: "vCPU / RAM",
        path: "resources",
        render: (row) => {
          const r = row.resources as { cores?: string | number; memory?: string | number } | undefined;
          if (!r) return <span className="text-muted-foreground">—</span>;
          return <span className="font-mono text-xs">{r.cores ?? "?"} vCPU · {fmtBytesGiB(r.memory)}</span>;
        },
      },
      {
        header: "Внутренний IP",
        path: "network_interfaces",
        render: (row) => {
          const nics = (row.network_interfaces as Array<{ primary_v4_address?: { address?: string } }> | undefined) ?? [];
          const ip = nics[0]?.primary_v4_address?.address;
          return ip ? <span className="font-mono text-xs">{ip}</span> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        header: "Загрузочный диск",
        path: "boot_disk.disk_id",
        render: (row) => {
          const bd = (row.boot_disk as { disk_id?: string } | undefined)?.disk_id;
          return <RefNameLink specId="compute-disks" refId={bd} asTag />;
        },
      },
      { header: "Дата создания", path: "created_at", format: "datetime" },
      {
        header: "Метки",
        path: "labels",
        render: (row) => <LabelsCell labels={row.labels as Record<string, string> | undefined} />,
      },
    ],
    fields: [
      FIELD_NAME_COMPUTE,
      { name: "zone_id", label: "Зона", type: "ref", refResource: "compute-zones", required: true, immutable: true },
      {
        name: "platform_id", label: "Платформа", type: "enum", required: true, default: "standard-v3",
        options: [
          { value: "standard-v1", label: "Intel Broadwell (standard-v1)" },
          { value: "standard-v2", label: "Intel Cascade Lake (standard-v2)" },
          { value: "standard-v3", label: "Intel Ice Lake (standard-v3)" },
          { value: "highfreq-v3", label: "Intel Ice Lake, 3.1 GHz (highfreq-v3)" },
        ],
        immutable: true,
        description: "Менять platform_id можно только когда ВМ остановлена.",
      },
      { name: "resources_spec.cores", label: "vCPU (cores)", type: "int", required: true, default: 2, min: 2,
        description: "2,4,6,8,...; зависит от платформы. Менять только когда ВМ остановлена.", editHidden: true },
      { name: "resources_spec.memory_gib", label: "RAM (ГиБ)", type: "int", required: true, default: 2, min: 1,
        description: "Кратно 1 ГиБ. Менять только когда ВМ остановлена.", editHidden: true },
      { name: "resources_spec.core_fraction", label: "Гарантированная доля vCPU, %", type: "enum", default: "100",
        options: [
          { value: "5", label: "5%" },
          { value: "20", label: "20%" },
          { value: "50", label: "50%" },
          { value: "100", label: "100%" },
        ],
        editHidden: true,
      },
      {
        name: "_boot_source", label: "Загрузочный диск", type: "enum", default: "image", required: true,
        options: [
          { value: "image", label: "Создать из образа" },
          { value: "disk", label: "Использовать существующий диск" },
        ],
        editHidden: true,
      },
      { name: "boot_disk_spec.disk_spec.image_id", label: "Образ для загрузочного диска", type: "ref",
        refResource: "compute-images", refFolderScoped: true,
        visibleWhen: { field: "_boot_source", equals: "image" }, editHidden: true },
      { name: "boot_disk_spec.disk_spec.size_gib", label: "Размер загрузочного диска (ГиБ)", type: "int", default: 10, min: 4,
        visibleWhen: { field: "_boot_source", equals: "image" }, editHidden: true },
      { name: "boot_disk_spec.disk_spec.type_id", label: "Тип загрузочного диска", type: "ref",
        refResource: "disk-types", placeholder: "network-ssd (по умолчанию)",
        visibleWhen: { field: "_boot_source", equals: "image" }, editHidden: true },
      { name: "boot_disk_spec.disk_id", label: "Существующий диск", type: "ref", refResource: "compute-disks",
        refFolderScoped: true, visibleWhen: { field: "_boot_source", equals: "disk" }, editHidden: true },
      { name: "boot_disk_spec.auto_delete", label: "Удалять загрузочный диск вместе с ВМ", type: "bool", default: true, editHidden: true },
      {
        name: "network_interface_specs", label: "Сетевые интерфейсы", type: "array", itemLabel: "интерфейс",
        description: "Минимум один сетевой интерфейс. Либо выберите существующий kacho-vpc NetworkInterface (nic_id) — тогда подсеть/SG/адрес берутся из него — либо опишите inline-spec (подсеть + SG + адрес), и интерфейс будет создан для ВМ. Подсеть должна быть в той же зоне, что и ВМ.",
        editHidden: true,
        newItem: () => ({ nic_id: "", subnet_id: "", _nat: false, primary_v4_address_spec: { address: "" } }),
        itemFields: [
          // KAC-5/KAC-9: attach существующий NetworkInterface-ресурс по id.
          // RefSelect авто-добавляет ?folder_id=<folder-context>; «+ Создать
          // интерфейс…» открывает InlineResourceCreateForm для network-interfaces
          // (pre-fill: folder_id ВМ + subnet_id, если в spec уже выбрана подсеть).
          {
            name: "nic_id", label: "Существующий NetworkInterface (опционально)", type: "ref",
            refResource: "network-interfaces", refFolderScoped: true,
            placeholder: "— Создать новый интерфейс из spec ниже —",
            description: "Если задано — подсеть/SG/адрес ниже игнорируются (берутся из выбранного NIC).",
            createResource: "network-interfaces",
            createTitle: "Создать сетевой интерфейс",
            // Pre-fill: folder ВМ. subnet_id — per-NIC-spec, не доступен здесь
            // (formValue в RefSelect = вся форма, не элемент массива) → пользователь
            // выбирает подсеть в inline-create-форме. TODO(KAC-9).
            createPresetFields: (form) => ({ folder_id: form["folder_id"] ?? "" }),
          },
          // Inline-spec (используется, если nic_id не задан).
          // TODO(KAC-9): visibleWhen по sibling-полю внутри array-item не
          // поддерживается (visibleWhen.field — top-level path), поэтому
          // подсеть/SG/адрес показываются всегда; sanitize выкидывает их, если
          // nic_id задан.
          { name: "subnet_id", label: "Подсеть (для нового интерфейса)", type: "ref", refResource: "subnets", refFolderScoped: true },
          { name: "_nat", label: "Публичный IP (one-to-one NAT)", type: "bool", default: false },
          { name: "primary_v4_address_spec.address", label: "Внутренний IPv4 (опционально)", type: "string",
            placeholder: "(авто из CIDR подсети, если пусто)" },
          {
            name: "security_group_ids", label: "Группы безопасности", type: "array", itemLabel: "SG",
            newItem: () => ({ value: "" }),
            itemFields: [
              { name: "value", label: "Security Group", type: "ref", refResource: "security-groups", refFolderScoped: true, required: true },
            ],
          },
        ],
      },
      { name: "hostname", label: "Hostname", type: "string", placeholder: "(= id если пусто)",
        pattern: "^([a-z]([-_a-z0-9]{0,61}[a-z0-9])?)?$", editHidden: true },
      { name: "service_account_id", label: "Service Account ID", type: "string", placeholder: "(опционально)" },
      FIELD_LABELS,
      FIELD_DESCRIPTION,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      zone_id: "",
      platform_id: "standard-v3",
      resources_spec: { cores: 2, memory_gib: 2, core_fraction: "100" },
      _boot_source: "image",
      boot_disk_spec: { auto_delete: true, disk_spec: { size_gib: 10, type_id: "" } },
      network_interface_specs: [{ nic_id: "", subnet_id: "", _nat: false, primary_v4_address_spec: { address: "" } }],
      description: "",
      labels: {},
    }),
    sanitize: (obj) => sanitizeInstanceCreate(obj),
  },

  // ====== System (kacho-only admin: Region / Zone / AddressPool) ======
  // НЕ verbatim-YC: эти ресурсы exposed через apiGW REST для admin UI.
  // На external TLS endpoint (yc CLI compat) НЕ публикуются — см. kacho-vpc CLAUDE.md.
  // Sync RPC (без Operation envelope), backend handler возвращает ресурс напрямую.

  regions: {
    id: "regions",
    route: "regions",
    apiPath: "/compute/v1/regions",
    payloadKey: "regions",
    singular: "Region",
    plural: "Регионы",
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
        placeholder: "<region-id>",
        description: "Lower-snake-kebab. Immutable PK.",
        pattern: "^[a-z][a-z0-9-]*$",
      },
      { name: "name", label: "Name", type: "string", placeholder: "Region display name" },
    ],
    template: () => ({ id: "", name: "" }),
  },

  zones: {
    id: "zones",
    route: "zones",
    apiPath: "/compute/v1/zones",
    payloadKey: "zones",
    singular: "Zone",
    plural: "Зоны",
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
        placeholder: "<zone-id>",
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
      { name: "name", label: "Name", type: "string", placeholder: "Zone display name" },
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
    serviceTitle: "Администрирование",
    scope: "global",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
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
        placeholder: "<pool-name>",
      },
      { name: "description", label: "Description", type: "text", rows: 2 },
      {
        // kind — UI ограничен одним значением, скрыт; backend требует поле в payload.
        name: "kind",
        label: "Kind",
        type: "enum",
        options: POOL_KINDS,
        required: true,
        default: "EXTERNAL_PUBLIC",
        immutable: true,
        hidden: true,
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
        newItem: () => ({ value: "" }),
        itemFields: [
          {
            name: "value",
            label: "CIDR",
            type: "string",
            required: true,
            placeholder: "<ip>/<prefix>",
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
      cidr_blocks: [{ value: "" }],
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

  // Hypervisor — internal/infra-ресурс kacho-compute (placement / capacity физики).
  // Internal-only: не публикуется на external TLS endpoint, exposed через apiGW
  // internal mux под /compute/v1/hypervisors (см. workspace CLAUDE.md §«Инфра-
  // чувствительные данные»). Register (POST) возвращает Hypervisor синхронно
  // (без Operation envelope) — как Region/Zone/AddressPool. Deregister — DELETE,
  // возвращает {}. (Опциональный :updateState action в generic-фреймворке не
  // выражается — пропущен.)
  hypervisors: {
    id: "hypervisors",
    route: "hypervisors",
    apiPath: "/compute/v1/hypervisors",
    payloadKey: "hypervisors",
    singular: "Hypervisor",
    plural: "Гипервизоры",
    serviceTitle: "Администрирование",
    scope: "global",
    ops: { create: true, update: false, delete: true },
    columns: [
      { header: "ID", path: "id", format: "text", className: "font-mono" },
      { header: "Zone", path: "zone_id", format: "text" },
      { header: "Node index", path: "node_index", format: "text" },
      { header: "FQDN", path: "fqdn", format: "text" },
      { header: "State", path: "state", format: "status" },
      { header: "vCPUs", path: "capacity.vcpus", format: "text" },
      {
        header: "Memory",
        path: "capacity.memory_bytes",
        render: (row) => fmtBytesGiB(getByPath(row, "capacity.memory_bytes")),
      },
      { header: "Instances", path: "capacity.instances", format: "text" },
      { header: "Updated", path: "updated_at", format: "datetime" },
      COL_CREATED,
    ],
    fields: [
      {
        name: "zone_id",
        label: "Zone",
        type: "ref",
        refResource: "zones",
        description: "Зона размещения гипервизора.",
      },
      { name: "fqdn", label: "FQDN", type: "string", placeholder: "hv-01.zone-a.kacho.local" },
      { name: "capacity.vcpus", label: "vCPUs", type: "int", min: 0, default: 0 },
      { name: "capacity.memory_bytes", label: "Memory (bytes)", type: "int", min: 0, default: 0 },
      { name: "capacity.instances", label: "Instances", type: "int", min: 0, default: 0 },
      {
        name: "id",
        label: "Hypervisor ID",
        type: "string",
        hidden: true,
        description: "Опционально. Пусто — id генерируется бекендом.",
      },
    ],
    template: () => ({
      zone_id: "",
      fqdn: "",
      capacity: { vcpus: 0, memory_bytes: 0, instances: 0 },
      id: "",
    }),
    // Вырезаем пустой id (чтобы бекенд сгенерировал) и пустую zone_id.
    sanitize: (obj) => {
      const o = { ...obj };
      if (o.id === "" || o.id === undefined) delete o.id;
      if (o.zone_id === "" || o.zone_id === undefined) delete o.zone_id;
      return o;
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

// === compute byte/GiB helpers ===
const GIB = 1024 * 1024 * 1024;

/** fmtBytesGiB — отображает число байт как "<N> ГиБ" (округление вверх до целых). */
export function fmtBytesGiB(v: unknown): string {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return "—";
  const gib = n / GIB;
  return `${gib >= 10 ? Math.round(gib) : Math.round(gib * 10) / 10} ГиБ`;
}

/** gibToBytes — конвертирует значение из ГиБ-инпута в строку байт для wire format. */
export function gibToBytes(v: unknown): string | undefined {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return String(Math.round(n * GIB));
}

/** sanitizeInstanceCreate — превращает form-internal представление CreateInstanceRequest
 *  в wire format: memory_gib→memory (байты), size_gib→size, core_fraction строка→число,
 *  boot_disk oneof (disk_spec vs disk_id), one-to-one NAT toggle → one_to_one_nat_spec,
 *  security_group_ids [{value}]→[ids]; вырезает _boot_source и пустые поля. */
export function sanitizeInstanceCreate(obj: Record<string, unknown>): Record<string, unknown> {
  const o = { ...obj } as Record<string, unknown>;

  // resources_spec
  const rs = { ...((o["resources_spec"] as Record<string, unknown>) ?? {}) };
  if (rs["memory_gib"] !== undefined) {
    rs["memory"] = gibToBytes(rs["memory_gib"]);
    delete rs["memory_gib"];
  }
  if (rs["cores"] !== undefined && rs["cores"] !== "") rs["cores"] = Number(rs["cores"]);
  if (rs["core_fraction"] !== undefined && rs["core_fraction"] !== "") rs["core_fraction"] = Number(rs["core_fraction"]);
  o["resources_spec"] = rs;

  // boot_disk_spec
  const bootSource = o["_boot_source"];
  const bds = { ...((o["boot_disk_spec"] as Record<string, unknown>) ?? {}) };
  if (bootSource === "image") {
    const ds = { ...((bds["disk_spec"] as Record<string, unknown>) ?? {}) };
    if (ds["size_gib"] !== undefined) { ds["size"] = gibToBytes(ds["size_gib"]); delete ds["size_gib"]; }
    if (ds["type_id"] === "" || ds["type_id"] === undefined) delete ds["type_id"];
    if (ds["image_id"] === "" || ds["image_id"] === undefined) delete ds["image_id"];
    bds["disk_spec"] = ds;
    delete bds["disk_id"];
  } else {
    // existing disk
    delete bds["disk_spec"];
  }
  o["boot_disk_spec"] = bds;
  delete o["_boot_source"];

  // network_interface_specs
  const nics = Array.isArray(o["network_interface_specs"]) ? (o["network_interface_specs"] as Record<string, unknown>[]) : [];
  o["network_interface_specs"] = nics.map((nic) => {
    const out: Record<string, unknown> = {};
    // Если выбран существующий NetworkInterface (nic_id) — отдаём только nic_id,
    // подсеть/SG/адрес берутся из самого NIC (см. compute.v1.NetworkInterfaceSpec.nic_id, KAC-5).
    if (nic["nic_id"]) {
      out["nic_id"] = nic["nic_id"];
      return out;
    }
    if (nic["subnet_id"]) out["subnet_id"] = nic["subnet_id"];
    const sgs = Array.isArray(nic["security_group_ids"])
      ? (nic["security_group_ids"] as unknown[])
          .map((it) => (typeof it === "object" && it !== null && "value" in (it as object) ? (it as Record<string, unknown>)["value"] : it))
          .filter((v) => typeof v === "string" && v)
      : [];
    if (sgs.length > 0) out["security_group_ids"] = sgs;
    const primaryAddr =
      typeof nic["primary_v4_address_spec"] === "object" && nic["primary_v4_address_spec"] !== null
        ? ((nic["primary_v4_address_spec"] as Record<string, unknown>)["address"] as string | undefined)
        : undefined;
    const pv4: Record<string, unknown> = {};
    if (primaryAddr) pv4["address"] = primaryAddr;
    if (nic["_nat"] === true) pv4["one_to_one_nat_spec"] = { ip_version: "IPV4" };
    if (Object.keys(pv4).length > 0) out["primary_v4_address_spec"] = pv4;
    return out;
  });

  // strip optional empties
  for (const k of ["hostname", "service_account_id"]) {
    if (o[k] === "" || o[k] === undefined) delete o[k];
  }
  return o;
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
