// DetailShell — общая обёртка detail-страницы под YC look-and-feel.
//
// Структура:
//   ┌─────────────────────────────────────────────────────────────┐
//   │ <header слот через useBreadcrumb / useHeaderRight уже там>  │
//   ├──────────────┬──────────────────────────────────────────────┤
//   │  resource    │                                              │
//   │  name+badge  │                                              │
//   │              │           main content (per tab)             │
//   │  vertical    │                                              │
//   │  tabs        │                                              │
//   │              │                                              │
//   │  Документация│                                              │
//   └──────────────┴──────────────────────────────────────────────┘
//
// Tab выбирается через ?tab=<id>. Дефолт — первый tab.

import { useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

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
  // Header info внутри left sub-nav (сверху над tabs).
  resourceLabel: string;          // singular: "Группа безопасности"
  resourceName: string;           // имя ресурса (или "(unnamed)")
  badges?: ReactNode;             // <Badge>Default</Badge>, статус и т.п.
  tabs: DetailTab[];
  docLinks?: DocLink[];
  /** Дефолтный tab id — берём первый, если не задан. */
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
    <div className="flex gap-6 -mt-2">
      <aside className="w-64 shrink-0 flex flex-col">
        <div className="px-2 py-3 border-b border-border space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {resourceLabel}
          </div>
          <div className="font-medium text-foreground break-all flex items-center gap-2 flex-wrap">
            <span className="truncate">{resourceName || "(unnamed)"}</span>
            {badges}
          </div>
        </div>

        <nav className="py-2 space-y-0.5">
          {tabs.map((t) => {
            const isActive = t.id === active?.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors flex items-center justify-between",
                  isActive
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span className="truncate">{t.label}</span>
                {typeof t.count === "number" && (
                  <span className="text-xs tabular-nums opacity-70">{t.count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {docs.length > 0 && (
          <div className="mt-auto pt-6">
            <div className="px-2 mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Документация
            </div>
            <ul className="space-y-1 px-1">
              {docs.map((d) => (
                <li key={d.href}>
                  <a
                    href={d.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-start gap-1.5 text-xs text-blue-400 hover:text-blue-300 leading-snug"
                  >
                    <span>{d.label}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-70" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <main className="flex-1 min-w-0">{active?.render()}</main>
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
