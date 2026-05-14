// InlineSubnetCreateForm — inline-форма создания подсети, встраиваемая в правую
// панель Network detail вместо "Общее"-Descriptions. Раскладка повторяет
// YC-style 2-column horizontal layout (label-left / input-right) с custom-
// виджетами под CIDR, метки и DHCP-collapse.
//
// Wire-format submission ровно как у public AddressService.Create:
//   { folder_id, network_id, zone_id, name, description?, labels?,
//     v4_cidr_blocks: [string], v6_cidr_blocks: [string], route_table_id?, dhcp_options? }
//
// v6_cidr_blocks (KAC-68): аналогично v4, но prefix-варианты /48..../128;
// в большинстве случаев /64 (RFC-default для subnet). Оба поля optional —
// допустима v4-only / v6-only / dual-stack подсеть.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  Collapse,
  Form,
  Input,
  Select,
  Space,
  Tooltip,
  Typography,
} from "antd";
import {
  PlusOutlined,
  QuestionCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { ApiError, api } from "@/api/client";
import { extractOperationId } from "@/components/OperationDialog";
import { SubnetCidrChips } from "@/components/SubnetCidrChips";
import { DopplerButton } from "@/components/DopplerButton";
import { REGISTRY } from "@/lib/resource-registry";
import { useInvalidateResourceList, useOperation } from "@/lib/use-operation";
import { toast } from "@/lib/toast";
import {
  LabelsEditor,
  labelsFromEntries,
  type LabelEntry,
} from "@/components/LabelsEditor";

interface Props {
  folderId: string;
  // networkId — preset (locked если задан). Если undefined — форма
  // отображает RefSelect "Сеть" как первое поле, user выбирает в форме
  // (отказались от двухшагового flow).
  networkId?: string;
  onCancel: () => void;
  onSuccess?: () => void;
}

interface LabelEntry {
  key: string;
  value: string;
}

function autoName(): string {
  return `subnetwork-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function InlineSubnetCreateForm({
  folderId,
  networkId: presetNetworkId,
  onCancel,
  onSuccess,
}: Props) {
  const invalidate = useInvalidateResourceList();
  const subnetSpec = REGISTRY["subnets"];
  const zoneSpec = REGISTRY["zones"];
  const rtSpec = REGISTRY["route-tables"];
  const networkSpec = REGISTRY["networks"];

  // Если networkId preset (передан из контекста — например, "Создать подсеть"
  // из NetworkDetailPage), сеть locked. Иначе — selectable в форме.
  const [networkId, setNetworkId] = useState<string | undefined>(presetNetworkId);
  const networkLocked = !!presetNetworkId;

  // Список Networks для RefSelect (когда preset не задан).
  const { data: netData } = useQuery({
    queryKey: ["networks", "list", folderId],
    queryFn: () =>
      api.list<{ networks: Array<{ id: string; name?: string }> }>(networkSpec.apiPath, {
        folder_id: folderId,
        pageSize: "500",
      }),
    enabled: !networkLocked,
    staleTime: 30_000,
  });
  const networkOptions = useMemo(
    () =>
      (netData?.networks ?? []).map((n) => ({
        value: n.id,
        label: n.name || n.id,
      })),
    [netData],
  );

  const [name, setName] = useState(() => autoName());
  const [description, setDescription] = useState("");
  const [labels, setLabels] = useState<LabelEntry[]>([]);
  const [zoneId, setZoneId] = useState<string | undefined>(undefined);
  const [routeTableId, setRouteTableId] = useState<string | undefined>(undefined);
  // CIDR-блоки храним как массив готовых строк "10.0.0.0/24" (как в edit-вью);
  // визуально — chip-list через SubnetCidrChips (visual parity с SubnetCidrManager).
  const [v4Blocks, setV4Blocks] = useState<string[]>([]);
  const [v6Blocks, setV6Blocks] = useState<string[]>([]);
  const [dhcpDomainName, setDhcpDomainName] = useState("");
  const [dhcpDns, setDhcpDns] = useState<string[]>([]);
  const [dhcpNtp, setDhcpNtp] = useState<string[]>([]);

  // Зоны: глобальный admin-ресурс, без folder_id.
  const { data: zoneData } = useQuery({
    queryKey: ["zones", "list"],
    queryFn: () =>
      api.list<{ zones: Array<{ id: string; name?: string }> }>(zoneSpec.apiPath, {
        pageSize: "500",
      }),
    staleTime: 60_000,
  });
  const zoneOptions = useMemo(
    () =>
      (zoneData?.zones ?? []).map((z) => ({
        value: z.id,
        label: z.name || z.id,
      })),
    [zoneData],
  );
  // Default-zone — первая по списку (обычно ru-central1-a).
  useEffect(() => {
    if (!zoneId && zoneOptions.length > 0) {
      setZoneId(zoneOptions[0].value);
    }
  }, [zoneId, zoneOptions]);

  // RouteTables: folder-scoped, ещё фильтруем по network.
  const { data: rtData } = useQuery({
    queryKey: ["route-tables", "list", folderId, networkId],
    queryFn: () =>
      api.list<{ route_tables: Array<Record<string, unknown>> }>(rtSpec.apiPath, {
        folder_id: folderId,
        pageSize: "500",
      }),
    staleTime: 30_000,
  });
  const rtOptions = useMemo(
    () =>
      (rtData?.route_tables ?? [])
        .filter((r) => r.network_id === networkId)
        .map((r) => ({
          value: r.id as string,
          label: ((r.name as string) || (r.id as string)) ?? "",
        })),
    [rtData, networkId],
  );

  // Doppler-flow: ждём op.done через polling вместо banner.
  const [pendingOpId, setPendingOpId] = useState<string | null>(null);
  const { data: op } = useOperation(pendingOpId);

  const mutation = useMutation({
    mutationFn: (item: unknown) => api.create(subnetSpec.apiPath, item),
    onSuccess: (resp) => {
      const id = extractOperationId(resp);
      if (id) {
        setPendingOpId(id);
      } else {
        invalidate(subnetSpec.id, folderId);
        onSuccess?.();
        onCancel();
      }
    },
    onError: (err) => {
      const m =
        err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      toast.error(`Создать подсеть: ${m}`);
    },
  });

  useEffect(() => {
    if (!pendingOpId || !op?.done) return;
    if (op.error) {
      // На ошибку — НЕ вызываем onCancel/onSuccess: остаёмся на форме,
      // user видит toast с причиной (например CIDR overlap) и может
      // поправить ввод. Раньше любой результат закрывал форму — баг.
      toast.error(`Создать подсеть: ${op.error.message ?? "ошибка"}`);
      setPendingOpId(null);
      return;
    }
    invalidate(subnetSpec.id, folderId);
    toast.success(`Подсеть ${name} создана`);
    setPendingOpId(null);
    onSuccess?.();
    onCancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op?.done, op?.error?.code]);

  const submit = () => {
    if (!networkId) {
      toast.error("Выберите сеть для подсети.");
      return;
    }
    if (!zoneId) {
      toast.error("Выберите зону доступности.");
      return;
    }
    // CIDR-строки уже валидированы и добавлены через SubnetCidrChips —
    // используем как есть. Хотя бы одно семейство (v4 / v6 / оба) обязательно.
    if (v4Blocks.length === 0 && v6Blocks.length === 0) {
      toast.error("Добавьте хотя бы один CIDR (IPv4 или IPv6).");
      return;
    }
    const labelMap = labelsFromEntries(labels);
    const dhcp =
      dhcpDomainName || dhcpDns.length > 0 || dhcpNtp.length > 0
        ? {
            domain_name: dhcpDomainName || undefined,
            domain_name_servers: dhcpDns.length > 0 ? dhcpDns : undefined,
            ntp_servers: dhcpNtp.length > 0 ? dhcpNtp : undefined,
          }
        : undefined;

    const payload: Record<string, unknown> = {
      folder_id: folderId,
      network_id: networkId,
      zone_id: zoneId,
      name,
      description: description || undefined,
      labels: Object.keys(labelMap).length > 0 ? labelMap : undefined,
      v4_cidr_blocks: v4Blocks.length > 0 ? v4Blocks : undefined,
      v6_cidr_blocks: v6Blocks.length > 0 ? v6Blocks : undefined,
      route_table_id: routeTableId || undefined,
      dhcp_options: dhcp,
    };

    mutation.mutate(payload);
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <Typography.Title level={4} style={{ margin: "0 0 16px" }}>
        Создание подсети
      </Typography.Title>

      <Form
        layout="horizontal"
        labelCol={{ flex: "200px" }}
        wrapperCol={{ flex: "auto" }}
        labelAlign="left"
        colon={false}
        size="middle"
      >
        <Form.Item label="Сеть" required>
          <Select
            showSearch
            value={networkId}
            onChange={(v) => setNetworkId(v)}
            options={networkOptions}
            placeholder="Выберите сеть"
            optionFilterProp="label"
            disabled={networkLocked}
          />
        </Form.Item>

        <Form.Item label="Имя" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="subnetwork-..."
          />
        </Form.Item>

        <Form.Item label="Описание">
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Form.Item>

        <Form.Item label="Метки">
          <LabelsEditor value={labels} onChange={setLabels} />
        </Form.Item>

        <Form.Item label="Зона доступности" required>
          <Select
            value={zoneId}
            onChange={setZoneId}
            options={zoneOptions}
            placeholder="Выберите зону"
          />
        </Form.Item>

        <Form.Item label="Таблица маршрутизации">
          <Select
            value={routeTableId}
            onChange={(v) => setRouteTableId(v)}
            options={rtOptions}
            allowClear
            placeholder=""
          />
        </Form.Item>

        <Form.Item
          label={
            <Space size={4}>
              IPv4 и IPv6 CIDR
              <Tooltip title="IPv4 и/или IPv6 CIDR-блоки подсети. Хотя бы одно семейство обязательно (v4-only / v6-only / dual-stack). Введите CIDR с префиксом, например 10.0.0.0/24 или 2001:db8::/64, и нажмите Add.">
                <QuestionCircleOutlined style={{ color: "rgba(255,255,255,0.45)" }} />
              </Tooltip>
            </Space>
          }
          required
        >
          {/* Тот же chip-list-виджет, что у Edit (SubnetCidrManager), но в
              controlled-mode — мутирует локальный state, отправка вместе с
              формой. Визуальная parity с edit-страницей. */}
          <SubnetCidrChips
            v4Blocks={v4Blocks}
            onV4Change={setV4Blocks}
            v6Blocks={v6Blocks}
            onV6Change={setV6Blocks}
          />
        </Form.Item>

        <div style={{ margin: "16px 0" }}>
          <Collapse
            ghost
            items={[
              {
                key: "dhcp",
                label: (
                  <Typography.Text strong>Настройки DHCP</Typography.Text>
                ),
                children: (
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Form.Item label="Domain name" style={{ marginBottom: 0 }}>
                      <Input
                        value={dhcpDomainName}
                        onChange={(e) => setDhcpDomainName(e.target.value)}
                        placeholder="<domain>"
                      />
                    </Form.Item>
                    <Form.Item label="DNS servers" style={{ marginBottom: 0 }}>
                      <Select
                        mode="tags"
                        value={dhcpDns}
                        onChange={setDhcpDns}
                        tokenSeparators={[",", " "]}
                        placeholder="<ip-адреса DNS>"
                      />
                    </Form.Item>
                    <Form.Item label="NTP servers" style={{ marginBottom: 0 }}>
                      <Select
                        mode="tags"
                        value={dhcpNtp}
                        onChange={setDhcpNtp}
                        tokenSeparators={[",", " "]}
                        placeholder="<NTP-серверы>"
                      />
                    </Form.Item>
                  </Space>
                ),
              },
            ]}
          />
        </div>

        <Form.Item wrapperCol={{ offset: 0, flex: "auto" }}>
          <Space>
            <DopplerButton
              type="primary"
              onClick={submit}
              pulsing={mutation.isPending || pendingOpId !== null}
            >
              Создать подсеть
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
