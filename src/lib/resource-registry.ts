// Реестр ресурсов: метаданные для generic ListPage / DetailPage / Create-Edit.
// Источник истины — proto definitions в kacho-proto/proto/kacho/cloud/.../v1/*.proto.

import type { ReactNode } from "react";

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
  // skeleton-объект для Create-формы
  template: (ctx: { folderId?: string; cloudId?: string; organizationId?: string }) => unknown;
}

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
    template: () => ({
      metadata: { name: "my-org" },
      spec: { displayName: "My Org", description: "" },
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
    template: ({ organizationId }) => ({
      metadata: { name: "my-cloud", organizationId: organizationId ?? "" },
      spec: { displayName: "My Cloud", description: "" },
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
    template: ({ cloudId, organizationId }) => ({
      metadata: { name: "my-folder", cloudId: cloudId ?? "", organizationId: organizationId ?? "" },
      spec: { displayName: "My Folder", description: "" },
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
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "my-net", folderId, cloudId, organizationId },
      spec: { displayName: "My Network", description: "" },
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
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "my-subnet", folderId, cloudId, organizationId },
      spec: { networkId: "<network-uid>", zoneId: "kacho-zone-a", cidrBlock: "10.0.0.0/24" },
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
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "my-sg", folderId, cloudId, organizationId },
      spec: {
        networkId: "<network-uid>",
        displayName: "My SG",
        rules: [
          {
            direction: "INGRESS",
            protocol: "TCP",
            portRangeMin: 22,
            portRangeMax: 22,
            cidrBlocks: ["0.0.0.0/0"],
          },
        ],
      },
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
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "my-rt", folderId, cloudId, organizationId },
      spec: {
        networkId: "<network-uid>",
        staticRoutes: [{ destinationPrefix: "10.10.0.0/16", nextHopAddress: "10.0.0.1" }],
      },
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
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "my-addr", folderId, cloudId, organizationId },
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
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "my-vm", folderId, cloudId, organizationId },
      spec: {
        platformId: "standard-v3",
        zoneId: "kacho-zone-a",
        resources: { cores: 2, memory: "4Gi", coreFraction: 100 },
        bootDisk: { diskId: "<disk-uid>", autoDelete: true },
        networkInterfaces: [{ subnetId: "<subnet-uid>" }],
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
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "my-disk", folderId, cloudId, organizationId },
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
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "my-snap", folderId, cloudId, organizationId },
      spec: { diskId: "<disk-uid>", displayName: "My Snapshot" },
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
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "my-nlb", folderId, cloudId, organizationId },
      spec: {
        regionId: "kacho-region-a",
        listeners: [{ name: "web", port: 80, protocol: "PROTOCOL_TCP", targetPort: 80 }],
        attachedTargetGroups: [{ targetGroupId: "<tg-uid>" }],
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
    template: ({ folderId, cloudId, organizationId }) => ({
      metadata: { name: "my-tg", folderId, cloudId, organizationId },
      spec: {
        regionId: "kacho-region-a",
        targets: [{ subnetId: "<subnet-uid>", address: "10.0.0.10" }],
      },
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
