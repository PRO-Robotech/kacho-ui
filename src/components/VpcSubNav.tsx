// VpcSubNav — левый sidebar с разделами VPC сервиса. Показывается на
// /folders/:folderId/* и /system/{regions,zones,address-pools}.
//
// Соответствует YC: при работе с одним сервисом слева — sub-nav этого
// сервиса (Сети / Подсети / Публичные IP / Таблицы маршрутизации /
// Группы безопасности / Шлюзы / Карта / Операции).

import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import {
  ApartmentOutlined,
  ClusterOutlined,
  GlobalOutlined,
  NodeIndexOutlined,
  SafetyOutlined,
  GatewayOutlined,
  AppstoreOutlined,
  EnvironmentOutlined,
  CloudOutlined,
  DatabaseOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useFolderStore } from "@/lib/folder-store";

interface NavItem {
  key: string; // matches segment, used in path
  label: string;
  icon: React.ReactNode;
  scope: "folder" | "system";
  disabled?: boolean;
}

// VPC разделы — в порядке как у YC.
const VPC_NAV: NavItem[] = [
  { key: "networks", label: "Облачные сети", icon: <ApartmentOutlined />, scope: "folder" },
  { key: "subnets", label: "Подсети", icon: <ClusterOutlined />, scope: "folder" },
  { key: "addresses", label: "Публичные IP-адреса", icon: <GlobalOutlined />, scope: "folder" },
  { key: "route-tables", label: "Таблицы маршрутизации", icon: <NodeIndexOutlined />, scope: "folder" },
  { key: "security-groups", label: "Группы безопасности", icon: <SafetyOutlined />, scope: "folder" },
  // Заглушки разделов, которых пока нет — отображаем disabled.
  { key: "gateways", label: "Шлюзы", icon: <GatewayOutlined />, scope: "folder", disabled: true },
  { key: "map", label: "Карта облачной сети", icon: <AppstoreOutlined />, scope: "folder", disabled: true },
  { key: "operations", label: "Операции", icon: <EnvironmentOutlined />, scope: "folder", disabled: true },
];

const SYSTEM_NAV: NavItem[] = [
  { key: "search", label: "Поиск", icon: <SearchOutlined />, scope: "system" },
  { key: "regions", label: "Регионы", icon: <GlobalOutlined />, scope: "system" },
  { key: "zones", label: "Зоны", icon: <CloudOutlined />, scope: "system" },
  { key: "address-pools", label: "Пулы адресов", icon: <DatabaseOutlined />, scope: "system" },
];

export function VpcSubNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const folder = useFolderStore((s) => s.folder);

  // Определяем активный раздел по pathname.
  const activeKey = useMemo(() => {
    const folderMatch = location.pathname.match(/^\/folders\/[^/]+\/([^/?]+)/);
    if (folderMatch) return folderMatch[1];
    const sysMatch = location.pathname.match(/^\/system\/([^/?]+)/);
    if (sysMatch) return sysMatch[1];
    return "";
  }, [location.pathname]);

  // Отображаем VPC-секцию + System-секцию (admin).
  const items: MenuProps["items"] = [
    {
      key: "vpc-group",
      label: "Virtual Private Cloud",
      type: "group" as const,
      children: VPC_NAV.map((it) => ({
        key: it.key,
        label: it.label,
        icon: it.icon,
        disabled: it.disabled || (it.scope === "folder" && !folder),
      })),
    },
    {
      key: "system-group",
      label: "Администрирование",
      type: "group" as const,
      children: SYSTEM_NAV.map((it) => ({
        key: it.key,
        label: it.label,
        icon: it.icon,
      })),
    },
  ];

  const onClick: MenuProps["onClick"] = ({ key }) => {
    const vpcItem = VPC_NAV.find((i) => i.key === key);
    if (vpcItem) {
      if (vpcItem.disabled) return;
      if (!folder) return;
      navigate(`/folders/${folder.id}/${key}`);
      return;
    }
    const sysItem = SYSTEM_NAV.find((i) => i.key === key);
    if (sysItem) {
      navigate(`/system/${key}`);
    }
  };

  return (
    <Menu
      mode="inline"
      selectedKeys={[activeKey]}
      onClick={onClick}
      items={items}
      style={{
        borderRight: "none",
        background: "transparent",
        height: "100%",
        paddingTop: 8,
      }}
    />
  );
}
