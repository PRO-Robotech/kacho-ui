// ResourceFormDialog — Create/Update ресурса через REST API.
// Create: POST /v1/<plural>  → Operation
// Update: PATCH /v1/<plural>/{id} → Operation
// После получения Operation — поллит до done=true через OperationDialog.

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Code2, FormInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { JsonEditor } from "@/components/JsonEditor";
import { FormFieldRenderer } from "@/components/form/FormField";
import { extractOperationId } from "@/components/OperationDialog";
import { OperationToastWatcher } from "@/components/OperationToastWatcher";
import { ApiError, api } from "@/api/client";
import { applyFieldDefaults } from "@/lib/resource-registry";
import { getByPath } from "@/lib/path";
import { useInvalidateResourceList } from "@/lib/use-operation";
import { toast } from "@/lib/toast";
import type { FormField } from "@/lib/form-schema";

type Mode = "create" | "edit";

interface Props {
  mode: Mode;
  title: string;
  description?: string;
  /** Для create: /<domain>/v1/<plural> ; для edit: /<domain>/v1/<plural>/{id} */
  apiPath: string;
  /** ID ресурса в registry — для инвалидации query-кэша */
  resourceId: string;
  template: unknown;
  fields?: FormField[];
  folderUid?: string | null;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  /** Опциональная нормализация payload перед отправкой (sanitize из ResourceSpec). */
  sanitize?: (obj: Record<string, unknown>) => Record<string, unknown>;
}

export function ResourceFormDialog({
  mode,
  title,
  description,
  apiPath,
  resourceId,
  template,
  fields,
  folderUid,
  trigger,
  onSuccess,
  sanitize,
}: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"form" | "json">(fields ? "form" : "json");
  const [obj, setObj] = useState<Record<string, unknown>>(() => normalize(template, fields));
  const [text, setText] = useState(() => JSON.stringify(template, null, 2));
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [opId, setOpId] = useState<string | null>(null);

  const invalidate = useInvalidateResourceList();

  // Snapshot template/fields в ref — иначе polling parent-страницы переcоздаёт
  // template prop каждые 3 сек, useEffect видит "изменение" и обнуляет форму
  // прямо во время ввода. Reset делаем только когда диалог open false→true.
  const snapshotRef = useRef({ template, fields });
  snapshotRef.current = { template, fields };

  // В edit-режиме — снимок оригинала на момент открытия для diff'а update_mask.
  // Backend без mask делает full-replace mutable полей: если в body какое-то ref-
  // поле прилетит как "" / отсутствует, оно сотрётся. Mask указывает, какие
  // поля реально менять (verbatim YC семантика PATCH).
  const originalRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (open) {
      const snap = snapshotRef.current;
      setObj(normalize(snap.template, snap.fields));
      setText(JSON.stringify(snap.template, null, 2));
      setSubmitErr(null);
      setOpId(null);
      setView(snap.fields ? "form" : "json");
      originalRef.current =
        mode === "edit" && typeof snap.template === "object" && snap.template !== null
          ? (snap.template as Record<string, unknown>)
          : null;
    }
    // ВАЖНО: только [open] — НЕ template/fields, иначе reset при каждом polling-update.
  }, [open, mode]);

  const mutation = useMutation({
    mutationFn: async (item: unknown) => {
      if (mode === "create") {
        return api.create(apiPath, item);
      } else {
        return api.update(apiPath, item);
      }
    },
    onSuccess: (resp) => {
      setSubmitErr(null);
      // НЕ закрываем форму немедленно — ждём done операции.
      // OperationToastWatcher вызовет onDone(success): закроем форму
      // только при success; при error форма остаётся открытой чтобы пользователь
      // мог поправить значения и попробовать снова.
      const id = extractOperationId(resp);
      if (id) {
        setOpId(id);
      } else {
        // Backend не вернул Operation — синхронный success: закрываем.
        setOpen(false);
        invalidate(resourceId, folderUid ?? null);
        onSuccess?.();
      }
    },
    onError: (err) => {
      // Submit-уровневая ошибка (network / 4xx / 5xx до создания Operation) —
      // показываем сразу прямо в форме, форма НЕ закрывается.
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      setSubmitErr(m);
      toast.error(`${title}: ${m}`);
    },
  });

  const submit = () => {
    setSubmitErr(null);
    let parsed: unknown;
    if (view === "form") {
      parsed = obj;
    } else {
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        setSubmitErr(`JSON parse: ${(e as Error).message}`);
        return;
      }
    }
    // Применяем sanitize (oneof strip, array flatten и т.д.)
    if (sanitize && typeof parsed === "object" && parsed !== null) {
      parsed = sanitize(parsed as Record<string, unknown>);
    }

    // Edit: вычисляем update_mask = поля spec.fields, реально изменившиеся
    // относительно snapshot. Без mask backend делает full-replace mutable
    // (см. applySubnetMask и т.п.) и стирает не-переданные ссылки.
    if (
      mode === "edit" &&
      originalRef.current &&
      fields &&
      typeof parsed === "object" &&
      parsed !== null
    ) {
      const mask = computeUpdateMask(originalRef.current, parsed as Record<string, unknown>, fields);
      if (mask.length === 0) {
        // Нет изменений — закрываем без вызова PATCH, чтобы не плодить пустые operations.
        setOpen(false);
        return;
      }
      // proto3 JSON mapping для FieldMask: comma-separated camelCase string
      // (см. https://protobuf.dev/programming-guides/proto3/#json — FieldMask).
      // Объектная форма {paths:[...]} НЕ принимается protojson grpc-gateway-ем
      // (вылетает `proto: syntax error … unexpected token {`).
      parsed = {
        ...(parsed as Record<string, unknown>),
        update_mask: mask.map(snakeToCamelPath).join(","),
      };
    }

    mutation.mutate(parsed);
  };

  const switchView = (next: "form" | "json") => {
    if (next === view) return;
    if (next === "json") {
      setText(JSON.stringify(obj, null, 2));
    } else {
      try {
        setObj(JSON.parse(text));
      } catch {
        // если broken — оставим текущий obj
      }
    }
    setView(next);
  };

  const opTitle = mode === "create"
    ? `Creating ${title.replace("Create ", "")}`
    : `Updating ${title.replace("Edit ", "")}`;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant={mode === "create" ? "default" : "outline"} size="sm">
              {mode === "create" ? (
                <>
                  <Plus className="h-4 w-4" /> Create
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" /> Edit
                </>
              )}
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>{title}</DialogTitle>
                {description && <DialogDescription>{description}</DialogDescription>}
              </div>
              {fields && (
                <div className="inline-flex items-center rounded-md border border-border p-0.5">
                  <Button
                    type="button"
                    variant={view === "form" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => switchView("form")}
                  >
                    <FormInput className="h-3.5 w-3.5" /> Form
                  </Button>
                  <Button
                    type="button"
                    variant={view === "json" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => switchView("json")}
                  >
                    <Code2 className="h-3.5 w-3.5" /> JSON
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {view === "form" && fields ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {fields.map((f) => (
                <FormFieldRenderer
                  key={f.name}
                  field={f}
                  pathPrefix=""
                  value={obj}
                  onChange={setObj}
                  editMode={mode === "edit"}
                />
              ))}
            </div>
          ) : (
            <JsonEditor value={text} onChange={setText} rows={18} />
          )}

          {submitErr && (
            <div className="rounded-md bg-destructive/10 text-destructive p-2 text-xs">
              {submitErr}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={mutation.isPending || opId !== null}>
              {mutation.isPending
                ? "Отправка…"
                : opId !== null
                ? "Выполнение…"
                : mode === "create"
                ? "Create"
                : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
        OperationToastWatcher живёт пока opId != null: показывает loading-toast,
        обновляет его на success/error по результату polling /operations/{id}.
        Форма уже закрыта — пользователь видит только toast.
      */}
      <OperationToastWatcher
        opId={opId}
        title={opTitle}
        onDone={(success) => {
          setOpId(null);
          invalidate(resourceId, folderUid ?? null);
          if (success) {
            setOpen(false);
            onSuccess?.();
          }
          // При error форма остаётся открытой; пользователь правит поля и шлёт заново.
        }}
      />
    </>
  );
}

function normalize(tpl: unknown, fields: FormField[] | undefined): Record<string, unknown> {
  const obj =
    typeof tpl === "object" && tpl !== null
      ? { ...(tpl as Record<string, unknown>) }
      : ({} as Record<string, unknown>);
  return applyFieldDefaults(fields, obj);
}

// Возвращает proto-paths полей spec.fields, чьи значения отличаются от
// snapshot оригинала. Hidden и UI-internal (`_*`) поля исключаются.
// Сравнение через JSON.stringify — достаточно для primitives/arrays/maps,
// которые всегда возвращаются API в стабильном порядке (ключи snake_case).
//
// Экспортирована для тестов (regress-guard от потери ссылок при PATCH).
export function computeUpdateMask(
  original: Record<string, unknown>,
  current: Record<string, unknown>,
  fields: FormField[],
): string[] {
  const out: string[] = [];
  for (const f of fields) {
    if (f.hidden) continue;
    if (f.immutable) continue; // backend reject через update_mask, и мы не пытаемся
    if (f.name.startsWith("_")) continue;
    const o = getByPath(original, f.name);
    const c = getByPath(current, f.name);
    if (JSON.stringify(o) !== JSON.stringify(c)) out.push(f.name);
  }
  return out;
}

// snake_case → camelCase для FieldMask path. Поддерживает dotted-pathи
// (`external_ipv4_address_spec.zone_id` → `externalIpv4AddressSpec.zoneId`):
// regex `_x` → `X` точку не трогает.
//
// Экспортирована для тестов.
export function snakeToCamelPath(p: string): string {
  return p.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
