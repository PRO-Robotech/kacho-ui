// Реестр ресурсов: метаданные для generic ListPage / DetailPage / Create-Edit.
// Flat API (sub-phase 1.0): все поля плоские, нет metadata/spec/status envelope.

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
  // URL-segment в gateway REST (kebab-case)
  apiPath: string;
  // ключ массива в List response: "networks", "instances"
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
}

const ZONES = [
  { value: "kacho-zone-a", label: "kacho-zone-a" },
  { value: "kacho-zone-b", label: "kacho-zone-b" },
  { value: "kacho-zone-c", label: "kacho-zone-c" },
];

// Общие колонки и поля
const COL_NAME: ResourceColumn = {
  header: "Name",
  path: "name",
  format: "text",
  className: "font-medium",
};
const COL_STATUS: ResourceColumn = {
  header: "Status",
  path: "status",
  format: "status",
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

const FIELDS_DISPLAY_DESC: FormField[] = [
  { name: "display_name", label: "Display Name", type: "string", placeholder: "Human-readable label" },
  { name: "description", label: "Description", type: "text", rows: 2 },
];

// Hidden поля для folder-context
const FIELD_FOLDER_ID: FormField = {
  name: "folder_id",
  label: "Folder",
  type: "string",
  hidden: true,
};

export const REGISTRY: Record<string, ResourceSpec> = {
  // ====== resourcemanager ======

  organizations: {
    id: "organizations",
    route: "organizations",
    apiPath: "organizations",
    payloadKey: "organizations",
    singular: "Organization",
    plural: "Organizations",
    description: "Корневой уровень иерархии. Cluster-scoped.",
    scope: "global",
    ops: { create: true, update: true, delete: false },
    columns: [
      COL_NAME,
      { header: "Display", path: "display_name", format: "text" },
      COL_STATUS,
      COL_CREATED,
      COL_ID,
    ],
    fields: [FIELD_NAME, ...FIELDS_DISPLAY_DESC],
    template: () => ({ name: "", display_name: "", description: "" }),
  },

  clouds: {
    id: "clouds",
    route: "clouds",
    apiPath: "clouds",
    payloadKey: "clouds",
    singular: "Cloud",
    plural: "Clouds",
    description: "Billing-scope внутри Organization.",
    scope: "global",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      { header: "Display", path: "display_name", format: "text" },
      { header: "Org", path: "organization_id", format: "uid-short" },
      COL_STATUS,
      COL_CREATED,
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
      ...FIELDS_DISPLAY_DESC,
    ],
    template: () => ({ name: "", organization_id: "", display_name: "", description: "" }),
  },

  folders: {
    id: "folders",
    route: "folders",
    apiPath: "folders",
    payloadKey: "folders",
    singular: "Folder",
    plural: "Folders",
    description: "Isolation-scope для domain-ресурсов.",
    scope: "global",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      { header: "Display", path: "display_name", format: "text" },
      { header: "Cloud", path: "cloud_id", format: "uid-short" },
      COL_STATUS,
      COL_CREATED,
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
      ...FIELDS_DISPLAY_DESC,
    ],
    template: () => ({ name: "", cloud_id: "", display_name: "", description: "" }),
  },

  // ====== vpc ======

  networks: {
    id: "networks",
    route: "networks",
    apiPath: "networks",
    payloadKey: "networks",
    singular: "Network",
    plural: "Networks",
    description: "VPC Networks.",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      COL_STATUS,
      { header: "Display", path: "display_name", format: "text" },
      COL_CREATED,
      COL_ID,
    ],
    fields: [
      FIELD_NAME,
      ...FIELDS_DISPLAY_DESC,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      display_name: "",
      description: "",
    }),
  },

  subnets: {
    id: "subnets",
    route: "subnets",
    apiPath: "subnets",
    payloadKey: "subnets",
    singular: "Subnet",
    plural: "Subnets",
    description: "VPC Subnets (folder-scoped).",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      COL_STATUS,
      { header: "Network", path: "network_id", format: "uid-short" },
      { header: "Zone", path: "zone_id", format: "text" },
      { header: "CIDR", path: "cidr_block", format: "code" },
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
        name: "cidr_block",
        label: "CIDR Block",
        type: "string",
        placeholder: "10.0.0.0/24",
        required: true,
        description: "RFC 1918, host-bits cleared.",
      },
      ...FIELDS_DISPLAY_DESC,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      network_id: "",
      zone_id: "kacho-zone-a",
      cidr_block: "10.0.0.0/24",
    }),
  },

  "security-groups": {
    id: "security-groups",
    route: "security-groups",
    apiPath: "security-groups",
    payloadKey: "securityGroups",
    singular: "Security Group",
    plural: "Security Groups",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      COL_STATUS,
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
      { name: "display_name", label: "Display Name", type: "string" },
      {
        name: "rules",
        label: "Rules",
        type: "array",
        itemLabel: "Rule",
        description: "Full-replace при Update.",
        newItem: () => ({
          direction: "INGRESS",
          protocol: "TCP",
          port_range_min: 80,
          port_range_max: 80,
          cidr_blocks: ["0.0.0.0/0"],
        }),
        itemFields: [
          {
            name: "direction",
            label: "Direction",
            type: "enum",
            required: true,
            options: [
              { value: "INGRESS", label: "INGRESS" },
              { value: "EGRESS", label: "EGRESS" },
            ],
          },
          {
            name: "protocol",
            label: "Protocol",
            type: "enum",
            required: true,
            options: [
              { value: "TCP", label: "TCP" },
              { value: "UDP", label: "UDP" },
              { value: "ICMP", label: "ICMP" },
            ],
          },
          { name: "port_range_min", label: "Port from", type: "int", min: 0, max: 65535 },
          { name: "port_range_max", label: "Port to", type: "int", min: 0, max: 65535 },
          { name: "cidr_blocks[0]", label: "CIDR", type: "string", placeholder: "0.0.0.0/0" },
          { name: "description", label: "Description", type: "string" },
        ],
      },
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      network_id: "",
      display_name: "",
      rules: [],
    }),
  },

  "route-tables": {
    id: "route-tables",
    route: "route-tables",
    apiPath: "route-tables",
    payloadKey: "routeTables",
    singular: "Route Table",
    plural: "Route Tables",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      COL_STATUS,
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
      { name: "display_name", label: "Display Name", type: "string" },
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
          { name: "description", label: "Description", type: "string" },
        ],
      },
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      network_id: "",
      display_name: "",
      static_routes: [],
    }),
  },

  addresses: {
    id: "addresses",
    route: "addresses",
    apiPath: "addresses",
    payloadKey: "addresses",
    singular: "Address",
    plural: "Addresses",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      COL_STATUS,
      { header: "IPv4", path: "allocated_ipv4", format: "code" },
      { header: "Type", path: "address_type", format: "text" },
      { header: "Zone", path: "zone_id", format: "text" },
    ],
    fields: [
      FIELD_NAME,
      {
        name: "address_type",
        label: "Address Type",
        type: "enum",
        required: true,
        options: [{ value: "EXTERNAL", label: "EXTERNAL" }],
        description: "В 1.x только EXTERNAL.",
      },
      {
        name: "zone_id",
        label: "Zone",
        type: "enum",
        required: true,
        options: ZONES,
      },
      ...FIELDS_DISPLAY_DESC,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      address_type: "EXTERNAL",
      zone_id: "kacho-zone-a",
    }),
  },

  // ====== compute ======

  instances: {
    id: "instances",
    route: "instances",
    apiPath: "instances",
    payloadKey: "instances",
    singular: "Instance",
    plural: "Instances",
    description: "VM-instances.",
    scope: "folder",
    ops: { create: true, update: true, delete: true, restart: true, start: true, stop: true },
    columns: [
      COL_NAME,
      COL_STATUS,
      { header: "Platform", path: "platform_id", format: "text" },
      { header: "Zone", path: "zone_id", format: "text" },
      { header: "Internal IPs", path: "ips.internal", format: "list" },
    ],
    fields: [
      FIELD_NAME,
      {
        name: "platform_id",
        label: "Platform",
        type: "enum",
        required: true,
        default: "standard-v3",
        options: [
          { value: "standard-v1", label: "standard-v1" },
          { value: "standard-v2", label: "standard-v2" },
          { value: "standard-v3", label: "standard-v3" },
        ],
      },
      {
        name: "zone_id",
        label: "Zone",
        type: "enum",
        options: ZONES,
        required: true,
      },
      { name: "resources.cores", label: "vCPU cores", type: "int", min: 1, max: 32, default: 2 },
      { name: "resources.memory", label: "Memory", type: "string", placeholder: "4Gi", default: "4Gi" },
      {
        name: "resources.core_fraction",
        label: "Core Fraction (%)",
        type: "int",
        min: 5,
        max: 100,
        default: 100,
      },
      {
        name: "boot_disk.disk_id",
        label: "Boot Disk",
        type: "ref",
        refResource: "disks",
        refFolderScoped: true,
        required: true,
      },
      {
        name: "boot_disk.auto_delete",
        label: "Auto-delete boot disk",
        type: "bool",
        default: true,
      },
      {
        name: "network_interfaces",
        label: "Network Interfaces",
        type: "array",
        itemLabel: "NIC",
        minItems: 1,
        newItem: () => ({ subnet_id: "" }),
        itemFields: [
          {
            name: "subnet_id",
            label: "Subnet",
            type: "ref",
            refResource: "subnets",
            refFolderScoped: true,
            required: true,
          },
          {
            name: "primary_v4_address",
            label: "Primary IPv4 (optional)",
            type: "string",
            placeholder: "10.0.0.5 — пусто для auto",
          },
        ],
      },
      {
        name: "desired_power_state",
        label: "Desired Power State",
        type: "enum",
        default: "POWER_RUNNING",
        options: [
          { value: "POWER_RUNNING", label: "POWER_RUNNING" },
          { value: "POWER_STOPPED", label: "POWER_STOPPED" },
        ],
      },
      ...FIELDS_DISPLAY_DESC,
      { name: "fqdn", label: "FQDN", type: "string", placeholder: "vm.example.local" },
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      platform_id: "standard-v3",
      zone_id: "kacho-zone-a",
      resources: { cores: 2, memory: "4Gi", core_fraction: 100 },
      boot_disk: { disk_id: "", auto_delete: true },
      network_interfaces: [{ subnet_id: "" }],
      desired_power_state: "POWER_RUNNING",
    }),
  },

  disks: {
    id: "disks",
    route: "disks",
    apiPath: "disks",
    payloadKey: "disks",
    singular: "Disk",
    plural: "Disks",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      COL_STATUS,
      { header: "Type", path: "disk_type_id", format: "text" },
      { header: "Size", path: "size", format: "text" },
      { header: "Zone", path: "zone_id", format: "text" },
    ],
    fields: [
      FIELD_NAME,
      {
        name: "disk_type_id",
        label: "Disk Type",
        type: "enum",
        required: true,
        default: "network-ssd",
        options: [
          { value: "network-ssd", label: "network-ssd" },
          { value: "network-hdd", label: "network-hdd" },
        ],
      },
      { name: "size", label: "Size", type: "string", placeholder: "10Gi", required: true },
      { name: "zone_id", label: "Zone", type: "enum", options: ZONES, required: true },
      {
        name: "image_id",
        label: "Source Image (optional)",
        type: "ref",
        refResource: "images",
        placeholder: "пусто = пустой диск",
      },
      ...FIELDS_DISPLAY_DESC,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      disk_type_id: "network-ssd",
      size: "10Gi",
      zone_id: "kacho-zone-a",
    }),
  },

  images: {
    id: "images",
    route: "images",
    apiPath: "images",
    payloadKey: "images",
    singular: "Image",
    plural: "Images",
    description: "Read-only catalog.",
    scope: "global",
    ops: { create: false, update: false, delete: false },
    columns: [
      COL_NAME,
      { header: "Family", path: "family", format: "text" },
      { header: "OS", path: "os_type", format: "text" },
      { header: "Description", path: "description", format: "text" },
      COL_STATUS,
    ],
    template: () => ({}),
  },

  snapshots: {
    id: "snapshots",
    route: "snapshots",
    apiPath: "snapshots",
    payloadKey: "snapshots",
    singular: "Snapshot",
    plural: "Snapshots",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      COL_STATUS,
      { header: "Disk", path: "disk_id", format: "uid-short" },
      { header: "Progress", path: "progress_percent", format: "text" },
    ],
    fields: [
      FIELD_NAME,
      {
        name: "disk_id",
        label: "Source Disk",
        type: "ref",
        refResource: "disks",
        refFolderScoped: true,
        required: true,
      },
      ...FIELDS_DISPLAY_DESC,
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      disk_id: "",
    }),
  },

  // ====== loadbalancer ======

  "network-load-balancers": {
    id: "network-load-balancers",
    route: "network-load-balancers",
    apiPath: "network-load-balancers",
    payloadKey: "networkLoadBalancers",
    singular: "Network Load Balancer",
    plural: "Network Load Balancers",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      COL_STATUS,
      { header: "Region", path: "region_id", format: "text" },
      { header: "External IPs", path: "external_ips", format: "list" },
      COL_CREATED,
    ],
    fields: [
      FIELD_NAME,
      { name: "region_id", label: "Region", type: "string", default: "kacho-region-a" },
      ...FIELDS_DISPLAY_DESC,
      {
        name: "listeners",
        label: "Listeners",
        type: "array",
        itemLabel: "Listener",
        minItems: 1,
        newItem: () => ({ name: "web", port: 80, protocol: "PROTOCOL_TCP", target_port: 80 }),
        itemFields: [
          { name: "name", label: "Name", type: "string", required: true, placeholder: "web" },
          { name: "port", label: "Port", type: "int", required: true, min: 1, max: 65535 },
          {
            name: "protocol",
            label: "Protocol",
            type: "enum",
            required: true,
            options: [
              { value: "PROTOCOL_TCP", label: "TCP" },
              { value: "PROTOCOL_UDP", label: "UDP" },
            ],
          },
          { name: "target_port", label: "Target Port", type: "int", min: 1, max: 65535 },
        ],
      },
      {
        name: "attached_target_groups",
        label: "Attached Target Groups",
        type: "array",
        itemLabel: "TG",
        newItem: () => ({ target_group_id: "" }),
        itemFields: [
          {
            name: "target_group_id",
            label: "Target Group",
            type: "ref",
            refResource: "target-groups",
            refFolderScoped: true,
            required: true,
          },
        ],
      },
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      region_id: "kacho-region-a",
      listeners: [{ name: "web", port: 80, protocol: "PROTOCOL_TCP", target_port: 80 }],
      attached_target_groups: [],
    }),
  },

  "target-groups": {
    id: "target-groups",
    route: "target-groups",
    apiPath: "target-groups",
    payloadKey: "targetGroups",
    singular: "Target Group",
    plural: "Target Groups",
    scope: "folder",
    ops: { create: true, update: true, delete: true },
    columns: [
      COL_NAME,
      COL_STATUS,
      { header: "Region", path: "region_id", format: "text" },
      COL_CREATED,
      COL_ID,
    ],
    fields: [
      FIELD_NAME,
      { name: "region_id", label: "Region", type: "string", default: "kacho-region-a" },
      ...FIELDS_DISPLAY_DESC,
      {
        name: "targets",
        label: "Targets",
        type: "array",
        itemLabel: "Target",
        newItem: () => ({ subnet_id: "", address: "" }),
        itemFields: [
          {
            name: "subnet_id",
            label: "Subnet",
            type: "ref",
            refResource: "subnets",
            refFolderScoped: true,
            required: true,
          },
          {
            name: "address",
            label: "IPv4 Address",
            type: "string",
            placeholder: "10.0.0.10",
            required: true,
          },
          {
            name: "instance_id",
            label: "Instance (optional)",
            type: "ref",
            refResource: "instances",
            refFolderScoped: true,
          },
        ],
      },
      FIELD_FOLDER_ID,
    ],
    template: ({ folderId }) => ({
      folder_id: folderId ?? "",
      name: "",
      region_id: "kacho-region-a",
      targets: [],
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
