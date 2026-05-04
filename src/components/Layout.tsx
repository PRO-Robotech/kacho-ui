import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Building2,
  Network,
  Layers,
  Route,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BreadcrumbSelector } from "@/components/BreadcrumbSelector";
import { ContextUrlSync } from "@/components/ContextUrlSync";
import { useFolderStore } from "@/lib/folder-store";

interface NavItem {
  // segment под /folders/{folderId}/<segment>
  segment: string;
  label: string;
  icon: typeof Building2;
  scope: "global" | "folder";
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "VPC",
    items: [
      { segment: "networks", label: "Networks", icon: Network, scope: "folder" },
      { segment: "subnets", label: "Subnets", icon: Layers, scope: "folder" },
      { segment: "route-tables", label: "Route Tables", icon: Route, scope: "folder" },
      { segment: "addresses", label: "Addresses", icon: MapPin, scope: "folder" },
    ],
  },
];

// Building2 импортирован, но используется в типе NavItem.icon. Pre-empt unused-warning:
const _building2Ref = Building2;
void _building2Ref;

export function Layout() {
  const location = useLocation();
  const folder = useFolderStore((s) => s.folder);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <ContextUrlSync />
      <header className="h-14 border-b border-border flex items-center px-6 gap-6 bg-background sticky top-0 z-20">
        <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white text-xs font-bold">
            K
          </div>
          <span>Kachō Console</span>
        </NavLink>
        <div className="flex-1" />
        <BreadcrumbSelector />
      </header>

      <div className="flex-1 flex">
        <aside className="w-60 shrink-0 border-r border-border py-4 px-3 overflow-y-auto sticky top-14 self-start max-h-[calc(100vh-3.5rem)]">
          {NAV.map((group) => (
            <div key={group.group} className="mb-4">
              <div className="px-3 mb-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                {group.group}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const disabled = item.scope === "folder" && !folder;
                const to = folder
                  ? `/folders/${folder.id}/${item.segment}`
                  : "#";
                const active = location.pathname.startsWith(`/folders/`) &&
                  location.pathname.includes(`/${item.segment}`);
                return (
                  <NavLink
                    key={item.segment}
                    to={to}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md mb-0.5 transition-colors",
                      active && "bg-secondary font-medium",
                      !active && "hover:bg-muted",
                      disabled && "opacity-40 pointer-events-none",
                    )}
                    title={disabled ? "Выберите Folder в крошках" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </aside>

        <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
