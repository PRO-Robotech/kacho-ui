// ServiceAccountsPage — список ServiceAccount per Account + Create/Edit/Delete.

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
import { iamApi, IAM, type ServiceAccount, type Account } from "@/api/iam";
import { useIamMutation, fmtTs, CopyableMonoId } from "@/components/iam/IamCommon";

export function ServiceAccountsPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceAccount | null>(null);

  const accounts = useQuery({
    queryKey: ["iam", "accounts", "list"],
    queryFn: () => iamApi.listAccounts({ pageSize: "1000" }),
    staleTime: 30_000,
  });

  const list = useQuery({
    queryKey: ["iam", "service-accounts", "list", accountId],
    queryFn: () =>
      iamApi.listServiceAccounts({ account_id: accountId!, pageSize: "200" }),
    enabled: !!accountId,
    refetchInterval: 5_000,
    staleTime: 0,
  });

  const del = useIamMutation({
    method: "DELETE",
    path: (b) => `${IAM.serviceAccounts}/${b as string}`,
    invalidateKeys: [["iam", "service-accounts", "list"]],
    successText: "ServiceAccount удалён",
  });

  const accountList = accounts.data?.accounts ?? [];
  const sas = list.data?.service_accounts ?? [];

  const columns: ColumnsType<ServiceAccount> = [
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
            onClick={() => setEditing(row)}
          />
          <Popconfirm
            title="Удалить ServiceAccount?"
            description={`Удалить «${row.name}»? SA с активными AccessBinding → FailedPrecondition.`}
            okText="Удалить"
            okButtonProps={{ danger: true }}
            cancelText="Отмена"
            onConfirm={() => void del.run(row.id)}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Service Accounts
      </Typography.Title>

      <Space size={8} wrap>
        <Select
          style={{ width: 320 }}
          placeholder="Выберите Account"
          value={accountId ?? undefined}
          onChange={(v) => setAccountId(v)}
          options={accountList.map((a: Account) => ({
            value: a.id,
            label: `${a.name} · ${a.id}`,
          }))}
          loading={accounts.isLoading}
          showSearch
          optionFilterProp="label"
        />
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          disabled={!accountId}
          onClick={() => setCreateOpen(true)}
        >
          Создать SA
        </Button>
      </Space>

      {!accountId ? (
        <Typography.Text type="secondary">
          Выберите Account, чтобы увидеть его Service Accounts.
        </Typography.Text>
      ) : (
        <Table<ServiceAccount>
          rowKey="id"
          size="small"
          loading={list.isLoading}
          dataSource={sas}
          columns={columns}
          pagination={false}
          locale={{
            emptyText: "Service Accounts отсутствуют. Создайте первый.",
          }}
        />
      )}

      <SaCreateModal
        open={createOpen}
        accountId={accountId}
        onClose={() => setCreateOpen(false)}
      />
      <SaEditModal sa={editing} onClose={() => setEditing(null)} />
    </Space>
  );
}

function SaCreateModal({
  open,
  accountId,
  onClose,
}: {
  open: boolean;
  accountId: string | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const mut = useIamMutation({
    method: "POST",
    path: IAM.serviceAccounts,
    invalidateKeys: [["iam", "service-accounts", "list"]],
    successText: "ServiceAccount создан",
    onSuccess: () => {
      form.resetFields();
      onClose();
    },
  });

  return (
    <Modal
      title="Создать Service Account"
      open={open}
      onCancel={onClose}
      maskClosable
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
          if (!accountId) return;
          const body: Record<string, unknown> = {
            account_id: accountId,
            name: v.name,
          };
          if (v.description) body.description = v.description;
          void mut.run(body);
        }}
      >
        <Form.Item label="Account">
          <Typography.Text code>{accountId ?? "—"}</Typography.Text>
        </Form.Item>
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
          <Input placeholder="ci-bot" />
        </Form.Item>
        <Form.Item label="Описание" name="description">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function SaEditModal({
  sa,
  onClose,
}: {
  sa: ServiceAccount | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const mut = useIamMutation({
    method: "PATCH",
    path: () => `${IAM.serviceAccounts}/${sa?.id}`,
    invalidateKeys: [["iam", "service-accounts", "list"]],
    successText: "ServiceAccount обновлён",
    onSuccess: () => onClose(),
  });

  return (
    <Modal
      title={`Изменить ServiceAccount · ${sa?.name ?? ""}`}
      open={!!sa}
      onCancel={onClose}
      maskClosable
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
          name: sa?.name ?? "",
          description: sa?.description ?? "",
        }}
        onFinish={(v) => {
          const update_mask: string[] = [];
          const body: Record<string, unknown> = {};
          if ((v.name ?? "") !== (sa?.name ?? "")) {
            update_mask.push("name");
            body.name = v.name;
          }
          if ((v.description ?? "") !== (sa?.description ?? "")) {
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
          <Input />
        </Form.Item>
        <Form.Item label="Описание" name="description">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
