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
// Сетка из div'ов (НЕ <table>): minmax(0,1fr) даёт колонкам min-width 0 →
// виджет сжимается вместе с wrapper-колонкой формы и НЕ выталкивает AntD-ряд
// в wrap. С <table> min-content таблицы переносил ряд на свою строку во всю
// ширину карточки (770px вместо 570px у полей). KAC-246.
const GRID_COLS = "minmax(0, 1fr) minmax(0, 1fr) 40px";
const cellInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
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
      style={{ width: "100%", minWidth: 0 }}
    >
      {/* header */}
      <div
        className="bg-muted/40 text-xs uppercase tracking-wide"
        style={{ display: "grid", gridTemplateColumns: GRID_COLS }}
      >
        <div className="px-3 py-2">Ключ</div>
        <div className="px-3 py-2">Значение</div>
        <div />
      </div>

      {/* rows */}
      {value.length === 0 && (
        <div
          className="px-3 text-center text-xs text-muted-foreground"
          style={{ height: ROW_H, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          Меток нет
        </div>
      )}
      {value.map((l, idx) => (
        <div
          key={idx}
          className="border-t border-border hover:bg-muted/20"
          style={{ display: "grid", gridTemplateColumns: GRID_COLS, alignItems: "center", minWidth: 0 }}
        >
          <div className="px-3 font-mono text-xs" style={{ minWidth: 0 }}>
            <Input
              variant="borderless"
              placeholder="ключ"
              value={l.key}
              onChange={(e) => update(idx, { key: e.target.value })}
              disabled={disabled}
              style={cellInputStyle}
            />
          </div>
          <div className="px-3 font-mono text-xs" style={{ minWidth: 0 }}>
            <Input
              variant="borderless"
              placeholder="значение"
              value={l.value}
              onChange={(e) => update(idx, { value: e.target.value })}
              disabled={disabled}
              style={cellInputStyle}
            />
          </div>
          <div style={{ textAlign: "center" }}>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              aria-label="Удалить метку"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              disabled={disabled}
            />
          </div>
        </div>
      ))}

      {/* footer */}
      <div className="border-t border-border" style={{ padding: "8px 12px" }}>
        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={() => onChange([...value, { key: "", value: "" }])}
          disabled={disabled}
        >
          Добавить метку
        </Button>
      </div>
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
