import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, theme as antdTheme, App as AntdApp } from "antd";
import ruRU from "antd/locale/ru_RU";
import { Layout } from "@/components/Layout";
import { AdminLayout } from "@/components/AdminLayout";
import { ResourceListPage } from "@/components/ResourceListPage";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { ResourceCreatePage } from "@/components/ResourceCreatePage";
import { ResourceEditPage } from "@/components/ResourceEditPage";
import { Toaster } from "@/components/Toaster";
import { REGISTRY } from "@/lib/resource-registry";
import { AddressPoolDetailPage } from "@/pages/AddressPoolDetailPage";
import { NetworkDetailPage } from "@/pages/NetworkDetailPage";
import { SubnetDetailPage } from "@/pages/SubnetDetailPage";
import { SecurityGroupDetailPage } from "@/pages/SecurityGroupDetailPage";
import { NetworkInterfaceDetailPage } from "@/pages/NetworkInterfaceDetailPage";
import { SubnetCreateRedirect } from "@/pages/SubnetCreateRedirect";
import { SubnetCreatePage } from "@/pages/SubnetCreatePage";
import { VpcListShell, VpcDetailShell } from "@/components/VpcShell";
import { RouteTableDetailPage } from "@/pages/RouteTableDetailPage";
import { AddressDetailPage } from "@/pages/AddressDetailPage";
import { InstanceDetailPage } from "@/pages/InstanceDetailPage";
import { OperationsPage } from "@/pages/OperationsPage";
import { SystemSearchPage } from "@/pages/SystemSearchPage";
import { DashboardPage } from "@/pages/DashboardPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Folder-scoped VPC ресурсы — берём имена из registry без захардкоженного списка.
const FOLDER_SCOPED = ["networks", "subnets", "addresses", "route-tables", "security-groups", "network-interfaces", "gateways"]
  .map((id) => REGISTRY[id])
  .filter(Boolean);

// Folder-scoped Compute ресурсы (Disk/Image/Snapshot/Instance). URL-сегмент — `compute`.
const COMPUTE_SCOPED = ["compute-disks", "compute-images", "compute-snapshots", "compute-instances"]
  .map((id) => REGISTRY[id])
  .filter(Boolean);

// LegacySegmentRedirect — редирект старых/RefNameLink flat-URL `/folders/<id>/<route>/...`
// на новые `/folders/<id>/<segment>/<route>/...` (segment = "vpc" | "compute").
// Сохраняет хвост path + query.
function LegacySegmentRedirect({ segment, route }: { segment: string; route: string }) {
  const { folderId } = useParams();
  const location = useLocation();
  const prefix = `/folders/${folderId}/${route}`;
  const tail = location.pathname.startsWith(prefix)
    ? location.pathname.slice(prefix.length)
    : "";
  return (
    <Navigate
      to={`/folders/${folderId}/${segment}/${route}${tail}${location.search}`}
      replace
    />
  );
}

export default function App() {
  return (
    <ConfigProvider
      locale={ruRU}
      form={{
        // Звёздочка required справа от label (по умолчанию AntD ставит слева).
        // По указанию user'а: все звёздочки должны быть справа.
        requiredMark: (label, info) => (
          <>
            {label}
            {info.required && (
              <span style={{ color: "#ff4d4f", marginLeft: 4 }} aria-hidden>
                *
              </span>
            )}
          </>
        ),
      }}
      theme={{
        algorithm: antdTheme.darkAlgorithm,
        token: {
          // YC-style палитра: тёмный графит + сине-голубой primary.
          colorPrimary: "#3D8DF5",
          colorBgBase: "#1c1d22",
          colorBgContainer: "#26272d",
          colorBgElevated: "#2d2e35",
          colorBorder: "#383941",
          colorBorderSecondary: "#2a2b32",
          colorText: "#dadde3",
          colorTextSecondary: "#8b8f99",
          colorTextTertiary: "#6b6f78",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          borderRadius: 6,
          borderRadiusLG: 8,
          borderRadiusSM: 4,
          fontSize: 13,
        },
        components: {
          Layout: {
            headerBg: "#1c1d22",
            headerHeight: 48,
            headerPadding: "0 12px",
            siderBg: "#1c1d22",
            bodyBg: "#1c1d22",
          },
          Menu: {
            itemBg: "transparent",
            itemSelectedBg: "#2d2e35",
            itemActiveBg: "#26272d",
            itemHoverBg: "#26272d",
            itemSelectedColor: "#dadde3",
          },
          Table: {
            headerBg: "#26272d",
            rowHoverBg: "#2a2b32",
          },
          // KAC-69: единый цвет модалок + селекторов внутри форм (по
          // указанию user'а: фон модалки rgb(52,54,61) = #34363d;
          // внутренний цвет селектора rgb(28,29,33) = #1c1d22).
          Modal: {
            contentBg: "#34363d",
            headerBg: "#34363d",
            footerBg: "#34363d",
          },
          Select: {
            // Закрытое поле + dropdown — затемнённый фон (как у Layout body).
            colorBgContainer: "#1c1d22",
            colorBgElevated: "#1c1d22",
            optionSelectedBg: "#2a2b32",
            optionActiveBg: "#26272d",
          },
          Input: {
            // Чтобы Input в модалке имел тот же фон что Select — visual unity.
            colorBgContainer: "#1c1d22",
          },
          InputNumber: {
            colorBgContainer: "#1c1d22",
          },
          DatePicker: {
            colorBgContainer: "#1c1d22",
          },
        },
      }}
    >
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            {/* Root → dashboard. */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            {/* Dashboard with folder context in URL. */}
            <Route path="/folders/:folderId/dashboard" element={<DashboardPage />} />

            {/* === Resource Manager hierarchy (через path) === */}

            {/* /organizations — список org (cluster-scoped) */}
            <Route
              path="/organizations"
              element={<ResourceListPage spec={REGISTRY.organizations} />}
            />
            <Route
              path="/organizations/create"
              element={<ResourceCreatePage spec={REGISTRY.organizations} />}
            />

            {/* /organizations/:orgId/clouds — список clouds в orgId */}
            <Route
              path="/organizations/:orgId/clouds"
              element={
                <ResourceListPage
                  spec={REGISTRY.clouds}
                  parentField="organization_id"
                  parentParam="orgId"
                />
              }
            />
            <Route
              path="/organizations/:orgId/clouds/create"
              element={
                <ResourceCreatePage
                  spec={REGISTRY.clouds}
                  parentField="organization_id"
                  parentParam="orgId"
                />
              }
            />

            {/* /clouds/:cloudId/folders — список folders в cloudId */}
            <Route
              path="/clouds/:cloudId/folders"
              element={
                <ResourceListPage
                  spec={REGISTRY.folders}
                  parentField="cloud_id"
                  parentParam="cloudId"
                />
              }
            />
            <Route
              path="/clouds/:cloudId/folders/create"
              element={
                <ResourceCreatePage
                  spec={REGISTRY.folders}
                  parentField="cloud_id"
                  parentParam="cloudId"
                />
              }
            />

            {/* === Folder-scoped VPC ресурсы === */}
            {/* /folders/:folderId/vpc/{networks|subnets|addresses|route-tables|security-groups} */}
            {FOLDER_SCOPED.map((spec) => (
              <Route key={spec.id}>
                <Route
                  path={`/folders/:folderId/vpc/${spec.route}`}
                  element={
                    // VpcListShell = ResourceListPage + ResourceFormModal mount
                    // (модалка открывается по ?modal=<spec>-create или
                    // ?modal=<spec>-edit&id=<uid>).
                    <VpcListShell
                      spec={spec}
                      parentField="folder_id"
                      parentParam="folderId"
                    />
                  }
                />
                <Route
                  path={`/folders/:folderId/vpc/${spec.route}/create`}
                  element={
                    // Subnet — отдельная standalone-страница SubnetCreatePage
                    // (YC-style layout как у SubnetDetailPage в edit-mode).
                    // Использует ?networkId=<n> для пред-фиксации сети;
                    // без параметра — показывает RefSelect "Сеть" вверху.
                    // Generic ResourceCreatePage оставлен для остальных VPC-
                    // ресурсов (Network, Address, RT, SG, Gateway, PE).
                    spec.id === "subnets"
                      ? <SubnetCreatePage />
                      : <ResourceCreatePage
                          spec={spec}
                          parentField="folder_id"
                          parentParam="folderId"
                        />
                  }
                />
                <Route
                  path={`/folders/:folderId/vpc/${spec.route}/:uid`}
                  element={
                    spec.id === "networks"
                      ? <NetworkDetailPage />
                      : spec.id === "subnets"
                        ? <SubnetDetailPage />
                        : spec.id === "security-groups"
                          ? <SecurityGroupDetailPage />
                          : spec.id === "network-interfaces"
                            ? <NetworkInterfaceDetailPage />
                            : <VpcDetailShell spec={spec} />
                  }
                />
                {/* /edit URL ведёт на ту же detail-страницу — она авто-
                    детектит /edit-суффикс и разворачивает inline-форму
                    редактирования в правой панели вместо "Общее". */}
                <Route
                  path={`/folders/:folderId/vpc/${spec.route}/:uid/edit`}
                  element={
                    spec.id === "networks"
                      ? <NetworkDetailPage />
                      : spec.id === "subnets"
                        ? <SubnetDetailPage />
                        : spec.id === "security-groups"
                          ? <SecurityGroupDetailPage />
                          : spec.id === "network-interfaces"
                            ? <NetworkInterfaceDetailPage />
                            : <VpcDetailShell spec={spec} />
                  }
                />
                {/* Legacy redirect: старые flat URL `/folders/X/<resource>/...`
                    автоматически редиректятся на /folders/X/vpc/<resource>/... */}
                <Route
                  path={`/folders/:folderId/${spec.route}/*`}
                  element={<LegacySegmentRedirect segment="vpc" route={spec.route} />}
                />
              </Route>
            ))}

            {/* === Folder-scoped Compute ресурсы === */}
            {/* /folders/:folderId/compute/{disks|images|snapshots|instances} */}
            {COMPUTE_SCOPED.map((spec) => (
              <Route key={spec.id}>
                <Route
                  path={`/folders/:folderId/compute/${spec.route}`}
                  element={
                    <ResourceListPage
                      spec={spec}
                      parentField="folder_id"
                      parentParam="folderId"
                    />
                  }
                />
                <Route
                  path={`/folders/:folderId/compute/${spec.route}/create`}
                  element={
                    <ResourceCreatePage
                      spec={spec}
                      parentField="folder_id"
                      parentParam="folderId"
                    />
                  }
                />
                <Route
                  path={`/folders/:folderId/compute/${spec.route}/:uid`}
                  element={
                    spec.id === "compute-instances"
                      ? <InstanceDetailPage />
                      : <ResourceDetailPage spec={spec} />
                  }
                />
                <Route
                  path={`/folders/:folderId/compute/${spec.route}/:uid/edit`}
                  element={
                    spec.id === "compute-instances"
                      ? <InstanceDetailPage />
                      : <ResourceDetailPage spec={spec} />
                  }
                />
                {/* Legacy/RefNameLink redirect: `/folders/X/<route>/...` → `/folders/X/compute/<route>/...` */}
                <Route
                  path={`/folders/:folderId/${spec.route}/*`}
                  element={<LegacySegmentRedirect segment="compute" route={spec.route} />}
                />
              </Route>
            ))}

            {/* === Network-nested CREATE для дочерних ресурсов === */}
            {/* Сохраняет network-context: при создании RT/SG из network detail
                URL остаётся под /networks/<n>/. */}
            <Route
              path="/folders/:folderId/vpc/networks/:networkId/route-tables/create"
              element={
                <ResourceCreatePage
                  spec={REGISTRY["route-tables"]}
                  parentField="folder_id"
                  parentParam="folderId"
                />
              }
            />
            <Route
              path="/folders/:folderId/vpc/networks/:networkId/security-groups/create"
              element={
                <ResourceCreatePage
                  spec={REGISTRY["security-groups"]}
                  parentField="folder_id"
                  parentParam="folderId"
                />
              }
            />
            <Route
              path="/folders/:folderId/vpc/networks/:networkId/subnets/create"
              element={<SubnetCreateRedirect />}
            />
            <Route
              path="/folders/:folderId/vpc/networks/:networkId/subnets/:subnetId/addresses/create"
              element={
                <ResourceCreatePage
                  spec={REGISTRY.addresses}
                  parentField="folder_id"
                  parentParam="folderId"
                />
              }
            />
            <Route
              path="/folders/:folderId/vpc/subnets/:subnetId/addresses/create"
              element={
                <ResourceCreatePage
                  spec={REGISTRY.addresses}
                  parentField="folder_id"
                  parentParam="folderId"
                />
              }
            />

            {/* === Global VPC Operations (folder-scoped) === */}
            <Route
              path="/folders/:folderId/vpc/operations"
              element={<OperationsPage />}
            />

            {/* === Network-nested ресурсы (YC-style URL) === */}
            {/* /folders/:folderId/vpc/networks/:networkId/subnets/:uid */}
            <Route
              path="/folders/:folderId/vpc/networks/:networkId/subnets/:uid"
              element={<SubnetDetailPage />}
            />
            <Route
              path="/folders/:folderId/vpc/networks/:networkId/subnets/:uid/edit"
              element={<SubnetDetailPage />}
            />
            {/* /folders/:folderId/vpc/networks/:networkId/route-tables/:uid */}
            <Route
              path="/folders/:folderId/vpc/networks/:networkId/route-tables/:uid"
              element={<RouteTableDetailPage />}
            />
            <Route
              path="/folders/:folderId/vpc/networks/:networkId/route-tables/:uid/edit"
              element={<RouteTableDetailPage />}
            />
            {/* /folders/:folderId/vpc/networks/:networkId/security-groups/:uid */}
            <Route
              path="/folders/:folderId/vpc/networks/:networkId/security-groups/:uid"
              element={<SecurityGroupDetailPage />}
            />
            <Route
              path="/folders/:folderId/vpc/networks/:networkId/security-groups/:uid/edit"
              element={<SecurityGroupDetailPage />}
            />
            {/* /folders/:folderId/vpc/networks/:networkId/subnets/:subnetId/addresses/:uid */}
            <Route
              path="/folders/:folderId/vpc/networks/:networkId/subnets/:subnetId/addresses/:uid"
              element={<AddressDetailPage />}
            />
            <Route
              path="/folders/:folderId/vpc/networks/:networkId/subnets/:subnetId/addresses/:uid/edit"
              element={<AddressDetailPage />}
            />
            {/* /folders/:folderId/vpc/subnets/:subnetId/addresses/:uid (flat-subnet-context) */}
            <Route
              path="/folders/:folderId/vpc/subnets/:subnetId/addresses/:uid"
              element={<AddressDetailPage />}
            />
            <Route
              path="/folders/:folderId/vpc/subnets/:subnetId/addresses/:uid/edit"
              element={<AddressDetailPage />}
            />

            {/* /folders/:folderId — редирект на dashboard */}
            <Route
              path="/folders/:folderId"
              element={<FolderDefaultRedirect />}
            />
            {/* Edit folder — full-page форма */}
            <Route
              path="/folders/:folderId/edit"
              element={<ResourceEditPage spec={REGISTRY.folders} paramKey="folderId" />}
            />

            {/* Detail-страницы для Resource Manager */}
            <Route
              path="/organizations/:orgId"
              element={<ResourceDetailPage spec={REGISTRY.organizations} paramKey="orgId" />}
            />
            <Route
              path="/organizations/:orgId/edit"
              element={<ResourceEditPage spec={REGISTRY.organizations} paramKey="orgId" />}
            />
            <Route
              path="/clouds/:cloudId"
              element={<ResourceDetailPage spec={REGISTRY.clouds} paramKey="cloudId" />}
            />
            <Route
              path="/clouds/:cloudId/edit"
              element={<ResourceEditPage spec={REGISTRY.clouds} paramKey="cloudId" />}
            />

            {/* === System (admin-only, kacho-only) === */}
            {/* Region/Zone/AddressPool — глобальные ресурсы. Не публикуются на
                external TLS endpoint, см. CLAUDE.md kacho-vpc §16.
                List-страницы обёрнуты в AdminLayout с горизонтальными табами
                навигации между admin-сущностями + кнопкой "Создать <singular>"
                в правом header-slot. */}
            <Route element={<AdminLayout />}>
              <Route path="/system/regions" element={<ResourceListPage spec={REGISTRY.regions} />} />
              <Route path="/system/zones" element={<ResourceListPage spec={REGISTRY.zones} />} />
              <Route path="/system/address-pools" element={<ResourceListPage spec={REGISTRY["address-pools"]} />} />
            </Route>
            <Route path="/system/regions/create" element={<ResourceCreatePage spec={REGISTRY.regions} />} />
            <Route path="/system/regions/:uid" element={<ResourceDetailPage spec={REGISTRY.regions} />} />
            <Route path="/system/regions/:uid/edit" element={<ResourceEditPage spec={REGISTRY.regions} />} />
            <Route path="/system/zones/create" element={<ResourceCreatePage spec={REGISTRY.zones} />} />
            <Route path="/system/zones/:uid" element={<ResourceDetailPage spec={REGISTRY.zones} />} />
            <Route path="/system/zones/:uid/edit" element={<ResourceEditPage spec={REGISTRY.zones} />} />
            <Route path="/system/address-pools/create" element={<ResourceCreatePage spec={REGISTRY["address-pools"]} />} />
            <Route path="/system/address-pools/:uid" element={<AddressPoolDetailPage />} />
            <Route path="/system/address-pools/:uid/edit" element={<ResourceEditPage spec={REGISTRY["address-pools"]} />} />
            <Route path="/system/search" element={<SystemSearchPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

// FolderDefaultRedirect: /folders/:folderId → /folders/:folderId/dashboard
function FolderDefaultRedirect() {
  const { folderId } = useParams();
  return <Navigate to={`/folders/${folderId}/dashboard`} replace />;
}
