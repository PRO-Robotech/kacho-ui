import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Building2,
  Cloud as CloudIcon,
  FolderOpen,
  Network,
  Layers,
  Server,
  HardDrive,
  Image as ImageIcon,
  Camera,
  Scale,
  Target,
  ShieldCheck,
  Route,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FolderSelector } from "@/components/FolderSelector";
import { useFolderStore } from "@/lib/folder-store";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Building2;
  scope: "global" | "folder";
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Resource Manager",
    items: [
      { to: "/organizations", label: "Organizations", icon: Building2, scope: "global" },
      { to: "/clouds", label: "Clouds", icon: CloudIcon, scope: "global" },
      { to: "/folders", label: "Folders", icon: FolderOpen, scope: "global" },
    ],
  },
  {
    group: "VPC",
    items: [
      { to: "/networks", label: "Networks", icon: Network, scope: "folder" },
      { to: "/subnets", label: "Subnets", icon: Layers, scope: "folder" },
      { to: "/security-groups", label: "Security Groups", icon: ShieldCheck, scope: "folder" },
      { to: "/route-tables", label: "Route Tables", icon: Route, scope: "folder" },
      { to: "/addresses", label: "Addresses", icon: MapPin, scope: "folder" },
    ],
  },
  {
    group: "Compute",
    items: [
      { to: "/instances", label: "Instances", icon: Server, scope: "folder" },
      { to: "/disks", label: "Disks", icon: HardDrive, scope: "folder" },
      { to: "/images", label: "Images", icon: ImageIcon, scope: "global" },
      { to: "/snapshots", label: "Snapshots", icon: Camera, scope: "folder" },
    ],
  },
  {
    group: "Load Balancer",
    items: [
      { to: "/network-load-balancers", label: "Load Balancers", icon: Scale, scope: "folder" },
      { to: "/target-groups", label: "Target Groups", icon: Target, scope: "folder" },
    ],
  },
];

export function Layout() {
  const location = useLocation();
  const folder = useFolderStore((s) => s.folder);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="h-14 border-b border-border flex items-center px-6 gap-6 bg-background sticky top-0 z-20">
        <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white text-xs font-bold">
            K
          </div>
          <span>Kachō Console</span>
        </NavLink>
        <div className="flex-1" />
        <FolderSelector />
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
                const active = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md mb-0.5 transition-colors",
                      active && "bg-secondary font-medium",
                      !active && "hover:bg-muted",
                      disabled && "opacity-40 pointer-events-none",
                    )}
                    title={disabled ? "Выберите Folder" : undefined}
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
