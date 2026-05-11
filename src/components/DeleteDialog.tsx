// DeleteDialog — confirm-modal с реальным DELETE и polling Operation
// прямо из диалога (Удалить-кнопка остаётся в loading-состоянии до op.done).

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Modal, Typography, Input } from "antd";
import { ApiError, api } from "@/api/client";
import { extractOperationId } from "@/components/OperationDialog";
import { useInvalidateResourceList, useOperation } from "@/lib/use-operation";
import { toast } from "@/lib/toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Полный API path: /vpc/v1/networks/<id>. */
  apiPath: string;
  /** ID ресурса в registry — для invalidate. */
  resourceId: string;
  /** Verbose имя для UI. */
  resourceLabel: string;
  name: string;
  /** Folder UID для invalidate соответствующих list-query. */
  folderUid?: string | null;
  /** Callback после успешного запуска (navigate на list etc.). */
  onSuccess?: () => void;
  /** Если true — требуется ввести имя ресурса для подтверждения. */
  requireNameConfirm?: boolean;
}

export function DeleteDialog({
  open,
  onOpenChange,
  apiPath,
  resourceId,
  resourceLabel,
  name,
  folderUid,
  onSuccess,
  requireNameConfirm,
}: Props) {
  const [confirmText, setConfirmText] = useState("");
  const invalidate = useInvalidateResourceList();
  const [pendingOpId, setPendingOpId] = useState<string | null>(null);
  const { data: op } = useOperation(pendingOpId);

  const mutation = useMutation({
    mutationFn: () => api.delete(apiPath),
    onSuccess: (resp) => {
      const opId = extractOperationId(resp);
      if (opId) {
        setPendingOpId(opId);
      } else {
        invalidate(resourceId, folderUid ?? null);
        onOpenChange(false);
        setConfirmText("");
        onSuccess?.();
      }
    },
    onError: (e) => {
      const m = e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message;
      toast.error(`Удалить ${resourceLabel} ${name}: ${m}`);
    },
  });

  useEffect(() => {
    if (!pendingOpId || !op?.done) return;
    if (op.error) {
      toast.error(`Удалить ${resourceLabel} ${name}: ${op.error.message ?? "ошибка"}`);
    } else {
      invalidate(resourceId, folderUid ?? null);
      toast.success(`${resourceLabel} ${name} удалён`);
      onSuccess?.();
    }
    setPendingOpId(null);
    onOpenChange(false);
    setConfirmText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op?.done, op?.error?.code]);

  const pending = mutation.isPending || pendingOpId !== null;
  const canConfirm = !requireNameConfirm || confirmText.trim() === name;

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (pending) return;
        onOpenChange(false);
        setConfirmText("");
      }}
      onOk={() => mutation.mutate()}
      okText="Удалить"
      okButtonProps={{
        danger: true,
        loading: pending,
        disabled: !canConfirm || pending,
      }}
      cancelButtonProps={{ disabled: pending }}
      cancelText="Отмена"
      title={`Удалить ${resourceLabel.toLowerCase()}?`}
      destroyOnClose
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Typography.Text>
          Вы уверены, что хотите удалить{" "}
          <Typography.Text strong>{name || "(без имени)"}</Typography.Text>?
          Действие необратимо.
        </Typography.Text>

        <Typography.Text code style={{ fontSize: 11, wordBreak: "break-all" }}>
          DELETE {apiPath}
        </Typography.Text>

        {requireNameConfirm && (
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Введите имя ресурса <Typography.Text code>{name}</Typography.Text> для
              подтверждения:
            </Typography.Text>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={name}
              style={{ marginTop: 6 }}
              autoFocus
            />
          </div>
        )}

      </div>
    </Modal>
  );
}
