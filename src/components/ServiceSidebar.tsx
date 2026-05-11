// ServiceSidebar — узкий (56px) icon-only навигатор. Набор ссылок зависит от
// активного «компонента» (модуля):
//
//   COMMON_TOP            ⌂ Все сервисы · 🔍 Поиск
//   ─
//   <middle>              если активен модуль (vpc/compute) → его items;
//                         иначе → лаунчеры модулей (клик → landing модуля)
//   ─
//   COMMON_BOTTOM         ⚙ Администрирование · 👤 Профиль
//
// Активный модуль определяется по URL (`/folders/:fid/<segment>/...`). Дашборд /
// Resource Manager / System — вне модулей. requiresFolder-пункты disabled без folder.

import { useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tooltip, theme } from "antd";
import { useFolderStore } from "@/lib/folder-store";
import { useContext } from "@/lib/context-store";
import {
  COMMON_BOTTOM,
  COMMON_TOP,
  SERVICE_MODULES,
  moduleFromPathname,
  type NavLeaf,
} from "@/lib/service-modules";

export function ServiceSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const folderId = useFolderStore((s) => s.folder)?.id ?? null;
  const cloudId = useContext((s) => s.cloud)?.id ?? null;
  const { token } = theme.useToken();

  const activeModule = useMemo(() => moduleFromPathname(location.pathname), [location.pathname]);

  // Лаунчеры модулей (когда не внутри модуля): псевдо-NavLeaf'ы, ведущие на landing.
  const moduleLaunchers: NavLeaf[] = useMemo(
    () =>
      SERVICE_MODULES.map((m) => ({
        key: `mod-${m.key}`,
        icon: m.icon,
        label: m.label,
        to: () => m.landing(folderId, cloudId),
        matches: () => false,
      })),
    [folderId, cloudId],
  );

  const middle: NavLeaf[] = activeModule ? activeModule.items : moduleLaunchers;
  const activeLeafKey = useMemo(() => {
    const all = [...COMMON_TOP, ...middle, ...COMMON_BOTTOM];
    return all.find((it) => it.matches(location.pathname))?.key ?? null;
  }, [location.pathname, middle]);

  const renderLeaf = (leaf: NavLeaf) => {
    const disabled = !!leaf.requiresFolder && !folderId;
    const active = activeLeafKey === leaf.key;
    return (
      <SidebarButton
        key={leaf.key}
        icon={leaf.icon}
        label={disabled ? "Выберите каталог" : leaf.label}
        active={active}
        disabled={disabled}
        onClick={() => !disabled && navigate(leaf.to(folderId))}
        token={token}
      />
    );
  };

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
      aria-label="Навигация сервиса"
    >
      {COMMON_TOP.map(renderLeaf)}
      <SidebarDivider token={token} />
      {middle.map(renderLeaf)}
      <div style={{ flex: 1 }} />
      <SidebarDivider token={token} />
      {COMMON_BOTTOM.map(renderLeaf)}
    </nav>
  );
}

function SidebarDivider({ token }: { token: ReturnType<typeof theme.useToken>["token"] }) {
  return (
    <div
      style={{
        width: 32,
        height: 1,
        background: token.colorBorderSecondary,
        margin: "6px 0",
        flexShrink: 0,
      }}
    />
  );
}

function SidebarButton({
  icon,
  label,
  active,
  disabled,
  onClick,
  token,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  token: ReturnType<typeof theme.useToken>["token"];
}) {
  const restColor = disabled ? (token.colorTextDisabled ?? token.colorTextTertiary) : token.colorTextSecondary;
  return (
    <Tooltip title={label} placement="right" mouseEnterDelay={0.4}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        disabled={disabled}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 36,
          flexShrink: 0,
          borderRadius: 6,
          border: "none",
          background: active ? token.colorBgElevated : "transparent",
          color: active ? token.colorText : restColor,
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
            (e.currentTarget as HTMLButtonElement).style.color = restColor;
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
        {icon}
      </button>
    </Tooltip>
  );
}
