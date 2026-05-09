// SubnetRelocateDialog — Move Subnet в другую зону через POST /vpc/v1/subnets/{id}:relocate.
//
// Фронт-валидация по kacho-vpc/CLAUDE.md §8.4: relocate отвергается, если
// Subnet содержит Address-ресурсы (verbatim YC: FailedPrecondition
// "Invalid subnet state"). Бэкенд это сам проверит — UI просто показывает
// результат через OperationToastWatcher.

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extractOperationId } from "@/components/OperationDialog";
import { OperationToastWatcher } from "@/components/OperationToastWatcher";
import { ApiError, api } from "@/api/client";
import { useInvalidateResourceList } from "@/lib/use-operation";
import { toast } from "@/lib/toast";

interface ZoneRow {
  id: string;
  name?: string;
  region_id?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subnetId: string;
  subnetName: string;
  currentZone: string;
  folderUid?: string | null;
}

export function SubnetRelocateDialog({
  open,
  onOpenChange,
  subnetId,
  subnetName,
  currentZone,
  folderUid,
}: Props) {
  const [targetZone, setTargetZone] = useState("");
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [opId, setOpId] = useState<string | null>(null);
  const invalidate = useInvalidateResourceList();

  const { data, isLoading } = useQuery({
    queryKey: ["zones-relocate"],
    queryFn: () => api.list<{ zones: ZoneRow[] }>("/vpc/v1/zones"),
    enabled: open,
    staleTime: 30_000,
  });

  const candidates = (data?.zones ?? []).filter((z) => z.id !== currentZone);

  const mutation = useMutation({
    mutationFn: () =>
      api.action(`/vpc/v1/subnets/${subnetId}:relocate`, { destination_zone_id: targetZone }),
    onSuccess: (resp) => {
      setSubmitErr(null);
      const id = extractOperationId(resp);
      if (id) setOpId(id);
      else {
        invalidate("subnets", folderUid ?? null);
        onOpenChange(false);
      }
    },
    onError: (err) => {
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      setSubmitErr(m);
      toast.error(`Перенос подсети ${subnetName}: ${m}`);
    },
  });

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setTargetZone("");
            setSubmitErr(null);
          }
          onOpenChange(o);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Перенести подсеть в другую зону</DialogTitle>
            <DialogDescription>
              <span className="block">
                <span className="text-muted-foreground">Подсеть: </span>
                <span className="font-medium text-foreground">{subnetName}</span>
              </span>
              <span className="block">
                <span className="text-muted-foreground">Текущая зона: </span>
                <code className="text-xs">{currentZone}</code>
              </span>
              <span className="block text-xs text-muted-foreground mt-2">
                Перенос невозможен, если в подсети уже есть IP-адреса —
                бэкенд вернёт <code>FailedPrecondition</code>.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="zone-target" className="text-sm">
              Целевая зона
            </label>
            <select
              id="zone-target"
              value={targetZone}
              onChange={(e) => setTargetZone(e.target.value)}
              disabled={isLoading || mutation.isPending || opId !== null}
              className="flex h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              <option value="">— Не выбрана —</option>
              {candidates.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.id}
                  {z.name ? ` — ${z.name}` : ""}
                </option>
              ))}
            </select>
            {isLoading && <p className="text-xs text-muted-foreground">Загрузка зон…</p>}
            {!isLoading && candidates.length === 0 && (
              <p className="text-xs text-amber-400">Нет доступных целевых зон.</p>
            )}
          </div>

          {submitErr && (
            <div className="rounded-md bg-destructive/10 text-destructive p-2 text-xs">
              {submitErr}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Отменить
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={!targetZone || mutation.isPending || opId !== null}
            >
              {mutation.isPending ? "Отправка…" : opId !== null ? "Выполнение…" : "Перенести"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OperationToastWatcher
        opId={opId}
        title={`Перенос подсети ${subnetName}`}
        onDone={(success) => {
          setOpId(null);
          invalidate("subnets", folderUid ?? null);
          if (success) onOpenChange(false);
        }}
      />
    </>
  );
}
