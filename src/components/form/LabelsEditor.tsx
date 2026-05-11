// LabelsEditor — generic editor для map<string,string> (YC labels).
// Хранит value в obj как объект; внутри держит локальный state из rows
// (массив пар key/value), синхронизированный с obj в onChange.

import { useEffect, useState } from "react";
import { Button, Input, Space } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Label } from "@/components/ui/input";
import { getByPath, setByPath } from "@/lib/path";

interface LabelEntry {
  key: string;
  value: string;
}

interface Props {
  pathPrefix: string;
  path: string;
  label: string;
  description?: string;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}

function objToEntries(o: Record<string, string> | undefined): LabelEntry[] {
  if (!o) return [];
  return Object.entries(o).map(([key, value]) => ({ key, value }));
}

function entriesToObj(rows: LabelEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.key.trim()) out[r.key.trim()] = r.value;
  }
  return out;
}

export function LabelsEditor({
  path,
  label,
  description,
  value,
  onChange,
  disabled,
}: Props) {
  const curRaw = getByPath(value, path);
  const cur =
    curRaw && typeof curRaw === "object" && !Array.isArray(curRaw)
      ? (curRaw as Record<string, string>)
      : undefined;

  // Локальный state — чтобы пустой ключ не "терялся" сразу при наборе.
  // Гидратируем при первом монтировании из value; сериализуем в obj в onChange.
  const [rows, setRows] = useState<LabelEntry[]>(() => objToEntries(cur));

  // Если родительский obj обновился (например, hydrate в edit-форме после
  // загрузки данных), пересинхронизируем — но только если ключи отличаются
  // от текущих rows (избегаем перетереть ввод пользователя).
  useEffect(() => {
    const incoming = objToEntries(cur);
    const incomingKeys = JSON.stringify(incoming.map((e) => e.key).sort());
    const localKeys = JSON.stringify(rows.map((e) => e.key).sort());
    if (incomingKeys !== localKeys) setRows(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cur)]);

  const update = (next: LabelEntry[]) => {
    setRows(next);
    onChange(setByPath(value, path, entriesToObj(next)));
  };

  return (
    <div className="space-y-1.5">
      <Label description={description}>{label}</Label>
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        {rows.map((r, idx) => (
          <Space key={idx} size={4} style={{ width: "100%" }}>
            <Input
              placeholder="ключ"
              value={r.key}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...next[idx], key: e.target.value };
                update(next);
              }}
              disabled={disabled}
              style={{ width: 220 }}
            />
            <span>=</span>
            <Input
              placeholder="значение"
              value={r.value}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...next[idx], value: e.target.value };
                update(next);
              }}
              disabled={disabled}
              style={{ width: 280 }}
            />
            <Button
              type="text"
              icon={<DeleteOutlined />}
              onClick={() => update(rows.filter((_, i) => i !== idx))}
              disabled={disabled}
            />
          </Space>
        ))}
        <Button
          onClick={() => update([...rows, { key: "", value: "" }])}
          icon={<PlusOutlined />}
          disabled={disabled}
        >
          Добавить метку
        </Button>
      </Space>
    </div>
  );
}
