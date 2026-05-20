import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
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
import { IamLayout } from "@/components/iam/IamLayout";
import { AccountsPage } from "@/pages/iam/AccountsPage";
import { ProjectsPage } from "@/pages/iam/ProjectsPage";
import { UsersPage } from "@/pages/iam/UsersPage";
import { ServiceAccountsPage } from "@/pages/iam/ServiceAccountsPage";
import { GroupsPage } from "@/pages/iam/GroupsPage";
import { RolesPage } from "@/pages/iam/RolesPage";
import { AccessBindingsPage } from "@/pages/iam/AccessBindingsPage";
import { AccessPage } from "@/pages/iam/AccessPage";
import { AuthCallback } from "@/pages/auth/AuthCallback";
import { SignupPage } from "@/pages/auth/SignupPage";
import { LogoutPage } from "@/pages/auth/Logout";
import { LoginPage } from "@/pages/auth/Login";
import { RegisterPage } from "@/pages/auth/Register";
import { RecoveryPage } from "@/pages/auth/Recovery";
import { SettingsPage } from "@/pages/auth/Settings";
import { StepUpModal } from "@/components/auth/StepUpModal";
import { AuthProvider } from "@/contexts/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Project-scoped VPC ресурсы — берём имена из registry без захардкоженного списка.
const PROJECT_SCOPED = ["networks", "subnets", "addresses", "route-tables", "security-groups", "network-interfaces", "gateways"]
  .map((id) => REGISTRY[id])
  .filter(Boolean);

// Project-scoped Compute ресурсы (Disk/Image/Snapshot/Instance). URL-сегмент — `compute`.
const COMPUTE_SCOPED = ["compute-disks", "compute-images", "compute-snapshots", "compute-instances"]
  .map((id) => REGISTRY[id])
  .filter(Boolean);

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
        <AuthProvider>
        <StepUpModal />
        <Routes>
          {/* Public signup/login pages (без Layout — full-screen) */}
          <Route path="/signup" element={<SignupPage />} />

          {/* KAC-127 (Phase 2): Passkey/WebAuthn auth pages — без Layout. */}
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/registration" element={<RegisterPage />} />
          <Route path="/auth/recovery" element={<RecoveryPage />} />
          <Route path="/auth/settings" element={<SettingsPage />} />
          <Route element={<Layout />}>
            {/* Root → dashboard. */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            {/* Dashboard with project context in URL. */}
            <Route path="/projects/:projectId/dashboard" element={<DashboardPage />} />

            {/* === IAM hierarchy (KAC-124: заменил Resource Manager) ===
                Account / Project — flat ресурсы под /iam/accounts и /iam/projects;
                рендерятся в IAM-section ниже (AccountsPage / ProjectsPage). */}

            {/* === Project-scoped VPC ресурсы === */}
            {/* /projects/:projectId/vpc/{networks|subnets|addresses|route-tables|security-groups} */}
            {PROJECT_SCOPED.map((spec) => (
              <Route key={spec.id}>
                <Route
                  path={`/projects/:projectId/vpc/${spec.route}`}
                  element={
                    // VpcListShell = ResourceListPage + ResourceFormModal mount
                    // (модалка открывается по ?modal=<spec>-create или
                    // ?modal=<spec>-edit&id=<uid>).
                    <VpcListShell
                      spec={spec}
                      parentField="project_id"
                      parentParam="projectId"
                    />
                  }
                />
                <Route
                  path={`/projects/:projectId/vpc/${spec.route}/create`}
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
                          parentField="project_id"
                          parentParam="projectId"
                        />
                  }
                />
                <Route
                  path={`/projects/:projectId/vpc/${spec.route}/:uid`}
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
                  path={`/projects/:projectId/vpc/${spec.route}/:uid/edit`}
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
              </Route>
            ))}

            {/* === Project-scoped Compute ресурсы === */}
            {/* /projects/:projectId/compute/{disks|images|snapshots|instances} */}
            {COMPUTE_SCOPED.map((spec) => (
              <Route key={spec.id}>
                <Route
                  path={`/projects/:projectId/compute/${spec.route}`}
                  element={
                    <ResourceListPage
                      spec={spec}
                      parentField="project_id"
                      parentParam="projectId"
                    />
                  }
                />
                <Route
                  path={`/projects/:projectId/compute/${spec.route}/create`}
                  element={
                    <ResourceCreatePage
                      spec={spec}
                      parentField="project_id"
                      parentParam="projectId"
                    />
                  }
                />
                <Route
                  path={`/projects/:projectId/compute/${spec.route}/:uid`}
                  element={
                    spec.id === "compute-instances"
                      ? <InstanceDetailPage />
                      : <ResourceDetailPage spec={spec} />
                  }
                />
                <Route
                  path={`/projects/:projectId/compute/${spec.route}/:uid/edit`}
                  element={
                    spec.id === "compute-instances"
                      ? <InstanceDetailPage />
                      : <ResourceDetailPage spec={spec} />
                  }
                />
              </Route>
            ))}

            {/* === Network-nested CREATE для дочерних ресурсов === */}
            {/* Сохраняет network-context: при создании RT/SG из network detail
                URL остаётся под /networks/<n>/. */}
            <Route
              path="/projects/:projectId/vpc/networks/:networkId/route-tables/create"
              element={
                <ResourceCreatePage
                  spec={REGISTRY["route-tables"]}
                  parentField="project_id"
                  parentParam="projectId"
                />
              }
            />
            <Route
              path="/projects/:projectId/vpc/networks/:networkId/security-groups/create"
              element={
                <ResourceCreatePage
                  spec={REGISTRY["security-groups"]}
                  parentField="project_id"
                  parentParam="projectId"
                />
              }
            />
            <Route
              path="/projects/:projectId/vpc/networks/:networkId/subnets/create"
              element={<SubnetCreateRedirect />}
            />
            <Route
              path="/projects/:projectId/vpc/networks/:networkId/subnets/:subnetId/addresses/create"
              element={
                <ResourceCreatePage
                  spec={REGISTRY.addresses}
                  parentField="project_id"
                  parentParam="projectId"
                />
              }
            />
            <Route
              path="/projects/:projectId/vpc/subnets/:subnetId/addresses/create"
              element={
                <ResourceCreatePage
                  spec={REGISTRY.addresses}
                  parentField="project_id"
                  parentParam="projectId"
                />
              }
            />

            {/* === Global VPC Operations (project-scoped) === */}
            <Route
              path="/projects/:projectId/vpc/operations"
              element={<OperationsPage />}
            />

            {/* === Network-nested ресурсы (YC-style URL) === */}
            {/* /projects/:projectId/vpc/networks/:networkId/subnets/:uid */}
            <Route
              path="/projects/:projectId/vpc/networks/:networkId/subnets/:uid"
              element={<SubnetDetailPage />}
            />
            <Route
              path="/projects/:projectId/vpc/networks/:networkId/subnets/:uid/edit"
              element={<SubnetDetailPage />}
            />
            {/* /projects/:projectId/vpc/networks/:networkId/route-tables/:uid */}
            <Route
              path="/projects/:projectId/vpc/networks/:networkId/route-tables/:uid"
              element={<RouteTableDetailPage />}
            />
            <Route
              path="/projects/:projectId/vpc/networks/:networkId/route-tables/:uid/edit"
              element={<RouteTableDetailPage />}
            />
            {/* /projects/:projectId/vpc/networks/:networkId/security-groups/:uid */}
            <Route
              path="/projects/:projectId/vpc/networks/:networkId/security-groups/:uid"
              element={<SecurityGroupDetailPage />}
            />
            <Route
              path="/projects/:projectId/vpc/networks/:networkId/security-groups/:uid/edit"
              element={<SecurityGroupDetailPage />}
            />
            {/* /projects/:projectId/vpc/networks/:networkId/subnets/:subnetId/addresses/:uid */}
            <Route
              path="/projects/:projectId/vpc/networks/:networkId/subnets/:subnetId/addresses/:uid"
              element={<AddressDetailPage />}
            />
            <Route
              path="/projects/:projectId/vpc/networks/:networkId/subnets/:subnetId/addresses/:uid/edit"
              element={<AddressDetailPage />}
            />
            {/* /projects/:projectId/vpc/subnets/:subnetId/addresses/:uid (flat-subnet-context) */}
            <Route
              path="/projects/:projectId/vpc/subnets/:subnetId/addresses/:uid"
              element={<AddressDetailPage />}
            />
            <Route
              path="/projects/:projectId/vpc/subnets/:subnetId/addresses/:uid/edit"
              element={<AddressDetailPage />}
            />

            {/* /projects/:projectId — редирект на dashboard */}
            <Route
              path="/projects/:projectId"
              element={<ProjectDefaultRedirect />}
            />
            {/* Edit project — full-page форма (KAC-124). */}
            <Route
              path="/projects/:projectId/edit"
              element={<ResourceEditPage spec={REGISTRY.projects} paramKey="projectId" />}
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

            {/* === IAM section (KAC-109, E0 UI block) ===
                Все 7 IAM-страниц + auth-info banner в shared IamLayout. */}
            <Route element={<IamLayout />}>
              <Route path="/iam" element={<Navigate to="/iam/accounts" replace />} />
              <Route path="/iam/accounts" element={<AccountsPage />} />
              <Route path="/iam/projects" element={<ProjectsPage />} />
              <Route path="/iam/users" element={<UsersPage />} />
              <Route path="/iam/service-accounts" element={<ServiceAccountsPage />} />
              <Route path="/iam/groups" element={<GroupsPage />} />
              <Route path="/iam/roles" element={<RolesPage />} />
              <Route path="/iam/access-bindings" element={<AccessBindingsPage />} />
              {/* KAC-125: YC-style «Права доступа» с Cascader + invite. */}
              <Route path="/iam/access" element={<AccessPage />} />
            </Route>

            {/* === Auth routes (OIDC callback + logout) ===
                /auth/callback: api-gateway → UI redirect после OIDC-flow.
                /logout: явный logout endpoint (используется UserMenu и прямым URL). */}
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/logout" element={<LogoutPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          </Routes>
        </AuthProvider>
        </BrowserRouter>
        <Toaster />
      </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

// ProjectDefaultRedirect: /projects/:projectId → /projects/:projectId/dashboard
function ProjectDefaultRedirect() {
  const { projectId } = useParams();
  return <Navigate to={`/projects/${projectId}/dashboard`} replace />;
}
