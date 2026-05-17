// IamLayout — обёртка для /iam/* admin-страниц. Горизонтальные табы между
// 7 IAM ресурсами + page-title header. Mount единственного GlobalResourceFormModal.
//
// На E0 (KAC-109): без auth-interceptor; UI шлёт запросы анонимно.
// Реактивность реализована через useQuery+refetchInterval (см. CLAUDE.md §1
// «@tanstack/react-query») + invalidateQueries после каждой mutation.

import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Space, Tabs, Typography, Alert } from "antd";
import { GlobalResourceFormModal } from "@/components/GlobalResourceFormModal";

const TABS = [
  { key: "/iam/accounts", label: "Accounts" },
  { key: "/iam/projects", label: "Projects" },
  { key: "/iam/users", label: "Users" },
  { key: "/iam/service-accounts", label: "Service Accounts" },
  { key: "/iam/groups", label: "Groups" },
  { key: "/iam/roles", label: "Roles" },
  { key: "/iam/access-bindings", label: "Access Bindings" },
];

export function IamLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const active =
    TABS.find((t) => location.pathname.startsWith(t.key))?.key ?? TABS[0].key;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Identity and Access Management
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Управление доступом: Accounts, Projects, Users, Service Accounts,
          Groups, Roles, Access Bindings.
        </Typography.Text>
      </div>

      <Alert
        type="info"
        showIcon
        message="Auth-flow не активирован (E0)"
        description={
          <span>
            На текущей фазе (E0) Zitadel/OpenFGA не задеплоены, UI ходит в
            api-gateway анонимно. Реальные signup/login придут после KAC-107
            (E2) + KAC-108 (E3). User'ы создаются через
            <code style={{ marginLeft: 4 }}>
              InternalUserService.UpsertFromIdentity
            </code>{" "}
            (gRPC-direct admin tooling).
          </span>
        }
        style={{ marginBottom: 0 }}
      />

      <Tabs
        activeKey={active}
        onChange={(k) => navigate(k)}
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
        size="middle"
        style={{ marginBottom: 0 }}
      />

      <Outlet />
      <GlobalResourceFormModal />
    </Space>
  );
}
