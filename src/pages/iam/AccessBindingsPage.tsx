// AccessBindingsPage — управление AccessBinding'ами.
// Two view modes:
//   - "byResource" → list per (resource_type + resource_id);
//   - "bySubject" → list per (subject_type + subject_id).
//
// Create — отдельная модалка: subject_type/id + role + resource_type/id.

import { useState, useMemo } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import type { ColumnsType } from "antd/es/table";
import {
  iamApi,
  IAM,
  type AccessBinding,
  type User,
  type ServiceAccount,
  type Group,
  type Role,
  type Account,
} from "@/api/iam";
import {
  useIamMutation,
  fmtTs,
  CopyableMonoId,
} from "@/components/iam/IamCommon";
import { useAuth } from "@/contexts/AuthContext";

type ViewMode = "byResource" | "bySubject";
type SubjectType = "user" | "service_account" | "group";
type ResourceType = "account" | "project" | "folder" | "organization" | "cloud";

const SUBJECT_TYPES: SubjectType[] = ["user", "service_account", "group"];
const RESOURCE_TYPES: ResourceType[] = [
  "account",
  "project",
  "folder",
  "organization",
  "cloud",
];

export function AccessBindingsPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<ViewMode>("byResource");
  const [createOpen, setCreateOpen] = useState(false);

  // KAC-123: Мои AccessBinding'и — авто-вызов /iam/v1/accessBindings:listBySubject
  // для текущего user'а, показываем сверху страницы.
  const myBindings = useQuery({
    queryKey: ["iam", "access-bindings", "by-subject", "user", user?.id ?? ""],
    queryFn: () =>
      iamApi.listAccessBindingsBySubject("user", user!.id, { pageSize: "200" }),
    enabled: !!user?.id,
    refetchInterval: 5_000,
    staleTime: 0,
  });

  // byResource state
  const [resType, setResType] = useState<ResourceType>("account");
  const [resId, setResId] = useState<string>("");
  // bySubject state
  const [subjType, setSubjType] = useState<SubjectType>("user");
  const [subjId, setSubjId] = useState<string>("");

  const byResource = useQuery({
    queryKey: ["iam", "access-bindings", "by-resource", resType, resId],
    queryFn: () =>
      iamApi.listAccessBindingsByResource(resType, resId, { pageSize: "200" }),
    enabled: mode === "byResource" && !!resId,
    refetchInterval: 5_000,
    staleTime: 0,
  });

  const bySubject = useQuery({
    queryKey: ["iam", "access-bindings", "by-subject", subjType, subjId],
    queryFn: () =>
      iamApi.listAccessBindingsBySubject(subjType, subjId, { pageSize: "200" }),
    enabled: mode === "bySubject" && !!subjId,
    refetchInterval: 5_000,
    staleTime: 0,
  });

  const data = mode === "byResource" ? byResource : bySubject;
  const bindings = data?.data?.access_bindings ?? [];

  const del = useIamMutation({
    method: "DELETE",
    path: (b) => `${IAM.accessBindings}/${b as string}`,
    invalidateKeys: [["iam", "access-bindings"]],
    successText: "AccessBinding удалён",
  });

  // Helpers for selectors
  const accounts = useQuery({
    queryKey: ["iam", "accounts", "list"],
    queryFn: () => iamApi.listAccounts({ pageSize: "1000" }),
    staleTime: 30_000,
  });

  const users = useQuery({
    queryKey: ["iam", "users", "list"],
    queryFn: () => iamApi.listUsers({ pageSize: "1000" }),
    enabled: subjType === "user" || createOpen,
    staleTime: 30_000,
  });

  const columns: ColumnsType<AccessBinding> = [
    {
      title: "Subject",
      key: "subject",
      render: (_v, row) => (
        <Space size={6}>
          <Tag color={subjectColor(row.subject_type)}>{row.subject_type}</Tag>
          <CopyableMonoId id={row.subject_id} />
        </Space>
      ),
    },
    {
      title: "Role",
      dataIndex: "role_id",
      key: "role",
      render: (v) => <CopyableMonoId id={v} />,
    },
    {
      title: "Resource",
      key: "resource",
      render: (_v, row) => (
        <Space size={6}>
          <Tag>{row.resource_type}</Tag>
          <CopyableMonoId id={row.resource_id} />
        </Space>
      ),
    },
    {
      title: "Создано",
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
          title="Удалить AccessBinding?"
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

  const myBindingsRows = myBindings.data?.access_bindings ?? [];

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Access Bindings
      </Typography.Title>

      {user?.id && (
        <Card
          size="small"
          title={
            <Space>
              <span>Мои AccessBinding'и</span>
              <Tag color="blue">{myBindingsRows.length}</Tag>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                субъект: <code>user:{user.id}</code>
              </Typography.Text>
            </Space>
          }
        >
          {myBindingsRows.length === 0 ? (
            <Typography.Text type="secondary">
              У вас нет привязанных ролей.
            </Typography.Text>
          ) : (
            <Table<AccessBinding>
              rowKey="id"
              size="small"
              loading={myBindings.isLoading}
              dataSource={myBindingsRows}
              columns={columns.filter((c) => c.key !== "subject")}
              pagination={false}
            />
          )}
        </Card>
      )}

      <Space size={12} wrap>
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as ViewMode)}
          options={[
            { label: "По ресурсу", value: "byResource" },
            { label: "По subject'у", value: "bySubject" },
          ]}
        />
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          Создать binding
        </Button>
      </Space>

      {mode === "byResource" ? (
        <Space size={8} wrap>
          <Select
            value={resType}
            onChange={(v) => setResType(v)}
            options={RESOURCE_TYPES.map((t) => ({ value: t, label: t }))}
            style={{ width: 180 }}
          />
          <ResourceIdInput
            resourceType={resType}
            value={resId}
            onChange={setResId}
            accountList={accounts.data?.accounts ?? []}
          />
        </Space>
      ) : (
        <Space size={8} wrap>
          <Select
            value={subjType}
            onChange={(v) => setSubjType(v)}
            options={SUBJECT_TYPES.map((t) => ({ value: t, label: t }))}
            style={{ width: 180 }}
          />
          {subjType === "user" ? (
            <Select
              style={{ width: 420 }}
              value={subjId || undefined}
              onChange={(v) => setSubjId(v ?? "")}
              placeholder="Выберите User"
              showSearch
              optionFilterProp="label"
              options={(users.data?.users ?? []).map((u: User) => ({
                value: u.id,
                label: `${u.email || u.display_name || u.id} · ${u.id}`,
              }))}
            />
          ) : (
            <Input
              placeholder={`${subjType} id (sva-... / grp-...)`}
              value={subjId}
              onChange={(e) => setSubjId(e.target.value.trim())}
              style={{ width: 420, fontFamily: "monospace" }}
            />
          )}
        </Space>
      )}

      {(mode === "byResource" ? !resId : !subjId) ? (
        <Typography.Text type="secondary">
          {mode === "byResource"
            ? "Введите resource_id для просмотра bindings."
            : "Выберите subject для просмотра bindings."}
        </Typography.Text>
      ) : (
        <Table<AccessBinding>
          rowKey="id"
          size="small"
          loading={data?.isLoading}
          dataSource={bindings}
          columns={columns}
          pagination={false}
          locale={{ emptyText: "AccessBinding'ов нет." }}
        />
      )}

      <AccessBindingCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </Space>
  );
}

function subjectColor(t: string): string {
  switch (t) {
    case "user":
      return "blue";
    case "service_account":
      return "gold";
    case "group":
      return "purple";
    default:
      return "default";
  }
}

function ResourceIdInput({
  resourceType,
  value,
  onChange,
  accountList,
}: {
  resourceType: string;
  value: string;
  onChange: (v: string) => void;
  accountList: Account[];
}) {
  // Если ресурс = account — даём drop-down из доступных Account.
  if (resourceType === "account") {
    return (
      <Select
        style={{ width: 420 }}
        value={value || undefined}
        onChange={(v) => onChange(v ?? "")}
        placeholder="Выберите Account"
        showSearch
        optionFilterProp="label"
        options={accountList.map((a) => ({
          value: a.id,
          label: `${a.name} · ${a.id}`,
        }))}
      />
    );
  }
  return (
    <Input
      style={{ width: 420, fontFamily: "monospace" }}
      placeholder={`${resourceType} id`}
      value={value}
      onChange={(e) => onChange(e.target.value.trim())}
    />
  );
}

function AccessBindingCreateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const [subjectType, setSubjectType] = useState<SubjectType>("user");

  const users = useQuery({
    queryKey: ["iam", "users", "list"],
    queryFn: () => iamApi.listUsers({ pageSize: "1000" }),
    enabled: open,
    staleTime: 30_000,
  });
  const roles = useQuery({
    queryKey: ["iam", "roles", "list"],
    queryFn: () => iamApi.listRoles({ pageSize: "1000" }),
    enabled: open,
    staleTime: 30_000,
  });
  const sas = useQuery({
    queryKey: ["iam", "service-accounts", "all"],
    queryFn: async () => {
      const accs = await iamApi.listAccounts({ pageSize: "1000" });
      const all: ServiceAccount[] = [];
      for (const a of accs.accounts) {
        const r = await iamApi.listServiceAccounts({
          account_id: a.id,
          pageSize: "1000",
        });
        all.push(...(r.service_accounts ?? []));
      }
      return all;
    },
    enabled: open && subjectType === "service_account",
    staleTime: 30_000,
  });
  const groups = useQuery({
    queryKey: ["iam", "groups", "all"],
    queryFn: async () => {
      const accs = await iamApi.listAccounts({ pageSize: "1000" });
      const all: Group[] = [];
      for (const a of accs.accounts) {
        const r = await iamApi.listGroups({
          account_id: a.id,
          pageSize: "1000",
        });
        all.push(...(r.groups ?? []));
      }
      return all;
    },
    enabled: open && subjectType === "group",
    staleTime: 30_000,
  });

  const mut = useIamMutation({
    method: "POST",
    path: IAM.accessBindings,
    invalidateKeys: [["iam", "access-bindings"]],
    successText: "AccessBinding создан",
    onSuccess: () => {
      form.resetFields();
      onClose();
    },
  });

  const subjectOptions = useMemo(() => {
    switch (subjectType) {
      case "user":
        return (users.data?.users ?? []).map((u: User) => ({
          value: u.id,
          label: `${u.email || u.display_name || u.id} · ${u.id}`,
        }));
      case "service_account":
        return (sas.data ?? []).map((sa) => ({
          value: sa.id,
          label: `${sa.name} · ${sa.id}`,
        }));
      case "group":
        return (groups.data ?? []).map((g) => ({
          value: g.id,
          label: `${g.name} · ${g.id}`,
        }));
    }
  }, [subjectType, users.data, sas.data, groups.data]);

  return (
    <Modal
      title="Создать AccessBinding"
      open={open}
      onCancel={onClose}
      maskClosable
      width={620}
      destroyOnClose
      onOk={() => form.submit()}
      okText="Создать"
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
        initialValues={{
          subject_type: "user",
          resource_type: "account",
        }}
        onFinish={(v) => {
          void mut.run({
            subject_type: v.subject_type,
            subject_id: v.subject_id,
            role_id: v.role_id,
            resource_type: v.resource_type,
            resource_id: v.resource_id,
          });
        }}
      >
        <Form.Item label="Subject type" name="subject_type" required>
          <Select
            options={SUBJECT_TYPES.map((t) => ({ value: t, label: t }))}
            onChange={(v) => {
              setSubjectType(v as SubjectType);
              form.setFieldValue("subject_id", undefined);
            }}
          />
        </Form.Item>
        <Form.Item
          label="Subject"
          name="subject_id"
          required
          rules={[{ required: true, message: "Выберите subject" }]}
        >
          <Select
            placeholder={`Выберите ${subjectType}`}
            options={subjectOptions}
            showSearch
            optionFilterProp="label"
            loading={
              users.isLoading || sas.isLoading || groups.isLoading
            }
          />
        </Form.Item>
        <Form.Item
          label="Role"
          name="role_id"
          required
          rules={[{ required: true, message: "Выберите role" }]}
        >
          <Select
            placeholder="Выберите Role"
            options={(roles.data?.roles ?? []).map((r: Role) => ({
              value: r.id,
              label: `${r.name}${r.is_system ? " · system" : ""} · ${r.id}`,
            }))}
            showSearch
            optionFilterProp="label"
            loading={roles.isLoading}
          />
        </Form.Item>
        <Form.Item label="Resource type" name="resource_type" required>
          <Select
            options={RESOURCE_TYPES.map((t) => ({ value: t, label: t }))}
          />
        </Form.Item>
        <Form.Item
          label="Resource"
          name="resource_id"
          required
          rules={[{ required: true, message: "Введите resource_id" }]}
        >
          <Input
            style={{ fontFamily: "monospace" }}
            placeholder="acc-... / prj-... / любой идентификатор"
          />
        </Form.Item>
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, marginBottom: 0, marginLeft: 200 }}
        >
          Подсказка: для resource_type=account → используйте id из вкладки
          Accounts; для project → из вкладки Projects.
        </Typography.Paragraph>
      </Form>
    </Modal>
  );
}
