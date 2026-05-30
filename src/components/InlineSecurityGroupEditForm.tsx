// InlineSecurityGroupEditForm — inline edit для Security Group, объединяющая
// два split-endpoint flow:
//   1. Name / Description / Labels → PATCH /vpc/v1/securityGroups/<id> (общий
//      Update RPC; rules в этот mask backend не принимает — ловит "unknown
//      field in update_mask: rules", потому что верхний contract ждёт
//      `rule_specs` только для Create).
//   2. Rules → PATCH /vpc/v1/securityGroups/<id>/rules (UpdateRules RPC,
//      payload { deletion_rule_ids, addition_rule_specs }). Изменённые правила
//      = delete старого id + add нового spec.
//
// Save отправляет оба запроса параллельно. На успех — pop OperationBanner для
// каждой созданной Operation.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Form, Input, Space, Typography } from "antd";
import { ApiError, api } from "@/api/client";
import { extractOperationId } from "@/components/OperationDialog";
import { LabelsEditor } from "@/components/form/LabelsEditor";
import { ResourceIcon } from "@/components/form/ResourceIcon";
import { REGISTRY } from "@/lib/resource-registry";
import { useInvalidateResourceList } from "@/lib/use-operation";
import { operationStore } from "@/lib/use-operation-store";
import { toast } from "@/lib/toast";

interface Props {
  projectId: string;
  sgId: string;
  onCancel: () => void;
}

interface Rule {
  id?: string;
  [k: string]: unknown;
}

export function InlineSecurityGroupEditForm({ projectId, sgId, onCancel }: Props) {
  const sgSpec = REGISTRY["security-groups"];
  const invalidate = useInvalidateResourceList();

  const { data, isLoading } = useQuery({
    queryKey: [sgSpec.id, "detail", sgId],
    queryFn: () => api.get<Record<string, unknown>>(`${sgSpec.apiPath}/${sgId}`),
    enabled: !!sgId,
    staleTime: 0,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [obj, setObj] = useState<Record<string, unknown>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    setName((data.name as string) ?? "");
    setDescription((data.description as string) ?? "");
    setObj({
      labels: (data.labels as Record<string, string>) ?? {},
      rules: ((data.rules as Rule[]) ?? []).map((r) => ({ ...r })),
    });
    setHydrated(true);
  }, [data, hydrated]);

  const updateMain = useMutation({
    mutationFn: (payload: unknown) =>
      api.update(`${sgSpec.apiPath}/${sgId}`, payload),
  });

  const updateRules = useMutation({
    mutationFn: (payload: unknown) =>
      api.update(`${sgSpec.apiPath}/${sgId}/rules`, payload),
  });

  const submit = async () => {
    if (!data) return;

    // 1) main fields
    const mainMask: string[] = [];
    if ((data.name as string) !== name) mainMask.push("name");
    if (((data.description as string) ?? "") !== description)
      mainMask.push("description");
    const origLabels = JSON.stringify(data.labels ?? {});
    const newLabels = JSON.stringify(obj.labels ?? {});
    if (origLabels !== newLabels) mainMask.push("labels");

    // 2) rules diff — КОНТЕНТНАЯ reconciliation (KAC-239 / fix дублирования).
    // Правила в JSONB могут не иметь id (sgRuleJSON.ID = `omitempty` →
    // legacy/Create-rules без id). id-based diff тогда считал ВСЕ правила
    // новыми → backend append → дубли при каждом сохранении. Сравниваем по
    // КОНТЕНТУ (sanitize без id): неизменённое правило (контент совпал с
    // исходным) — пропускаем; изменённое — delete(старый id)+add; новое — add.
    const origRules = (data.rules as Rule[]) ?? [];
    const curRules = (obj.rules as Rule[]) ?? [];
    const keyOf = (r: Rule): string => {
      const c = sanitizeSgRule({ ...r });
      delete c.id;
      return JSON.stringify(c);
    };
    const origByKey = new Map<string, Rule>();
    for (const r of origRules) if (!origByKey.has(keyOf(r))) origByKey.set(keyOf(r), r);
    const curKeys = new Set(curRules.map(keyOf));
    // additions: текущие правила, контента которых нет среди исходных.
    const addition_rule_specs: Record<string, unknown>[] = [];
    for (const r of curRules) {
      if (origByKey.has(keyOf(r))) continue; // неизменённое — оставляем как есть
      const clean = sanitizeSgRule({ ...r });
      delete clean.id;
      addition_rule_specs.push(clean);
    }
    // deletions: исходные правила (с id), контента которых больше нет в текущих.
    const deletion_rule_ids: string[] = [];
    for (const r of origRules) {
      if (r.id && !curKeys.has(keyOf(r))) deletion_rule_ids.push(r.id as string);
    }

    const promises: Promise<{ operation: { id?: string } }>[] = [];

    if (mainMask.length > 0) {
      promises.push(
        updateMain.mutateAsync({
          name,
          description,
          labels: obj.labels ?? {},
          update_mask: mainMask.join(","),
        }) as Promise<{ operation: { id?: string } }>,
      );
    }
    if (deletion_rule_ids.length > 0 || addition_rule_specs.length > 0) {
      promises.push(
        updateRules.mutateAsync({
          deletion_rule_ids,
          addition_rule_specs,
        }) as Promise<{ operation: { id?: string } }>,
      );
    }

    if (promises.length === 0) {
      onCancel();
      return;
    }

    try {
      const results = await Promise.all(promises);
      results.forEach((resp, i) => {
        const opId = extractOperationId(
          resp as Parameters<typeof extractOperationId>[0],
        );
        if (opId) {
          operationStore.start({
            id: opId,
            title:
              i === 0 && mainMask.length > 0
                ? `Сохранение группы безопасности ${name}`
                : `Сохранение правил группы безопасности ${name}`,
            resourceId: sgSpec.id,
            projectId: projectId,
          });
        }
      });
      invalidate(sgSpec.id, projectId);
      onCancel();
    } catch (err) {
      const m =
        err instanceof ApiError
          ? `${err.code}: ${err.message}`
          : (err as Error).message;
      toast.error(`Сохранить группу безопасности: ${m}`);
    }
  };

  const labelsField = useMemo(
    () => ({ name: "labels", label: "Метки", type: "labels" as const }),
    [],
  );

  if (isLoading || !data) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Text type="secondary">Загрузка…</Typography.Text>
      </div>
    );
  }

  const pending = updateMain.isPending || updateRules.isPending;

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
        <ResourceIcon specId="security-groups" />
        Редактирование: SecurityGroup
      </Typography.Title>

      <Form
        layout="horizontal"
        labelCol={{ flex: "200px" }}
        wrapperCol={{ flex: "auto" }}
        labelAlign="left"
        colon={false}
        size="middle"
      >
        <Form.Item label="Имя" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Form.Item>

        <Form.Item label="Описание">
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Form.Item>

        <Form.Item label="Метки">
          <LabelsEditor
            pathPrefix=""
            path="labels"
            label=""
            value={obj}
            onChange={setObj}
          />
        </Form.Item>

        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <Typography.Title level={5} style={{ margin: "0 0 8px" }}>
            Правила
          </Typography.Title>
          <SgRulesEditor
            pathPrefix=""
            value={obj}
            onChange={setObj}
            path="rules"
            description="Direction + protocol/ports + target. Без правил — default-deny."
          />
        </div>

        <Form.Item wrapperCol={{ offset: 0, flex: "auto" }}>
          <Space>
            <Button type="primary" onClick={submit} loading={pending}>
              Сохранить
            </Button>
            <Button onClick={onCancel} disabled={pending}>
              Отменить
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );

  // Suppress unused
  void labelsField;
}
