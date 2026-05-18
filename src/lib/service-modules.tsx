// service-modules — реестр «компонентов» (опубликованных сервисов) Kachō-консоли.
//
// Каждый модуль (vpc / compute) описывает:
//   • плашку на дашборде (label / icon / color / description / список stat-метрик);
//   • собственный набор ссылок сайдбара (items) — рендерится, когда активен этот модуль.
//
// Модуль считается «активным», если текущий URL начинается с `/folders/:fid/<segment>/...`
// (см. moduleFromPathname). Дашборд / Resource Manager / System — вне модулей; сайдбар
// в этом случае показывает лаунчеры модулей (COMMON_TOP → лаунчеры → COMMON_BOTTOM).

import type { ReactNode } from "react";
import {
  HomeOutlined,
  SearchOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  GlobalOutlined,
  NodeIndexOutlined,
  SafetyOutlined,
  GatewayOutlined,
  ApiOutlined,
  HistoryOutlined,
  DesktopOutlined,
  HddOutlined,
  FileImageOutlined,
  CameraOutlined,
  SettingOutlined,
  UserOutlined,
  CloudServerOutlined,
  LockOutlined,
} from "@ant-design/icons";

export interface NavLeaf {
  key: string;
  icon: ReactNode;
  /** Tooltip / aria-label. */
  label: string;
  to: (projectId: string | null) => string;
  matches: (pathname: string) => boolean;
  requiresFolder?: boolean;
}

/** Stat-метрика плашки: считается через GET `${listPath}?folder_id=…&pageSize=1000` → `resp[payloadKey].length`. */
export interface ModuleStat {
  key: string;
  label: string;
  listPath: string;
  payloadKey: string;
}

export interface ServiceModule {
  /** Стабильный ключ модуля (`vpc` | `compute`). */
  key: string;
  /** URL-сегмент под `/folders/:fid/`. */
  segment: string;
  /** Полное имя для плашки. */
  label: string;
  /** Короткое имя (бейдж / breadcrumb). */
  short: string;
  icon: ReactNode;
  color: string;
  description: string;
  /** Куда вести при клике по плашке / лаунчеру — с учётом наличия folder/cloud. */
  landing: (projectId: string | null, cloudId: string | null) => string;
  stats: ModuleStat[];
  items: NavLeaf[];
}

const seg = (f: string | null, path: string) => (f ? `/projects/${f}/${path}` : "/dashboard");
const folderRe = (path: string) => new RegExp(`^/projects/[^/]+/${path.replace(/\//g, "\\/")}`);
const iamSeg = (path: string) => `/iam/${path}`;
const iamRe = (path: string) => new RegExp(`^/iam/${path.replace(/\//g, "\\/")}`);

export const SERVICE_MODULES: ServiceModule[] = [
  {
    key: "vpc",
    segment: "vpc",
    label: "Virtual Private Cloud",
    short: "VPC",
    icon: <ApartmentOutlined />,
    color: "#3D8DF5",
    description: "Облачные сети, подсети, группы безопасности, публичные IP, таблицы маршрутизации.",
    landing: (f, c) => (f ? `/projects/${f}/vpc/networks` : c ? `/clouds/${c}/folders` : "/organizations"),
    stats: [
      { key: "networks", label: "Сетей", listPath: "/vpc/v1/networks", payloadKey: "networks" },
      { key: "subnets", label: "Подсетей", listPath: "/vpc/v1/subnets", payloadKey: "subnets" },
      { key: "sgs", label: "Групп безопасности", listPath: "/vpc/v1/securityGroups", payloadKey: "security_groups" },
    ],
    items: [
      { key: "networks", icon: <ApartmentOutlined />, label: "Облачные сети", to: (f) => seg(f, "vpc/networks"), matches: (p) => folderRe("vpc/networks").test(p), requiresFolder: true },
      { key: "subnets", icon: <ClusterOutlined />, label: "Подсети", to: (f) => seg(f, "vpc/subnets"), matches: (p) => folderRe("vpc/subnets").test(p), requiresFolder: true },
      { key: "addresses", icon: <GlobalOutlined />, label: "Публичные IP-адреса", to: (f) => seg(f, "vpc/addresses"), matches: (p) => folderRe("vpc/addresses").test(p), requiresFolder: true },
      { key: "route-tables", icon: <NodeIndexOutlined />, label: "Таблицы маршрутизации", to: (f) => seg(f, "vpc/route-tables"), matches: (p) => folderRe("vpc/route-tables").test(p), requiresFolder: true },
      { key: "security-groups", icon: <SafetyOutlined />, label: "Группы безопасности", to: (f) => seg(f, "vpc/security-groups"), matches: (p) => folderRe("vpc/security-groups").test(p), requiresFolder: true },
      { key: "network-interfaces", icon: <ApiOutlined />, label: "Сетевые интерфейсы", to: (f) => seg(f, "vpc/network-interfaces"), matches: (p) => folderRe("vpc/network-interfaces").test(p), requiresFolder: true },
      { key: "gateways", icon: <GatewayOutlined />, label: "Шлюзы", to: (f) => seg(f, "vpc/gateways"), matches: (p) => folderRe("vpc/gateways").test(p), requiresFolder: true },
      { key: "operations", icon: <HistoryOutlined />, label: "Операции", to: (f) => seg(f, "vpc/operations"), matches: (p) => folderRe("vpc/operations").test(p), requiresFolder: true },
    ],
  },
  {
    key: "compute",
    segment: "compute",
    label: "Compute Cloud",
    short: "Compute",
    icon: <CloudServerOutlined />,
    color: "#36CFC9",
    description: "Виртуальные машины, диски, образы и снимки дисков.",
    landing: (f) => (f ? `/projects/${f}/compute/instances` : "/dashboard"),
    stats: [
      { key: "instances", label: "Машин", listPath: "/compute/v1/instances", payloadKey: "instances" },
      { key: "disks", label: "Дисков", listPath: "/compute/v1/disks", payloadKey: "disks" },
      { key: "images", label: "Образов", listPath: "/compute/v1/images", payloadKey: "images" },
    ],
    items: [
      { key: "compute-instances", icon: <DesktopOutlined />, label: "Виртуальные машины", to: (f) => seg(f, "compute/instances"), matches: (p) => folderRe("compute/instances").test(p), requiresFolder: true },
      { key: "compute-disks", icon: <HddOutlined />, label: "Диски", to: (f) => seg(f, "compute/disks"), matches: (p) => folderRe("compute/disks").test(p), requiresFolder: true },
      { key: "compute-images", icon: <FileImageOutlined />, label: "Образы", to: (f) => seg(f, "compute/images"), matches: (p) => folderRe("compute/images").test(p), requiresFolder: true },
      { key: "compute-snapshots", icon: <CameraOutlined />, label: "Снимки дисков", to: (f) => seg(f, "compute/snapshots"), matches: (p) => folderRe("compute/snapshots").test(p), requiresFolder: true },
    ],
  },
  // KAC-117/120: IAM — отдельный module-block, параллельно VPC/Compute.
  // IAM ресурсы: Account, Project, User, ServiceAccount, Group, Role, AccessBinding.
  // Не требует folder/project context (живёт на уровне /iam/*).
  {
    key: "iam",
    segment: "iam",
    label: "Identity and Access Management",
    short: "IAM",
    icon: <LockOutlined />,
    color: "#9B59F6",
    description: "Аккаунты, проекты, пользователи, сервисные аккаунты, группы, роли и связки прав.",
    landing: () => "/iam/accounts",
    stats: [
      { key: "accounts", label: "Аккаунтов", listPath: "/iam/v1/accounts", payloadKey: "accounts" },
      { key: "projects", label: "Проектов", listPath: "/iam/v1/projects", payloadKey: "projects" },
      { key: "roles", label: "Ролей", listPath: "/iam/v1/roles", payloadKey: "roles" },
    ],
    items: [
      { key: "iam-accounts", icon: <ApartmentOutlined />, label: "Аккаунты", to: () => iamSeg("accounts"), matches: (p) => iamRe("accounts").test(p) },
      { key: "iam-projects", icon: <ClusterOutlined />, label: "Проекты", to: () => iamSeg("projects"), matches: (p) => iamRe("projects").test(p) },
      { key: "iam-users", icon: <UserOutlined />, label: "Пользователи", to: () => iamSeg("users"), matches: (p) => iamRe("users").test(p) },
      { key: "iam-service-accounts", icon: <ApiOutlined />, label: "Сервисные аккаунты", to: () => iamSeg("service-accounts"), matches: (p) => iamRe("service-accounts").test(p) },
      { key: "iam-groups", icon: <NodeIndexOutlined />, label: "Группы", to: () => iamSeg("groups"), matches: (p) => iamRe("groups").test(p) },
      { key: "iam-roles", icon: <SafetyOutlined />, label: "Роли", to: () => iamSeg("roles"), matches: (p) => iamRe("roles").test(p) },
      { key: "iam-access-bindings", icon: <GatewayOutlined />, label: "Связки прав", to: () => iamSeg("access-bindings"), matches: (p) => iamRe("access-bindings").test(p) },
    ],
  },
];

/** Активный модуль по URL — `/folders/:fid/<segment>/...` → ServiceModule | null. */
export function moduleFromPathname(pathname: string): ServiceModule | null {
  const m = pathname.match(/^\/folders\/[^/]+\/([^/]+)/);
  if (!m) return null;
  return SERVICE_MODULES.find((mod) => mod.segment === m[1]) ?? null;
}

/** Верхний общий блок сайдбара (всегда виден). */
export const COMMON_TOP: NavLeaf[] = [
  {
    key: "dashboard",
    icon: <HomeOutlined />,
    label: "Все сервисы",
    to: (f) => (f ? `/projects/${f}/dashboard` : "/dashboard"),
    matches: (p) => p === "/dashboard" || /^\/folders\/[^/]+\/dashboard$/.test(p),
  },
  {
    key: "search",
    icon: <SearchOutlined />,
    label: "Поиск",
    to: () => "/system/search",
    matches: (p) => p.startsWith("/system/search"),
  },
];

/** Нижний общий блок сайдбара (всегда виден). KAC-120: IAM удалён отсюда —
 *  теперь регистрируется как module-block в SERVICE_MODULES (параллельно VPC/Compute). */
export const COMMON_BOTTOM: NavLeaf[] = [
  {
    key: "system",
    icon: <SettingOutlined />,
    label: "Администрирование",
    to: () => "/system/regions",
    matches: (p) => /^\/system\/(regions|zones|address-pools)/.test(p),
  },
  {
    key: "profile",
    icon: <UserOutlined />,
    label: "Профиль",
    to: () => "/system/search",
    matches: () => false,
  },
];
