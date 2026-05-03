// ResourceFormDialog — Create/Update ресурса через REST API.
// Create: POST /v1/<plural>  → Operation
// Update: PATCH /v1/<plural>/{id} → Operation
// После получения Operation — поллит до done=true через OperationDialog.

import { useCallback, useEffect, useState } from "react";
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
import { OperationDialog, extractOperationId } from "@/components/OperationDialog";
import { ApiError, api } from "@/api/client";
import { applyFieldDefaults } from "@/lib/resource-registry";
import { useInvalidateResourceList } from "@/lib/use-operation";
import type { FormField } from "@/lib/form-schema";

type Mode = "create" | "edit";

interface Props {
  mode: Mode;
  title: string;
  description?: string;
  /** Для create: /v1/<plural> ; для edit: /v1/<plural>/{id} */
  apiPath: string;
  /** ID ресурса в registry — для инвалидации query-кэша */
  resourceId: string;
  template: unknown;
  fields?: FormField[];
  folderUid?: string | null;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
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
}: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"form" | "json">(fields ? "form" : "json");
  const [obj, setObj] = useState<Record<string, unknown>>(() => normalize(template, fields));
  const [text, setText] = useState(() => JSON.stringify(template, null, 2));
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [opId, setOpId] = useState<string | null>(null);

  const invalidate = useInvalidateResourceList();

  // При открытии — reset
  useEffect(() => {
    if (open) {
      setObj(normalize(template, fields));
      setText(JSON.stringify(template, null, 2));
      setSubmitErr(null);
      setOpId(null);
      setView(fields ? "form" : "json");
    }
  }, [open, template, fields]);

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
      const id = extractOperationId(resp);
      if (id) {
        setOpId(id);
      } else {
        // Если backend не вернул operation — закрываем сразу
        handleOperationSuccess();
      }
    },
    onError: (err) => {
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      setSubmitErr(m);
    },
  });

  const handleOperationSuccess = useCallback(() => {
    setOpId(null);
    setOpen(false);
    invalidate(resourceId, folderUid ?? null);
    onSuccess?.();
  }, [invalidate, resourceId, folderUid, onSuccess]);

  const handleOperationClose = useCallback(() => {
    setOpId(null);
    // Инвалидируем в любом случае — операция могла частично выполниться
    invalidate(resourceId, folderUid ?? null);
  }, [invalidate, resourceId, folderUid]);

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
            <Button onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending
                ? "Отправка…"
                : mode === "create"
                ? "Create"
                : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OperationDialog
        opId={opId}
        title={opTitle}
        onSuccess={handleOperationSuccess}
        onClose={handleOperationClose}
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
