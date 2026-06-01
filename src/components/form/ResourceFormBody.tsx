// src/components/form/ResourceFormBody.tsx
// ResourceFormBody — ЕДИНЫЙ рендер тела Create/Edit формы ресурса. Рендерится
// и modal-шеллом (Inline*Form), и page-шеллом (ResourceCreate/EditPage), что
// даёт паритет create==edit==modal==page. Шеллы владеют state + mutation +
// Operation-flow и передают obj/onChange/lockedPaths/submit сюда.
import { Alert, Form } from "antd";
import { FormFieldRenderer } from "@/components/form/FormField";
import { FormShell } from "@/components/form/FormShell";
import { FieldLabel } from "@/components/form/FieldLabel";
import { FormFooter } from "@/components/form/FormFooter";
import { ImmutableField } from "@/components/form/ImmutableField";
import { getByPath } from "@/lib/path";
import type { ResourceSpec } from "@/lib/resource-registry";

export interface ResourceFormBodyProps {
  spec: ResourceSpec;
  mode: "create" | "edit";
  obj: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** preset/immutable paths → read-only ImmutableField. */
  lockedPaths?: Set<string>;
  /** per-field enum option narrowing (create-context). */
  fieldOptionsFilter?: Record<string, string[]>;
  /** title override (default "Создание/Редактирование: <singular>"). */
  title?: string;
  /** optional banner above the form (e.g. page-create context note). */
  notice?: React.ReactNode;
  submitLabel: string;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  /** sticky footer for tall forms. */
  stickyFooter?: boolean;
}

const FULL_WIDTH = new Set(["sg-rules", "array", "custom"]);

function matchesVisibleWhen(
  obj: Record<string, unknown>,
  vw: { field: string; equals: string | string[] } | undefined,
): boolean {
  if (!vw) return true;
  const cur = getByPath(obj, vw.field) as string | undefined;
  return Array.isArray(vw.equals) ? vw.equals.includes(cur ?? "") : cur === vw.equals;
}

function displayValue(obj: Record<string, unknown>, field: any): React.ReactNode {
  const raw = getByPath(obj, field.name);
  if (field.type === "enum" && Array.isArray(field.options)) {
    const opt = field.options.find((o: { value: string }) => o.value === raw);
    if (opt) return opt.label;
  }
  return raw == null ? "" : String(raw);
}

export function ResourceFormBody({
  spec,
  mode,
  obj,
  onChange,
  lockedPaths,
  fieldOptionsFilter,
  title,
  notice,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
  stickyFooter,
}: ResourceFormBodyProps) {
  const fields = spec.fields;
  if (!fields) {
    return (
      <Alert
        type="warning"
        message={`У ресурса ${spec.singular} нет form-schema; используйте API напрямую.`}
      />
    );
  }
  const editMode = mode === "edit";
  const locked = lockedPaths ?? new Set<string>();

  const visible = fields.filter((f) => {
    if (f.hidden) return false;
    if (editMode && (f.editHidden || (f as any).createOnly)) return false;
    return matchesVisibleWhen(obj, f.visibleWhen);
  });

  return (
    <FormShell specId={spec.id} mode={mode} singular={spec.singular} title={title}>
      {notice}
      <Form
        layout="horizontal"
        labelCol={{ flex: "200px" }}
        wrapperCol={{ flex: "auto" }}
        labelAlign="left"
        colon={false}
        size="middle"
      >
        {visible.map((f) => {
          const isLocked = locked.has(f.name) || (editMode && (f as any).immutable);
          const fullWidth = FULL_WIDTH.has(f.type as string);

          // Locked scalar/ref → read-only affordance (not hidden, not silent-disabled).
          if (isLocked && !fullWidth && f.type !== "labels") {
            return (
              <Form.Item key={f.name} label={<FieldLabel text={f.label} info={f.description} />}>
                <ImmutableField
                  value={displayValue(obj, f)}
                  reason={editMode ? "Неизменяемо после создания" : "Задано из контекста"}
                />
              </Form.Item>
            );
          }

          const allowed = fieldOptionsFilter?.[f.name];
          const field =
            allowed && f.type === "enum"
              ? {
                  ...f,
                  options: allowed
                    .map((v) => (f as any).options.find((o: { value: string }) => o.value === v))
                    .filter(Boolean),
                }
              : f;

          const inner = (
            <FormFieldRenderer
              field={field as any}
              pathPrefix=""
              value={obj}
              onChange={onChange}
              editMode={editMode}
              hideLabel={!fullWidth}
            />
          );

          if (fullWidth) {
            return (
              <Form.Item key={f.name} wrapperCol={{ offset: 0, flex: "auto" }} colon={false}>
                {inner}
              </Form.Item>
            );
          }
          return (
            <Form.Item
              key={f.name}
              label={<FieldLabel text={f.label} info={f.description} />}
              required={!!f.required}
            >
              {inner}
            </Form.Item>
          );
        })}

        <Form.Item wrapperCol={{ offset: 0, flex: "auto" }}>
          <FormFooter
            submitLabel={submitLabel}
            submitting={submitting}
            onSubmit={onSubmit}
            onCancel={onCancel}
            sticky={stickyFooter}
          />
        </Form.Item>
      </Form>
    </FormShell>
  );
}
