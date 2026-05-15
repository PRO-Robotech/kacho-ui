// AdminLayout — обёртка над admin-страницами /system/{regions,zones,address-pools}.
// Рендерит горизонтальные табы навигации между admin-ресурсами в одном месте,
// чтобы пользователь видел все доступные admin-сущности и мог создавать любую.
//
// Применяется только для list-страниц через App.tsx. Detail/Create/Edit
// используют ResourceDetailPage/CreatePage/EditPage как обычно.

import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Space, Tabs, Typography } from "antd";
import { GlobalResourceFormModal } from "@/components/GlobalResourceFormModal";

const TABS = [
  { key: "/system/regions", label: "Регионы" },
  { key: "/system/zones", label: "Зоны" },
  { key: "/system/address-pools", label: "Пулы адресов" },
  { key: "/system/hypervisors", label: "Гипервизоры" },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const active =
    TABS.find((t) => location.pathname.startsWith(t.key))?.key ??
    TABS[0].key;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Администрирование
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Глобальные ресурсы инфраструктуры. Доступны только администраторам.
        </Typography.Text>
      </div>

      <Tabs
        activeKey={active}
        onChange={(k) => navigate(k)}
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
        size="middle"
        style={{ marginBottom: 0 }}
      />

      <Outlet />
      {/* Глобальный mount модалок Create/Edit для admin-страниц (regions /
          zones / address-pools). Не folder/cloud/org-scoped — используем
          "system" как containerId-placeholder; ResourceFormModal не требует
          конкретного folderId для cluster-scoped ресурсов. */}
      <GlobalResourceFormModal />
    </Space>
  );
}
