// TS-типы для flat API (sub-phase 1.0, verbatim YC proto).
// Ресурсы — плоские объекты (нет metadata/spec/status envelope).
// grpc-gateway сериализует proto snake_case → JSON snake_case (прямой маппинг).

// ====== Operation ======

export interface Operation {
  id: string;
  description?: string;
  created_at?: string;
  created_by?: string;
  modified_at?: string;
  done: boolean;
  metadata?: { "@type": string; [key: string]: unknown };
  error?: { code: number; message: string; details?: unknown[] };
  response?: { "@type": string; [key: string]: unknown };
}

export interface OperationList {
  operations: Operation[];
  next_page_token?: string;
}

// ====== organization-manager ======

export interface Organization {
  id: string;
  created_at?: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  language?: string;
  title?: string;
}

export interface OrganizationList {
  organizations: Organization[];
  next_page_token?: string;
}

// ====== resource-manager ======

export interface Cloud {
  id: string;
  created_at?: string;
  name: string;
  description?: string;
  organization_id?: string;
  labels?: Record<string, string>;
}

export interface CloudList {
  clouds: Cloud[];
  next_page_token?: string;
}

export interface Folder {
  id: string;
  created_at?: string;
  name: string;
  description?: string;
  cloud_id?: string;
  labels?: Record<string, string>;
  status?: "STATUS_UNSPECIFIED" | "CREATING" | "ACTIVE" | "DELETING" | string;
}

export interface FolderList {
  folders: Folder[];
  next_page_token?: string;
}

// ====== vpc ======

export interface Network {
  id: string;
  folder_id?: string;
  created_at?: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  default_security_group_id?: string;
}

export interface NetworkList {
  networks: Network[];
  next_page_token?: string;
}

export interface Subnet {
  id: string;
  folder_id?: string;
  created_at?: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  network_id?: string;
  zone_id?: string;
  v4_cidr_blocks?: string[];
  v6_cidr_blocks?: string[];
  route_table_id?: string;
}

export interface SubnetList {
  subnets: Subnet[];
  next_page_token?: string;
}

export interface Address {
  id: string;
  folder_id?: string;
  created_at?: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  external_ipv4_address?: { address: string; zone_id: string };
  internal_ipv4_address?: { address: string; subnet_id: string };
  reserved?: boolean;
  used?: boolean;
  type?: string;
  ip_version?: string;
  deletion_protection?: boolean;
  dns_record?: string;
}

export interface AddressList {
  addresses: Address[];
  next_page_token?: string;
}

export interface RouteTable {
  id: string;
  folder_id?: string;
  created_at?: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  network_id?: string;
  static_routes?: Array<{
    destination_prefix?: string;
    next_hop_address?: string;
    labels?: Record<string, string>;
  }>;
}

export interface RouteTableList {
  route_tables: RouteTable[];
  next_page_token?: string;
}
