// ProjectsPage — список Project ресурсов в выбранном Account + create + edit
// + Move в другой Account + Delete.
//
// Account picker (top-of-page) обязателен для List — proto require account_id.

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
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import type { ColumnsType } from "antd/es/table";
import { iamApi, IAM, type Project, type Account } from "@/api/iam";
import { useIamMutation, fmtTs, CopyableMonoId } from "@/components/iam/IamCommon";

export function ProjectsPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [moving, setMoving] = useState<Project | null>(null);

  const accounts = useQuery({
    queryKey: ["iam", "accounts", "list"],
    queryFn: () => iamApi.listAccounts({ pageSize: "1000" }),
    staleTime: 30_000,
  });

  const list = useQuery({
    queryKey: ["iam", "projects", "list", accountId],
    queryFn: () =>
      iamApi.listProjects({ account_id: accountId!, pageSize: "200" }),
    enabled: !!accountId,
    refetchInterval: 5_000,
    staleTime: 0,
  });

  const del = useIamMutation({
    method: "DELETE",
    path: (b) => `${IAM.projects}/${b as string}`,
    invalidateKeys: [["iam", "projects", "list"]],
    successText: "Project удалён",
  });

  const accountList = accounts.data?.accounts ?? [];
  const projects = list.data?.projects ?? [];

  const columns: ColumnsType<Project> = [
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
      width: 160,
      render: (_v, row) => (
        <Space size={4}>
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => setEditing(row)}
          />
          <Button
            size="small"
            type="text"
            icon={<SwapOutlined />}
            title="Move в другой Account"
            onClick={() => setMoving(row)}
          />
          <Popconfirm
            title="Удалить Project?"
            description={`Удалить «${row.name}»?`}
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
          Projects
        </Typography.Title>
      </Space>

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
          notFoundContent="Account'ов нет"
        />
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          disabled={!accountId}
          onClick={() => setCreateOpen(true)}
        >
          Создать Project
        </Button>
      </Space>

      {!accountId ? (
        <Typography.Text type="secondary">
          Выберите Account, чтобы увидеть его Projects.
        </Typography.Text>
      ) : (
        <Table<Project>
          rowKey="id"
          size="small"
          loading={list.isLoading}
          dataSource={projects}
          columns={columns}
          pagination={false}
          locale={{
            emptyText: `В Account «${accountId}» Project'ов нет. Создайте первый.`,
          }}
        />
      )}

      <ProjectCreateModal
        open={createOpen}
        accountId={accountId}
        onClose={() => setCreateOpen(false)}
      />
      <ProjectEditModal project={editing} onClose={() => setEditing(null)} />
      <ProjectMoveModal
        project={moving}
        accounts={accountList}
        onClose={() => setMoving(null)}
      />
    </Space>
  );
}

function ProjectCreateModal({
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
    path: IAM.projects,
    invalidateKeys: [["iam", "projects", "list"]],
    successText: "Project создан",
    onSuccess: () => {
      form.resetFields();
      onClose();
    },
  });

  return (
    <Modal
      title="Создать Project"
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
          <Input placeholder="my-project" />
        </Form.Item>
        <Form.Item label="Описание" name="description">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function ProjectEditModal({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const mut = useIamMutation({
    method: "PATCH",
    path: () => `${IAM.projects}/${project?.id}`,
    invalidateKeys: [["iam", "projects", "list"]],
    successText: "Project обновлён",
    onSuccess: () => onClose(),
  });

  return (
    <Modal
      title={`Изменить Project · ${project?.name ?? ""}`}
      open={!!project}
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
          name: project?.name ?? "",
          description: project?.description ?? "",
        }}
        onFinish={(v) => {
          const update_mask: string[] = [];
          const body: Record<string, unknown> = {};
          if ((v.name ?? "") !== (project?.name ?? "")) {
            update_mask.push("name");
            body.name = v.name;
          }
          if ((v.description ?? "") !== (project?.description ?? "")) {
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
          <Input placeholder="my-project" />
        </Form.Item>
        <Form.Item label="Описание" name="description">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
          account_id — immutable; меняется только через Move
        </Typography.Paragraph>
      </Form>
    </Modal>
  );
}

function ProjectMoveModal({
  project,
  accounts,
  onClose,
}: {
  project: Project | null;
  accounts: Account[];
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const mut = useIamMutation({
    method: "ACTION",
    path: () => `${IAM.projects}/${project?.id}:move`,
    invalidateKeys: [["iam", "projects", "list"]],
    successText: "Project перемещён",
    onSuccess: () => onClose(),
  });

  return (
    <Modal
      title={`Move Project · ${project?.name ?? ""}`}
      open={!!project}
      onCancel={onClose}
      maskClosable
      width={520}
      destroyOnClose
      onOk={() => form.submit()}
      okText="Переместить"
      cancelText="Отмена"
      confirmLoading={mut.submitting}
    >
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ flex: "200px" }}
        wrapperCol={{ flex: "auto" }}
        labelAlign="left"
        colon={false}
        onFinish={(v) => {
          void mut.run({ destination_account_id: v.destination_account_id });
        }}
      >
        <Form.Item label="Текущий Account">
          <Typography.Text code>{project?.account_id ?? "—"}</Typography.Text>
        </Form.Item>
        <Form.Item
          label="Целевой Account"
          name="destination_account_id"
          required
          rules={[{ required: true, message: "Выберите целевой Account" }]}
        >
          <Select
            placeholder="Выберите целевой Account"
            options={accounts
              .filter((a) => a.id !== project?.account_id)
              .map((a) => ({
                value: a.id,
                label: `${a.name} · ${a.id}`,
              }))}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
