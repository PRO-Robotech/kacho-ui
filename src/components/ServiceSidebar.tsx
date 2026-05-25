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
import { Avatar, Dropdown, Spin, Tooltip, theme } from "antd";
import { LoginOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";
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
  const { user, loading: authLoading } = useAuth();
  const { token } = theme.useToken();

  // IAM-entry: показывать только если у user'а есть `iam.read` permission
  // (E3 OpenFGA). До auth-резолва (loading) показываем — чтобы layout не
  // прыгал; в анонимном E0-режиме (user=null, !loading) и без `iam.read` —
  // прячем IAM-кнопку. KAC-198: profile leaf убран из COMMON_BOTTOM — теперь
  // user-menu рендерится отдельно через SidebarUserButton ниже.
  const bottomItems = useMemo<NavLeaf[]>(() => {
    return COMMON_BOTTOM.filter((leaf) => {
      if (leaf.key === "system") {
        // KAC-178 follow-up: показываем "Администрирование" любому авторизованному
        // user'у — server-side authz (api-gateway catalog + IAM Check) сам решит
        // 200/403 при попытке CRUD на Region/Zone/AddressPool. Раньше client-side
        // фильтр прятал sidebar entirely для user'ов без 'admin'/'*' permission
        // в JWT, что неверно для cluster system_admin (per-FGA tuple, не в JWT).
        // List endpoints для compute.Region/Zone — exempt в catalog (cluster.viewer
        // cascade) → доступны всем; AddressPool — admin-only через FGA.
        if (authLoading) return false;
        return !!user;
      }
      return true;
    });
  }, [authLoading, user]);

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
      <SidebarUserButton token={token} />
    </nav>
  );
}

// SidebarUserButton — KAC-198: user-menu в нижней части sidebar (раньше был в
// header через HeaderAuth/UserMenu). Авторизованный — avatar + email + dropdown
// {Профиль → /iam/users, Выйти}. Неавторизованный — LoginOutlined → /login.
// Loading — Spin (чтобы не дёргать layout).
function SidebarUserButton({ token }: { token: ReturnType<typeof theme.useToken>["token"] }) {
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div
        style={{
          width: 40,
          height: 36,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="small" />
      </div>
    );
  }

  if (!user) {
    return (
      <Tooltip title="Войти" placement="right" mouseEnterDelay={0.4}>
        <button
          type="button"
          // KAC-199: было navigate("/login") — такого SPA-route нет (только
          // /auth/login). Вызываем login() из useAuth — он делает full-page
          // assign на kratos.loginUrl() с return_to (тот же flow, что и в
          // <LoginButton/>). Anonymous user из любой точки UI должен оказаться
          // на Kratos self-service login.
          onClick={() => login(window.location.pathname + window.location.search)}
          aria-label="Войти"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 36,
            flexShrink: 0,
            borderRadius: 6,
            border: "none",
            background: "transparent",
            color: token.colorTextSecondary,
            cursor: "pointer",
            fontSize: 18,
            transition: "background-color 120ms ease, color 120ms ease",
          }}
        >
          <LoginOutlined />
        </button>
      </Tooltip>
    );
  }

  const display = user.display_name || user.email || user.id;
  const ini = initials(user.display_name || user.email);

  const items = [
    {
      key: "user-info",
      label: (
        <div style={{ padding: "4px 4px", minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{display}</div>
          {user.email && user.email !== display && (
            <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
              {user.email}
            </div>
          )}
        </div>
      ),
      disabled: true,
    },
    { type: "divider" as const },
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Профиль",
      onClick: () => navigate("/iam/users"),
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Выйти",
      onClick: async () => {
        logout();
        navigate("/");
      },
    },
  ];

  return (
    <Dropdown menu={{ items }} placement="topRight" trigger={["click"]}>
      <Tooltip title={display} placement="right" mouseEnterDelay={0.4}>
        <button
          type="button"
          aria-label={display}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 36,
            flexShrink: 0,
            borderRadius: 6,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Avatar
            size={26}
            style={{
              background: token.colorPrimary,
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {ini || <UserOutlined />}
          </Avatar>
        </button>
      </Tooltip>
    </Dropdown>
  );
}

function initials(name?: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
