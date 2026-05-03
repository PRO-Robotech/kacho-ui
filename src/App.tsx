import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { DashboardPage } from "@/pages/DashboardPage";
import { OrganizationsPage } from "@/pages/OrganizationsPage";
import { CloudsPage } from "@/pages/CloudsPage";
import { FoldersPage } from "@/pages/FoldersPage";
import { NetworksPage } from "@/pages/NetworksPage";
import { SubnetsPage } from "@/pages/SubnetsPage";
import { InstancesPage } from "@/pages/InstancesPage";
import { DisksPage } from "@/pages/DisksPage";
import { ImagesPage } from "@/pages/ImagesPage";
import { NlbsPage } from "@/pages/NlbsPage";
import { TargetGroupsPage } from "@/pages/TargetGroupsPage";
import { StubPage } from "@/pages/StubPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/clouds" element={<CloudsPage />} />
            <Route path="/folders" element={<FoldersPage />} />

            <Route path="/networks" element={<NetworksPage />} />
            <Route path="/subnets" element={<SubnetsPage />} />
            <Route
              path="/security-groups"
              element={
                <StubPage
                  title="Security Groups"
                  description="Firewall rules per VPC Network"
                  endpoint="/v1/security-groups/list"
                  resourceKey="securityGroups"
                  scope="folder"
                />
              }
            />
            <Route
              path="/route-tables"
              element={
                <StubPage
                  title="Route Tables"
                  description="Static routing per VPC Network"
                  endpoint="/v1/route-tables/list"
                  resourceKey="routeTables"
                  scope="folder"
                />
              }
            />
            <Route
              path="/addresses"
              element={
                <StubPage
                  title="Addresses"
                  description="Reserved external IP addresses"
                  endpoint="/v1/addresses/list"
                  resourceKey="addresses"
                  scope="folder"
                />
              }
            />

            <Route path="/instances" element={<InstancesPage />} />
            <Route path="/disks" element={<DisksPage />} />
            <Route path="/images" element={<ImagesPage />} />
            <Route
              path="/snapshots"
              element={
                <StubPage
                  title="Snapshots"
                  description="Disk snapshots"
                  endpoint="/v1/snapshots/list"
                  resourceKey="snapshots"
                  scope="folder"
                />
              }
            />

            <Route path="/network-load-balancers" element={<NlbsPage />} />
            <Route path="/target-groups" element={<TargetGroupsPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
