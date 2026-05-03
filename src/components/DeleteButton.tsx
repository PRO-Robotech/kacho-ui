import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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
import { ApiError, post } from "@/api/client";

interface Props {
  endpoint: string; // POST /v1/<resource>/delete
  uid: string;
  name: string;
  resourceLabel: string; // "Network", "Instance"
  invalidateQueryKeys?: unknown[][];
  triggerLabel?: string;
  navigateTo?: () => void; // после удаления (на detail page — вернуть на список)
}

export function DeleteButton({
  endpoint,
  uid,
  name,
  resourceLabel,
  invalidateQueryKeys,
  triggerLabel,
  navigateTo,
}: Props) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => post(endpoint, { uids: [uid] }),
    onSuccess: () => {
      setErr(null);
      setOpen(false);
      (invalidateQueryKeys ?? []).forEach((k) => qc.invalidateQueries({ queryKey: k as never }));
      navigateTo?.();
    },
    onError: (e) => {
      setErr(e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4" />
          {triggerLabel ?? "Delete"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Удалить {resourceLabel}?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{name}</span>
            <br />
            <code className="text-xs text-muted-foreground">{uid}</code>
            <br />
            Действие необратимо. Запускается soft-delete (deletionTimestamp), затем
            finalizers + физическое удаление.
          </DialogDescription>
        </DialogHeader>
        {err && <div className="rounded-md bg-destructive/10 text-destructive p-2 text-xs">{err}</div>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
