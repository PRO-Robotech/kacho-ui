// DeleteDialog — confirm-modal с реальным DELETE → Operation poll через
// operationStore (sticky banner). Заменяет DeleteConfirmStub.

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Modal, Typography, Alert, Input } from "antd";
import { ApiError, api } from "@/api/client";
import { extractOperationId } from "@/components/OperationDialog";
import { useInvalidateResourceList } from "@/lib/use-operation";
import { operationStore } from "@/lib/use-operation-store";
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
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const invalidate = useInvalidateResourceList();

  const mutation = useMutation({
    mutationFn: () => api.delete(apiPath),
    onSuccess: (resp) => {
      setSubmitErr(null);
      const opId = extractOperationId(resp);
      if (opId) {
        operationStore.start({
          id: opId,
          title: `Удаление ${resourceLabel.toLowerCase()} ${name}`,
          resourceId,
          folderUid: folderUid ?? null,
        });
      } else {
        invalidate(resourceId, folderUid ?? null);
      }
      onOpenChange(false);
      setConfirmText("");
      onSuccess?.();
    },
    onError: (e) => {
      const m = e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message;
      setSubmitErr(m);
      toast.error(`Удалить ${resourceLabel} ${name}: ${m}`);
    },
  });

  const canConfirm = !requireNameConfirm || confirmText.trim() === name;

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (mutation.isPending) return;
        onOpenChange(false);
        setConfirmText("");
        setSubmitErr(null);
      }}
      onOk={() => mutation.mutate()}
      okText="Удалить"
      okButtonProps={{
        danger: true,
        loading: mutation.isPending,
        disabled: !canConfirm || mutation.isPending,
      }}
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

        {submitErr && <Alert type="error" message={submitErr} />}
      </div>
    </Modal>
  );
}
