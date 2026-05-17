// AccountsPage — список Account ресурсов из kacho-iam.
//
// CRUD: Create через модалку (name + description + owner_user_id picker через
// User-select); Edit name/description/labels; Delete (FailedPrecondition если
// есть child Projects — backend сам контролирует).

import { useState } from "react";
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import type { ColumnsType } from "antd/es/table";
import { iamApi, IAM, type Account, type User } from "@/api/iam";
import { useIamMutation, fmtTs, CopyableMonoId } from "@/components/iam/IamCommon";

export function AccountsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["iam", "accounts", "list"],
    queryFn: () => iamApi.listAccounts({ pageSize: "200" }),
    refetchInterval: 5_000,
    staleTime: 0,
  });

  const accounts = data?.accounts ?? [];

  const del = useIamMutation({
    method: "DELETE",
    path: (b) => `${IAM.accounts}/${b as string}`,
    invalidateKeys: [["iam", "accounts", "list"]],
    successText: "Account удалён",
  });

  const columns: ColumnsType<Account> = [
    {
      title: "Имя",
      dataIndex: "name",
      key: "name",
      render: (v) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      render: (v) => <CopyableMonoId id={v} />,
    },
    {
      title: "Owner User",
      dataIndex: "owner_user_id",
      key: "owner",
      render: (v) => <CopyableMonoId id={v} />,
    },
    {
      title: "Описание",
      dataIndex: "description",
      key: "description",
      render: (v) =>
        v || <Typography.Text type="secondary">—</Typography.Text>,
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
      width: 110,
      render: (_v, row) => (
        <Space size={4}>
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(row);
            }}
          />
          <Popconfirm
            title="Удалить Account?"
            description={`Удалить «${row.name}»? Account с child Projects вернёт ошибку.`}
            okText="Удалить"
            okButtonProps={{ danger: true }}
            cancelText="Отмена"
            onConfirm={() => void del.run(row.id)}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space size={8} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Accounts
        </Typography.Title>
        <div style={{ flex: 1 }} />
      </Space>

      <Space size={8} wrap>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          Создать Account
        </Button>
      </Space>

      <Table<Account>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={accounts}
        columns={columns}
        pagination={false}
        locale={{ emptyText: "Account'ов нет. Создайте первый." }}
      />

      <AccountCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <AccountEditModal account={editing} onClose={() => setEditing(null)} />
    </Space>
  );
}

function AccountCreateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm();

  const users = useQuery({
    queryKey: ["iam", "users", "list"],
    queryFn: () => iamApi.listUsers({ pageSize: "1000" }),
    enabled: open,
    staleTime: 30_000,
  });

  const mut = useIamMutation({
    method: "POST",
    path: IAM.accounts,
    invalidateKeys: [["iam", "accounts", "list"]],
    successText: "Account создан",
    onSuccess: () => {
      form.resetFields();
      onClose();
    },
  });

  return (
    <Modal
      title="Создать Account"
      open={open}
      onCancel={onClose}
      maskClosable={true}
      width={560}
      destroyOnClose
      onOk={() => form.submit()}
      okText="Создать"
      cancelText="Отмена"
      confirmLoading={mut.submitting}
    >
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ flex: "160px" }}
        wrapperCol={{ flex: "auto" }}
        labelAlign="left"
        colon={false}
        onFinish={(v) => {
          const body: Record<string, unknown> = {
            name: v.name,
            owner_user_id: v.owner_user_id,
          };
          if (v.description) body.description = v.description;
          void mut.run(body);
        }}
        initialValues={{ name: "" }}
      >
        <Form.Item
          label="Имя"
          name="name"
          required
          rules={[
            {
              required: true,
              pattern: /^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$/,
              message: "lowercase, цифры, дефисы; 3-63 символа",
            },
          ]}
        >
          <Input placeholder="my-account" />
        </Form.Item>
        <Form.Item
          label="Owner User"
          name="owner_user_id"
          required
          rules={[{ required: true, message: "Выберите owner" }]}
          extra={
            (users.data?.users.length ?? 0) === 0
              ? "User'ов нет. Сначала создайте через InternalUserService.UpsertFromIdentity."
              : null
          }
        >
          <Select
            placeholder="Выберите owner-user"
            loading={users.isLoading}
            options={(users.data?.users ?? []).map((u: User) => ({
              value: u.id,
              label: `${u.display_name || u.email || u.id} · ${u.id}`,
            }))}
            showSearch
            optionFilterProp="label"
            notFoundContent="User'ов нет"
          />
        </Form.Item>
        <Form.Item label="Описание" name="description">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function AccountEditModal({
  account,
  onClose,
}: {
  account: Account | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const mut = useIamMutation({
    method: "PATCH",
    path: () => `${IAM.accounts}/${account?.id}`,
    invalidateKeys: [["iam", "accounts", "list"]],
    successText: "Account обновлён",
    onSuccess: () => onClose(),
  });

  return (
    <Modal
      title={`Изменить Account · ${account?.name ?? ""}`}
      open={!!account}
      onCancel={onClose}
      maskClosable={true}
      width={560}
      destroyOnClose
      onOk={() => form.submit()}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={mut.submitting}
    >
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ flex: "160px" }}
        wrapperCol={{ flex: "auto" }}
        labelAlign="left"
        colon={false}
        initialValues={{
          name: account?.name ?? "",
          description: account?.description ?? "",
        }}
        onFinish={(v) => {
          const update_mask: string[] = [];
          const body: Record<string, unknown> = {};
          if ((v.name ?? "") !== (account?.name ?? "")) {
            update_mask.push("name");
            body.name = v.name;
          }
          if ((v.description ?? "") !== (account?.description ?? "")) {
            update_mask.push("description");
            body.description = v.description;
          }
          if (update_mask.length === 0) {
            onClose();
            return;
          }
          body.update_mask = update_mask.join(",");
          void mut.run(body);
        }}
      >
        <Form.Item label="Имя" name="name">
          <Input placeholder="my-account" />
        </Form.Item>
        <Form.Item label="Описание" name="description">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
          owner_user_id — immutable; меняется только через Move/Recreate
        </Typography.Paragraph>
      </Form>
    </Modal>
  );
}
