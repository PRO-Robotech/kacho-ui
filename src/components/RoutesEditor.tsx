// RoutesEditor — controlled key-value-таблица статических маршрутов для ФОРМЫ
// создания RouteTable. Визуальный паритет с RoutesPanel (detail edit), но
// controlled (value/onChange — часть state формы, без собственного save).
//
// Реализован на div-grid (НЕ <table>): minmax(0,1fr) колонки + min-width:0 →
// виджет сжимается с шириной формы и не выталкивает layout (см. LabelsEditor,
// KAC-246 gotcha про <table> в AntD Form). Колонки: Префикс назначения |
// Следующий узел | ⌫, снизу dashed «Добавить маршрут».
//
// Backend поддерживает только next_hop_address (kacho-vpc#55) — gateway_id не
// вводим (как и RoutesPanel).
import { Button, Input, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

export interface RouteEntry {
  destination_prefix: string;
  next_hop_address: string;
}

interface Props {
  value: RouteEntry[];
  onChange: (next: RouteEntry[]) => void;
  disabled?: boolean;
}

const ROW_H = 40;
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

export function RoutesEditor({ value, onChange, disabled }: Props) {
  const update = (idx: number, patch: Partial<RouteEntry>) => {
    onChange(value.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  return (
    <div>
      <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
        Статические маршруты{" "}
        <Typography.Text type="secondary" style={{ fontWeight: 400 }}>
          ({value.length})
        </Typography.Text>
      </Typography.Text>

      <div
        className="rounded-lg border border-border overflow-hidden bg-card"
        style={{ width: "100%", minWidth: 0 }}
      >
        {/* header */}
        <div
          className="bg-muted/40 text-xs uppercase tracking-wide"
          style={{ display: "grid", gridTemplateColumns: GRID_COLS }}
        >
          <div className="px-3 py-2">Префикс назначения</div>
          <div className="px-3 py-2">Следующий узел</div>
          <div />
        </div>

        {/* rows */}
        {value.length === 0 && (
          <div
            className="px-3 text-center text-xs text-muted-foreground"
            style={{ height: ROW_H, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            Маршрутов нет
          </div>
        )}
        {value.map((r, idx) => (
          <div
            key={idx}
            className="border-t border-border hover:bg-muted/20"
            style={{ display: "grid", gridTemplateColumns: GRID_COLS, alignItems: "center", minWidth: 0 }}
          >
            <div className="px-3 font-mono text-xs" style={{ minWidth: 0 }}>
              <Input
                variant="borderless"
                placeholder="10.0.0.0/24"
                value={r.destination_prefix}
                onChange={(e) => update(idx, { destination_prefix: e.target.value })}
                disabled={disabled}
                style={cellInputStyle}
              />
            </div>
            <div className="px-3 font-mono text-xs" style={{ minWidth: 0 }}>
              <Input
                variant="borderless"
                placeholder="10.0.0.1"
                value={r.next_hop_address}
                onChange={(e) => update(idx, { next_hop_address: e.target.value })}
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
                aria-label="Удалить маршрут"
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
            onClick={() => onChange([...value, { destination_prefix: "", next_hop_address: "" }])}
            disabled={disabled}
          >
            Добавить маршрут
          </Button>
        </div>
      </div>
    </div>
  );
}
