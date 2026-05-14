// InlineNetworkInterfaceEditForm — упрощённая модалка редактирования NIC.
// Только три блока: Имя/Описание, IPv4/IPv6 Address chips, Security Groups
// chips. Subnet — read-only (immutable после Create). Labels убраны из
// верхнего уровня — раскрытие в advanced collapse (часто избыточны).

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  Collapse,
  Form,
  Input,
  Space,
  Typography,
} from "antd";
import { ApiError, api } from "@/api/client";
import { ResourceRefChips } from "@/components/ResourceRefChips";
import { REGISTRY } from "@/lib/resource-registry";
import {
  useInvalidateResourceList,
  useOperation,
} from "@/lib/use-operation";
import { extractOperationId } from "@/components/OperationDialog";
import { toast } from "@/lib/toast";

interface Props {
  folderId: string;
  nicId: string;
  onCancel: () => void;
  onSuccess?: () => void;
}

interface NicData {
  id: string;
  name?: string;
  description?: string;
  labels?: Record<string, string>;
  subnet_id?: string;
  v4_address_ids?: string[];
  v6_address_ids?: string[];
  security_group_ids?: string[];
}

export function InlineNetworkInterfaceEditForm({
  folderId,
  nicId,
  onCancel,
  onSuccess,
}: Props) {
  const invalidate = useInvalidateResourceList();
  const spec = REGISTRY["network-interfaces"];

  const { data: nic, isLoading } = useQuery({
    queryKey: ["network-interfaces", "detail", nicId],
    queryFn: () => api.get<NicData>(`${spec.apiPath}/${nicId}`),
    enabled: !!nicId,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [v4, setV4] = useState<string[]>([]);
  const [v6, setV6] = useState<string[]>([]);
  const [sgs, setSgs] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!nic || hydrated) return;
    setName(nic.name ?? "");
    setDescription(nic.description ?? "");
    setV4(nic.v4_address_ids ?? []);
    setV6(nic.v6_address_ids ?? []);
    setSgs(nic.security_group_ids ?? []);
    setHydrated(true);
  }, [nic, hydrated]);

  const [pendingOpId, setPendingOpId] = useState<string | null>(null);
  const { data: op } = useOperation(pendingOpId);

  const mutation = useMutation({
    mutationFn: (item: unknown) => api.update(`${spec.apiPath}/${nicId}`, item),
    onSuccess: (resp) => {
      const opId = extractOperationId(resp);
      if (opId) setPendingOpId(opId);
      else {
        invalidate(spec.id, folderId);
        toast.success(`NIC ${name || nicId} сохранён`);
        onSuccess?.();
        onCancel();
      }
    },
    onError: (err) => {
      const m =
        err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      toast.error(`Сохранить NIC: ${m}`);
    },
  });

  useEffect(() => {
    if (!pendingOpId || !op?.done) return;
    if (op.error) {
      toast.error(`Сохранить NIC: ${op.error.message ?? "ошибка"}`);
      setPendingOpId(null);
      return;
    }
    invalidate(spec.id, folderId);
    toast.success(`NIC ${name || nicId} сохранён`);
    setPendingOpId(null);
    onSuccess?.();
    onCancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op?.done, op?.error?.code]);

  const submit = () => {
    if (!nic) return;
    const mask: string[] = [];
    if ((nic.name ?? "") !== name) mask.push("name");
    if ((nic.description ?? "") !== description) mask.push("description");
    const origV4 = (nic.v4_address_ids ?? []).slice().sort();
    const origV6 = (nic.v6_address_ids ?? []).slice().sort();
    const origSg = (nic.security_group_ids ?? []).slice().sort();
    if (JSON.stringify(origV4) !== JSON.stringify(v4.slice().sort())) mask.push("v4_address_ids");
    if (JSON.stringify(origV6) !== JSON.stringify(v6.slice().sort())) mask.push("v6_address_ids");
    if (JSON.stringify(origSg) !== JSON.stringify(sgs.slice().sort())) mask.push("security_group_ids");

    if (mask.length === 0) {
      onCancel();
      return;
    }
    mutation.mutate({
      name,
      description,
      v4_address_ids: v4,
      v6_address_ids: v6,
      security_group_ids: sgs,
      update_mask: mask.join(","),
    });
  };

  if (isLoading || !nic) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Text type="secondary">Загрузка…</Typography.Text>
      </div>
    );
  }

  return (
    <div>
      <Typography.Title level={4} style={{ margin: "0 0 16px" }}>
        Редактирование сетевого интерфейса
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
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Form.Item>

        <Form.Item label="Описание">
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Form.Item>

        <Form.Item label="Подсеть">
          <Input value={nic.subnet_id ?? ""} disabled />
        </Form.Item>

        <Form.Item label="IPv4 адреса">
          <ResourceRefChips
            title="IPv4 Address"
            refResource="addresses"
            folderId={folderId}
            tagColor="blue"
            value={v4}
            onChange={setV4}
            maxItems={1}
            refFilter={(row) => !!row.internal_ipv4_address}
          />
        </Form.Item>

        <Form.Item label="IPv6 адреса">
          <ResourceRefChips
            title="IPv6 Address"
            refResource="addresses"
            folderId={folderId}
            tagColor="geekblue"
            value={v6}
            onChange={setV6}
            maxItems={1}
            refFilter={(row) =>
              !!row.internal_ipv6_address || !!row.external_ipv6_address
            }
          />
        </Form.Item>

        <Form.Item label="Группы безопасности">
          <ResourceRefChips
            title="Security Group"
            refResource="security-groups"
            folderId={folderId}
            tagColor="purple"
            value={sgs}
            onChange={setSgs}
          />
        </Form.Item>

        <Collapse
          ghost
          items={[
            {
              key: "advanced",
              label: <Typography.Text type="secondary">Дополнительно</Typography.Text>,
              children: (
                <Form.Item label="Метки">
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Редактирование меток здесь не поддерживается — используйте полную форму или API.
                  </Typography.Text>
                </Form.Item>
              ),
            },
          ]}
        />

        <Form.Item wrapperCol={{ offset: 0, flex: "auto" }}>
          <Space>
            <Button
              type="primary"
              onClick={submit}
              loading={mutation.isPending || !!pendingOpId}
              disabled={mutation.isPending || !!pendingOpId}
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
