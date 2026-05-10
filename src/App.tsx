import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, theme as antdTheme, App as AntdApp } from "antd";
import ruRU from "antd/locale/ru_RU";
import { Layout } from "@/components/Layout";
import { ResourceListPage } from "@/components/ResourceListPage";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { ResourceCreatePage } from "@/components/ResourceCreatePage";
import { Toaster } from "@/components/Toaster";
import { REGISTRY } from "@/lib/resource-registry";
import { AddressPoolDetailPage } from "@/pages/AddressPoolDetailPage";
import { SubnetDetailPage } from "@/pages/SubnetDetailPage";
import { SecurityGroupDetailPage } from "@/pages/SecurityGroupDetailPage";
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
const FOLDER_SCOPED = ["networks", "subnets", "addresses", "route-tables", "security-groups"]
  .map((id) => REGISTRY[id])
  .filter(Boolean);

export default function App() {
  return (
    <ConfigProvider
      locale={ruRU}
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
            {/* /folders/:folderId/{networks|subnets|addresses|route-tables} */}
            {FOLDER_SCOPED.map((spec) => (
              <Route key={spec.id}>
                <Route
                  path={`/folders/:folderId/${spec.route}`}
                  element={
                    <ResourceListPage
                      spec={spec}
                      parentField="folder_id"
                      parentParam="folderId"
                    />
                  }
                />
                <Route
                  path={`/folders/:folderId/${spec.route}/create`}
                  element={
                    <ResourceCreatePage
                      spec={spec}
                      parentField="folder_id"
                      parentParam="folderId"
                    />
                  }
                />
                <Route
                  path={`/folders/:folderId/${spec.route}/:uid`}
                  element={
                    spec.id === "subnets"
                      ? <SubnetDetailPage />
                      : spec.id === "security-groups"
                        ? <SecurityGroupDetailPage />
                        : <ResourceDetailPage spec={spec} />
                  }
                />
              </Route>
            ))}

            {/* /folders/:folderId — пока редирект на networks (default landing) */}
            <Route
              path="/folders/:folderId"
              element={<FolderDefaultRedirect />}
            />

            {/* Detail-страницы для Resource Manager */}
            <Route
              path="/organizations/:orgId"
              element={<ResourceDetailPage spec={REGISTRY.organizations} paramKey="orgId" />}
            />
            <Route
              path="/clouds/:cloudId"
              element={<ResourceDetailPage spec={REGISTRY.clouds} paramKey="cloudId" />}
            />

            {/* === System (admin-only, kacho-only) === */}
            {/* Region/Zone/AddressPool — глобальные ресурсы. Не публикуются на
                external TLS endpoint, см. CLAUDE.md kacho-vpc §16. */}
            <Route path="/system/regions" element={<ResourceListPage spec={REGISTRY.regions} />} />
            <Route path="/system/regions/create" element={<ResourceCreatePage spec={REGISTRY.regions} />} />
            <Route path="/system/regions/:uid" element={<ResourceDetailPage spec={REGISTRY.regions} />} />
            <Route path="/system/zones" element={<ResourceListPage spec={REGISTRY.zones} />} />
            <Route path="/system/zones/create" element={<ResourceCreatePage spec={REGISTRY.zones} />} />
            <Route path="/system/zones/:uid" element={<ResourceDetailPage spec={REGISTRY.zones} />} />
            <Route path="/system/address-pools" element={<ResourceListPage spec={REGISTRY["address-pools"]} />} />
            <Route path="/system/address-pools/create" element={<ResourceCreatePage spec={REGISTRY["address-pools"]} />} />
            <Route path="/system/address-pools/:uid" element={<AddressPoolDetailPage />} />
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

// FolderDefaultRedirect: /folders/:folderId → /folders/:folderId/networks
import { useParams } from "react-router-dom";
function FolderDefaultRedirect() {
  const { folderId } = useParams();
  return <Navigate to={`/folders/${folderId}/networks`} replace />;
}
