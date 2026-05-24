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
// Активный модуль определяется по URL (`/projects/:projectId/<segment>/...`). Дашборд /
// IAM / System — вне модулей. requiresProject-пункты disabled без project.

import { useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tooltip, theme } from "antd";
import { useContext } from "@/lib/context-store";
import { useAuth } from "@/contexts/AuthContext";
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
  const projectId = useContext((s) => s.project)?.id ?? null;
  const accountId = useContext((s) => s.account)?.id ?? null;
  const { user, loading: authLoading, hasPermission } = useAuth();
  const { token } = theme.useToken();

  // IAM-entry: показывать только если у user'а есть `iam.read` permission
  // (E3 OpenFGA). До auth-резолва (loading) показываем — чтобы layout не
  // прыгал; в анонимном E0-режиме (user=null, !loading) и без `iam.read` —
  // прячем IAM-кнопку. Profile-кнопка показывается только когда залогинены.
  const bottomItems = useMemo<NavLeaf[]>(() => {
    return COMMON_BOTTOM.filter((leaf) => {
      if (leaf.key === "system") {
        // KAC-118: admin Administration (Regions/Zones/AddressPools) — только
        // для admin (system principal либо * wildcard в permissions).
        if (authLoading) return false;
        if (!user) return false;
        return user.subject_type === "system" || hasPermission("*") || hasPermission("admin");
      }
      if (leaf.key === "profile") {
        return !!user;
      }
      return true;
    });
  }, [authLoading, user, hasPermission]);

  const activeModule = useMemo(() => moduleFromPathname(location.pathname), [location.pathname]);

  // Лаунчеры модулей (когда не внутри модуля): псевдо-NavLeaf'ы, ведущие на landing.
  const moduleLaunchers: NavLeaf[] = useMemo(
    () =>
      SERVICE_MODULES.map((m) => ({
        key: `mod-${m.key}`,
        icon: m.icon,
        label: m.label,
        // landing может вернуть null (project-scoped модуль без project) —
        // тогда лаунчер disabled через requiresProject, to не вызывается.
        to: () => m.landing(projectId, accountId) ?? "/dashboard",
        matches: () => false,
        requiresProject: m.requiresProject,
      })),
    [projectId, accountId],
  );

  const middle: NavLeaf[] = activeModule ? activeModule.items : moduleLaunchers;
  const activeLeafKey = useMemo(() => {
    const all = [...COMMON_TOP, ...middle, ...bottomItems];
    return all.find((it) => it.matches(location.pathname))?.key ?? null;
  }, [location.pathname, middle, bottomItems]);

  const renderLeaf = (leaf: NavLeaf) => {
    const disabled = !!leaf.requiresProject && !projectId;
    const active = activeLeafKey === leaf.key;
    return (
      <SidebarButton
        key={leaf.key}
        icon={leaf.icon}
        label={disabled ? "Выберите каталог" : leaf.label}
        active={active}
        disabled={disabled}
        onClick={() => !disabled && navigate(leaf.to(projectId))}
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
      {bottomItems.map(renderLeaf)}
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
