// Реестр ресурсов: метаданные для generic ListPage / DetailPage / Create-Edit.
// Источник истины — proto definitions в kacho-proto/proto/kacho/cloud/.../v1/*.proto.

import type { ReactNode } from "react";
import type { FormField } from "./form-schema";
import { setByPath } from "./path";

export interface ResourceColumn {
  header: string;
  // path в объекте: например "metadata.name", "spec.cidrBlock", "status.state"
  path: string;
  format?: "text" | "uid-short" | "datetime" | "status" | "code" | "list";
  className?: string;
  render?: (row: Record<string, unknown>) => ReactNode;
}

export interface ResourceSpec {
  id: string;
  // route path в SPA (без leading slash), например "networks", "network-load-balancers"
  route: string;
  // URL-segment в gateway REST (kebab-case, тот же что route)
  apiPath: string;
  // ключ массива в payload upsert/list response: "networks", "instances"
  payloadKey: string;
  // singular label для UI: "Network", "Instance"
  singular: string;
  // plural label: "Networks", "Instances"
  plural: string;
  description?: string;
  // global = cluster-scoped, folder = только в выбранном folder
  scope: "global" | "folder";
  // поддерживаемые операции
  ops: { create: boolean; edit: boolean; delete: boolean; restart?: boolean };
  // колонки для list-таблицы
  columns: ResourceColumn[];
  // schema полей формы (если undefined — fallback к JSON-editor)
  fields?: FormField[];
  // skeleton-объект для Create-формы (заполнение defaults)
  template: (ctx: { folderId?: string; cloudId?: string; organizationId?: string }) => unknown;
}

const ZONES = [
  { value: "kacho-zone-a", label: "kacho-zone-a" },
  { value: "kacho-zone-b", label: "kacho-zone-b" },
  { value: "kacho-zone-c", label: "kacho-zone-c" },
];

const COMMON_NAME_FIELD: FormField = {
  name: "metadata.name",
  label: "Name",
  type: "string",
  required: true,
  placeholder: "my-resource",
  description: "Уникальное в рамках folder. Lowercase + дефисы (RFC 1123).",
  pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$",
};

const COMMON_DESC: FormField[] = [
  {
    name: "spec.displayName",
    label: "Display Name",
    type: "string",
    placeholder: "Human-readable label",
  },
  { name: "spec.description", label: "Description", type: "text", rows: 2 },
];

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
    ops: { create: true, edit: true, delete: false },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Display", path: "spec.displayName", format: "text" },
      { header: "UID", path: "metadata.uid", format: "uid-short" },
      { header: "Created", path: "metadata.creationTimestamp", format: "datetime" },
      { header: "RV", path: "metadata.resourceVersion", format: "code" },
    ],
    fields: [COMMON_NAME_FIELD, ...COMMON_DESC],
    template: () => ({
      metadata: { name: "" },
      spec: { displayName: "", description: "" },
    }),
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
    ops: { create: true, edit: true, delete: true },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Display", path: "spec.displayName", format: "text" },
      { header: "Org", path: "metadata.organizationId", format: "uid-short" },
      { header: "Created", path: "metadata.creationTimestamp", format: "datetime" },
    ],
    fields: [
      COMMON_NAME_FIELD,
      {
        name: "metadata.organizationId",
        label: "Organization",
        type: "ref",
        refResource: "organizations",
        required: true,
      },
      ...COMMON_DESC,
    ],
    template: ({ organizationId }) => ({
      metadata: { name: "", organizationId: organizationId ?? "" },
      spec: { displayName: "", description: "" },
    }),
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
    ops: { create: true, edit: true, delete: true },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Display", path: "spec.displayName", format: "text" },
      { header: "Cloud", path: "metadata.cloudId", format: "uid-short" },
      { header: "Created", path: "metadata.creationTimestamp", format: "datetime" },
    ],
    fields: [
      COMMON_NAME_FIELD,
      {
        name: "metadata.cloudId",
        label: "Cloud",
        type: "ref",
        refResource: "clouds",
        required: true,
      },
      { name: "metadata.organizationId", label: "Organization", type: "string", hidden: true },
      ...COMMON_DESC,
    ],
    template: ({ cloudId, organizationId }) => ({
      metadata: { name: "", cloudId: cloudId ?? "", organizationId: organizationId ?? "" },
      spec: { displayName: "", description: "" },
    }),
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
    ops: { create: true, edit: true, delete: true },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Status", path: "status.state", format: "status" },
      { header: "Display", path: "spec.displayName", format: "text" },
      { header: "UID", path: "metadata.uid", format: "uid-short" },
      { header: "Created", path: "metadata.creationTimestamp", format: "datetime" },
    ],
    fields: [
      COMMON_NAME_FIELD,
      ...COMMON_DESC,
      { name: "metadata.folderId", label: "Folder", type: "string", hidden: true },
      { name: "metadata.cloudId", label: "Cloud", type: "string", hidden: true },
      { name: "metadata.organizationId", label: "Organization", type: "string", hidden: true },
    ],
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "", folderId, cloudId, organizationId },
      spec: { displayName: "", description: "" },
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
    ops: { create: true, edit: true, delete: true },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Status", path: "status.state", format: "status" },
      { header: "Network", path: "spec.networkId", format: "uid-short" },
      { header: "Zone", path: "spec.zoneId", format: "text" },
      { header: "CIDR", path: "spec.cidrBlock", format: "code" },
    ],
    fields: [
      COMMON_NAME_FIELD,
      {
        name: "spec.networkId",
        label: "Network",
        type: "ref",
        refResource: "networks",
        refFolderScoped: true,
        required: true,
      },
      {
        name: "spec.zoneId",
        label: "Zone",
        type: "enum",
        options: ZONES,
        required: true,
      },
      {
        name: "spec.cidrBlock",
        label: "CIDR Block",
        type: "string",
        placeholder: "10.0.0.0/24",
        required: true,
        description: "RFC 1918, host-bits cleared (для /24 — последний октет 0).",
      },
      ...COMMON_DESC,
      { name: "metadata.folderId", label: "Folder", type: "string", hidden: true },
      { name: "metadata.cloudId", label: "Cloud", type: "string", hidden: true },
      { name: "metadata.organizationId", label: "Organization", type: "string", hidden: true },
    ],
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "", folderId, cloudId, organizationId },
      spec: { networkId: "", zoneId: "kacho-zone-a", cidrBlock: "10.0.0.0/24" },
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
    ops: { create: true, edit: true, delete: true },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Status", path: "status.state", format: "status" },
      { header: "Network", path: "spec.networkId", format: "uid-short" },
    ],
    fields: [
      COMMON_NAME_FIELD,
      {
        name: "spec.networkId",
        label: "Network",
        type: "ref",
        refResource: "networks",
        refFolderScoped: true,
        required: true,
      },
      { name: "spec.displayName", label: "Display Name", type: "string" },
      {
        name: "spec.rules",
        label: "Rules",
        type: "array",
        itemLabel: "Rule",
        description: "Full-replace при Upsert. Server-side IDs регенерируются.",
        newItem: () => ({
          direction: "INGRESS",
          protocol: "TCP",
          portRangeMin: 80,
          portRangeMax: 80,
          cidrBlocks: ["0.0.0.0/0"],
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
          { name: "portRangeMin", label: "Port from", type: "int", min: 0, max: 65535 },
          { name: "portRangeMax", label: "Port to", type: "int", min: 0, max: 65535 },
          {
            name: "cidrBlocks[0]",
            label: "CIDR",
            type: "string",
            placeholder: "0.0.0.0/0",
          },
          { name: "description", label: "Description", type: "string" },
        ],
      },
      { name: "metadata.folderId", label: "Folder", type: "string", hidden: true },
      { name: "metadata.cloudId", label: "Cloud", type: "string", hidden: true },
      { name: "metadata.organizationId", label: "Organization", type: "string", hidden: true },
    ],
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "", folderId, cloudId, organizationId },
      spec: { networkId: "", displayName: "", rules: [] },
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
    ops: { create: true, edit: true, delete: true },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Status", path: "status.state", format: "status" },
      { header: "Network", path: "spec.networkId", format: "uid-short" },
    ],
    fields: [
      COMMON_NAME_FIELD,
      {
        name: "spec.networkId",
        label: "Network",
        type: "ref",
        refResource: "networks",
        refFolderScoped: true,
        required: true,
      },
      { name: "spec.displayName", label: "Display Name", type: "string" },
      {
        name: "spec.staticRoutes",
        label: "Static Routes",
        type: "array",
        itemLabel: "Route",
        description: "Full-replace при Upsert.",
        newItem: () => ({ destinationPrefix: "10.10.0.0/16", nextHopAddress: "10.0.0.1" }),
        itemFields: [
          {
            name: "destinationPrefix",
            label: "Destination CIDR",
            type: "string",
            required: true,
            placeholder: "10.10.0.0/16",
          },
          {
            name: "nextHopAddress",
            label: "Next Hop",
            type: "string",
            required: true,
            placeholder: "10.0.0.1",
          },
          { name: "description", label: "Description", type: "string" },
        ],
      },
      { name: "metadata.folderId", label: "Folder", type: "string", hidden: true },
      { name: "metadata.cloudId", label: "Cloud", type: "string", hidden: true },
      { name: "metadata.organizationId", label: "Organization", type: "string", hidden: true },
    ],
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "", folderId, cloudId, organizationId },
      spec: { networkId: "", displayName: "", staticRoutes: [] },
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
    ops: { create: true, edit: true, delete: true },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Status", path: "status.state", format: "status" },
      { header: "IPv4", path: "status.allocatedIpv4", format: "code" },
      { header: "Type", path: "spec.addressType", format: "text" },
    ],
    fields: [
      COMMON_NAME_FIELD,
      {
        name: "spec.addressType",
        label: "Address Type",
        type: "enum",
        required: true,
        options: [{ value: "EXTERNAL", label: "EXTERNAL" }],
        description: "В 0.x только EXTERNAL.",
      },
      {
        name: "spec.zoneId",
        label: "Zone",
        type: "enum",
        required: true,
        options: ZONES,
      },
      ...COMMON_DESC,
      { name: "metadata.folderId", label: "Folder", type: "string", hidden: true },
      { name: "metadata.cloudId", label: "Cloud", type: "string", hidden: true },
      { name: "metadata.organizationId", label: "Organization", type: "string", hidden: true },
    ],
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "", folderId, cloudId, organizationId },
      spec: { addressType: "EXTERNAL", zoneId: "kacho-zone-a" },
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
    ops: { create: true, edit: true, delete: true, restart: true },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Status", path: "status.state", format: "status" },
      { header: "Platform", path: "spec.platformId", format: "text" },
      { header: "Zone", path: "spec.zoneId", format: "text" },
      { header: "Internal IPs", path: "status.ips.internal", format: "list" },
    ],
    fields: [
      COMMON_NAME_FIELD,
      {
        name: "spec.platformId",
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
        name: "spec.zoneId",
        label: "Zone",
        type: "enum",
        options: ZONES,
        required: true,
      },
      { name: "spec.resources.cores", label: "vCPU cores", type: "int", min: 1, max: 32, default: 2 },
      {
        name: "spec.resources.memory",
        label: "Memory",
        type: "string",
        placeholder: "4Gi",
        default: "4Gi",
      },
      {
        name: "spec.resources.coreFraction",
        label: "Core Fraction (%)",
        type: "int",
        min: 5,
        max: 100,
        default: 100,
      },
      {
        name: "spec.bootDisk.diskId",
        label: "Boot Disk",
        type: "ref",
        refResource: "disks",
        refFolderScoped: true,
        required: true,
      },
      { name: "spec.bootDisk.autoDelete", label: "Auto-delete boot disk", type: "bool", default: true },
      {
        name: "spec.networkInterfaces",
        label: "Network Interfaces",
        type: "array",
        itemLabel: "NIC",
        minItems: 1,
        newItem: () => ({ subnetId: "" }),
        itemFields: [
          {
            name: "subnetId",
            label: "Subnet",
            type: "ref",
            refResource: "subnets",
            refFolderScoped: true,
            required: true,
          },
          {
            name: "primaryV4Address",
            label: "Primary IPv4 (optional)",
            type: "string",
            placeholder: "10.0.0.5 — пусто для auto",
          },
        ],
      },
      {
        name: "spec.desiredPowerState",
        label: "Desired Power State",
        type: "enum",
        default: "POWER_RUNNING",
        options: [
          { value: "POWER_RUNNING", label: "POWER_RUNNING" },
          { value: "POWER_STOPPED", label: "POWER_STOPPED" },
        ],
      },
      ...COMMON_DESC,
      { name: "spec.fqdn", label: "FQDN", type: "string", placeholder: "vm.example.local" },
      { name: "metadata.folderId", label: "Folder", type: "string", hidden: true },
      { name: "metadata.cloudId", label: "Cloud", type: "string", hidden: true },
      { name: "metadata.organizationId", label: "Organization", type: "string", hidden: true },
    ],
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "", folderId, cloudId, organizationId },
      spec: {
        platformId: "standard-v3",
        zoneId: "kacho-zone-a",
        resources: { cores: 2, memory: "4Gi", coreFraction: 100 },
        bootDisk: { diskId: "", autoDelete: true },
        networkInterfaces: [{ subnetId: "" }],
        desiredPowerState: "POWER_RUNNING",
      },
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
    ops: { create: true, edit: true, delete: true },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Status", path: "status.state", format: "status" },
      { header: "Type", path: "spec.diskTypeId", format: "text" },
      { header: "Size", path: "spec.size", format: "text" },
      { header: "Zone", path: "spec.zoneId", format: "text" },
    ],
    fields: [
      COMMON_NAME_FIELD,
      {
        name: "spec.diskTypeId",
        label: "Disk Type",
        type: "enum",
        required: true,
        default: "network-ssd",
        options: [
          { value: "network-ssd", label: "network-ssd" },
          { value: "network-hdd", label: "network-hdd" },
        ],
      },
      {
        name: "spec.size",
        label: "Size",
        type: "string",
        placeholder: "10Gi",
        required: true,
      },
      {
        name: "spec.zoneId",
        label: "Zone",
        type: "enum",
        options: ZONES,
        required: true,
      },
      {
        name: "spec.imageId",
        label: "Source Image (optional)",
        type: "ref",
        refResource: "images",
        placeholder: "пусто = пустой диск",
      },
      ...COMMON_DESC,
      { name: "metadata.folderId", label: "Folder", type: "string", hidden: true },
      { name: "metadata.cloudId", label: "Cloud", type: "string", hidden: true },
      { name: "metadata.organizationId", label: "Organization", type: "string", hidden: true },
    ],
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "", folderId, cloudId, organizationId },
      spec: { diskTypeId: "network-ssd", size: "10Gi", zoneId: "kacho-zone-a" },
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
    ops: { create: false, edit: false, delete: false },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Family", path: "spec.family", format: "text" },
      { header: "OS", path: "spec.osType", format: "text" },
      { header: "Description", path: "spec.description", format: "text" },
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
    ops: { create: true, edit: true, delete: true },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Status", path: "status.state", format: "status" },
      { header: "Disk", path: "spec.diskId", format: "uid-short" },
      { header: "Progress", path: "status.progressPercent", format: "text" },
    ],
    fields: [
      COMMON_NAME_FIELD,
      {
        name: "spec.diskId",
        label: "Source Disk",
        type: "ref",
        refResource: "disks",
        refFolderScoped: true,
        required: true,
      },
      ...COMMON_DESC,
      { name: "metadata.folderId", label: "Folder", type: "string", hidden: true },
      { name: "metadata.cloudId", label: "Cloud", type: "string", hidden: true },
      { name: "metadata.organizationId", label: "Organization", type: "string", hidden: true },
    ],
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "", folderId, cloudId, organizationId },
      spec: { diskId: "", displayName: "" },
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
    ops: { create: true, edit: true, delete: true },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Status", path: "status.state", format: "status" },
      { header: "External IPs", path: "status.externalIps", format: "list" },
    ],
    fields: [
      COMMON_NAME_FIELD,
      { name: "spec.regionId", label: "Region", type: "string", default: "kacho-region-a" },
      ...COMMON_DESC,
      {
        name: "spec.listeners",
        label: "Listeners",
        type: "array",
        itemLabel: "Listener",
        minItems: 1,
        newItem: () => ({ name: "web", port: 80, protocol: "PROTOCOL_TCP", targetPort: 80 }),
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
          { name: "targetPort", label: "Target Port", type: "int", min: 1, max: 65535 },
        ],
      },
      {
        name: "spec.attachedTargetGroups",
        label: "Attached Target Groups",
        type: "array",
        itemLabel: "TG",
        newItem: () => ({ targetGroupId: "" }),
        itemFields: [
          {
            name: "targetGroupId",
            label: "Target Group",
            type: "ref",
            refResource: "target-groups",
            refFolderScoped: true,
            required: true,
          },
        ],
      },
      { name: "metadata.folderId", label: "Folder", type: "string", hidden: true },
      { name: "metadata.cloudId", label: "Cloud", type: "string", hidden: true },
      { name: "metadata.organizationId", label: "Organization", type: "string", hidden: true },
    ],
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "", folderId, cloudId, organizationId },
      spec: {
        regionId: "kacho-region-a",
        listeners: [{ name: "web", port: 80, protocol: "PROTOCOL_TCP", targetPort: 80 }],
        attachedTargetGroups: [],
      },
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
    ops: { create: true, edit: true, delete: true },
    columns: [
      { header: "Name", path: "metadata.name", format: "text", className: "font-medium" },
      { header: "Status", path: "status.state", format: "status" },
      { header: "Region", path: "spec.regionId", format: "text" },
    ],
    fields: [
      COMMON_NAME_FIELD,
      { name: "spec.regionId", label: "Region", type: "string", default: "kacho-region-a" },
      ...COMMON_DESC,
      {
        name: "spec.targets",
        label: "Targets",
        type: "array",
        itemLabel: "Target",
        newItem: () => ({ subnetId: "", address: "" }),
        itemFields: [
          {
            name: "subnetId",
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
            name: "instanceId",
            label: "Instance (optional)",
            type: "ref",
            refResource: "instances",
            refFolderScoped: true,
          },
        ],
      },
      { name: "metadata.folderId", label: "Folder", type: "string", hidden: true },
      { name: "metadata.cloudId", label: "Cloud", type: "string", hidden: true },
      { name: "metadata.organizationId", label: "Organization", type: "string", hidden: true },
    ],
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "", folderId, cloudId, organizationId },
      spec: { regionId: "kacho-region-a", targets: [] },
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
