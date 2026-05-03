// Per-resource API helpers. Каждая функция — обёртка над api/client.post.

import { post } from "./client";
import type {
  CloudList,
  DiskList,
  FolderList,
  ImageList,
  InstanceList,
  ListRequest,
  NetworkList,
  NlbList,
  Organization,
  OrganizationList,
  Cloud,
  Folder,
  Network,
  Subnet,
  SubnetList,
  TgList,
  Instance,
  Disk,
  NetworkLoadBalancer,
  TargetGroup,
} from "./types";

// ====== resourcemanager ======

export const orgsApi = {
  list: (req: ListRequest = {}) =>
    post<ListRequest, OrganizationList>("/v1/organizations/list", req),
  upsert: (organizations: Organization[]) =>
    post<{ organizations: Organization[] }, { organizations: Organization[] }>(
      "/v1/organizations/upsert",
      { organizations },
    ),
};

export const cloudsApi = {
  list: (req: ListRequest = {}) =>
    post<ListRequest, CloudList>("/v1/clouds/list", req),
  upsert: (clouds: Cloud[]) =>
    post<{ clouds: Cloud[] }, { clouds: Cloud[] }>("/v1/clouds/upsert", { clouds }),
};

export const foldersApi = {
  list: (req: ListRequest = {}) =>
    post<ListRequest, FolderList>("/v1/folders/list", req),
  upsert: (folders: Folder[]) =>
    post<{ folders: Folder[] }, { folders: Folder[] }>("/v1/folders/upsert", { folders }),
};

// ====== vpc ======

export const networksApi = {
  list: (req: ListRequest = {}) => post<ListRequest, NetworkList>("/v1/networks/list", req),
  upsert: (networks: Network[]) =>
    post<{ networks: Network[] }, { networks: Network[] }>("/v1/networks/upsert", { networks }),
  delete: (uids: string[]) =>
    post<{ uids: string[] }, unknown>("/v1/networks/delete", { uids }),
};

export const subnetsApi = {
  list: (req: ListRequest = {}) => post<ListRequest, SubnetList>("/v1/subnets/list", req),
  upsert: (subnets: Subnet[]) =>
    post<{ subnets: Subnet[] }, { subnets: Subnet[] }>("/v1/subnets/upsert", { subnets }),
};

// ====== compute ======

export const instancesApi = {
  list: (req: ListRequest = {}) => post<ListRequest, InstanceList>("/v1/instances/list", req),
  upsert: (instances: Instance[]) =>
    post<{ instances: Instance[] }, { instances: Instance[] }>("/v1/instances/upsert", { instances }),
  restart: (uid: string) =>
    post<{ uid: string }, unknown>("/v1/instances/restart", { uid }),
};

export const disksApi = {
  list: (req: ListRequest = {}) => post<ListRequest, DiskList>("/v1/disks/list", req),
  upsert: (disks: Disk[]) =>
    post<{ disks: Disk[] }, { disks: Disk[] }>("/v1/disks/upsert", { disks }),
};

export const imagesApi = {
  list: (req: ListRequest = {}) => post<ListRequest, ImageList>("/v1/images/list", req),
};

// ====== loadbalancer ======

export const nlbApi = {
  list: (req: ListRequest = {}) => post<ListRequest, NlbList>("/v1/network-load-balancers/list", req),
  upsert: (nlbs: NetworkLoadBalancer[]) =>
    post<{ networkLoadBalancers: NetworkLoadBalancer[] }, { networkLoadBalancers: NetworkLoadBalancer[] }>(
      "/v1/network-load-balancers/upsert",
      { networkLoadBalancers: nlbs },
    ),
};

export const tgApi = {
  list: (req: ListRequest = {}) => post<ListRequest, TgList>("/v1/target-groups/list", req),
  upsert: (tgs: TargetGroup[]) =>
    post<{ targetGroups: TargetGroup[] }, { targetGroups: TargetGroup[] }>(
      "/v1/target-groups/upsert",
      { targetGroups: tgs },
    ),
};
