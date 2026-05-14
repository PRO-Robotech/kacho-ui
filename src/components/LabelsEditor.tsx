// LabelsEditor — единый controlled editor для map<string,string> labels-полей.
// Используется во всех формах ресурсов (Subnet, Network, NIC, SecurityGroup,
// AddressPool, …) для visual unity.
//
// Контракт: value — массив пар {key, value} (явный, без неявных
// преобразований). Это гарантирует корректное отображение «с первой попытки» —
// state hydrate в parent один раз, после чего editor reflect'ит без race'ов.
//
// Для удобства hydrate из/в `Record<string,string>` есть утилиты
// labelsToEntries / labelsFromEntries.

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
    const next = value.map((row, i) => (i === idx ? { ...row, ...patch } : row));
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const add = () => {
    onChange([...value, { key: "", value: "" }]);
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
            onClick={() => remove(idx)}
            disabled={disabled}
          />
        </Space.Compact>
      ))}
      <Button
        onClick={add}
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
  obj: Record<string, string> | undefined,
): LabelEntry[] {
  if (!obj) return [];
  return Object.entries(obj).map(([key, value]) => ({ key, value }));
}

export function labelsFromEntries(rows: LabelEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.key.trim()) out[r.key.trim()] = r.value;
  }
  return out;
}
