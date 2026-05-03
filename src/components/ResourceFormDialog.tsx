import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ApiError, post } from "@/api/client";
import { applyFieldDefaults } from "@/lib/resource-registry";
import type { FormField } from "@/lib/form-schema";

type Mode = "create" | "edit";

interface Props {
  mode: Mode;
  title: string;
  description?: string;
  endpoint: string;
  payloadKey: string;
  template: unknown;
  fields?: FormField[];
  invalidateQueryKeys?: unknown[][];
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function ResourceFormDialog({
  mode,
  title,
  description,
  endpoint,
  payloadKey,
  template,
  fields,
  invalidateQueryKeys,
  trigger,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"form" | "json">(fields ? "form" : "json");
  const [obj, setObj] = useState<Record<string, unknown>>(() => normalize(template, fields));
  const [text, setText] = useState(() => JSON.stringify(template, null, 2));
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const qc = useQueryClient();

  // При открытии — reset
  useEffect(() => {
    if (open) {
      setObj(normalize(template, fields));
      setText(JSON.stringify(template, null, 2));
      setSubmitErr(null);
      setView(fields ? "form" : "json");
    }
  }, [open, template, fields]);

  const mutation = useMutation({
    mutationFn: async (item: unknown) => {
      const body = { [payloadKey]: [item] };
      return post(endpoint, body);
    },
    onSuccess: () => {
      setSubmitErr(null);
      setOpen(false);
      (invalidateQueryKeys ?? []).forEach((key) => qc.invalidateQueries({ queryKey: key as never }));
      onSuccess?.();
    },
    onError: (err) => {
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      setSubmitErr(m);
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
    mutation.mutate(parsed);
  };

  // Sync form ↔ JSON при переключении view
  const switchView = (next: "form" | "json") => {
    if (next === view) return;
    if (next === "json") {
      // form → json
      setText(JSON.stringify(obj, null, 2));
    } else {
      // json → form
      try {
        setObj(JSON.parse(text));
      } catch {
        // если broken — оставим текущий obj
      }
    }
    setView(next);
  };

  return (
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
          <div className="rounded-md bg-destructive/10 text-destructive p-2 text-xs">{submitErr}</div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Submitting…" : mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function normalize(tpl: unknown, fields: FormField[] | undefined): Record<string, unknown> {
  const obj = (typeof tpl === "object" && tpl !== null ? { ...(tpl as Record<string, unknown>) } : {}) as Record<string, unknown>;
  return applyFieldDefaults(fields, obj);
}
