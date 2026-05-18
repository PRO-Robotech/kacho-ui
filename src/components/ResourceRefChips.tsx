// ResourceRefChips — controlled chip-list для array-of-ref полей (например
// NIC.v4_address_ids / v6_address_ids / security_group_ids). Визуально как
// SubnetCidrChips, но содержимое — id чужих ресурсов; чипы показывают
// resolved name (загрузка через api.list для folder-scoped ресурсов).
// Внизу — Select для добавления, Tag-close для удаления.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Select, Space, Tag, Typography } from "antd";
import { CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { api } from "@/api/client";
import { getResource } from "@/lib/resource-registry";

interface Props {
  title: string;
  /** ID ресурса в REGISTRY (например, "addresses", "security-groups"). */
  refResource: string;
  /** folder_id для ListXxxRequest. */
  projectId: string;
  /** Опц. client-side filter (например, только internal IPv4 Address'ы). */
  refFilter?: (row: Record<string, unknown>) => boolean;
  /** Цвет chip'ов (для visual diff между IPv4/IPv6/SG). */
  tagColor?: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** Максимум элементов (KAC-55: ≤1 v4/v6 Address на NIC). */
  maxItems?: number;
}

export function ResourceRefChips({
  title,
  refResource,
  projectId,
  refFilter,
  tagColor = "blue",
  value,
  onChange,
  maxItems,
}: Props) {
  const spec = getResource(refResource);
  const [draft, setDraft] = useState<string | undefined>(undefined);

  // Загружаем список ресурсов folder'а для resolve id→name + dropdown options.
  const { data: listData } = useQuery({
    queryKey: [refResource, "list", projectId],
    queryFn: () =>
      api.list<Record<string, unknown>>(spec!.apiPath, {
        folder_id: projectId,
        pageSize: "500",
      }),
    enabled: !!spec,
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    if (!listData || !spec) return [];
    const arr = (listData[spec.payloadKey] as Record<string, unknown>[] | undefined) ?? [];
    return refFilter ? arr.filter(refFilter) : arr;
  }, [listData, spec, refFilter]);

  const byId = useMemo(
    () => new Map(rows.map((r) => [(r.id as string) ?? "", r])),
    [rows],
  );

  // Options для dropdown — только те, что ещё не добавлены.
  const options = useMemo(
    () =>
      rows
        .filter((r) => !value.includes((r.id as string) ?? ""))
        .map((r) => ({
          value: (r.id as string) ?? "",
          label: ((r.name as string) || (r.id as string)) ?? "",
        })),
    [rows, value],
  );

  const atCap = maxItems !== undefined && value.length >= maxItems;

  const onAdd = () => {
    if (!draft || atCap) return;
    if (value.includes(draft)) return;
    onChange([...value, draft]);
    setDraft(undefined);
  };

  const onRemove = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <Typography.Text strong>{title}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {value.length}
            {maxItems !== undefined ? ` / ${maxItems}` : ""}
          </Typography.Text>
        </Space>
      }
    >
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <div style={{ minHeight: 24 }}>
          {value.length === 0 ? (
            <Typography.Text type="secondary" italic style={{ fontSize: 12 }}>
              — пусто —
            </Typography.Text>
          ) : (
            <Space size={[6, 6]} wrap>
              {value.map((id) => {
                const row = byId.get(id);
                const name = (row?.name as string) || id;
                return (
                  <Tag
                    key={id}
                    color={tagColor}
                    closable
                    closeIcon={<CloseOutlined style={{ fontSize: 10 }} />}
                    onClose={(e) => {
                      e.preventDefault();
                      onRemove(id);
                    }}
                    style={{ fontFamily: "monospace", fontSize: 12, margin: 0 }}
                  >
                    {name}
                  </Tag>
                );
              })}
            </Space>
          )}
        </div>
        <Space.Compact style={{ width: "100%" }}>
          <Select
            showSearch
            value={draft}
            onChange={setDraft}
            options={options}
            placeholder={atCap ? `Максимум ${maxItems}` : `Выбрать ${title}`}
            optionFilterProp="label"
            disabled={atCap}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            ghost
            onClick={onAdd}
            disabled={!draft || atCap}
            icon={<PlusOutlined />}
          >
            Add
          </Button>
        </Space.Compact>
      </Space>
    </Card>
  );
}
