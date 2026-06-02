import { Outlet } from "react-router-dom";
import { Layout as AntLayout, Tooltip, Button, theme } from "antd";
import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/lib/theme-context";
import { ContextUrlSync } from "@/components/ContextUrlSync";
import { ContextBreadcrumb } from "@/components/ContextBreadcrumb";
import { ServiceSidebar } from "@/components/ServiceSidebar";
import { HeaderRightSlot, PageHeaderSlotProvider } from "@/components/PageHeaderSlot";
import { GlobalResourceFormModal } from "@/components/GlobalResourceFormModal";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
// KAC-246 Фаза 2A: бренд переехал в ServiceSidebar (full/mark по collapse).
// Top-bar: breadcrumb-контекст `Account › Project › Resource` (ContextBreadcrumb)
// слева + переключатель темы + per-page right-slot справа.

const { Header, Sider, Content } = AntLayout;

const SIDEBAR_RAIL = 56;
const SIDEBAR_EXPANDED = 224;
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
  const { mode, toggle } = useThemeMode();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  const siderWidth = collapsed ? SIDEBAR_RAIL : SIDEBAR_EXPANDED;

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <ContextUrlSync />

      <Header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          position: "sticky",
          top: 0,
          zIndex: 20,
          paddingInline: 12,
          height: HEADER_HEIGHT,
          lineHeight: `${HEADER_HEIGHT}px`,
          background: token.colorBgLayout,
        }}
      >
        {/* Центр-лево: breadcrumb-контекст Account › Project › Resource */}
        <div style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1, overflow: "hidden" }}>
          <ContextBreadcrumb />
        </div>

        {/* Право: per-page right-slot + переключатель темы */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <HeaderRightSlot />
          <Tooltip title={mode === "dark" ? "Светлая тема" : "Тёмная тема"}>
            <Button
              type="text"
              size="small"
              onClick={toggle}
              aria-label={mode === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
              icon={
                mode === "dark" ? (
                  <Sun size={16} strokeWidth={2} />
                ) : (
                  <Moon size={16} strokeWidth={2} />
                )
              }
            />
          </Tooltip>
        </div>
      </Header>

      <AntLayout>
        <Sider
          width={siderWidth}
          theme="dark"
          style={{
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            position: "sticky",
            top: HEADER_HEIGHT,
            height: `calc(100vh - ${HEADER_HEIGHT}px)`,
            overflow: "visible",
            background: token.colorBgLayout,
            transition: "width 180ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <ServiceSidebar collapsed={collapsed} onToggle={toggleCollapsed} />
        </Sider>

        <Content
          style={{
            overflow: "auto",
            minWidth: 0,
            background: token.colorBgLayout,
          }}
        >
          {/* min-width: max-content гарантирует, что широкие таблицы не сжимают
              cells, а раздвигают page-level horizontal scrollbar. */}
          <div style={{ minWidth: "max-content", padding: "20px 24px" }}>
            <Outlet />
          </div>
          {/* Глобальный mount модалок Create/Edit — для всех ресурсов. */}
          <GlobalResourceFormModal />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
