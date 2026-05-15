// LabelsEditor — единый controlled editor для map<string,string> labels.
// Использовать в каждой модалке/форме (Subnet, Network, NIC, SG, AddressPool,
// ...). Visual: список пар "ключ"+"значение"+корзина и кнопка «Добавить метку».
//
// Контракт: value — массив пар LabelEntry. State держится в parent, что
// исключает feedback-loop, из-за которого row пропадал при первом клике
// (entries=[{"":""}] → obj={} → useEffect мог сбросить локальный state).
//
// Утилиты: labelsToEntries / labelsFromEntries (canonical имена), labelsFromMap /
// labelsToMap (алиасы для совместимости со старыми импортами).

import { Button, Input, Space, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

export interface LabelEntry {
  key: string;
  value: string;
}

interface Props {
  value: LabelEntry[];
  onChange: (next: LabelEntry[]) => void;
  disabled?: boolean;
}

export function LabelsEditor({ value, onChange, disabled }: Props) {
  const update = (idx: number, patch: Partial<LabelEntry>) => {
    onChange(value.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  return (
    <Space direction="vertical" size={6} style={{ width: "100%" }}>
      {value.length === 0 && (
        <Typography.Text type="secondary" italic style={{ fontSize: 12 }}>
          — нет меток —
        </Typography.Text>
      )}
      {value.map((l, idx) => (
        <Space.Compact key={idx} style={{ width: "100%" }}>
          <Input
            placeholder="ключ"
            value={l.key}
            onChange={(e) => update(idx, { key: e.target.value })}
            disabled={disabled}
            style={{ flex: "0 0 220px" }}
          />
          <Input
            placeholder="значение"
            value={l.value}
            onChange={(e) => update(idx, { value: e.target.value })}
            disabled={disabled}
            style={{ flex: 1 }}
          />
          <Button
            icon={<DeleteOutlined />}
            onClick={() => onChange(value.filter((_, i) => i !== idx))}
            disabled={disabled}
          />
        </Space.Compact>
      ))}
      <Button
        onClick={() => onChange([...value, { key: "", value: "" }])}
        icon={<PlusOutlined />}
        size="small"
        disabled={disabled}
      >
        Добавить метку
      </Button>
    </Space>
  );
}

export function labelsToEntries(
  m: Record<string, string> | undefined,
): LabelEntry[] {
  if (!m) return [];
  return Object.entries(m).map(([key, value]) => ({ key, value }));
}

export function labelsFromEntries(
  entries: LabelEntry[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of entries) {
    if (l.key.trim()) out[l.key.trim()] = l.value;
  }
  return out;
}

// Алиасы для совместимости с InlineNetworkInterface*/InlineAddressPool*,
// которые импортировали под этими именами.
export const labelsFromMap = labelsToEntries;
export const labelsToMap = labelsFromEntries;
