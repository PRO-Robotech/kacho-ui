import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Layout as AntLayout, Tooltip, Button, theme } from "antd";
import {
  HomeOutlined,
  AppstoreOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import {
  Network,
  Layers,
  Route,
  MapPin,
  Shield,
  Globe,
  Cloud,
  Boxes,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BreadcrumbSelector } from "@/components/BreadcrumbSelector";
import { ContextUrlSync } from "@/components/ContextUrlSync";
import { HierarchyTree } from "@/components/HierarchyTree";
import { useFolderStore } from "@/lib/folder-store";
import {
  HeaderRightSlot,
  HeaderBreadcrumbSlot,
  PageHeaderSlotProvider,
} from "@/components/PageHeaderSlot";

const { Header, Sider, Content } = AntLayout;

interface NavItem {
  segment: string;
  label: string;
  icon: typeof Network;
  scope: "global" | "folder";
}

const NAV: NavItem[] = [
  { segment: "networks", label: "Облачные сети", icon: Network, scope: "folder" },
  { segment: "subnets", label: "Подсети", icon: Layers, scope: "folder" },
  { segment: "addresses", label: "Публичные IP-адреса", icon: MapPin, scope: "folder" },
  { segment: "route-tables", label: "Таблицы маршрутизации", icon: Route, scope: "folder" },
  { segment: "security-groups", label: "Группы безопасности", icon: Shield, scope: "folder" },
  // System (admin-only)
  { segment: "search", label: "Поиск", icon: Search, scope: "global" },
  { segment: "regions", label: "Регионы", icon: Globe, scope: "global" },
  { segment: "zones", label: "Зоны", icon: Cloud, scope: "global" },
  { segment: "address-pools", label: "Пулы адресов", icon: Boxes, scope: "global" },
];

export function Layout() {
  return (
    <PageHeaderSlotProvider>
      <LayoutInner />
    </PageHeaderSlotProvider>
  );
}

function LayoutInner() {
  const location = useLocation();
  const folder = useFolderStore((s) => s.folder);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const { token } = theme.useToken();

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <ContextUrlSync />
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: `1px solid ${token.colorBorder}`,
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <NavLink
          to="/"
          className="flex items-center justify-center h-7 w-7 shrink-0"
          title="Kachō Console"
        >
          <div
            className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[11px] font-bold"
            style={{ background: "linear-gradient(135deg, #fbbf24, #f43f5e)" }}
          >
            K
          </div>
        </NavLink>

        <BreadcrumbSelector />

        <Tooltip title="Все сервисы">
          <Button type="text" icon={<AppstoreOutlined />} size="small" />
        </Tooltip>
        <Tooltip title="Главная">
          <NavLink to={folder ? `/folders/${folder.id}` : "/"}>
            <Button type="text" icon={<HomeOutlined />} size="small" />
          </NavLink>
        </Tooltip>

        <span style={{ color: token.colorTextTertiary, padding: "0 4px" }}>/</span>
        <div className="flex items-center gap-2 text-sm min-w-0 flex-1 truncate">
          <HeaderBreadcrumbSlot />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <HeaderRightSlot />
        </div>
      </Header>

      <AntLayout>
        {/* Левый узкий sidebar — domain icon nav */}
        <Sider
          width={56}
          theme="dark"
          style={{
            borderRight: `1px solid ${token.colorBorder}`,
            position: "sticky",
            top: 48,
            height: "calc(100vh - 48px)",
            overflowY: "auto",
          }}
        >
          <div className="py-2 flex flex-col items-center gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const disabled = item.scope === "folder" && !folder;
              const to =
                item.scope === "global"
                  ? `/system/${item.segment}`
                  : folder
                  ? `/folders/${folder.id}/${item.segment}`
                  : "#";
              const active =
                item.scope === "global"
                  ? location.pathname.startsWith(`/system/${item.segment}`)
                  : location.pathname.startsWith(`/folders/`) &&
                    location.pathname.includes(`/${item.segment}`);
              return (
                <Tooltip
                  key={item.segment}
                  title={disabled ? `${item.label} — выберите Folder` : item.label}
                  placement="right"
                >
                  <NavLink
                    to={to}
                    className={cn(
                      "h-9 w-9 inline-flex items-center justify-center rounded-md transition-colors",
                      disabled && "opacity-30 pointer-events-none",
                    )}
                    style={{
                      background: active ? token.colorBgElevated : "transparent",
                      color: active ? token.colorText : token.colorTextSecondary,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </NavLink>
                </Tooltip>
              );
            })}
          </div>
        </Sider>

        {/* Средний sidebar — Org/Cloud/Folder tree */}
        <Sider
          width={260}
          collapsedWidth={0}
          collapsible
          collapsed={treeCollapsed}
          trigger={null}
          theme="dark"
          style={{
            borderRight: `1px solid ${token.colorBorder}`,
            position: "sticky",
            top: 48,
            height: "calc(100vh - 48px)",
          }}
        >
          <HierarchyTree />
        </Sider>

        <div
          style={{
            position: "absolute",
            top: 56,
            left: treeCollapsed ? 56 : 56 + 260,
            transition: "left 0.2s",
            zIndex: 10,
          }}
        >
          <Tooltip title={treeCollapsed ? "Развернуть дерево" : "Свернуть дерево"}>
            <Button
              type="text"
              size="small"
              icon={treeCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setTreeCollapsed((c) => !c)}
              style={{
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorder}`,
                borderRadius: "0 4px 4px 0",
                borderLeft: "none",
                width: 16,
                height: 32,
                padding: 0,
              }}
            />
          </Tooltip>
        </div>

        <Content style={{ padding: "20px 24px", overflow: "auto", minWidth: 0 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
