// UsersPage — список User-mirror'ов из kacho-iam.
//
// Create через публичный API НЕ предусмотрен (это Zitadel signup-flow OIDC).
// На E0 user'ы создаются только через `grpcurl -plaintext kacho-iam:9091
// kacho.cloud.iam.v1.InternalUserService.UpsertFromIdentity` (admin tooling).
// На E2 — через OIDC-callback автоматически.

import { Button, Popconfirm, Space, Table, Typography, Alert } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import type { ColumnsType } from "antd/es/table";
import { iamApi, IAM, type User } from "@/api/iam";
import { useIamMutation, fmtTs, CopyableMonoId } from "@/components/iam/IamCommon";

export function UsersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["iam", "users", "list"],
    queryFn: () => iamApi.listUsers({ pageSize: "200" }),
    refetchInterval: 5_000,
    staleTime: 0,
  });

  const users = data?.users ?? [];

  const del = useIamMutation({
    method: "DELETE",
    path: (b) => `${IAM.users}/${b as string}`,
    invalidateKeys: [["iam", "users", "list"]],
    successText: "User удалён",
  });

  const columns: ColumnsType<User> = [
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (v) =>
        v ? <Typography.Text strong>{v}</Typography.Text> : "—",
    },
    {
      title: "Display name",
      dataIndex: "display_name",
      key: "display_name",
      render: (v) =>
        v || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      render: (v) => <CopyableMonoId id={v} />,
    },
    {
      title: "External ID (Zitadel sub)",
      dataIndex: "external_id",
      key: "external_id",
      render: (v) => <CopyableMonoId id={v} />,
    },
    {
      title: "Создан",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (v) => fmtTs(v),
    },
    {
      title: "",
      key: "actions",
      width: 60,
      render: (_v, row) => (
        <Popconfirm
          title="Удалить User?"
          description={`Удалить «${row.email || row.id}»? Owned Account/AccessBinding — см. backend rules.`}
          okText="Удалить"
          okButtonProps={{ danger: true }}
          cancelText="Отмена"
          onConfirm={() => void del.run(row.id)}
        >
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Users
      </Typography.Title>

      {users.length === 0 && !isLoading && (
        <Alert
          type="warning"
          showIcon
          message="User'ов нет"
          description={
            <span>
              На E0 публичного Create нет — User создаётся только через
              <code style={{ marginLeft: 4 }}>
                InternalUserService.UpsertFromIdentity
              </code>{" "}
              (gRPC-direct admin). На E2 — автоматически из OIDC-callback Zitadel.
              <br />
              Пример из admin-shell:
              <pre style={{ marginTop: 8, fontSize: 12 }}>{`grpcurl -plaintext \\
  -d '{"external_id":"zitadel-sub-123","email":"admin@example.com","display_name":"Admin"}' \\
  kacho-iam:9091 \\
  kacho.cloud.iam.v1.InternalUserService/UpsertFromIdentity`}</pre>
            </span>
          }
        />
      )}

      <Table<User>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={users}
        columns={columns}
        pagination={false}
        locale={{ emptyText: "User'ов нет." }}
      />
    </Space>
  );
}
