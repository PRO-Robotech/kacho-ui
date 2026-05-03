// Per-resource API helpers. Обёртки над api/client.api.list/get.
// Используются FolderSelector, DashboardPage и другими компонентами,
// которые не могут пользоваться generic registry.

import { api } from "./client";
import type {
  CloudList,
  DiskList,
  FolderList,
  ImageList,
  InstanceList,
  NetworkList,
  NlbList,
  OrganizationList,
  SubnetList,
  TargetGroupList,
} from "./types";

// ====== resourcemanager ======

export const orgsApi = {
  list: (q?: Record<string, string>) =>
    api.list<OrganizationList>("/v1/organizations", q),
};

export const cloudsApi = {
  list: (q?: Record<string, string>) =>
    api.list<CloudList>("/v1/clouds", q),
};

export const foldersApi = {
  list: (q?: Record<string, string>) =>
    api.list<FolderList>("/v1/folders", q),
};

// ====== vpc ======

export const networksApi = {
  list: (q?: Record<string, string>) =>
    api.list<NetworkList>("/v1/networks", q),
};

export const subnetsApi = {
  list: (q?: Record<string, string>) =>
    api.list<SubnetList>("/v1/subnets", q),
};

// ====== compute ======

export const instancesApi = {
  list: (q?: Record<string, string>) =>
    api.list<InstanceList>("/v1/instances", q),
};

export const disksApi = {
  list: (q?: Record<string, string>) =>
    api.list<DiskList>("/v1/disks", q),
};

export const imagesApi = {
  list: (q?: Record<string, string>) =>
    api.list<ImageList>("/v1/images", q),
};

// ====== loadbalancer ======

export const nlbApi = {
  list: (q?: Record<string, string>) =>
    api.list<NlbList>("/v1/network-load-balancers", q),
};

export const tgApi = {
  list: (q?: Record<string, string>) =>
    api.list<TargetGroupList>("/v1/target-groups", q),
};
