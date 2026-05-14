// InlineAddressPoolEditForm — YC-style форма редактирования AddressPool,
// визуально парная к InlineAddressPoolCreateForm: тот же horizontal Form
// layout, тот же CIDR-chip widget. Wire-format:
//   PATCH /vpc/v1/addressPools/{id}  { name, description, ..., update_mask }
//
// kind / zone_id — immutable (disabled в форме). cidr_blocks — editable
// (backend Update принимает полный список с update_mask=cidr_blocks).

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
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
  cidr_blocks?: string[];
  is_default?: boolean;
  selector_priority?: number;
}

const KIND_OPTIONS = [
  { value: "EXTERNAL_PUBLIC", label: "External public" },
  { value: "EXTERNAL_TEST", label: "External test" },
  { value: "RESERVED_INTERNAL", label: "Reserved internal" },
];

function isV4(cidr: string): boolean {
  return cidr.includes(".") && !cidr.includes(":");
}

export function InlineAddressPoolEditForm({ poolId, onCancel, onSuccess }: Props) {
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

  // Hydrate из загруженных данных.
  useEffect(() => {
    if (!pool || hydrated) return;
    setName(pool.name ?? "");
    setDescription(pool.description ?? "");
    const all = pool.cidr_blocks ?? [];
    setV4Blocks(all.filter(isV4));
    setV6Blocks(all.filter((c) => !isV4(c)));
    setIsDefault(!!pool.is_default);
    setSelectorPriority(pool.selector_priority ?? 0);
    setHydrated(true);
  }, [pool, hydrated]);

  const mutation = useMutation({
    mutationFn: (item: unknown) => api.update(`${spec.apiPath}/${poolId}`, item),
    onSuccess: () => {
      invalidate(spec.id, null);
      toast.success(`Пул адресов ${name || poolId} обновлён`);
      onSuccess?.();
      onCancel();
    },
    onError: (err) => {
      const m =
        err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      toast.error(`Сохранить пул адресов: ${m}`);
    },
  });

  const submit = () => {
    if (!pool) return;
    if (v4Blocks.length === 0 && v6Blocks.length === 0) {
      toast.error("Добавьте хотя бы один CIDR (IPv4 или IPv6).");
      return;
    }
    const cidrs = [...v4Blocks, ...v6Blocks];
    const origCidrs = (pool.cidr_blocks ?? []).slice().sort();
    const newCidrs = cidrs.slice().sort();

    // Diff против текущего объекта для update_mask.
    const mask: string[] = [];
    if ((pool.name ?? "") !== name) mask.push("name");
    if ((pool.description ?? "") !== description) mask.push("description");
    if (JSON.stringify(origCidrs) !== JSON.stringify(newCidrs)) mask.push("cidr_blocks");
    if ((pool.is_default ?? false) !== isDefault) mask.push("is_default");
    if ((pool.selector_priority ?? 0) !== selectorPriority) mask.push("selector_priority");

    if (mask.length === 0) {
      onCancel();
      return;
    }
    mutation.mutate({
      name,
      description: description || "",
      cidr_blocks: cidrs,
      is_default: isDefault,
      selector_priority: selectorPriority,
      update_mask: mask.join(","),
    });
  };

  if (isLoading || !pool) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Text type="secondary">Загрузка…</Typography.Text>
      </div>
    );
  }

  return (
    <div>
      <Typography.Title level={4} style={{ margin: "0 0 16px" }}>
        Редактирование пула адресов
      </Typography.Title>

      <Form
        layout="horizontal"
        labelCol={{ flex: "200px" }}
        wrapperCol={{ flex: "auto" }}
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
                <QuestionCircleOutlined style={{ color: "rgba(255,255,255,0.45)" }} />
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
                <QuestionCircleOutlined style={{ color: "rgba(255,255,255,0.45)" }} />
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

        <Form.Item wrapperCol={{ offset: 0, flex: "auto" }}>
          <Space>
            <Button
              type="primary"
              onClick={submit}
              loading={mutation.isPending}
              disabled={mutation.isPending}
            >
              Сохранить
            </Button>
            <Button onClick={onCancel} disabled={mutation.isPending}>
              Отмена
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
