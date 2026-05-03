// TS-типы для flat API (sub-phase 1.0).
// Ресурсы — плоские объекты (нет metadata/spec/status envelope).
// grpc-gateway сериализует proto snake_case → JSON camelCase.

// ====== Operations ======

export type OperationStatus =
  | "OPERATION_STATUS_UNSPECIFIED"
  | "OPERATION_STATUS_RUNNING"
  | "OPERATION_STATUS_DONE"
  | "OPERATION_STATUS_CANCELLED"
  | "OPERATION_STATUS_FAILED"
  | string;

export interface OperationError {
  code?: number;
  message?: string;
  details?: unknown;
}

export interface Operation {
  id: string;
  description?: string;
  createdAt?: string;
  createdBy?: string;
  modifiedAt?: string;
  done: boolean;
  resourceId?: string;
  resourceType?: string;
  folderId?: string;
  status?: OperationStatus;
  response?: Record<string, unknown>;
  error?: OperationError;
}

export interface OperationList {
  operations: Operation[];
  nextPageToken?: string;
}

// ====== resourcemanager ======

export interface Organization {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  createdAt?: string;
  status?: string;
}

export interface OrganizationList {
  organizations: Organization[];
  nextPageToken?: string;
}

export interface Cloud {
  id: string;
  organizationId?: string;
  name: string;
  displayName?: string;
  description?: string;
  createdAt?: string;
  status?: string;
}

export interface CloudList {
  clouds: Cloud[];
  nextPageToken?: string;
}

export interface Folder {
  id: string;
  cloudId?: string;
  organizationId?: string;
  name: string;
  displayName?: string;
  description?: string;
  createdAt?: string;
  status?: string;
}

export interface FolderList {
  folders: Folder[];
  nextPageToken?: string;
}

// ====== vpc ======

export interface Network {
  id: string;
  folderId?: string;
  name: string;
  displayName?: string;
  description?: string;
  createdAt?: string;
  status?: string;
}

export interface NetworkList {
  networks: Network[];
  nextPageToken?: string;
}

export interface Subnet {
  id: string;
  folderId?: string;
  networkId?: string;
  name: string;
  displayName?: string;
  description?: string;
  zoneId?: string;
  cidrBlock?: string;
  createdAt?: string;
  status?: string;
}

export interface SubnetList {
  subnets: Subnet[];
  nextPageToken?: string;
}

export interface SecurityGroup {
  id: string;
  folderId?: string;
  networkId?: string;
  name: string;
  displayName?: string;
  createdAt?: string;
  status?: string;
  rules?: Array<{
    id?: string;
    direction?: string;
    protocol?: string;
    portRangeMin?: number;
    portRangeMax?: number;
    cidrBlocks?: string[];
    description?: string;
  }>;
}

export interface SecurityGroupList {
  securityGroups: SecurityGroup[];
  nextPageToken?: string;
}

export interface RouteTable {
  id: string;
  folderId?: string;
  networkId?: string;
  name: string;
  displayName?: string;
  createdAt?: string;
  status?: string;
  staticRoutes?: Array<{
    destinationPrefix?: string;
    nextHopAddress?: string;
    description?: string;
  }>;
}

export interface RouteTableList {
  routeTables: RouteTable[];
  nextPageToken?: string;
}

export interface Address {
  id: string;
  folderId?: string;
  name: string;
  displayName?: string;
  description?: string;
  zoneId?: string;
  addressType?: string;
  createdAt?: string;
  status?: string;
  allocatedIpv4?: string;
}

export interface AddressList {
  addresses: Address[];
  nextPageToken?: string;
}

// ====== compute ======

export interface Instance {
  id: string;
  folderId?: string;
  name: string;
  displayName?: string;
  description?: string;
  zoneId?: string;
  platformId?: string;
  createdAt?: string;
  status?: string;
  resources?: {
    cores?: number;
    memory?: string;
    coreFraction?: number;
  };
  bootDisk?: {
    diskId?: string;
    autoDelete?: boolean;
  };
  networkInterfaces?: Array<{
    subnetId?: string;
    primaryV4Address?: string;
  }>;
  desiredPowerState?: string;
  fqdn?: string;
  ips?: {
    internal?: string[];
    external?: string[];
  };
}

export interface InstanceList {
  instances: Instance[];
  nextPageToken?: string;
}

export interface Disk {
  id: string;
  folderId?: string;
  name: string;
  displayName?: string;
  description?: string;
  zoneId?: string;
  diskTypeId?: string;
  size?: string;
  imageId?: string;
  createdAt?: string;
  status?: string;
}

export interface DiskList {
  disks: Disk[];
  nextPageToken?: string;
}

export interface Image {
  id: string;
  name: string;
  family?: string;
  osType?: string;
  description?: string;
  createdAt?: string;
  status?: string;
}

export interface ImageList {
  images: Image[];
  nextPageToken?: string;
}

export interface Snapshot {
  id: string;
  folderId?: string;
  name: string;
  displayName?: string;
  description?: string;
  diskId?: string;
  createdAt?: string;
  status?: string;
  progressPercent?: number;
}

export interface SnapshotList {
  snapshots: Snapshot[];
  nextPageToken?: string;
}

// ====== loadbalancer ======

export interface NetworkLoadBalancer {
  id: string;
  folderId?: string;
  name: string;
  displayName?: string;
  description?: string;
  regionId?: string;
  createdAt?: string;
  status?: string;
  externalIps?: string[];
  listeners?: Array<{
    name?: string;
    port?: number;
    protocol?: string;
    targetPort?: number;
  }>;
  attachedTargetGroups?: Array<{
    targetGroupId?: string;
  }>;
}

export interface NlbList {
  networkLoadBalancers: NetworkLoadBalancer[];
  nextPageToken?: string;
}

export interface TargetGroup {
  id: string;
  folderId?: string;
  name: string;
  displayName?: string;
  description?: string;
  regionId?: string;
  createdAt?: string;
  status?: string;
  targets?: Array<{
    subnetId?: string;
    address?: string;
    instanceId?: string;
  }>;
}

export interface TargetGroupList {
  targetGroups: TargetGroup[];
  nextPageToken?: string;
}
