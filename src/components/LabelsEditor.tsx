// LabelsEditor — единый controlled editor для map<string,string> labels.
// Использовать в каждой модалке/форме (Subnet, Network, NIC, SG, AddressPool,
// ...). Visual: ОДНА таблица key=value (Ключ | Значение | ⌫) — единый вид с
// RoutesPanel/«Статические маршруты»: borderless-ячейки, dashed «Добавить
// метку» снизу. Применяется в формах создания/модификации.
//
// Контракт: value — массив пар LabelEntry. State держится в parent, что
// исключает feedback-loop, из-за которого row пропадал при первом клике
// (entries=[{"":""}] → obj={} → useEffect мог сбросить локальный state).
//
// Утилиты: labelsToEntries / labelsFromEntries (canonical имена), labelsFromMap /
// labelsToMap (алиасы для совместимости со старыми импортами).

import { Button, Input } from "antd";
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

const ROW_H = 38;
const cellInputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "ui-monospace, monospace",
  fontSize: 12,
  padding: 0,
  height: ROW_H - 2,
  lineHeight: `${ROW_H - 2}px`,
};

export function LabelsEditor({ value, onChange, disabled }: Props) {
  const update = (idx: number, patch: Partial<LabelEntry>) => {
    onChange(value.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  return (
    <div
      className="rounded-lg border border-border overflow-hidden bg-card"
      style={{ maxWidth: 520 }}
    >
      <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "calc((100% - 48px) / 2)" }} />
          <col style={{ width: "calc((100% - 48px) / 2)" }} />
          <col style={{ width: 48 }} />
        </colgroup>
        <thead>
          <tr className="bg-muted/40 text-xs uppercase tracking-wide">
            <th className="text-left px-3 py-2">Ключ</th>
            <th className="text-left px-3 py-2">Значение</th>
            <th className="px-1 py-2" />
          </tr>
        </thead>
        <tbody>
          {value.length === 0 && (
            <tr style={{ height: ROW_H }}>
              <td
                colSpan={3}
                className="px-3 text-center text-xs text-muted-foreground"
                style={{ verticalAlign: "middle" }}
              >
                Меток нет
              </td>
            </tr>
          )}
          {value.map((l, idx) => (
            <tr
              key={idx}
              className="border-t border-border hover:bg-muted/20"
              style={{ height: ROW_H }}
            >
              <td className="px-3 font-mono text-xs" style={{ verticalAlign: "middle" }}>
                <Input
                  variant="borderless"
                  placeholder="ключ"
                  value={l.key}
                  onChange={(e) => update(idx, { key: e.target.value })}
                  disabled={disabled}
                  style={cellInputStyle}
                />
              </td>
              <td className="px-3 font-mono text-xs" style={{ verticalAlign: "middle" }}>
                <Input
                  variant="borderless"
                  placeholder="значение"
                  value={l.value}
                  onChange={(e) => update(idx, { value: e.target.value })}
                  disabled={disabled}
                  style={cellInputStyle}
                />
              </td>
              <td className="px-1 text-center" style={{ verticalAlign: "middle" }}>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  aria-label="Удалить метку"
                  onClick={() => onChange(value.filter((_, i) => i !== idx))}
                  disabled={disabled}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td className="px-3 py-2" colSpan={3}>
              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                onClick={() => onChange([...value, { key: "", value: "" }])}
                disabled={disabled}
              >
                Добавить метку
              </Button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
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
