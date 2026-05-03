// Минимальные TS-типы под наш envelope. Соответствуют kacho-proto/proto/.../v1/*.proto.
// Поля в camelCase — grpc-gateway сериализует proto snake_case → JSON camelCase.

export interface ResourceMeta {
  uid: string;
  name: string;
  organizationId?: string;
  cloudId?: string;
  folderId?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: string;
  resourceVersion?: string;
  generation?: string;
  deletionTimestamp?: string;
  finalizers?: string[];
}

export interface Selector {
  field?: string;
  op?: "EQ" | "NEQ" | "IN" | "NOT_IN" | "EXISTS" | "NOT_EXISTS";
  values?: string[];
}

export interface ListRequest {
  selectors?: Selector[];
  pageSize?: number;
  pageToken?: string;
}

// ====== resourcemanager ======

export interface OrganizationSpec {
  displayName?: string;
  description?: string;
}
export interface Organization {
  metadata: ResourceMeta;
  spec?: OrganizationSpec;
}
export interface OrganizationList {
  organizations: Organization[];
  resourceVersion?: string;
  nextPageToken?: string;
}

export interface CloudSpec {
  displayName?: string;
  description?: string;
}
export interface Cloud {
  metadata: ResourceMeta;
  spec?: CloudSpec;
}
export interface CloudList {
  clouds: Cloud[];
  resourceVersion?: string;
  nextPageToken?: string;
}

export interface FolderSpec {
  displayName?: string;
  description?: string;
}
export interface Folder {
  metadata: ResourceMeta;
  spec?: FolderSpec;
}
export interface FolderList {
  folders: Folder[];
  resourceVersion?: string;
  nextPageToken?: string;
}

// ====== vpc ======

export type LifecycleState = "ACTIVE" | "CREATING" | "DELETING" | "ERROR" | string;

export interface NetworkSpec {
  displayName?: string;
  description?: string;
}
export interface NetworkStatus {
  state?: LifecycleState;
}
export interface Network {
  metadata: ResourceMeta;
  spec?: NetworkSpec;
  status?: NetworkStatus;
}
export interface NetworkList {
  networks: Network[];
  resourceVersion?: string;
  nextPageToken?: string;
}

export interface SubnetSpec {
  networkId?: string;
  zoneId?: string;
  cidrBlock?: string;
  displayName?: string;
  description?: string;
}
export interface Subnet {
  metadata: ResourceMeta;
  spec?: SubnetSpec;
  status?: { state?: LifecycleState };
}
export interface SubnetList {
  subnets: Subnet[];
  resourceVersion?: string;
}

// ====== compute ======

export type ComputeState =
  | "STATE_UNSPECIFIED"
  | "STATE_PROVISIONING"
  | "STATE_RUNNING"
  | "STATE_STOPPING"
  | "STATE_STOPPED"
  | "STATE_STARTING"
  | "STATE_ERROR"
  | "STATE_DELETING"
  | "STATE_CREATING"
  | "STATE_READY"
  | "STATE_ATTACHING"
  | "STATE_DETACHING"
  | string;

export interface InstanceSpec {
  displayName?: string;
  description?: string;
  platformId?: string;
  zoneId?: string;
  desiredPowerState?: "POWER_RUNNING" | "POWER_STOPPED" | string;
}
export interface Instance {
  metadata: ResourceMeta;
  spec?: InstanceSpec;
  status?: {
    state?: ComputeState;
    stateLastTransitionAt?: string;
    ips?: { internal?: string[]; external?: string[] };
    fqdn?: string;
    observedGeneration?: string;
  };
}
export interface InstanceList {
  instances: Instance[];
  resourceVersion?: string;
}

export interface DiskSpec {
  diskTypeId?: string;
  zoneId?: string;
  size?: string;
  imageId?: string;
  displayName?: string;
  description?: string;
}
export interface Disk {
  metadata: ResourceMeta;
  spec?: DiskSpec;
  status?: { state?: ComputeState };
}
export interface DiskList {
  disks: Disk[];
  resourceVersion?: string;
}

export interface ImageSpec {
  description?: string;
  family?: string;
  osType?: string;
}
export interface Image {
  metadata: ResourceMeta;
  spec?: ImageSpec;
  status?: { state?: string };
}
export interface ImageList {
  images: Image[];
  resourceVersion?: string;
}

// ====== loadbalancer ======

export interface NlbSpec {
  displayName?: string;
  description?: string;
  regionId?: string;
  listeners?: Array<{ name?: string; port?: number; protocol?: string; targetPort?: number }>;
  attachedTargetGroups?: Array<{ targetGroupId?: string }>;
}
export interface NetworkLoadBalancer {
  metadata: ResourceMeta;
  spec?: NlbSpec;
  status?: {
    state?: ComputeState;
    externalIps?: string[];
    observedGeneration?: string;
  };
}
export interface NlbList {
  networkLoadBalancers: NetworkLoadBalancer[];
  resourceVersion?: string;
}

export interface TargetGroup {
  metadata: ResourceMeta;
  spec?: {
    displayName?: string;
    regionId?: string;
    targets?: Array<{ subnetId?: string; address?: string; instanceId?: string }>;
  };
  status?: { state?: ComputeState };
}
export interface TgList {
  targetGroups: TargetGroup[];
  resourceVersion?: string;
}

// ====== Watch ======

export type WatchEventType = "ADDED" | "MODIFIED" | "DELETED" | string;
export interface WatchEvent<T = unknown> {
  type: WatchEventType;
  resourceVersion?: string;
  resource?: T;
}
export interface StreamEnvelope<T> {
  result?: T;
  error?: { code?: string; message?: string };
}
