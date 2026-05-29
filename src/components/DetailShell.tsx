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
}

const SUB_PANE_WIDTH = 240;

export function DetailShell({
  resourceLabel,
  resourceName,
  badges,
  tabs,
  secondaryActions,
  docLinks,
  defaultTab,
  mainOverride,
}: Props) {
  const [params, setParams] = useSearchParams();
  const fallback = defaultTab ?? tabs[0]?.id ?? "overview";
  const activeId = params.get("tab") ?? fallback;
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const setTab = (id: string) => {
    const next = new URLSearchParams(params);
    if (id === fallback) next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  };

  const docs = docLinks ?? DEFAULT_VPC_DOCS;

  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        marginTop: -8,
        alignItems: "stretch",
        // Высота под viewport: header h=48 + Content padding 20+20 + small.
        minHeight: "calc(100vh - 110px)",
      }}
    >
      <aside
        style={{
          width: SUB_PANE_WIDTH,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--ant-color-border-secondary)",
          paddingRight: 8,
        }}
      >
        <div
          style={{
            padding: "12px 8px",
            borderBottom: "1px solid var(--ant-color-border-secondary)",
            marginBottom: 8,
          }}
        >
          {/* Имя ресурса — bold сверху, label-тип ниже мелким (как в YC). */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Typography.Text strong style={{ wordBreak: "break-all", fontSize: 15 }}>
              {resourceName || "(unnamed)"}
            </Typography.Text>
            {badges}
          </div>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12, marginTop: 2, display: "block" }}
          >
            {resourceLabel}
          </Typography.Text>
        </div>

        <Menu
          mode="inline"
          selectedKeys={active ? [active.id] : []}
          onClick={({ key }) => setTab(key)}
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
              borderTop: "1px solid var(--ant-color-border-secondary)",
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

      <main style={{ flex: 1, minWidth: 0 }}>
        {mainOverride ? (
          mainOverride
        ) : (
          <>
            {secondaryActions && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: "1px solid var(--ant-color-border-secondary)",
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

// Дефолтные ссылки для VPC ресурсов. Те же, что показывает YC console.
const DEFAULT_VPC_DOCS: DocLink[] = [
  { label: "Начать работу с сетями и подсетями", href: "https://yandex.cloud/ru/docs/vpc/quickstart" },
  { label: "Облачные сети и подсети", href: "https://yandex.cloud/ru/docs/vpc/concepts/network" },
  { label: "Группы безопасности", href: "https://yandex.cloud/ru/docs/vpc/concepts/security-groups" },
  { label: "Адреса облачных ресурсов", href: "https://yandex.cloud/ru/docs/vpc/concepts/address" },
  { label: "Получить статический публичный IP-адрес", href: "https://yandex.cloud/ru/docs/vpc/operations/enable-static-ip" },
  { label: "История изменений Virtual Private Cloud", href: "https://yandex.cloud/ru/docs/release-notes/vpc" },
];
