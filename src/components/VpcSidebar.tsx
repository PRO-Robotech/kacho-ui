// VpcSidebar — узкий icon-only глобальный навигатор сервисов (как в YC console).
// Ширина 56px. Tooltip on hover. Активный — заливка + 3px вертикальная полоска слева.
//
// Структура:
//   ⌂  Дашборд
//   🔍 Поиск
//   ─
//   ⊟  Сети           — VPC, требуют выбранный folder
//   ⊠  Подсети
//   ⊕  Публичные IP
//   ⇄  Таблицы маршрутизации
//   ⛛  Группы безопасности
//   ─
//   ⚙  Администрирование (Regions/Zones/Pools)
//   👤 Профиль (заглушка)
//
// При отсутствии folder VPC-иконки disabled (muted цвет, тулзип «Выберите каталог»).
// Иерархия Org→Cloud→Folder выбирается через три pill'а в шапке (BreadcrumbSelector).

import { useMemo, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Tooltip, theme } from "antd";
import {
  HomeOutlined,
  SearchOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  GlobalOutlined,
  NodeIndexOutlined,
  SafetyOutlined,
  SettingOutlined,
  UserOutlined,
  HistoryOutlined,
  GatewayOutlined,
  DesktopOutlined,
  HddOutlined,
  FileImageOutlined,
  CameraOutlined,
} from "@ant-design/icons";
import { useFolderStore } from "@/lib/folder-store";

interface NavItem {
  kind: "item";
  key: string;
  icon: ReactNode;
  tooltip: string;
  to: (folderId: string | null) => string;
  matches: (pathname: string) => boolean;
  requiresFolder?: boolean;
}

interface NavDivider {
  kind: "divider";
  key: string;
}

type NavEntry = NavItem | NavDivider;

const ITEMS: NavEntry[] = [
  {
    kind: "item",
    key: "dashboard",
    icon: <HomeOutlined />,
    tooltip: "Дашборд",
    // Если folder выбран — сохраняем путь до него в URL.
    to: (f) => (f ? `/folders/${f}/dashboard` : "/dashboard"),
    matches: (p) =>
      p === "/dashboard" || /^\/folders\/[^/]+\/dashboard$/.test(p),
  },
  {
    kind: "item",
    key: "search",
    icon: <SearchOutlined />,
    tooltip: "Поиск",
    to: () => "/system/search",
    matches: (p) => p.startsWith("/system/search"),
  },
  { kind: "divider", key: "div-1" },
  {
    kind: "item",
    key: "networks",
    icon: <ApartmentOutlined />,
    tooltip: "Облачные сети",
    to: (f) => (f ? `/folders/${f}/vpc/networks` : "/dashboard"),
    matches: (p) => /^\/folders\/[^/]+\/vpc\/networks/.test(p),
    requiresFolder: true,
  },
  {
    kind: "item",
    key: "subnets",
    icon: <ClusterOutlined />,
    tooltip: "Подсети",
    to: (f) => (f ? `/folders/${f}/vpc/subnets` : "/dashboard"),
    matches: (p) => /^\/folders\/[^/]+\/vpc\/subnets/.test(p),
    requiresFolder: true,
  },
  {
    kind: "item",
    key: "addresses",
    icon: <GlobalOutlined />,
    tooltip: "Публичные IP-адреса",
    to: (f) => (f ? `/folders/${f}/vpc/addresses` : "/dashboard"),
    matches: (p) => /^\/folders\/[^/]+\/vpc\/addresses/.test(p),
    requiresFolder: true,
  },
  {
    kind: "item",
    key: "route-tables",
    icon: <NodeIndexOutlined />,
    tooltip: "Таблицы маршрутизации",
    to: (f) => (f ? `/folders/${f}/vpc/route-tables` : "/dashboard"),
    matches: (p) => /^\/folders\/[^/]+\/vpc\/route-tables/.test(p),
    requiresFolder: true,
  },
  {
    kind: "item",
    key: "security-groups",
    icon: <SafetyOutlined />,
    tooltip: "Группы безопасности",
    to: (f) => (f ? `/folders/${f}/vpc/security-groups` : "/dashboard"),
    matches: (p) => /^\/folders\/[^/]+\/vpc\/security-groups/.test(p),
    requiresFolder: true,
  },
  {
    kind: "item",
    key: "gateways",
    icon: <GatewayOutlined />,
    tooltip: "Шлюзы",
    to: (f) => (f ? `/folders/${f}/vpc/gateways` : "/dashboard"),
    matches: (p) => /^\/folders\/[^/]+\/vpc\/gateways/.test(p),
    requiresFolder: true,
  },
  {
    kind: "item",
    key: "operations",
    icon: <HistoryOutlined />,
    tooltip: "Операции",
    to: (f) => (f ? `/folders/${f}/vpc/operations` : "/dashboard"),
    matches: (p) => /^\/folders\/[^/]+\/vpc\/operations/.test(p),
    requiresFolder: true,
  },
  { kind: "divider", key: "div-compute" },
  {
    kind: "item",
    key: "compute-instances",
    icon: <DesktopOutlined />,
    tooltip: "Виртуальные машины",
    to: (f) => (f ? `/folders/${f}/compute/instances` : "/dashboard"),
    matches: (p) => /^\/folders\/[^/]+\/compute\/instances/.test(p),
    requiresFolder: true,
  },
  {
    kind: "item",
    key: "compute-disks",
    icon: <HddOutlined />,
    tooltip: "Диски",
    to: (f) => (f ? `/folders/${f}/compute/disks` : "/dashboard"),
    matches: (p) => /^\/folders\/[^/]+\/compute\/disks/.test(p),
    requiresFolder: true,
  },
  {
    kind: "item",
    key: "compute-images",
    icon: <FileImageOutlined />,
    tooltip: "Образы",
    to: (f) => (f ? `/folders/${f}/compute/images` : "/dashboard"),
    matches: (p) => /^\/folders\/[^/]+\/compute\/images/.test(p),
    requiresFolder: true,
  },
  {
    kind: "item",
    key: "compute-snapshots",
    icon: <CameraOutlined />,
    tooltip: "Снимки дисков",
    to: (f) => (f ? `/folders/${f}/compute/snapshots` : "/dashboard"),
    matches: (p) => /^\/folders\/[^/]+\/compute\/snapshots/.test(p),
    requiresFolder: true,
  },
  { kind: "divider", key: "div-2" },
  {
    kind: "item",
    key: "system",
    icon: <SettingOutlined />,
    tooltip: "Администрирование",
    to: () => "/system/regions",
    matches: (p) => /^\/system\/(regions|zones|address-pools)/.test(p),
  },
  {
    kind: "item",
    key: "profile",
    icon: <UserOutlined />,
    tooltip: "Профиль",
    to: () => "/system/search",
    matches: () => false,
  },
];

export function VpcSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const folder = useFolderStore((s) => s.folder);
  const folderId = folder?.id ?? null;
  const { token } = theme.useToken();

  const activeKey = useMemo(() => {
    return ITEMS.find((e) => e.kind === "item" && (e as NavItem).matches(location.pathname))?.key ?? null;
  }, [location.pathname]);

  return (
    <nav
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 8,
        paddingBottom: 8,
        gap: 2,
        height: "100%",
      }}
      aria-label="Сервисы"
    >
      {ITEMS.map((entry) => {
        if (entry.kind === "divider") {
          return (
            <div
              key={entry.key}
              style={{
                width: 32,
                height: 1,
                background: token.colorBorderSecondary,
                margin: "6px 0",
              }}
            />
          );
        }
        const disabled = !!entry.requiresFolder && !folderId;
        const active = activeKey === entry.key;
        return (
          <Tooltip
            key={entry.key}
            title={disabled ? "Выберите каталог" : entry.tooltip}
            placement="right"
            mouseEnterDelay={0.4}
          >
            <button
              type="button"
              onClick={() => !disabled && navigate(entry.to(folderId))}
              aria-label={entry.tooltip}
              aria-current={active ? "page" : undefined}
              disabled={disabled}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 36,
                borderRadius: 6,
                border: "none",
                background: active ? token.colorBgElevated : "transparent",
                color: disabled
                  ? (token.colorTextDisabled ?? token.colorTextTertiary)
                  : active
                  ? token.colorText
                  : token.colorTextSecondary,
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: 18,
                transition: "background-color 120ms ease, color 120ms ease",
              }}
              onMouseEnter={(e) => {
                if (!disabled && !active) {
                  (e.currentTarget as HTMLButtonElement).style.background = token.colorFillTertiary;
                  (e.currentTarget as HTMLButtonElement).style.color = token.colorText;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = disabled
                    ? (token.colorTextDisabled ?? token.colorTextTertiary)
                    : token.colorTextSecondary;
                }
              }}
            >
              {active && (
                <span
                  style={{
                    position: "absolute",
                    left: -8,
                    top: 6,
                    bottom: 6,
                    width: 3,
                    borderRadius: 2,
                    background: token.colorPrimary,
                  }}
                />
              )}
              {entry.icon}
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
}
