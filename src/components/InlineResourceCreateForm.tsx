// InlineResourceCreateForm — встраиваемая форма создания ресурса.
// Используется когда форма должна жить внутри detail-страницы родителя
// (Network detail → Создать подсеть), а не как отдельный route.
//
// Mirror'ит submit-логику ResourceCreatePage, но без navigate/breadcrumb-side-effects.

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Form, Space, Tooltip, Typography } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { FormFieldRenderer } from "@/components/form/FormField";
import { ResourceIcon } from "@/components/form/ResourceIcon";
import { DopplerButton } from "@/components/DopplerButton";
import { extractOperationId } from "@/components/OperationDialog";
import { ApiError, api } from "@/api/client";
import { applyFieldDefaults, type ResourceSpec } from "@/lib/resource-registry";
import { getByPath, setByPath } from "@/lib/path";
import { useInvalidateResourceList, useOperation } from "@/lib/use-operation";
import { toast } from "@/lib/toast";

interface Props {
  spec: ResourceSpec;
  /** Контекст для ResourceSpec.template — передаётся в applyFieldDefaults. */
  ctx: { projectId?: string; cloudId?: string; organizationId?: string };
  /** Поля, которые должны быть pre-filled и locked (immutable в форме).
   *  Ключи — paths (например "network_id" или "internal_ipv4_address_spec.subnet_id"). */
  presetFields?: Record<string, unknown>;
  /** Поля, которые должны быть pre-filled, но остаются editable (это начальное
   *  значение, не lock). Пример: `_address_kind` при создании адреса из контекста
   *  подсети — дефолт "internal", но пользователь может переключить на "internal_v6". */
  editablePresetFields?: Record<string, unknown>;
  /** Per-field ограничение набора опций enum-полей. Ключ — имя поля, значение —
   *  список допустимых `value` (в нужном порядке). Опции, не вошедшие в список,
   *  не показываются. Пример: `{ _address_kind: ["internal", "internal_v6"] }` —
   *  в контексте подсети internal IPv4/IPv6, без `external`. */
  fieldOptionsFilter?: Record<string, string[]>;
  /** folderUid для invalidate + OperationBanner. */
  folderUid: string | null;
  /** Title формы. По умолчанию — "Создать <singular>". */
  title?: string;
  onCancel: () => void;
  /** Вызывается после успешного submit (Operation pushed в banner или sync-create). */
  onSuccess?: () => void;
}

export function InlineResourceCreateForm({
  spec,
  ctx,
  presetFields,
  editablePresetFields,
  fieldOptionsFilter,
  folderUid,
  title,
  onCancel,
  onSuccess,
}: Props) {
  const invalidate = useInvalidateResourceList();
  const presets = useMemo(() => presetFields ?? {}, [presetFields]);
  const editablePresets = useMemo(
    () => editablePresetFields ?? {},
    [editablePresetFields],
  );

  const initialObj = useMemo(() => {
    const tpl = spec.template(ctx);
    const baseObj =
      typeof tpl === "object" && tpl !== null
        ? { ...(tpl as Record<string, unknown>) }
        : {};
    let merged: Record<string, unknown> = applyFieldDefaults(spec.fields, baseObj);
    for (const [path, val] of Object.entries(editablePresets)) {
      merged = setByPath(merged, path, val);
    }
    for (const [path, val] of Object.entries(presets)) {
      merged = setByPath(merged, path, val);
    }
    // Auto-name: если у ресурса есть поле name и оно пустое, генерируем
    // <route>-NNNNNN — иначе backend (UNIQUE по folder_id+name) отвечает
    // ALREADY_EXISTS на повторный nameless ресурс.
    if (
      spec.fields?.some((f) => f.name === "name") &&
      (!merged.name || merged.name === "")
    ) {
      const stem = spec.route.replace(/-/g, "");
      merged.name = `${stem}-${Math.floor(100000 + Math.random() * 900000)}`;
    }
    return merged;
    // initial — фиксируем при mount; presets/ctx стабильны через жизненный цикл формы
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [obj, setObj] = useState<Record<string, unknown>>(initialObj);
  const lockedPathsRef = useRef(new Set(Object.keys(presets)));

  // Doppler-flow: после POST дожидаемся op.done через polling, кнопка
  // пульсирует, форма не закрывается. По завершении → success/error toast.
  const [pendingOpId, setPendingOpId] = useState<string | null>(null);
  const { data: op } = useOperation(pendingOpId);

  const mutation = useMutation({
    mutationFn: (item: unknown) => api.create(spec.apiPath, item),
    onSuccess: (resp) => {
      const id = extractOperationId(resp);
      if (id) {
        setPendingOpId(id);
      } else {
        // Sync-ответ (admin RPC без Operation envelope) — закрываем сразу.
        invalidate(spec.id, folderUid);
        onSuccess?.();
        onCancel();
      }
    },
    onError: (err) => {
      const m =
        err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      toast.error(`Создать ${spec.singular}: ${m}`);
    },
  });

  useEffect(() => {
    if (!pendingOpId || !op?.done) return;
    if (op.error) {
      const msg = op.error.message ?? "ошибка";
      toast.error(`Создать ${spec.singular}: ${msg}`);
    } else {
      invalidate(spec.id, folderUid);
      toast.success(`${spec.singular} создан`);
      onSuccess?.();
    }
    setPendingOpId(null);
    onCancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op?.done, op?.error?.code]);

  const submit = () => {
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
        {title ?? `Создание: ${spec.singular}`}
      </Typography.Title>

      <Form
        layout="horizontal"
        labelCol={{ flex: "200px" }}
        wrapperCol={{ flex: "auto" }}
        labelAlign="left"
        colon={false}
        size="middle"
      >
        {fields
          .filter((f) => {
            if (lockedPathsRef.current.has(f.name)) return false;
            if (f.hidden) return false;
            if (f.visibleWhen) {
              const cur = getByPath(obj, f.visibleWhen.field) as string | undefined;
              const want = f.visibleWhen.equals;
              const matched = Array.isArray(want)
                ? want.includes(cur ?? "")
                : cur === want;
              if (!matched) return false;
            }
            return true;
          })
          .map((f) => {
            const allowed = fieldOptionsFilter?.[f.name];
            const field =
              allowed && f.type === "enum"
                ? {
                    ...f,
                    options: allowed
                      .map((v) => f.options.find((o) => o.value === v))
                      .filter((o): o is { value: string; label: string } => !!o),
                  }
                : f;
            // sg-rules/array/custom — рендерят свой собственный header/box во
            // всю ширину формы (без бокового label). labels — оборачиваем в
            // Form.Item с label="Метки" (как Subnet Create) — editor справа.
            const fullWidth =
              field.type === "sg-rules" ||
              field.type === "array" ||
              field.type === "custom";
            const inner = (
              <FormFieldRenderer
                field={field}
                pathPrefix=""
                value={obj}
                onChange={setObj}
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
                  field.description ? (
                    <Space size={4}>
                      {field.label}
                      <Tooltip title={field.description}>
                        <QuestionCircleOutlined style={{ color: "rgba(255,255,255,0.45)" }} />
                      </Tooltip>
                    </Space>
                  ) : (
                    field.label
                  )
                }
                required={!!field.required}
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
              Создать {spec.singular.toLowerCase()}
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
