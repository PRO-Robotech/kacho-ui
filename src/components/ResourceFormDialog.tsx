import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ApiError, post } from "@/api/client";
import { Plus, Pencil } from "lucide-react";

type Mode = "create" | "edit";

interface Props {
  mode: Mode;
  title: string;
  description?: string;
  endpoint: string; // POST /v1/<resource>/upsert
  payloadKey: string; // ключ массива в payload: e.g. "networks", "instances"
  template: unknown; // skeleton JSON показываемый в editor для create / current value для edit
  invalidateQueryKeys?: unknown[][];
  trigger?: React.ReactNode; // override default trigger button
  onSuccess?: () => void;
}

export function ResourceFormDialog({
  mode,
  title,
  description,
  endpoint,
  payloadKey,
  template,
  invalidateQueryKeys,
  trigger,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(template, null, 2));
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const qc = useQueryClient();

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
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setSubmitErr(`JSON parse: ${(e as Error).message}`);
      return;
    }
    mutation.mutate(parsed);
  };

  const reset = () => {
    setText(JSON.stringify(template, null, 2));
    setSubmitErr(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <JsonEditor value={text} onChange={setText} rows={18} />
        {submitErr && (
          <div className="rounded-md bg-destructive/10 text-destructive p-2 text-xs">{submitErr}</div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="outline" onClick={reset} disabled={mutation.isPending}>
            Reset
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Submitting…" : mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
