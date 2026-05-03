// Реестр ресурсов: метаданные для generic ListPage / DetailPage / Create-Edit.
// Scope: 7 ресурсов verbatim YC proto.
// apiPath содержит полный путь с доменным префиксом (verbatim из proto google.api.http annotations).

import type { ReactNode } from "react";
import type { FormField } from "./form-schema";
import { setByPath } from "./path";

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
  // skeleton-объект для Create-формы
  template: (ctx: { folderId?: string; cloudId?: string; organizationId?: string }) => unknown;
  // Опциональная нормализация payload перед отправкой на API.
  // Используется для конвертации form-internal представления (wrapper-объекты, toggle-поля)
  // в wire format (plain arrays, oneof etc.).
  sanitize?: (obj: Record<string, unknown>) => Record<string, unknown>;
}

const ZONES = [
  { value: "kacho-zone-a", label: "kacho-zone-a" },
  { value: "kacho-zone-b", label: "kacho-zone-b" },
  { value: "kacho-zone-c", label: "kacho-zone-c" },
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

const FIELD_NAME: FormField = {
  name: "name",
  label: "Name",
  type: "string",
  required: true,
  placeholder: "my-resource",
  description: "Уникальное в рамках folder. Lowercase + дефисы (RFC 1123).",
  pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$",
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
    description: "Корневой уровень иерархии. Cluster-scoped.",
    scope: "global",
    ops: { create: true, update: true, delete: false },
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
    template: () => ({ name: "", organization_id: "", description: "" }),
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
    template: () => ({ name: "", cloud_id: "", description: "" }),
  },

  // ====== vpc ======
  // proto: GET /vpc/v1/networks

  networks: {
    id: "networks",
    route: "networks",
    apiPath: "/vpc/v1/networks",
    payloadKey: "networks",
    singular: "Network",
    plural: "Networks",
    description: "VPC Networks.",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      { header: "Description", path: "description", format: "text" },
      COL_CREATED,
      COL_ID,
    ],
    fields: [
      FIELD_NAME,
      FIELD_DESCRIPTION,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      description: "",
    }),
  },

  // proto: GET /vpc/v1/subnets

  subnets: {
    id: "subnets",
    route: "subnets",
    apiPath: "/vpc/v1/subnets",
    payloadKey: "subnets",
    singular: "Subnet",
    plural: "Subnets",
    description: "VPC Subnets (folder-scoped).",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      { header: "Network", path: "network_id", format: "uid-short" },
      { header: "Zone", path: "zone_id", format: "text" },
      { header: "CIDRs", path: "v4_cidr_blocks", format: "list" },
      COL_ID,
    ],
    fields: [
      FIELD_NAME,
      {
        name: "network_id",
        label: "Network",
        type: "ref",
        refResource: "networks",
        refFolderScoped: true,
        required: true,
      },
      {
        name: "zone_id",
        label: "Zone",
        type: "enum",
        options: ZONES,
        required: true,
      },
      {
        name: "v4_cidr_blocks",
        label: "IPv4 CIDR Blocks",
        type: "array",
        itemLabel: "CIDR",
        description: "Массив IPv4 CIDR-блоков (RFC 1918). Например: 10.0.0.0/24",
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
      FIELD_DESCRIPTION,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      network_id: "",
      zone_id: "kacho-zone-a",
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
    plural: "Addresses",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      { header: "Type", path: "type", format: "text" },
      { header: "Ext IPv4", path: "external_ipv4_address.address", format: "code" },
      { header: "Int IPv4", path: "internal_ipv4_address.address", format: "code" },
      { header: "Reserved", path: "reserved", format: "text" },
      COL_ID,
    ],
    fields: [
      FIELD_NAME,
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
      // External fields
      {
        name: "external_ipv4_address_spec.zone_id",
        label: "Zone (External)",
        type: "enum",
        options: ZONES,
        description: "Зона для External IP. Оставьте address пустым для auto-allocation.",
      },
      {
        name: "external_ipv4_address_spec.address",
        label: "Address (External, необязательно)",
        type: "string",
        placeholder: "пусто = auto-allocated",
        description: "Если пусто — адрес выделяется автоматически.",
      },
      // Internal fields
      {
        name: "internal_ipv4_address_spec.subnet_id",
        label: "Subnet (Internal)",
        type: "ref",
        refResource: "subnets",
        refFolderScoped: true,
        description: "Subnet для Internal IP. Адрес выделяется автоматически.",
      },
      {
        name: "internal_ipv4_address_spec.address",
        label: "Address (Internal, необязательно)",
        type: "string",
        placeholder: "пусто = auto-allocated",
        description: "Если пусто — адрес выделяется из subnet автоматически.",
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
      external_ipv4_address_spec: { zone_id: "kacho-zone-a", address: "" },
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

  // proto: GET /vpc/v1/route-tables

  "route-tables": {
    id: "route-tables",
    route: "route-tables",
    apiPath: "/vpc/v1/route-tables",
    payloadKey: "route_tables",
    singular: "Route Table",
    plural: "Route Tables",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      { header: "Network", path: "network_id", format: "uid-short" },
      COL_CREATED,
      COL_ID,
    ],
    fields: [
      FIELD_NAME,
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
};

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
