import { useId } from "react";
import { Trash2, Plus } from "lucide-react";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefSelect } from "@/components/form/RefSelect";
import { SgRulesEditor } from "@/components/form/SgRulesEditor";
import { LabelsEditor } from "@/components/form/LabelsEditor";
import { getByPath, setByPath, deleteByPath } from "@/lib/path";
import type { FormField as FF, ArrayField } from "@/lib/form-schema";

interface Props {
  field: FF;
  // pathPrefix — родительский путь, например "spec.rules[0]"; пустая строка для top-level
  pathPrefix: string;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  // В Edit-режиме поля с `immutable: true` рендерятся disabled.
  // В Create — игнорируется.
  editMode?: boolean;
}

function fullPath(prefix: string, name: string): string {
  if (!prefix) return name;
  return `${prefix}.${name}`;
}

export function FormFieldRenderer({ field, pathPrefix, value, onChange, editMode }: Props) {
  if (field.hidden) return null;
  if (editMode && field.editHidden) return null;
  if (field.visibleWhen) {
    // visibleWhen.field — всегда top-level path (oneof discriminator живёт у корня формы).
    const cur = getByPath(value, field.visibleWhen.field) as string | undefined;
    const want = field.visibleWhen.equals;
    const matched = Array.isArray(want) ? want.includes(cur ?? "") : cur === want;
    if (!matched) return null;
  }
  const disabled = !!(field.immutable && editMode);
  if (field.type === "array") return <ArrayFieldRenderer field={field} pathPrefix={pathPrefix} value={value} onChange={onChange} editMode={editMode} disabled={disabled} />;
  if (field.type === "sg-rules") {
    const path = pathPrefix ? `${pathPrefix}.${field.name}` : field.name;
    return (
      <SgRulesEditor
        pathPrefix={pathPrefix}
        value={value}
        onChange={onChange}
        path={path}
        description={field.description}
      />
    );
  }
  if (field.type === "labels") {
    const path = pathPrefix ? `${pathPrefix}.${field.name}` : field.name;
    return (
      <LabelsEditor
        pathPrefix={pathPrefix}
        value={value}
        onChange={onChange}
        path={path}
        label={field.label}
        description={field.description}
        disabled={disabled}
      />
    );
  }
  return <ScalarFieldRenderer field={field} pathPrefix={pathPrefix} value={value} onChange={onChange} disabled={disabled} />;
}

function ScalarFieldRenderer({ field, pathPrefix, value, onChange, disabled }: Props & { disabled?: boolean }) {
  const id = useId();
  const path = fullPath(pathPrefix, field.name);
  const cur = getByPath(value, path);

  const set = (v: unknown) => onChange(setByPath(value, path, v));

  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        required={field.required}
        description={
          disabled
            ? `${field.description ? field.description + " " : ""}(immutable после Create)`
            : field.description
        }
      >
        {field.label}
      </Label>
      {field.type === "string" && (
        <Input
          id={id}
          value={(cur as string | undefined) ?? ""}
          onChange={(e) => set(e.target.value)}
          placeholder={field.placeholder}
          pattern={field.pattern}
          disabled={disabled}
        />
      )}
      {field.type === "text" && (
        <Textarea
          id={id}
          value={(cur as string | undefined) ?? ""}
          onChange={(e) => set(e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows ?? 3}
          disabled={disabled}
        />
      )}
      {field.type === "int" && (
        <Input
          id={id}
          type="number"
          value={cur === undefined || cur === null ? "" : String(cur)}
          onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))}
          min={field.min}
          max={field.max}
          disabled={disabled}
        />
      )}
      {field.type === "bool" && (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(cur ?? field.default)}
            onChange={(e) => set(e.target.checked)}
            className="h-4 w-4 rounded border-border"
            disabled={disabled}
          />
          <label htmlFor={id} className="text-sm">{field.label}</label>
        </div>
      )}
      {field.type === "enum" && (
        <select
          id={id}
          value={(cur as string | undefined) ?? ""}
          onChange={(e) => set(e.target.value || undefined)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
        >
          <option value="">— Не выбрано —</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {field.type === "ref" && (
        <RefSelect
          id={id}
          refResource={field.refResource}
          refFolderScoped={field.refFolderScoped}
          value={cur as string | undefined}
          onChange={(uid) => set(uid || undefined)}
          placeholder={field.placeholder}
          disabled={disabled}
          refQueryFromField={field.refQueryFromField}
          formValue={value}
          createResource={field.createResource}
          createPresetFields={field.createPresetFields}
          createTitle={field.createTitle}
        />
      )}
    </div>
  );
}

function ArrayFieldRenderer({ field, pathPrefix, value, onChange, editMode, disabled }: { field: ArrayField; disabled?: boolean } & Omit<Props, "field">) {
  const path = fullPath(pathPrefix, field.name);
  const items = (getByPath(value, path) as Record<string, unknown>[] | undefined) ?? [];

  const add = () => {
    const next = [...items, field.newItem ? field.newItem() : {}];
    onChange(setByPath(value, path, next));
  };

  const removeAt = (idx: number) => {
    onChange(deleteByPath(value, `${path}[${idx}]`));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label
          description={
            disabled
              ? `${field.description ? field.description + " " : ""}(immutable после Create — управляется отдельным action)`
              : field.description
          }
          required={field.required}
        >
          {field.label}
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled}>
          <Plus className="h-4 w-4" /> Добавить {field.itemLabel}
        </Button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Пусто. Нажмите «Добавить {field.itemLabel}».</p>
      )}
      <div className="space-y-3">
        {items.map((_, idx) => (
          <div
            key={idx}
            className={`rounded-md border border-border p-3 space-y-3 bg-muted/20 ${disabled ? "opacity-60 pointer-events-none" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {field.itemLabel} #{idx + 1}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeAt(idx)} disabled={disabled}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {field.itemFields.map((sub) => (
              <FormFieldRenderer
                key={sub.name}
                field={sub}
                pathPrefix={`${path}[${idx}]`}
                value={value}
                onChange={onChange}
                editMode={editMode}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
