import { NavLink, Outlet } from "react-router-dom";
import { Layout as AntLayout, Tooltip, Button, theme } from "antd";
import { HomeOutlined, AppstoreOutlined } from "@ant-design/icons";
import { BreadcrumbSelector } from "@/components/BreadcrumbSelector";
import { ContextUrlSync } from "@/components/ContextUrlSync";
import { VpcSidebar } from "@/components/VpcSidebar";
import {
  HeaderRightSlot,
  HeaderBreadcrumbSlot,
  PageHeaderSlotProvider,
} from "@/components/PageHeaderSlot";

const { Header, Sider, Content } = AntLayout;

const SIDEBAR_WIDTH = 56;
const HEADER_HEIGHT = 48;

export function Layout() {
  return (
    <PageHeaderSlotProvider>
      <LayoutInner />
    </PageHeaderSlotProvider>
  );
}

function LayoutInner() {
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
          paddingInline: 12,
          height: HEADER_HEIGHT,
          lineHeight: `${HEADER_HEIGHT}px`,
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
          width={SIDEBAR_WIDTH}
          theme="dark"
          style={{
            borderRight: `1px solid ${token.colorBorder}`,
            position: "sticky",
            top: HEADER_HEIGHT,
            height: `calc(100vh - ${HEADER_HEIGHT}px)`,
            overflow: "visible",
            background: token.colorBgLayout,
          }}
        >
          <VpcSidebar />
        </Sider>

        <Content
          style={{
            overflow: "auto",
            minWidth: 0,
            background: token.colorBgLayout,
          }}
        >
          {/* min-width: max-content гарантирует, что широкие таблицы не сжимают
              cells, а раздвигают page-level horizontal scrollbar (Content
              имеет overflow:auto). */}
          <div style={{ minWidth: "max-content", padding: "20px 24px" }}>
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
