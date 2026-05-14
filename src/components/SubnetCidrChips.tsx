// SubnetCidrChips — controlled-вариант SubnetCidrManager для контекстов, где
// subnet ещё не существует (Create-форма). Визуально идентичен Edit-виджету
// (карточка с заголовком + chip-list + input + Add), но мутирует локальный
// state через onChange, а не вызывает :add-cidr-blocks / :remove-cidr-blocks
// verbs. Используется в InlineSubnetCreateForm.
//
// Edit-mode (subnet уже существует) → SubnetCidrManager (API).
// Create-mode (subnet ещё нет) → SubnetCidrChips (controlled).

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

type CidrKind = "v4" | "v6";

function validateCidr(kind: CidrKind, cidr: string): string | null {
  if (!cidr) return "Введите CIDR.";
  if (!cidr.includes("/")) return "CIDR должен содержать префикс (например /24).";
  if (kind === "v6" && !cidr.includes(":")) return "Похоже не на IPv6-адрес.";
  return null;
}

interface SectionProps {
  kind: CidrKind;
  blocks: string[];
  onChange: (next: string[]) => void;
}

function CidrSection({ kind, blocks, onChange }: SectionProps) {
  const [draft, setDraft] = useState("");
  const label = kind === "v4" ? "IPv4 CIDR blocks" : "IPv6 CIDR blocks";
  const placeholder = kind === "v4" ? "10.0.1.0/24" : "fd00:1234::/64";

  const onAdd = () => {
    const cidr = draft.trim();
    const err = validateCidr(kind, cidr);
    if (err) {
      toast.error(err);
      return;
    }
    if (blocks.includes(cidr)) {
      toast.error("Этот CIDR уже добавлен.");
      return;
    }
    onChange([...blocks, cidr]);
    setDraft("");
  };

  const onRemove = (cidr: string) => {
    onChange(blocks.filter((c) => c !== cidr));
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{label}</h3>
        <span className="text-xs text-muted-foreground">{blocks.length} блок(ов)</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {blocks.length === 0 && (
          <span className="text-xs text-muted-foreground italic">— пусто —</span>
        )}
        {blocks.map((cidr) => (
          <span
            key={cidr}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs font-mono"
          >
            {cidr}
            <button
              type="button"
              onClick={() => onRemove(cidr)}
              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-rose-600"
              title="Remove this CIDR"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="font-mono text-xs h-8"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAdd}
          disabled={!draft.trim()}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}

interface Props {
  v4Blocks: string[];
  onV4Change: (next: string[]) => void;
  v6Blocks: string[];
  onV6Change: (next: string[]) => void;
}

export function SubnetCidrChips({
  v4Blocks,
  onV4Change,
  v6Blocks,
  onV6Change,
}: Props) {
  return (
    <div className="space-y-3">
      <CidrSection kind="v4" blocks={v4Blocks} onChange={onV4Change} />
      <CidrSection kind="v6" blocks={v6Blocks} onChange={onV6Change} />
    </div>
  );
}
