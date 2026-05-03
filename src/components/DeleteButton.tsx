// DeleteButton — DELETE /v1/<plural>/{id} → Operation → poll до done.

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { OperationDialog, extractOperationId } from "@/components/OperationDialog";
import { ApiError, api } from "@/api/client";
import { useInvalidateResourceList } from "@/lib/use-operation";

interface Props {
  /** /v1/<plural>/{id} */
  apiPath: string;
  /** ID ресурса в registry — для инвалидации кэша */
  resourceId: string;
  name: string;
  resourceLabel: string;
  folderUid?: string | null;
  triggerLabel?: string;
  /** После успешного удаления (например, navigate на список) */
  navigateTo?: () => void;
}

export function DeleteButton({
  apiPath,
  resourceId,
  name,
  resourceLabel,
  folderUid,
  triggerLabel,
  navigateTo,
}: Props) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [opId, setOpId] = useState<string | null>(null);

  const invalidate = useInvalidateResourceList();

  const mutation = useMutation({
    mutationFn: () => api.delete(apiPath),
    onSuccess: (resp) => {
      setErr(null);
      setOpen(false);
      const id = extractOperationId(resp);
      if (id) {
        setOpId(id);
      } else {
        handleAfterDelete();
      }
    },
    onError: (e) => {
      setErr(e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message);
    },
  });

  const handleAfterDelete = useCallback(() => {
    invalidate(resourceId, folderUid ?? null);
    navigateTo?.();
  }, [invalidate, resourceId, folderUid, navigateTo]);

  const handleOperationSuccess = useCallback(() => {
    setOpId(null);
    handleAfterDelete();
  }, [handleAfterDelete]);

  const handleOperationClose = useCallback(() => {
    setOpId(null);
    invalidate(resourceId, folderUid ?? null);
  }, [invalidate, resourceId, folderUid]);

  return (
    <>
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
              <code className="text-xs text-muted-foreground">{apiPath}</code>
              <br />
              Действие необратимо.
            </DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 text-destructive p-2 text-xs">
              {err}
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

      <OperationDialog
        opId={opId}
        title={`Deleting ${resourceLabel}`}
        onSuccess={handleOperationSuccess}
        onClose={handleOperationClose}
      />
    </>
  );
}
