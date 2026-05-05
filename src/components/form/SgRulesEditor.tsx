// SgRulesEditor — специализированный редактор VPC SecurityGroupRule[].
//
// Proto shape (kacho/cloud/vpc/v1/security_group.proto::SecurityGroupRule):
//   - direction: INGRESS | EGRESS  (required)
//   - description, labels
//   - protocol_name | protocol_number  (либо name, либо number, либо ничего = any)
//   - ports: PortRange { from_port, to_port }  (отсутствие = any)
//   - oneof target { cidr_blocks | security_group_id | predefined_target }
//
// UI-состояние держит дополнительные дискриминаторы `_protocol_mode`, `_ports_any`,
// `_target_kind`, чтобы рендерить нужные ветки. Spec-level sanitize (см. registry)
// вычищает их перед PATCH.

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { getByPath, setByPath, deleteByPath } from "@/lib/path";

type ProtocolMode = "any" | "name" | "number";
type TargetKind = "cidr" | "sg" | "predefined";

interface RuleExt {
  direction?: string;
  description?: string;
  _protocol_mode?: ProtocolMode;
  protocol_name?: string;
  protocol_number?: number;
  _ports_any?: boolean;
  ports?: { from_port?: number; to_port?: number };
  _target_kind?: TargetKind;
  cidr_blocks?: { v4_cidr_blocks?: string[]; v6_cidr_blocks?: string[] };
  security_group_id?: string;
  predefined_target?: string;
  // backend-managed
  id?: string;
}

interface Props {
  // pathPrefix не используется — sg-rules только top-level (внутри Resource).
  pathPrefix: string;
  // Полный resource-объект и колбэк, как у других FormField-рендереров.
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  path: string; // "rules"
  description?: string;
}

// При первом render существующих rules дискриминаторы могут отсутствовать —
// выводим их из shape. Делаем нормализацию на лету (без store).
function inferProtocolMode(r: RuleExt): ProtocolMode {
  if (r._protocol_mode) return r._protocol_mode;
  if (r.protocol_name) return "name";
  if (typeof r.protocol_number === "number") return "number";
  return "any";
}

function inferPortsAny(r: RuleExt): boolean {
  if (typeof r._ports_any === "boolean") return r._ports_any;
  return !r.ports || (r.ports.from_port == null && r.ports.to_port == null);
}

function inferTargetKind(r: RuleExt): TargetKind {
  if (r._target_kind) return r._target_kind;
  if (r.cidr_blocks) return "cidr";
  if (r.security_group_id) return "sg";
  if (r.predefined_target) return "predefined";
  return "cidr";
}

function emptyRule(): RuleExt {
  return {
    direction: "INGRESS",
    description: "",
    _protocol_mode: "any",
    _ports_any: true,
    _target_kind: "cidr",
    cidr_blocks: { v4_cidr_blocks: ["0.0.0.0/0"] },
  };
}

export function SgRulesEditor({ value, onChange, path, description }: Props) {
  const rules = (getByPath(value, path) as RuleExt[] | undefined) ?? [];

  const setRule = (idx: number, next: RuleExt) => {
    const arr = [...rules];
    arr[idx] = next;
    onChange(setByPath(value, path, arr));
  };

  const addRule = () => {
    onChange(setByPath(value, path, [...rules, emptyRule()]));
  };

  const removeRule = (idx: number) => {
    onChange(deleteByPath(value, `${path}[${idx}]`));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label description={description}>Rules</Label>
        <Button type="button" variant="outline" size="sm" onClick={addRule}>
          <Plus className="h-4 w-4" /> Add rule
        </Button>
      </div>
      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Пусто. Без правил трафик блокирован по default-deny.
        </p>
      )}
      <div className="space-y-3">
        {rules.map((rule, idx) => (
          <RuleCard
            key={idx}
            idx={idx}
            rule={rule}
            onChange={(next) => setRule(idx, next)}
            onRemove={() => removeRule(idx)}
          />
        ))}
      </div>
    </div>
  );
}

function RuleCard({
  idx,
  rule,
  onChange,
  onRemove,
}: {
  idx: number;
  rule: RuleExt;
  onChange: (next: RuleExt) => void;
  onRemove: () => void;
}) {
  const protoMode = inferProtocolMode(rule);
  const portsAny = inferPortsAny(rule);
  const targetKind = inferTargetKind(rule);

  const set = (patch: Partial<RuleExt>) => onChange({ ...rule, ...patch });

  return (
    <div className="rounded-md border border-border p-3 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Rule #{idx + 1}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Direction + Description */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Direction" required>
          <Select
            value={rule.direction ?? "INGRESS"}
            onChange={(v) => set({ direction: v })}
            options={[
              { value: "INGRESS", label: "INGRESS" },
              { value: "EGRESS", label: "EGRESS" },
            ]}
          />
        </Field>
        <Field label="Description">
          <Input
            value={rule.description ?? ""}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>
      </div>

      {/* Protocol */}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Protocol">
          <Select
            value={protoMode}
            onChange={(v) =>
              set({
                _protocol_mode: v as ProtocolMode,
                protocol_name: v === "name" ? (rule.protocol_name ?? "") : undefined,
                protocol_number:
                  v === "number" ? (rule.protocol_number ?? 0) : undefined,
              })
            }
            options={[
              { value: "any", label: "Any" },
              { value: "name", label: "By name" },
              { value: "number", label: "By number" },
            ]}
          />
        </Field>
        {protoMode === "name" && (
          <Field label="Name" className="col-span-2">
            <Input
              placeholder="tcp / udp / icmp / …"
              value={rule.protocol_name ?? ""}
              onChange={(e) => set({ protocol_name: e.target.value })}
            />
          </Field>
        )}
        {protoMode === "number" && (
          <Field label="Number (IANA)" className="col-span-2">
            <Input
              type="number"
              min={0}
              max={255}
              placeholder="0..255"
              value={rule.protocol_number ?? ""}
              onChange={(e) =>
                set({
                  protocol_number: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </Field>
        )}
      </div>

      {/* Ports */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={portsAny}
            onChange={(e) => set({ _ports_any: e.target.checked, ports: e.target.checked ? undefined : { from_port: 0, to_port: 65535 } })}
            className="h-4 w-4 rounded border-border"
          />
          Ports: any
        </label>
        {!portsAny && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input
                type="number"
                min={0}
                max={65535}
                value={rule.ports?.from_port ?? ""}
                onChange={(e) =>
                  set({
                    ports: {
                      ...(rule.ports ?? {}),
                      from_port: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field label="To">
              <Input
                type="number"
                min={0}
                max={65535}
                value={rule.ports?.to_port ?? ""}
                onChange={(e) =>
                  set({
                    ports: {
                      ...(rule.ports ?? {}),
                      to_port: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
          </div>
        )}
      </div>

      {/* Target oneof */}
      <div className="space-y-2">
        <Field label="Target">
          <Select
            value={targetKind}
            onChange={(v) =>
              set({
                _target_kind: v as TargetKind,
                cidr_blocks: v === "cidr" ? (rule.cidr_blocks ?? { v4_cidr_blocks: ["0.0.0.0/0"] }) : undefined,
                security_group_id: v === "sg" ? (rule.security_group_id ?? "") : undefined,
                predefined_target: v === "predefined" ? (rule.predefined_target ?? "self_security_group") : undefined,
              })
            }
            options={[
              { value: "cidr", label: "CIDR blocks" },
              { value: "sg", label: "Security group" },
              { value: "predefined", label: "Predefined" },
            ]}
          />
        </Field>
        {targetKind === "cidr" && (
          <CidrEditor
            v4={rule.cidr_blocks?.v4_cidr_blocks ?? []}
            v6={rule.cidr_blocks?.v6_cidr_blocks ?? []}
            onChange={(v4, v6) =>
              set({
                cidr_blocks: {
                  ...(v4.length > 0 ? { v4_cidr_blocks: v4 } : {}),
                  ...(v6.length > 0 ? { v6_cidr_blocks: v6 } : {}),
                },
              })
            }
          />
        )}
        {targetKind === "sg" && (
          <Field label="Security Group ID">
            <Input
              placeholder="UUID другой SG"
              value={rule.security_group_id ?? ""}
              onChange={(e) => set({ security_group_id: e.target.value })}
            />
          </Field>
        )}
        {targetKind === "predefined" && (
          <Field label="Predefined target">
            <Select
              value={rule.predefined_target ?? "self_security_group"}
              onChange={(v) => set({ predefined_target: v })}
              options={[
                { value: "self_security_group", label: "self_security_group" },
                { value: "loadbalancer_healthchecks", label: "loadbalancer_healthchecks" },
              ]}
            />
          </Field>
        )}
      </div>
    </div>
  );
}

function CidrEditor({
  v4,
  v6,
  onChange,
}: {
  v4: string[];
  v6: string[];
  onChange: (v4: string[], v6: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <CidrList label="IPv4 CIDRs" placeholder="0.0.0.0/0" value={v4} onChange={(next) => onChange(next, v6)} />
      <CidrList label="IPv6 CIDRs" placeholder="::/0" value={v6} onChange={(next) => onChange(v4, next)} />
    </div>
  );
}

function CidrList({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={() => onChange([...value, ""])}
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground italic">— пусто —</p>
      )}
      {value.map((cidr, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder={placeholder}
            value={cidr}
            onChange={(e) => {
              const next = [...value];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-border bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
