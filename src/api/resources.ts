// Per-resource API helpers. Обёртки над api/client.api.list/get.
// Используются FolderSelector, DashboardPage и другими компонентами,
// которые не могут пользоваться generic registry.
// URL-ы verbatim из proto google.api.http annotations.

import { api } from "./client";
import type {
  CloudList,
  FolderList,
  NetworkList,
  OrganizationList,
  SubnetList,
  AddressList,
  RouteTableList,
} from "./types";

// ====== organization-manager ======

export const orgsApi = {
  list: (q?: Record<string, string>) =>
    api.list<OrganizationList>("/organization-manager/v1/organizations", q),
};

// ====== resource-manager ======

export const cloudsApi = {
  list: (q?: Record<string, string>) =>
    api.list<CloudList>("/resource-manager/v1/clouds", q),
};

export const foldersApi = {
  list: (q?: Record<string, string>) =>
    api.list<FolderList>("/resource-manager/v1/folders", q),
};

// ====== vpc ======

export const networksApi = {
  list: (q?: Record<string, string>) =>
    api.list<NetworkList>("/vpc/v1/networks", q),
};

export const subnetsApi = {
  list: (q?: Record<string, string>) =>
    api.list<SubnetList>("/vpc/v1/subnets", q),
};

export const addressesApi = {
  list: (q?: Record<string, string>) =>
    api.list<AddressList>("/vpc/v1/addresses", q),
};

export const routeTablesApi = {
  list: (q?: Record<string, string>) =>
    api.list<RouteTableList>("/vpc/v1/route-tables", q),
};
