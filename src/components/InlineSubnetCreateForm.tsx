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
import { DopplerButton } from "@/components/DopplerButton";
import { REGISTRY } from "@/lib/resource-registry";
import { useInvalidateResourceList, useOperation } from "@/lib/use-operation";
import { toast } from "@/lib/toast";

interface Props {
  folderId: string;
  networkId: string;
  onCancel: () => void;
  onSuccess?: () => void;
}

interface CidrEntry {
  address: string;
  prefix: number;
}

interface LabelEntry {
  key: string;
  value: string;
}

const PREFIX_OPTIONS = Array.from({ length: 25 }, (_, i) => ({
  value: i + 8, // /8 .. /32
  label: `${i + 8}`,
}));

// IPv6: типичные subnet-маски /48..../128 (RFC 6177 — /48 site, /56 home,
// /64 default subnet). Шаг 1 даёт полное покрытие; default /64.
const PREFIX_OPTIONS_V6 = Array.from({ length: 81 }, (_, i) => ({
  value: i + 48, // /48 .. /128
  label: `${i + 48}`,
}));

function autoName(): string {
  return `subnetwork-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function InlineSubnetCreateForm({
  folderId,
  networkId,
  onCancel,
  onSuccess,
}: Props) {
  const invalidate = useInvalidateResourceList();
  const subnetSpec = REGISTRY["subnets"];
  const zoneSpec = REGISTRY["zones"];
  const rtSpec = REGISTRY["route-tables"];

  const [name, setName] = useState(() => autoName());
  const [description, setDescription] = useState("");
  const [labels, setLabels] = useState<LabelEntry[]>([]);
  const [zoneId, setZoneId] = useState<string | undefined>(undefined);
  const [routeTableId, setRouteTableId] = useState<string | undefined>(undefined);
  const [cidrs, setCidrs] = useState<CidrEntry[]>([{ address: "", prefix: 24 }]);
  // v6 — пусто по умолчанию; оба массива независимы (v4-only / v6-only / dual-stack).
  const [cidrsV6, setCidrsV6] = useState<CidrEntry[]>([]);
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
      toast.error(`Создать подсеть: ${op.error.message ?? "ошибка"}`);
    } else {
      invalidate(subnetSpec.id, folderId);
      toast.success(`Подсеть ${name} создана`);
      onSuccess?.();
    }
    setPendingOpId(null);
    onCancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op?.done, op?.error?.code]);

  const submit = () => {
    if (!zoneId) {
      return;
    }
    const cidrStrings = cidrs
      .map((c) => c.address.trim())
      .filter((s) => s.length > 0)
      .map((s, i) => `${s}/${cidrs[i].prefix}`);
    const v6Strings = cidrsV6
      .map((c) => c.address.trim())
      .filter((s) => s.length > 0)
      .map((s, i) => `${s}/${cidrsV6[i].prefix}`);
    // Хотя бы одно семейство должно быть задано (kacho-vpc допускает v4-only,
    // v6-only и dual-stack; полностью пустая подсеть отвергается backend'ом).
    if (cidrStrings.length === 0 && v6Strings.length === 0) {
      return;
    }
    const labelMap: Record<string, string> = {};
    for (const l of labels) {
      if (l.key.trim()) labelMap[l.key.trim()] = l.value;
    }
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
      v4_cidr_blocks: cidrStrings.length > 0 ? cidrStrings : undefined,
      v6_cidr_blocks: v6Strings.length > 0 ? v6Strings : undefined,
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
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            {labels.map((l, idx) => (
              <Space key={idx} size={4} style={{ width: "100%" }}>
                <Input
                  placeholder="ключ"
                  value={l.key}
                  onChange={(e) => {
                    const next = [...labels];
                    next[idx] = { ...next[idx], key: e.target.value };
                    setLabels(next);
                  }}
                  style={{ width: 200 }}
                />
                <span>=</span>
                <Input
                  placeholder="значение"
                  value={l.value}
                  onChange={(e) => {
                    const next = [...labels];
                    next[idx] = { ...next[idx], value: e.target.value };
                    setLabels(next);
                  }}
                  style={{ width: 240 }}
                />
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => setLabels(labels.filter((_, i) => i !== idx))}
                />
              </Space>
            ))}
            <Button
              onClick={() => setLabels([...labels, { key: "", value: "" }])}
              icon={<PlusOutlined />}
            >
              Добавить метку
            </Button>
          </Space>
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
              IPv4 CIDR
              <Tooltip title="IPv4 CIDR-блоки подсети, RFC 1918. Маска /16–/30. Поле опционально — допустима v6-only подсеть.">
                <QuestionCircleOutlined style={{ color: "rgba(255,255,255,0.45)" }} />
              </Tooltip>
            </Space>
          }
        >
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            {cidrs.map((c, idx) => (
              <Space.Compact key={idx} style={{ width: "100%" }}>
                <Input
                  placeholder="IPv4 CIDR (например, 10.0.0.0)"
                  value={c.address}
                  onChange={(e) => {
                    const next = [...cidrs];
                    next[idx] = { ...next[idx], address: e.target.value };
                    setCidrs(next);
                  }}
                  style={{ flex: 1 }}
                />
                <Input
                  defaultValue="/"
                  disabled
                  style={{
                    width: 30,
                    textAlign: "center",
                    pointerEvents: "none",
                    background: "transparent",
                  }}
                />
                <Select
                  value={c.prefix}
                  onChange={(v) => {
                    const next = [...cidrs];
                    next[idx] = { ...next[idx], prefix: v };
                    setCidrs(next);
                  }}
                  options={PREFIX_OPTIONS}
                  style={{ width: 80 }}
                />
                <Button
                  icon={<DeleteOutlined />}
                  onClick={() => setCidrs(cidrs.filter((_, i) => i !== idx))}
                />
              </Space.Compact>
            ))}
            <Button
              onClick={() => setCidrs([...cidrs, { address: "", prefix: 24 }])}
              icon={<PlusOutlined />}
            >
              Добавить IPv4 CIDR
            </Button>
          </Space>
        </Form.Item>

        <Form.Item
          label={
            <Space size={4}>
              IPv6 CIDR
              <Tooltip title="IPv6 CIDR-блоки подсети. Маска /48–/128 (default /64 — RFC 6177). Поле опционально — допустима v4-only подсеть. Dual-stack: задайте оба.">
                <QuestionCircleOutlined style={{ color: "rgba(255,255,255,0.45)" }} />
              </Tooltip>
            </Space>
          }
        >
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            {cidrsV6.map((c, idx) => (
              <Space.Compact key={idx} style={{ width: "100%" }}>
                <Input
                  placeholder="IPv6 CIDR (например, 2001:db8::)"
                  value={c.address}
                  onChange={(e) => {
                    const next = [...cidrsV6];
                    next[idx] = { ...next[idx], address: e.target.value };
                    setCidrsV6(next);
                  }}
                  style={{ flex: 1 }}
                />
                <Input
                  defaultValue="/"
                  disabled
                  style={{
                    width: 30,
                    textAlign: "center",
                    pointerEvents: "none",
                    background: "transparent",
                  }}
                />
                <Select
                  value={c.prefix}
                  onChange={(v) => {
                    const next = [...cidrsV6];
                    next[idx] = { ...next[idx], prefix: v };
                    setCidrsV6(next);
                  }}
                  options={PREFIX_OPTIONS_V6}
                  style={{ width: 90 }}
                  showSearch
                />
                <Button
                  icon={<DeleteOutlined />}
                  onClick={() => setCidrsV6(cidrsV6.filter((_, i) => i !== idx))}
                />
              </Space.Compact>
            ))}
            <Button
              onClick={() => setCidrsV6([...cidrsV6, { address: "", prefix: 64 }])}
              icon={<PlusOutlined />}
            >
              Добавить IPv6 CIDR
            </Button>
          </Space>
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
