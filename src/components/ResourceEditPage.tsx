// ResourceEditPage — full-page Edit (как в YC console "Изменение ...").
// Поллит ресурс по id, заполняет initial state, отправляет PATCH с update_mask.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Space, Spin, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { FormFieldRenderer } from "@/components/form/FormField";
import { extractOperationId } from "@/components/OperationDialog";
import { computeUpdateMask, snakeToCamelPath } from "@/components/ResourceFormDialog";
import { useBreadcrumb, useHeaderRight } from "@/components/PageHeaderSlot";
import { ApiError, api } from "@/api/client";
import { applyFieldDefaults, type ResourceSpec } from "@/lib/resource-registry";
import { useInvalidateResourceList } from "@/lib/use-operation";
import { operationStore } from "@/lib/use-operation-store";
import { toast } from "@/lib/toast";
import { useFolderStore } from "@/lib/folder-store";

interface Props {
  spec: ResourceSpec;
  paramKey?: string;
}

export function ResourceEditPage({ spec, paramKey = "uid" }: Props) {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const folder = useFolderStore((s) => s.folder);
  const invalidate = useInvalidateResourceList();

  const uid = params[paramKey];

  // backHref = current path без /edit (вернуться на detail).
  const backHref = location.pathname.replace(/\/edit$/, "") || "/";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [spec.id, "detail", uid],
    queryFn: () => api.get<Record<string, unknown>>(`${spec.apiPath}/${uid}`),
    enabled: !!uid,
    staleTime: 0,
  });

  const fields = spec.fields;
  const originalRef = useRef<Record<string, unknown> | null>(null);
  const [obj, setObj] = useState<Record<string, unknown>>({});
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    const baseObj: Record<string, unknown> = { ...data };
    const merged = applyFieldDefaults(fields, baseObj);
    originalRef.current = baseObj;
    setObj(merged);
    setHydrated(true);
  }, [data, fields, hydrated]);

  const name = (data?.name as string | undefined) ?? uid ?? "";

  const breadcrumb = useMemo(
    () => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {spec.serviceTitle && (
          <>
            <Typography.Text type="secondary">{spec.serviceTitle}</Typography.Text>
            <Typography.Text type="secondary">/</Typography.Text>
          </>
        )}
        <Link to={backHref.replace(/\/[^/]+$/, "")}>
          <Typography.Text type="secondary">{spec.plural}</Typography.Text>
        </Link>
        <Typography.Text type="secondary">/</Typography.Text>
        <Link to={backHref}>
          <Typography.Text type="secondary">{name}</Typography.Text>
        </Link>
        <Typography.Text type="secondary">/</Typography.Text>
        <Typography.Text strong>Редактировать</Typography.Text>
      </span>
    ),
    [backHref, spec.plural, spec.serviceTitle, name],
  );
  useBreadcrumb(breadcrumb);
  const noHeaderRight = useMemo(() => null, []);
  useHeaderRight(noHeaderRight);

  const mutation = useMutation({
    mutationFn: (item: unknown) => api.update(`${spec.apiPath}/${uid}`, item),
    onSuccess: (resp) => {
      setSubmitErr(null);
      const opId = extractOperationId(resp);
      if (opId) {
        operationStore.start({
          id: opId,
          title: `Сохранение ${spec.singular.toLowerCase()} ${name}`,
          resourceId: spec.id,
          folderUid: folder?.uid ?? null,
        });
      } else {
        invalidate(spec.id, folder?.uid ?? null);
      }
      navigate(backHref);
    },
    onError: (err) => {
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      setSubmitErr(m);
      toast.error(`Сохранить ${spec.singular}: ${m}`);
    },
  });

  const submit = () => {
    if (!fields || !originalRef.current) return;
    setSubmitErr(null);
    let parsed: Record<string, unknown> = obj;
    if (spec.sanitize) parsed = spec.sanitize(parsed);
    const mask = computeUpdateMask(originalRef.current, parsed, fields);
    if (mask.length === 0) {
      navigate(backHref);
      return;
    }
    const payload = {
      ...parsed,
      update_mask: mask.map(snakeToCamelPath).join(","),
    };
    mutation.mutate(payload);
  };

  if (!fields) {
    return (
      <Alert
        type="warning"
        message={`У ресурса ${spec.singular} нет form-schema; используйте API напрямую.`}
      />
    );
  }

  if (isLoading && !data) {
    return (
      <div style={{ padding: 24 }}>
        <Spin tip="Загрузка…" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        <Link to={backHref}>
          <Button size="small" icon={<ArrowLeftOutlined />}>Назад</Button>
        </Link>
        <Alert
          type="error"
          message={`Ошибка загрузки: ${(error as Error)?.message ?? "ресурс не найден"}`}
        />
      </Space>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <div>
          <Link to={backHref}>
            <Button type="text" size="small" icon={<ArrowLeftOutlined />} style={{ marginLeft: -8 }}>
              {name}
            </Button>
          </Link>
          <Typography.Title level={3} style={{ margin: "4px 0 0 0" }}>
            Изменение {spec.singular.toLowerCase()}
          </Typography.Title>
        </div>

        <Card size="small">
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {fields.map((f) => (
              <FormFieldRenderer
                key={f.name}
                field={f}
                pathPrefix=""
                value={obj}
                onChange={setObj}
                editMode
              />
            ))}
          </Space>
        </Card>

        {submitErr && <Alert type="error" message={submitErr} />}

        <Space>
          <Button type="primary" onClick={submit} loading={mutation.isPending}>
            Сохранить
          </Button>
          <Link to={backHref}>
            <Button>Отменить</Button>
          </Link>
        </Space>
      </Space>
    </div>
  );
}
