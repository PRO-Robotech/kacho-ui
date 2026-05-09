import { useMemo } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Layout as AntLayout, Tooltip, Button, theme } from "antd";
import { HomeOutlined, AppstoreOutlined } from "@ant-design/icons";
import { BreadcrumbSelector } from "@/components/BreadcrumbSelector";
import { ContextUrlSync } from "@/components/ContextUrlSync";
import { HierarchyTree } from "@/components/HierarchyTree";
import { VpcSubNav } from "@/components/VpcSubNav";
import { useFolderStore } from "@/lib/folder-store";
import {
  HeaderRightSlot,
  HeaderBreadcrumbSlot,
  PageHeaderSlotProvider,
} from "@/components/PageHeaderSlot";

const { Header, Sider, Content } = AntLayout;

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
  const { token } = theme.useToken();

  // Sidebar mode выбирается по pathname:
  //   /dashboard  → tree (root разводная)
  //   /folders/*  → VPC sub-nav
  //   /system/*   → VPC sub-nav (System группа активна)
  //   остальное   → tree (Org/Cloud/Folder drill)
  const sidebarMode: "tree" | "subnav" = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith("/dashboard")) return "tree";
    if (p.startsWith("/folders/") || p.startsWith("/system/")) return "subnav";
    return "tree";
  }, [location.pathname]);

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
          paddingInline: 12,
        }}
      >
        <NavLink
          to="/"
          aria-label="Kachō Console"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 28,
            width: 28,
          }}
        >
          <div
            style={{
              height: 24,
              width: 24,
              borderRadius: 6,
              background: "linear-gradient(135deg, #fbbf24, #f43f5e)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            K
          </div>
        </NavLink>

        <BreadcrumbSelector />

        <Tooltip title="Все сервисы">
          <Button type="text" size="small" icon={<AppstoreOutlined />} />
        </Tooltip>
        <Tooltip title="На главную">
          <NavLink to="/" aria-label="Главная">
            <Button type="text" size="small" icon={<HomeOutlined />} />
          </NavLink>
        </Tooltip>

        <span style={{ color: token.colorTextTertiary, padding: "0 4px" }}>/</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            minWidth: 0,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <HeaderBreadcrumbSlot />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <HeaderRightSlot />
        </div>
      </Header>

      <AntLayout>
        <Sider
          width={260}
          theme="dark"
          style={{
            borderRight: `1px solid ${token.colorBorder}`,
            position: "sticky",
            top: 48,
            height: "calc(100vh - 48px)",
            overflowY: "auto",
          }}
        >
          {sidebarMode === "tree" ? (
            <HierarchyTree />
          ) : (
            <VpcSubNav />
          )}
        </Sider>

        <Content
          style={{
            padding: "20px 24px",
            overflow: "auto",
            minWidth: 0,
            background: token.colorBgLayout,
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );

  // Suppress unused — folder может пригодиться для будущей логики
  void folder;
}
