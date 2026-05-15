// ResourceIcon — иконка ресурса для заголовков модалок (Создание/Редактирование).
// Centralized mapping по spec.id; недостающие — fallback к Box.

import {
  Box,
  Cable,
  Cloud,
  Folder,
  Globe,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Map,
  MapPin,
  Network,
  Route,
  Server,
  Shield,
  ShieldCheck,
  Building2,
  Camera,
} from "lucide-react";

const ICONS: Record<string, typeof Box> = {
  organizations: Building2,
  clouds: Cloud,
  folders: Folder,
  networks: Globe,
  subnets: Network,
  "security-groups": Shield,
  "security-group-rules": ShieldCheck,
  "route-tables": Route,
  addresses: MapPin,
  gateways: Map,
  "address-pools": Layers,
  "network-interfaces": Cable,
  instances: Server,
  disks: HardDrive,
  images: ImageIcon,
  snapshots: Camera,
};

interface Props {
  specId: string;
  size?: number;
  className?: string;
}

export function ResourceIcon({ specId, size = 20, className }: Props) {
  const Icon = ICONS[specId] ?? Box;
  return <Icon size={size} className={className} aria-hidden />;
}
