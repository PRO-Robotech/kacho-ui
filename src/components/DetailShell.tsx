// DetailShell — обёртка detail-страницы под YC look-and-feel на antd.
//
// Структура:
//   ┌──────────────┬──────────────────────────────────────────────┐
//   │  resource    │                                              │
//   │  name+badge  │           main content (per tab)             │
//   │  Menu (tabs) │                                              │
//   │  Документация│                                              │
//   └──────────────┴──────────────────────────────────────────────┘
//
// Tab выбирается через ?tab=<id>. Дефолт — первый tab.

import { useMemo, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  docLinks?: DocLink[];
  defaultTab?: string;
}

export function DetailShell({
  resourceLabel,
  resourceName,
  badges,
  tabs,
  docLinks,
  defaultTab,
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

  const docs = useMemo(() => docLinks ?? DEFAULT_VPC_DOCS, [docLinks]);

  return (
    <div style={{ display: "flex", gap: 24, marginTop: -8 }}>
      <aside style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "12px 8px",
            borderBottom: "1px solid var(--ant-color-border)",
            marginBottom: 8,
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {resourceLabel}
          </Typography.Text>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            <Typography.Text strong style={{ wordBreak: "break-all" }}>
              {resourceName || "(unnamed)"}
            </Typography.Text>
            {badges}
          </div>
        </div>

        <Menu
          mode="inline"
          selectedKeys={active ? [active.id] : []}
          onClick={({ key }) => setTab(key)}
          style={{ borderRight: "none", background: "transparent" }}
          items={tabs.map((t) => ({
            key: t.id,
            label: (
              <span style={{ display: "inline-flex", justifyContent: "space-between", width: "100%" }}>
                <span>{t.label}</span>
                {typeof t.count === "number" && t.count > 0 && (
                  <Badge count={t.count} color="rgba(255,255,255,0.12)" overflowCount={9999} />
                )}
              </span>
            ),
          }))}
        />

        {docs.length > 0 && (
          <div style={{ marginTop: 24, padding: "0 8px" }}>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}
            >
              Документация
            </Typography.Text>
            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
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

      <main style={{ flex: 1, minWidth: 0 }}>{active?.render()}</main>
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

// Suppress unused — Link нужен для будущих использований navigator-style link.
void Link;
