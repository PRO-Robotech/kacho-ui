// ResourceListPage — generic страница списка ресурсов на antd.
//
// Polling 3 сек (через useResourceList).

import { useMemo, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Input, Typography, Space } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { ResourceTable, Column } from "@/components/ResourceTable";
import { CopyableId } from "@/components/CopyableId";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";
import { useHeaderRight, useBreadcrumb } from "@/components/PageHeaderSlot";
import { ResourceSpec, getByPath } from "@/lib/resource-registry";
import { buildSpecColumns } from "@/lib/spec-columns";
import { useResourceList } from "@/lib/use-resource-list";

interface Props {
  spec: ResourceSpec;
  parentField?: string;
  parentParam?: string;
}

export function ResourceListPage({ spec, parentField, parentParam }: Props) {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const filterValue = parentParam ? (params[parentParam] ?? null) : null;
  const [query, setQuery] = useState("");

  const { data, isLoading, isError, error } = useResourceList(
    spec,
    parentField ?? null,
    filterValue,
  );

  const breadcrumb = useMemo(
    () => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {spec.serviceTitle && (
          <>
            <Typography.Text type="secondary">{spec.serviceTitle}</Typography.Text>
            <Typography.Text type="secondary">/</Typography.Text>
          </>
        )}
        <Typography.Text strong>{spec.plural}</Typography.Text>
      </span>
    ),
    [spec.plural, spec.serviceTitle],
  );
  useBreadcrumb(breadcrumb);

  const createBase = location.pathname.endsWith("/")
    ? location.pathname.slice(0, -1)
    : location.pathname;

  const cta = useMemo(() => {
    if (!spec.ops.create) return null;
    if (spec.fields) {
      return (
        <Link to={`${createBase}/create`}>
          <Button type="primary" size="small" icon={<PlusOutlined />}>
            Создать {spec.singular.toLowerCase()}
          </Button>
        </Link>
      );
    }
    const tpl = spec.template({
      folderId: parentField === "folder_id" ? (filterValue ?? undefined) : undefined,
      cloudId: parentField === "cloud_id" ? (filterValue ?? undefined) : undefined,
      organizationId:
        parentField === "organization_id" ? (filterValue ?? undefined) : undefined,
    });
    return (
      <ResourceFormDialog
        mode="create"
        title={`Создать ${spec.singular.toLowerCase()}`}
        apiPath={spec.apiPath}
        resourceId={spec.id}
        template={tpl}
        fields={spec.fields}
        folderUid={filterValue ?? null}
        sanitize={spec.sanitize}
      />
    );
  }, [spec, createBase, parentField, filterValue]);

  useHeaderRight(cta);

  if (parentField && !filterValue) return <FolderRequiredEmpty resource={spec.plural} />;

  const basePath = location.pathname.endsWith("/")
    ? location.pathname.slice(0, -1)
    : location.pathname;

  const items = (data?.[spec.payloadKey] as Record<string, unknown>[] | undefined) ?? [];

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      const name = (getByPath<string>(row, "name") ?? "").toLowerCase();
      const id = (getByPath<string>(row, "id") ?? "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [items, query]);

  const columns: Column<Record<string, unknown>>[] = buildSpecColumns(spec);

  columns.push({
    header: "",
    className: "text-right whitespace-nowrap",
    cell: (row) => (
      <RowActionsMenu
        spec={spec}
        row={row}
        basePath={basePath}
        folderUid={filterValue ?? null}
      />
    ),
  });

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {spec.plural}
        </Typography.Title>
        {spec.description && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {spec.description}
          </Typography.Text>
        )}
      </div>

      <Space size={12} wrap>
        <Input.Search
          placeholder="Фильтр по имени или идентификатору"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 360 }}
          allowClear
        />
        {parentField && filterValue && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {parentField}: <CopyableId id={filterValue} />
          </Typography.Text>
        )}
      </Space>

      {isError && (
        <Alert type="error" message={`Ошибка: ${(error as Error).message}`} />
      )}

      <ResourceTable
        rows={filteredItems}
        loading={isLoading && items.length === 0}
        rowKey={(r) => getByPath<string>(r, "id") ?? Math.random().toString()}
        columns={columns}
        onRowClick={(row) => {
          const id = getByPath<string>(row, "id");
          if (!id) return;
          // childRoute шаблон: /folders/:id, /clouds/:id/folders, ...
          const target = spec.childRoute
            ? spec.childRoute.replace(":id", id)
            : `${basePath}/${id}`;
          navigate(target);
        }}
      />
    </Space>
  );
}

