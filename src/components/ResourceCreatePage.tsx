// ResourceCreatePage — full-page форма Create (не modal).

import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Card, Space, Tag, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { FormFieldRenderer } from "@/components/form/FormField";
import { extractOperationId } from "@/components/OperationDialog";
import { OperationToastWatcher } from "@/components/OperationToastWatcher";
import { useBreadcrumb, useHeaderRight } from "@/components/PageHeaderSlot";
import { ApiError, api } from "@/api/client";
import { applyFieldDefaults, getByPath, type ResourceSpec } from "@/lib/resource-registry";
import { setByPath } from "@/lib/path";
import { useInvalidateResourceList } from "@/lib/use-operation";
import { toast } from "@/lib/toast";

interface Props {
  spec: ResourceSpec;
  parentField?: string;
  parentParam?: string;
}

export function ResourceCreatePage({ spec, parentField, parentParam }: Props) {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterValue = parentParam ? (params[parentParam] ?? null) : null;
  const invalidate = useInvalidateResourceList();

  const ctx = useMemo(
    () => ({
      folderId: parentField === "folder_id" ? (filterValue ?? undefined) : undefined,
      cloudId: parentField === "cloud_id" ? (filterValue ?? undefined) : undefined,
      organizationId:
        parentField === "organization_id" ? (filterValue ?? undefined) : undefined,
    }),
    [parentField, filterValue],
  );

  const presetFields = useMemo(() => {
    const out: Record<string, unknown> = {};
    const subnetId = searchParams.get("subnet_id");
    const networkId = searchParams.get("network_id");
    const kind = searchParams.get("kind");
    if (kind) out["_address_kind"] = kind;
    if (subnetId) {
      if (kind === "internal" || (!kind && spec.id === "addresses")) {
        out["internal_ipv4_address_spec.subnet_id"] = subnetId;
      } else {
        out["subnet_id"] = subnetId;
      }
    }
    if (networkId) out["network_id"] = networkId;
    return out;
  }, [searchParams, spec.id]);

  const initialObj = useMemo(() => {
    const tpl = spec.template(ctx);
    const baseObj =
      typeof tpl === "object" && tpl !== null
        ? { ...(tpl as Record<string, unknown>) }
        : {};
    let merged: Record<string, unknown> = applyFieldDefaults(spec.fields, baseObj);
    for (const [path, val] of Object.entries(presetFields)) {
      merged = setByPath(merged, path, val);
    }
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [obj, setObj] = useState<Record<string, unknown>>(initialObj);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [opId, setOpId] = useState<string | null>(null);

  const lockedPathsRef = useRef(new Set(Object.keys(presetFields)));

  const backHref = parentParam && filterValue
    ? `/folders/${filterValue}/${spec.route}`
    : `/${spec.route}`;

  const breadcrumb = useMemo(
    () => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Link to={backHref}>
          <Typography.Text type="secondary">{spec.plural}</Typography.Text>
        </Link>
        <Typography.Text type="secondary">/</Typography.Text>
        <Typography.Text strong>Создать</Typography.Text>
      </span>
    ),
    [backHref, spec.plural],
  );
  useBreadcrumb(breadcrumb);
  const noHeaderRight = useMemo(() => null, []);
  useHeaderRight(noHeaderRight);

  const mutation = useMutation({
    mutationFn: (item: unknown) => api.create(spec.apiPath, item),
    onSuccess: (resp) => {
      setSubmitErr(null);
      const id = extractOperationId(resp);
      if (id) setOpId(id);
      else {
        invalidate(spec.id, filterValue ?? null);
        navigate(backHref);
      }
    },
    onError: (err) => {
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      setSubmitErr(m);
      toast.error(`Создать ${spec.singular}: ${m}`);
    },
  });

  const submit = () => {
    setSubmitErr(null);
    let parsed: Record<string, unknown> = obj;
    if (spec.sanitize) parsed = spec.sanitize(parsed);
    mutation.mutate(parsed);
  };

  const fields = spec.fields;
  if (!fields) {
    return (
      <Alert
        type="warning"
        message={`У ресурса ${spec.singular} нет form-schema; используйте API напрямую.`}
      />
    );
  }

  return (
    <>
      <div style={{ maxWidth: 760 }}>
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <div>
            <Link to={backHref}>
              <Button type="text" size="small" icon={<ArrowLeftOutlined />} style={{ marginLeft: -8 }}>
                {spec.plural}
              </Button>
            </Link>
            <Typography.Title level={3} style={{ margin: "4px 0 0 0" }}>
              Создать {spec.singular.toLowerCase()}
            </Typography.Title>
          </div>

          {Object.keys(presetFields).length > 0 && (
            <Alert
              type="info"
              message={
                <span>
                  Предзаполнено из контекста:{" "}
                  {Object.entries(presetFields).map(([k, v]) => (
                    <Tag key={k} style={{ fontFamily: "monospace", marginRight: 4 }}>
                      {k}={String(v)}
                    </Tag>
                  ))}
                </span>
              }
            />
          )}

          <Card size="small">
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              {fields.map((f) => (
                <FormFieldRenderer
                  key={f.name}
                  field={lockedPathsRef.current.has(f.name) ? { ...f, immutable: true } : f}
                  pathPrefix=""
                  value={obj}
                  onChange={setObj}
                  editMode={lockedPathsRef.current.has(f.name)}
                />
              ))}
            </Space>
          </Card>

          {submitErr && <Alert type="error" message={submitErr} />}

          <Space>
            <Button
              type="primary"
              onClick={submit}
              loading={mutation.isPending || opId !== null}
            >
              Создать {spec.singular.toLowerCase()}
            </Button>
            <Link to={backHref}>
              <Button>Отменить</Button>
            </Link>
          </Space>
        </Space>
      </div>

      <OperationToastWatcher
        opId={opId}
        title={`Создаётся ${spec.singular.toLowerCase()}`}
        onDone={(success) => {
          setOpId(null);
          invalidate(spec.id, filterValue ?? null);
          if (success) navigate(backHref);
        }}
      />
    </>
  );

  // Suppress unused getByPath import
  void getByPath;
}
