// ResourceDetailPage — детальная страница ресурса (flat API, 1.0).
// Поллит GET <spec.apiPath>/{id} каждые 3 сек.
// Restart/Start/Stop → POST <spec.apiPath>/{id}:verb → Operation.

import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Descriptions, Dropdown, Space, Spin, Typography } from "antd";
import type { MenuProps } from "antd";
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  MoreOutlined,
  DragOutlined,
} from "@ant-design/icons";
import { JsonView } from "@/components/JsonView";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyableId } from "@/components/CopyableId";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { DeleteConfirmStub } from "@/components/DeleteConfirmStub";
import { MoveStubDialog } from "@/components/MoveStubDialog";
import { OperationDialog, extractOperationId } from "@/components/OperationDialog";
import { SubnetCidrManager } from "@/components/SubnetCidrManager";
import { DetailShell, type DetailTab } from "@/components/DetailShell";
import { useBreadcrumb, useHeaderRight } from "@/components/PageHeaderSlot";
import { api, ApiError } from "@/api/client";
import { useFolderStore } from "@/lib/folder-store";
import { ResourceSpec, getByPath } from "@/lib/resource-registry";
import { useInvalidateResourceList } from "@/lib/use-operation";

interface Props {
  spec: ResourceSpec;
  paramKey?: string;
  extraTabs?: (data: Record<string, unknown>) => DetailTab[];
  /** Опциональный ряд secondary-actions кнопок над tab content (Subnet «Перенести в зону»). */
  secondaryActions?: (data: Record<string, unknown>) => React.ReactNode;
  /** По умолчанию показывается JSON-tab последним. Установить true чтобы скрыть. */
  hideJsonTab?: boolean;
  /** Per-tab override header-right slot. Возвращает null/undefined → fallback на default
   *  (Создать <singular> + Редактировать + kebab Move/Delete). */
  headerActionsByTab?: (
    tabId: string,
    data: Record<string, unknown>,
  ) => React.ReactNode | null | undefined;
}

export function ResourceDetailPage({
  spec,
  paramKey = "uid",
  extraTabs,
  secondaryActions,
  hideJsonTab,
  headerActionsByTab,
}: Props) {
  const params = useParams();
  const uid = params[paramKey];
  const navigate = useNavigate();
  const folder = useFolderStore((s) => s.folder);
  const invalidate = useInvalidateResourceList();
  const [searchParams] = useSearchParams();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [spec.id, "detail", uid],
    queryFn: () => api.get<Record<string, unknown>>(`${spec.apiPath}/${uid}`),
    refetchInterval: 3_000,
    enabled: !!uid,
    staleTime: 0,
  });

  const [actionOpId, setActionOpId] = useState<string | null>(null);
  const [actionTitle, setActionTitle] = useState("Action");
  const [actionErr, setActionErr] = useState<string | null>(null);

  const handleActionDone = useCallback(() => {
    setActionOpId(null);
    invalidate(spec.id, folder?.uid);
  }, [invalidate, spec.id, folder?.uid]);

  const actionMutation = useMutation({
    mutationFn: (verb: string) => api.action(`${spec.apiPath}/${uid}:${verb}`),
    onSuccess: (resp) => {
      setActionErr(null);
      const id = extractOperationId(resp);
      if (id) setActionOpId(id);
      else invalidate(spec.id, folder?.uid);
    },
    onError: (e) => {
      setActionErr(e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message);
    },
  });

  const doAction = (verb: string, title: string) => {
    setActionTitle(title);
    setActionErr(null);
    actionMutation.mutate(verb);
  };

  const name = data ? (getByPath<string>(data, "name") ?? "") : "";
  const statusValue = data ? getByPath<string>(data, "status") : undefined;
  const resourceId = data ? (getByPath<string>(data, "id") ?? uid ?? "") : uid ?? "";
  const editPath = `${spec.apiPath}/${resourceId}`;

  const backHref = useMemo(() => {
    const folderId = params.folderId;
    if (folderId) return `/folders/${folderId}/${spec.route}`;
    if (spec.id === "clouds" && data) {
      const orgId = getByPath<string>(data, "organization_id");
      return orgId ? `/organizations/${orgId}/clouds` : "/organizations";
    }
    if (spec.id === "folders" && data) {
      const cloudId = getByPath<string>(data, "cloud_id");
      return cloudId ? `/clouds/${cloudId}/folders` : "/organizations";
    }
    return "/organizations";
  }, [params.folderId, spec.id, spec.route, data]);

  const breadcrumb = useMemo(
    () => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {spec.serviceTitle && (
          <>
            <Typography.Text type="secondary">{spec.serviceTitle}</Typography.Text>
            <Typography.Text type="secondary">/</Typography.Text>
          </>
        )}
        <Link to={backHref}>
          <Typography.Text type="secondary">{spec.plural}</Typography.Text>
        </Link>
        <Typography.Text type="secondary">/</Typography.Text>
        <Typography.Text strong style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
          {name || resourceId}
        </Typography.Text>
      </span>
    ),
    [backHref, spec.plural, spec.serviceTitle, name, resourceId],
  );
  useBreadcrumb(breadcrumb);

  // Move-capable: те же ресурсы, что в RowActionsMenu (Org/Cloud/Folder/Region/Zone/AddressPool — нет).
  const moveCapable = useMemo(
    () =>
      ![
        "organizations",
        "clouds",
        "folders",
        "regions",
        "zones",
        "address-pools",
      ].includes(spec.id),
    [spec.id],
  );

  const overviewActions = useMemo(() => {
    const kebabItems: MenuProps["items"] = [
      moveCapable
        ? {
            key: "move",
            icon: <DragOutlined />,
            label: "Переместить",
            onClick: () => setMoveOpen(true),
          }
        : null,
      spec.ops.delete && data
        ? {
            key: "delete",
            icon: <DeleteOutlined />,
            label: "Удалить",
            danger: true,
            onClick: () => setDeleteOpen(true),
          }
        : null,
    ].filter(Boolean) as MenuProps["items"];

    return (
      <Space size="small">
        {spec.ops.create && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => navigate(`${backHref}/create`)}
          >
            Создать {spec.singular.toLowerCase()}
          </Button>
        )}
        {spec.ops.restart && (
          <Button
            size="small"
            icon={<ReloadOutlined spin={actionMutation.isPending && actionMutation.variables === "restart"} />}
            onClick={() => doAction("restart", "Restarting")}
            disabled={actionMutation.isPending}
          >
            Перезапустить
          </Button>
        )}
        {spec.ops.start && (
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => doAction("start", "Starting")}
            disabled={actionMutation.isPending}
          >
            Запустить
          </Button>
        )}
        {spec.ops.stop && (
          <Button
            size="small"
            icon={<PauseCircleOutlined />}
            onClick={() => doAction("stop", "Stopping")}
            disabled={actionMutation.isPending}
          >
            Остановить
          </Button>
        )}
        {spec.ops.update && data && (
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
            Редактировать
          </Button>
        )}
        {kebabItems && kebabItems.length > 0 && (
          <Dropdown menu={{ items: kebabItems }} trigger={["click"]} placement="bottomRight">
            <Button size="small" icon={<MoreOutlined />} aria-label="Действия" />
          </Dropdown>
        )}
      </Space>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    spec,
    data,
    moveCapable,
    backHref,
    actionMutation.isPending,
    actionMutation.variables,
  ]);

  // Per-tab header CTA (через ?tab) — если задано и возвращает не-null,
  // используется вместо overviewActions. useMemo обязателен, иначе
  // useHeaderRight видит новый node-ref на каждый рендер и зацикливает setState.
  const activeTabId = searchParams.get("tab") ?? "overview";
  const finalHeaderRight = useMemo(() => {
    if (!data) return null;
    const override = headerActionsByTab ? headerActionsByTab(activeTabId, data) : null;
    return override ?? overviewActions;
  }, [headerActionsByTab, activeTabId, data, overviewActions]);
  useHeaderRight(finalHeaderRight);

  if (isLoading && !data) {
    return (
      <div style={{ padding: 24 }}>
        <Spin tip="Загрузка…" />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        <Link to={backHref}>
          <Button size="small" icon={<ArrowLeftOutlined />}>Назад</Button>
        </Link>
        <Alert type="error" message={`Ошибка: ${(error as Error).message}`} />
      </Space>
    );
  }

  if (!data) {
    return (
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        <Link to={backHref}>
          <Button size="small" icon={<ArrowLeftOutlined />}>Назад</Button>
        </Link>
        <Alert type="warning" message="Ресурс не найден." />
      </Space>
    );
  }

  const overviewItems = [
    { label: "ID", value: <CopyableId id={resourceId} /> },
    { label: "Имя", value: name || "—" },
    statusValue ? { label: "Статус", value: <StatusBadge state={statusValue} /> } : null,
    getByPath<string>(data, "created_at")
      ? {
          label: "Дата создания",
          value: new Date(getByPath<string>(data, "created_at")!).toLocaleString(),
        }
      : null,
    getByPath<string>(data, "folder_id")
      ? { label: "Folder", value: <CopyableId id={getByPath<string>(data, "folder_id")!} /> }
      : null,
    getByPath<string>(data, "cloud_id")
      ? { label: "Cloud", value: <CopyableId id={getByPath<string>(data, "cloud_id")!} /> }
      : null,
    getByPath<string>(data, "organization_id")
      ? {
          label: "Organization",
          value: <CopyableId id={getByPath<string>(data, "organization_id")!} />,
        }
      : null,
    getByPath<string>(data, "zone_id")
      ? {
          label: "Зона",
          value: <Typography.Text code>{getByPath<string>(data, "zone_id")!}</Typography.Text>,
        }
      : null,
    getByPath<string>(data, "network_id")
      ? { label: "Сеть", value: <CopyableId id={getByPath<string>(data, "network_id")!} /> }
      : null,
    getByPath<string>(data, "description")
      ? { label: "Описание", value: getByPath<string>(data, "description")! }
      : null,
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];

  const tabs: DetailTab[] = [
    {
      id: "overview",
      label: "Обзор",
      render: () => (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {actionErr && <Alert type="error" message={actionErr} />}
          {spec.id === "subnets" && (
            <SubnetCidrManager
              subnetId={resourceId}
              blocks={(getByPath<string[]>(data, "v4_cidr_blocks") ?? []) as string[]}
            />
          )}
          <Descriptions
            title="Общее"
            bordered
            column={1}
            size="small"
            labelStyle={{ width: 200 }}
            items={overviewItems.map((it, i) => ({
              key: String(i),
              label: it.label,
              children: it.value,
            }))}
          />
        </Space>
      ),
    },
    ...(extraTabs ? extraTabs(data) : []),
    ...(hideJsonTab
      ? []
      : [
          {
            id: "raw",
            label: "JSON",
            render: () => <JsonView data={data} />,
          },
        ]),
  ];

  return (
    <>
      <DetailShell
        resourceLabel={spec.singular}
        resourceName={name || resourceId}
        badges={statusValue ? <StatusBadge state={statusValue} /> : null}
        tabs={tabs}
        secondaryActions={secondaryActions ? secondaryActions(data) : undefined}
      />

      {spec.ops.update && (
        <ResourceFormDialog
          mode="edit"
          title={`Edit ${spec.singular}`}
          description="Изменяет ресурс."
          apiPath={editPath}
          resourceId={spec.id}
          template={data}
          fields={spec.fields}
          folderUid={folder?.uid}
          sanitize={spec.sanitize}
          controlledOpen={{ open: editOpen, setOpen: setEditOpen }}
        />
      )}
      {spec.ops.delete && (
        <DeleteConfirmStub
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          resourceLabel={spec.singular}
          name={name || resourceId}
          apiPath={editPath}
        />
      )}

      {moveCapable && (
        <MoveStubDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          resourceLabel={spec.singular}
          name={name || resourceId}
          apiPath={editPath}
        />
      )}

      <OperationDialog
        opId={actionOpId}
        title={actionTitle}
        onSuccess={handleActionDone}
        onClose={handleActionDone}
      />
    </>
  );

  // Suppress unused
  void navigate;
}
