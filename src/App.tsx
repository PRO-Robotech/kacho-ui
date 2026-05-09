import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { ResourceListPage } from "@/components/ResourceListPage";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { Toaster } from "@/components/Toaster";
import { REGISTRY } from "@/lib/resource-registry";
import { AddressPoolDetailPage } from "@/pages/AddressPoolDetailPage";
import { SubnetDetailPage } from "@/pages/SubnetDetailPage";
import { SecurityGroupDetailPage } from "@/pages/SecurityGroupDetailPage";
import { SystemSearchPage } from "@/pages/SystemSearchPage";

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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            {/* Root → drill-flow от Organizations вниз. */}
            <Route index element={<Navigate to="/organizations" replace />} />

            {/* === Resource Manager hierarchy (через path) === */}

            {/* /organizations — список org (cluster-scoped) */}
            <Route
              path="/organizations"
              element={<ResourceListPage spec={REGISTRY.organizations} />}
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
            <Route path="/system/regions/:uid" element={<ResourceDetailPage spec={REGISTRY.regions} />} />
            <Route path="/system/zones" element={<ResourceListPage spec={REGISTRY.zones} />} />
            <Route path="/system/zones/:uid" element={<ResourceDetailPage spec={REGISTRY.zones} />} />
            <Route path="/system/address-pools" element={<ResourceListPage spec={REGISTRY["address-pools"]} />} />
            <Route path="/system/address-pools/:uid" element={<AddressPoolDetailPage />} />
            <Route path="/system/search" element={<SystemSearchPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

// FolderDefaultRedirect: /folders/:folderId → /folders/:folderId/networks
import { useParams } from "react-router-dom";
function FolderDefaultRedirect() {
  const { folderId } = useParams();
  return <Navigate to={`/folders/${folderId}/networks`} replace />;
}
