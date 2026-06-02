import { Outlet } from "react-router-dom";
import { Layout as AntLayout, Tooltip, Button, theme } from "antd";
import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/lib/theme-context";
import { ContextUrlSync } from "@/components/ContextUrlSync";
import { ContextBreadcrumb } from "@/components/ContextBreadcrumb";
import { ServiceSidebar } from "@/components/ServiceSidebar";
import { HeaderRightSlot, PageHeaderSlotProvider } from "@/components/PageHeaderSlot";
import { GlobalResourceFormModal } from "@/components/GlobalResourceFormModal";
// KAC-246: full-height sidebar (логотип сверху = левый верхний угол), от самого
// верха до самого низа. Header — внутри правого под-лейаута, только НАД контентом
// (а не во всю ширину поверх сайдбара). Сворачиватель убран.

const { Header, Sider, Content } = AntLayout;

// KAC-246: узкий icon-rail; ServiceSidebar разворачивается оверлеем при наведении
// (надписи только при hover), поэтому Sider резервирует только ширину рейла.
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
  const { mode, toggle } = useThemeMode();

  return (
    <AntLayout style={{ minHeight: "100vh" }} hasSider>
      <ContextUrlSync />

      {/* Сайдбар во всю высоту: от верха до низа, логотип в верхней части. */}
      <Sider
        width={SIDEBAR_WIDTH}
        theme="dark"
        style={{
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "visible",
          background: token.colorBgLayout,
        }}
      >
        <ServiceSidebar />
      </Sider>

      {/* Правый под-лейаут: slim header над контентом + сам контент. */}
      <AntLayout style={{ background: token.colorBgLayout }}>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            position: "sticky",
            top: 0,
            zIndex: 20,
            paddingInline: 20,
            height: HEADER_HEIGHT,
            lineHeight: `${HEADER_HEIGHT}px`,
            background: token.colorBgLayout,
          }}
        >
          {/* Слева: breadcrumb-контекст Account › Project › Resource. */}
          <div style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1, overflow: "hidden" }}>
            <ContextBreadcrumb />
          </div>

          {/* Справа: per-page right-slot + переключатель темы. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <HeaderRightSlot />
            <Tooltip title={mode === "dark" ? "Светлая тема" : "Тёмная тема"}>
              <Button
                type="text"
                size="small"
                onClick={toggle}
                aria-label={mode === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
                icon={mode === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
              />
            </Tooltip>
          </div>
        </Header>

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
