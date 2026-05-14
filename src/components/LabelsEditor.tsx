// LabelsEditor — controlled editor для map<string,string> labels-полей.
// Visual: список пар ключ=значение + кнопка «Добавить метку». Использует
// AntD-стили (тот же фон что Input/Select #1c1d22 через theme tokens).

import { Button, Input, Space, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

export interface LabelEntry {
  key: string;
  value: string;
}

interface Props {
  value: LabelEntry[];
  onChange: (next: LabelEntry[]) => void;
}

export function LabelsEditor({ value, onChange }: Props) {
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
            onChange={(e) => {
              const next = [...value];
              next[idx] = { ...next[idx], key: e.target.value };
              onChange(next);
            }}
            style={{ flex: "0 0 220px" }}
          />
          <Input
            placeholder="значение"
            value={l.value}
            onChange={(e) => {
              const next = [...value];
              next[idx] = { ...next[idx], value: e.target.value };
              onChange(next);
            }}
            style={{ flex: 1 }}
          />
          <Button
            icon={<DeleteOutlined />}
            onClick={() => onChange(value.filter((_, i) => i !== idx))}
          />
        </Space.Compact>
      ))}
      <Button
        onClick={() => onChange([...value, { key: "", value: "" }])}
        icon={<PlusOutlined />}
        size="small"
      >
        Добавить метку
      </Button>
    </Space>
  );
}

export function labelsToMap(entries: LabelEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of entries) {
    if (l.key.trim()) out[l.key.trim()] = l.value;
  }
  return out;
}

export function labelsFromMap(m: Record<string, string> | undefined): LabelEntry[] {
  if (!m) return [];
  return Object.entries(m).map(([key, value]) => ({ key, value }));
}
