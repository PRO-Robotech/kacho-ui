import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Network,
  Layers,
  Route,
  MapPin,
  Shield,
  Globe,
  Cloud,
  Boxes,
  Search,
  LayoutGrid,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BreadcrumbSelector } from "@/components/BreadcrumbSelector";
import { ContextUrlSync } from "@/components/ContextUrlSync";
import { useFolderStore } from "@/lib/folder-store";
import {
  HeaderRightSlot,
  HeaderBreadcrumbSlot,
  PageHeaderSlotProvider,
} from "@/components/PageHeaderSlot";

interface NavItem {
  segment: string;
  label: string;
  icon: typeof Network;
  scope: "global" | "folder";
}

const NAV: NavItem[] = [
  { segment: "networks", label: "Облачные сети", icon: Network, scope: "folder" },
  { segment: "subnets", label: "Подсети", icon: Layers, scope: "folder" },
  { segment: "addresses", label: "Публичные IP-адреса", icon: MapPin, scope: "folder" },
  { segment: "route-tables", label: "Таблицы маршрутизации", icon: Route, scope: "folder" },
  { segment: "security-groups", label: "Группы безопасности", icon: Shield, scope: "folder" },
  // System (admin-only)
  { segment: "search", label: "Поиск", icon: Search, scope: "global" },
  { segment: "regions", label: "Регионы", icon: Globe, scope: "global" },
  { segment: "zones", label: "Зоны", icon: Cloud, scope: "global" },
  { segment: "address-pools", label: "Пулы адресов", icon: Boxes, scope: "global" },
];

export function Layout() {
  return (
    <PageHeaderSlotProvider>
      <LayoutInner />
    </PageHeaderSlotProvider>
  );
}

function LayoutInner() {
  const location = useLocation();
  const folder = useFolderStore((s) => s.folder);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <ContextUrlSync />

      <header className="h-12 border-b border-border flex items-center px-3 gap-2 bg-background sticky top-0 z-20">
        <NavLink
          to="/"
          className="flex items-center justify-center h-7 w-7 shrink-0"
          title="Kachō Console"
        >
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white text-[11px] font-bold">
            K
          </div>
        </NavLink>

        <BreadcrumbSelector />

        <button
          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
          title="Все сервисы"
          aria-label="Все сервисы"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <NavLink
          to={folder ? `/folders/${folder.id}` : "/"}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
          title="Главная"
          aria-label="Главная"
        >
          <Home className="h-4 w-4" />
        </NavLink>

        <div className="text-muted-foreground/40 px-1">/</div>
        <div className="flex items-center gap-2 text-sm min-w-0 flex-1 truncate">
          <HeaderBreadcrumbSlot />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <HeaderRightSlot />
        </div>
      </header>

      <div className="flex-1 flex">
        <aside className="w-14 shrink-0 border-r border-border py-2 flex flex-col items-center gap-1 sticky top-12 self-start max-h-[calc(100vh-3rem)] overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const disabled = item.scope === "folder" && !folder;
            const to =
              item.scope === "global"
                ? `/system/${item.segment}`
                : folder
                ? `/folders/${folder.id}/${item.segment}`
                : "#";
            const active =
              item.scope === "global"
                ? location.pathname.startsWith(`/system/${item.segment}`)
                : location.pathname.startsWith(`/folders/`) &&
                  location.pathname.includes(`/${item.segment}`);
            return (
              <NavLink
                key={item.segment}
                to={to}
                title={disabled ? `${item.label} — выберите Folder` : item.label}
                className={cn(
                  "h-9 w-9 inline-flex items-center justify-center rounded-md transition-colors",
                  active && "bg-secondary text-primary",
                  !active && "text-muted-foreground hover:bg-accent hover:text-foreground",
                  disabled && "opacity-30 pointer-events-none",
                )}
              >
                <Icon className="h-4 w-4" />
              </NavLink>
            );
          })}
        </aside>

        <main className="flex-1 px-6 py-5 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
