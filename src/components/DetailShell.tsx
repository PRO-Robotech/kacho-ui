// DetailShell — обёртка detail-страницы под YC look-and-feel.
//
// Layout (внутри Content; глобальный ServiceSidebar w=56 рисует Layout.tsx):
//   ┌─ Sub-pane w=240 ────────┬─ Main pane ────────────────────────────────┐
//   │  RESOURCE LABEL (caps)  │  [secondary action row]                    │
//   │  Name + status badges   │                                            │
//   │  ──────                 │  Active tab content (Обзор / IP-адреса …)  │
//   │  Tabs (vertical menu)   │                                            │
//   │                         │                                            │
//   │  ──────                 │                                            │
//   │  ДОКУМЕНТАЦИЯ           │                                            │
//   │  · ссылки               │                                            │
//   └─────────────────────────┴────────────────────────────────────────────┘
//
// Tab выбирается через ?tab=<id>. Дефолт — первый tab.

import { type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Menu, Typography, Badge } from "antd";
import { useDetailHeaderIcon } from "@/components/PanelHeader";

export interface DetailTab {
  id: string;
  label: string;
  count?: number;
  render: () => ReactNode;
}

export interface DocLink {
  label: string;
  href: string;
}

interface Props {
  resourceLabel: string;
  resourceName: string;
  badges?: ReactNode;
  tabs: DetailTab[];
  /** Опциональный ряд кнопок-secondary actions над content в main pane.
   *  Используется для domain-specific действий (Subnet «Перенести в зону» и т.п.). */
  secondaryActions?: ReactNode;
  docLinks?: DocLink[];
  defaultTab?: string;
  /** KAC-232: если задан — main pane (zone 3) рендерит это вместо контента
   *  активного таба. Используется для form-panel (edit / create связного
   *  ресурса разворачивается в правой зоне, табы остаются для контекста). */
  mainOverride?: ReactNode;
  /** KAC-233: controlled-режим табов (path-based вместо ?tab=). Когда задан
   *  `onTabSelect` — активный таб = `activeTabId`, клик по табу зовёт
   *  `onTabSelect(id)` (caller навигирует по path → уникальный URI на таб,
   *  и переключение таба выходит из form-panel). Иначе — legacy ?tab=. */
  activeTabId?: string;
  onTabSelect?: (id: string) => void;
  /** Действия рядом с именем ресурса в зоне 3 (Редактировать/Удалить/Создать). */
  nameActions?: ReactNode;
}

const SUB_PANE_WIDTH = 232;

export function DetailShell({
  resourceLabel,
  resourceName,
  badges,
  tabs,
  secondaryActions,
  docLinks,
  defaultTab,
  mainOverride,
  activeTabId,
  onTabSelect,
  nameActions,
}: Props) {
  const headerIcon = useDetailHeaderIcon();
  const [params, setParams] = useSearchParams();
  const fallback = defaultTab ?? tabs[0]?.id ?? "overview";
  const controlled = onTabSelect !== undefined;
  const activeId = controlled ? (activeTabId ?? fallback) : (params.get("tab") ?? fallback);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const setTab = (id: string) => {
    if (controlled) {
      onTabSelect!(id);
      return;
    }
    const next = new URLSearchParams(params);
    if (id === fallback) next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  };

  const docs = docLinks ?? DEFAULT_VPC_DOCS;

  return (
    <div
      className="kc-surface"
      style={{
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
        // Высота под viewport: header h=48 + Content padding 20+20 + small.
        // (marginTop:-8 убран — list-страница его не имеет, иначе фон прыгал
        // вверх на 8px при переходе list↔detail.)
        minHeight: "100%",
      }}
    >
      {/* KAC-246: рейл табов — часть единой detail-поверхности. Без своего
          фона/рамки/радиуса/тени; от main отделён ТОЛЬКО вертикальным
          border-secondary. «Встроен», а не «плавает». */}
      <aside
        style={{
          width: SUB_PANE_WIDTH,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--kc-border-secondary)",
          padding: 10,
        }}
      >
        {/* Зона 2 верх: [иконка] + действие (active tab) + тип ресурса. Имя
            переехало в зону 3 (main). */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            padding: "4px 6px 14px",
            borderBottom: "1px solid var(--kc-border-secondary)",
            marginBottom: 8,
          }}
        >
          {headerIcon && (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                color: "var(--kc-primary)",
                background: "linear-gradient(135deg, rgba(61,141,245,0.16), rgba(61,141,245,0.05))",
                border: "1px solid rgba(61,141,245,0.22)",
              }}
            >
              {headerIcon}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--kc-primary)",
                marginBottom: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {active?.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--kc-text)", lineHeight: 1.2 }}>
              {resourceLabel}
            </div>
          </div>
        </div>

        <Menu
          mode="inline"
          selectedKeys={active ? [active.id] : []}
          onClick={({ key }) => setTab(key)}
          className="kc-detail-rail-menu"
          style={{ borderRight: "none", background: "transparent" }}
          items={tabs.map((t) => ({
            key: t.id,
            label: (
              <span
                style={{
                  display: "inline-flex",
                  justifyContent: "space-between",
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <span>{t.label}</span>
                {typeof t.count === "number" && t.count > 0 && (
                  <Badge
                    count={t.count}
                    color="rgba(255,255,255,0.12)"
                    overflowCount={9999}
                  />
                )}
              </span>
            ),
          }))}
        />

        {docs.length > 0 && (
          <div
            style={{
              marginTop: "auto",
              padding: "16px 8px 8px 8px",
              borderTop: "1px solid var(--kc-border-secondary)",
            }}
          >
            <Typography.Text
              type="secondary"
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontWeight: 500,
              }}
            >
              Документация
            </Typography.Text>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "8px 0 0 0",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {docs.map((d) => (
                <li key={d.href}>
                  <Typography.Link
                    href={d.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, lineHeight: 1.4 }}
                  >
                    {d.label}
                  </Typography.Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: "20px 24px" }}>
        {mainOverride ? (
          mainOverride
        ) : (
          <>
            {/* Зона 3 верх: имя ресурса (крупно) + статус + действия. */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                flexWrap: "wrap",
                paddingBottom: 16,
                marginBottom: 18,
                borderBottom: "1px solid var(--kc-border-secondary)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}
              >
                <Typography.Title
                  level={3}
                  style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--kc-text)", wordBreak: "break-all" }}
                >
                  {resourceName || "(без имени)"}
                </Typography.Title>
                {badges}
              </div>
              {nameActions && (
                <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                  {nameActions}
                </div>
              )}
            </div>
            {secondaryActions && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: "1px solid var(--kc-border-secondary)",
                }}
              >
                {secondaryActions}
              </div>
            )}
            {active?.render()}
          </>
        )}
      </main>
    </div>
  );
}

// Дефолтные ссылки для VPC ресурсов (Kachō docs; конкретные ссылки на тип
// мастер-ресурса передаёт ResourceShell через docLinks).
const DEFAULT_VPC_DOCS: DocLink[] = [
  { label: "Начать работу с сетями и подсетями", href: "#" },
  { label: "Облачные сети и подсети", href: "#" },
  { label: "Группы безопасности", href: "#" },
  { label: "Адреса облачных ресурсов", href: "#" },
  { label: "Получить статический публичный IP-адрес", href: "#" },
];
