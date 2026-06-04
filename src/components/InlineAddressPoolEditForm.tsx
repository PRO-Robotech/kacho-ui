// InlineAddressPoolEditForm — YC-style форма редактирования AddressPool,
// визуально парная к InlineAddressPoolCreateForm: тот же horizontal Form
// layout, тот же CIDR-chip widget. Wire-format:
//   PATCH /vpc/v1/addressPools/{id}  { name, description, ..., update_mask }
//
// kind / zone_id — immutable (disabled в форме). v4_cidr_blocks / v6_cidr_blocks
// — editable, full-replace через replace_v4_cidr_blocks / replace_v6_cidr_blocks
// флаги (KAC-71, REQ-IPL-UPD-05/06): backend применяет replace только если
// флаг = true. Если по полю diff — добавляем оба поля (массив + флаг) в payload
// + соответствующий пункт в update_mask.

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tooltip,
  Typography,
} from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { ApiError, api } from "@/api/client";
import { SubnetCidrChips } from "@/components/SubnetCidrChips";
import { FormShell } from "@/components/form/FormShell";
import { FormFooter } from "@/components/form/FormFooter";
import { REGISTRY } from "@/lib/resource-registry";
import { useInvalidateResourceList } from "@/lib/use-operation";
import { toast } from "@/lib/toast";

interface Props {
  poolId: string;
  onCancel: () => void;
  onSuccess?: () => void;
}

interface PoolData {
  id: string;
  name?: string;
  description?: string;
  kind?: string;
  zone_id?: string;
  v4_cidr_blocks?: string[];
  v6_cidr_blocks?: string[];
  is_default?: boolean;
  selector_priority?: number;
}

// KAC-70: AddressPoolKind — единственный валидный вариант EXTERNAL_PUBLIC.
// EXTERNAL_TEST = 2 / RESERVED_INTERNAL = 100 удалены из proto enum
// (`reserved 2, 100` в kacho.cloud.vpc.v1.AddressPoolKind).
const KIND_OPTIONS = [{ value: "EXTERNAL_PUBLIC", label: "External public" }];

export function InlineAddressPoolEditForm({
  poolId,
  onCancel,
  onSuccess,
}: Props) {
  const invalidate = useInvalidateResourceList();
  const spec = REGISTRY["address-pools"];

  const { data: pool, isLoading } = useQuery({
    queryKey: ["address-pools", "detail", poolId],
    queryFn: () => api.get<PoolData>(`${spec.apiPath}/${poolId}`),
    enabled: !!poolId,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [v4Blocks, setV4Blocks] = useState<string[]>([]);
  const [v6Blocks, setV6Blocks] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [selectorPriority, setSelectorPriority] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate из загруженных данных. KAC-71: backend отдаёт уже split-shape
  // (v4_cidr_blocks + v6_cidr_blocks), client-side family-фильтр больше не нужен.
  useEffect(() => {
    if (!pool || hydrated) return;
    setName(pool.name ?? "");
    setDescription(pool.description ?? "");
    setV4Blocks(pool.v4_cidr_blocks ?? []);
    setV6Blocks(pool.v6_cidr_blocks ?? []);
    setIsDefault(!!pool.is_default);
    setSelectorPriority(pool.selector_priority ?? 0);
    setHydrated(true);
  }, [pool, hydrated]);

  const mutation = useMutation({
    mutationFn: (item: unknown) =>
      api.update(`${spec.apiPath}/${poolId}`, item),
    onSuccess: () => {
      invalidate(spec.id, null);
      toast.success(`Пул адресов ${name || poolId} обновлён`);
      onSuccess?.();
      onCancel();
    },
    onError: (err) => {
      const m =
        err instanceof ApiError
          ? `${err.code}: ${err.message}`
          : (err as Error).message;
      toast.error(`Сохранить пул адресов: ${m}`);
    },
  });

  const submit = () => {
    if (!pool) return;
    if (v4Blocks.length === 0 && v6Blocks.length === 0) {
      toast.error("Добавьте хотя бы один CIDR (IPv4 или IPv6).");
      return;
    }

    // KAC-71: split-shape + явные replace-флаги. Diff по каждому family
    // отдельно — если массив изменился, добавляем (а) поле массива, (б)
    // replace-флаг = true, (в) оба пункта в update_mask.
    const origV4 = (pool.v4_cidr_blocks ?? []).slice().sort();
    const origV6 = (pool.v6_cidr_blocks ?? []).slice().sort();
    const newV4 = v4Blocks.slice().sort();
    const newV6 = v6Blocks.slice().sort();
    const v4Changed = JSON.stringify(origV4) !== JSON.stringify(newV4);
    const v6Changed = JSON.stringify(origV6) !== JSON.stringify(newV6);

    const mask: string[] = [];
    if ((pool.name ?? "") !== name) mask.push("name");
    if ((pool.description ?? "") !== description) mask.push("description");
    if (v4Changed) mask.push("v4_cidr_blocks", "replace_v4_cidr_blocks");
    if (v6Changed) mask.push("v6_cidr_blocks", "replace_v6_cidr_blocks");
    if ((pool.is_default ?? false) !== isDefault) mask.push("is_default");
    if ((pool.selector_priority ?? 0) !== selectorPriority)
      mask.push("selector_priority");

    if (mask.length === 0) {
      onCancel();
      return;
    }
    const payload: Record<string, unknown> = {
      name,
      description: description || "",
      is_default: isDefault,
      selector_priority: selectorPriority,
      update_mask: mask.join(","),
    };
    if (v4Changed) {
      payload.v4_cidr_blocks = v4Blocks;
      payload.replace_v4_cidr_blocks = true;
    }
    if (v6Changed) {
      payload.v6_cidr_blocks = v6Blocks;
      payload.replace_v6_cidr_blocks = true;
    }
    mutation.mutate(payload);
  };

  if (isLoading || !pool) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Text type="secondary">Загрузка…</Typography.Text>
      </div>
    );
  }

  return (
    <FormShell specId="address-pools" mode="edit" singular={spec.singular}>
      <Form
        layout="horizontal"
        labelCol={{ flex: "200px" }}
        wrapperCol={{ flex: "1 1 0" }}
        labelAlign="left"
        colon={false}
        size="middle"
      >
        <Form.Item label="Имя">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pool-public-zone-a"
          />
        </Form.Item>

        <Form.Item label="Описание">
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Form.Item>

        <Form.Item label="Тип">
          <Select
            value={pool.kind ?? "EXTERNAL_PUBLIC"}
            options={KIND_OPTIONS}
            disabled
          />
        </Form.Item>

        <Form.Item label="Зона">
          <Input value={pool.zone_id || "(глобальный)"} disabled />
        </Form.Item>

        <Form.Item
          required
          label={
            <Space size={4}>
              IPv4 и IPv6 CIDR
              <Tooltip title="Блоки IPv4 и/или IPv6, из которых аллоцируются адреса. Update заменяет полный список.">
                <QuestionCircleOutlined
                  style={{ color: "rgba(255,255,255,0.45)" }}
                />
              </Tooltip>
            </Space>
          }
        >
          <SubnetCidrChips
            v4Blocks={v4Blocks}
            onV4Change={setV4Blocks}
            v6Blocks={v6Blocks}
            onV6Change={setV6Blocks}
          />
        </Form.Item>

        <Form.Item
          label={
            <Space size={4}>
              Default
              <Tooltip title="Один is_default=true на (zone, kind).">
                <QuestionCircleOutlined
                  style={{ color: "rgba(255,255,255,0.45)" }}
                />
              </Tooltip>
            </Space>
          }
        >
          <Switch checked={isDefault} onChange={setIsDefault} />
        </Form.Item>

        <Form.Item label="Selector priority">
          <InputNumber
            value={selectorPriority}
            onChange={(v) => setSelectorPriority((v as number) ?? 0)}
            style={{ width: "100%" }}
          />
        </Form.Item>
        <FormFooter
          submitLabel="Сохранить"
          submitting={mutation.isPending}
          onSubmit={submit}
          onCancel={onCancel}
        />
      </Form>
    </FormShell>
  );
}
