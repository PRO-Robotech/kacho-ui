// InlineResourceEditForm — generic inline-форма редактирования ресурса,
// встраиваемая в правую панель ResourceDetailPage вместо "Общее"-Descriptions.
// Использует FormFieldRenderer (editMode=true → immutable-поля disabled),
// PATCH с computeUpdateMask и Operation-banner на onSuccess.
//
// Применяется по умолчанию ко всем ресурсам, у которых есть spec.fields. Для
// resource-specific layout (например, YC-style для subnet) детальная страница
// может передать свой `renderInlineEdit` в ResourceDetailPage и переопределить
// эту форму.

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Form, Space, Tooltip, Typography } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { FormFieldRenderer } from "@/components/form/FormField";
import { ResourceIcon } from "@/components/form/ResourceIcon";
import { extractOperationId } from "@/components/OperationDialog";
import { DopplerButton } from "@/components/DopplerButton";
import { computeUpdateMask, snakeToCamelPath } from "@/components/ResourceFormDialog";
import { ApiError, api } from "@/api/client";
import { applyFieldDefaults, type ResourceSpec } from "@/lib/resource-registry";
import { getByPath } from "@/lib/path";
import { useInvalidateResourceList, useOperation } from "@/lib/use-operation";
import { toast } from "@/lib/toast";

interface Props {
  spec: ResourceSpec;
  /** Текущий объект ресурса (уже загружен ResourceDetailPage). */
  data: Record<string, unknown>;
  /** folder_id для invalidate + OperationBanner. */
  folderUid: string | null;
  onCancel: () => void;
  onSuccess?: () => void;
}

export function InlineResourceEditForm({
  spec,
  data,
  folderUid,
  onCancel,
  onSuccess,
}: Props) {
  const invalidate = useInvalidateResourceList();
  const fields = spec.fields;
  const originalRef = useRef<Record<string, unknown> | null>(null);
  const [obj, setObj] = useState<Record<string, unknown>>({});
  const [hydrated, setHydrated] = useState(false);

  const id = (data.id as string | undefined) ?? "";

  useEffect(() => {
    if (hydrated || !fields) return;
    // wire → form: если spec определил hydrate (см. resource-registry для
    // NIC v4/v6_address_ids/security_group_ids и Subnet v4/v6_cidr_blocks),
    // оборачиваем array-of-string поля в {value:"..."}-объекты, чтобы
    // RefSelect/array-form их корректно отображал в edit-режиме. Иначе
    // RefSelect получает массив строк и не показывает имена.
    const wireData: Record<string, unknown> = { ...data };
    const baseObj = spec.hydrate ? spec.hydrate(wireData) : wireData;
    const merged = applyFieldDefaults(fields, baseObj);
    originalRef.current = baseObj;
    setObj(merged);
    setHydrated(true);
  }, [data, fields, hydrated, spec]);

  const [pendingOpId, setPendingOpId] = useState<string | null>(null);
  const { data: op } = useOperation(pendingOpId);

  const mutation = useMutation({
    mutationFn: (item: unknown) => api.update(`${spec.apiPath}/${id}`, item),
    onSuccess: (resp) => {
      const opId = extractOperationId(resp);
      if (opId) {
        setPendingOpId(opId);
      } else {
        invalidate(spec.id, folderUid);
        onSuccess?.();
        onCancel();
      }
    },
    onError: (err) => {
      const m =
        err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      toast.error(`Сохранить ${spec.singular}: ${m}`);
    },
  });

  useEffect(() => {
    if (!pendingOpId || !op?.done) return;
    if (op.error) {
      toast.error(`Сохранить ${spec.singular}: ${op.error.message ?? "ошибка"}`);
    } else {
      invalidate(spec.id, folderUid);
      toast.success(`${spec.singular} сохранён`);
      onSuccess?.();
    }
    setPendingOpId(null);
    onCancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op?.done, op?.error?.code]);

  const submit = () => {
    if (!fields || !originalRef.current) return;
    let parsed: Record<string, unknown> = obj;
    if (spec.sanitize) parsed = spec.sanitize(parsed);
    const mask = computeUpdateMask(originalRef.current, parsed, fields);
    if (mask.length === 0) {
      onCancel();
      return;
    }
    mutation.mutate({
      ...parsed,
      update_mask: mask.map(snakeToCamelPath).join(","),
    });
  };

  const visibleFields = useMemo(
    () =>
      (fields ?? []).filter((f) => {
        if (f.hidden || f.editHidden) return false;
        if (f.visibleWhen) {
          const cur = getByPath(obj, f.visibleWhen.field) as string | undefined;
          const want = f.visibleWhen.equals;
          const matched = Array.isArray(want)
            ? want.includes(cur ?? "")
            : cur === want;
          if (!matched) return false;
        }
        return true;
      }),
    [fields, obj],
  );

  if (!fields) {
    return (
      <Alert
        type="warning"
        message={`У ресурса ${spec.singular} нет form-schema; используйте API напрямую.`}
      />
    );
  }

  return (
    <div>
      <Typography.Title
        level={4}
        style={{
          margin: "0 0 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <ResourceIcon specId={spec.id} />
        Редактирование: {spec.singular}
      </Typography.Title>

      <Form
        layout="horizontal"
        labelCol={{ flex: "200px" }}
        wrapperCol={{ flex: "auto" }}
        labelAlign="left"
        colon={false}
        size="middle"
      >
        {visibleFields.map((f) => {
          const fullWidth =
            f.type === "sg-rules" ||
            f.type === "array" ||
            f.type === "custom";
          const inner = (
            <FormFieldRenderer
              field={f}
              pathPrefix=""
              value={obj}
              onChange={setObj}
              editMode
              hideLabel={!fullWidth}
            />
          );
          if (fullWidth) {
            return (
              <Form.Item key={f.name} wrapperCol={{ offset: 0, flex: "auto" }} colon={false}>
                {inner}
              </Form.Item>
            );
          }
          return (
            <Form.Item
              key={f.name}
              label={
                f.description ? (
                  <Space size={4}>
                    {f.label}
                    <Tooltip title={f.description}>
                      <QuestionCircleOutlined style={{ color: "rgba(255,255,255,0.45)" }} />
                    </Tooltip>
                  </Space>
                ) : (
                  f.label
                )
              }
              required={!!f.required}
            >
              {inner}
            </Form.Item>
          );
        })}

        <Form.Item wrapperCol={{ offset: 0, flex: "auto" }}>
          <Space>
            <DopplerButton
              type="primary"
              onClick={submit}
              pulsing={mutation.isPending || pendingOpId !== null}
            >
              Сохранить
            </DopplerButton>
            <Button
              onClick={onCancel}
              disabled={mutation.isPending || pendingOpId !== null}
            >
              Отменить
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
