// OperationBanner — sticky-плашка под Header для async ops feedback.
// Подписана на operationStore (см. lib/use-operation-store.ts).
// Поллит /operations/{id} каждые 1сек пока pending — на done переключает status.
// Заменяет блокирующий OperationDialog modal для Create-flow.

import { useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, X } from "lucide-react";
import { theme } from "antd";
import { useOperation } from "@/lib/use-operation";
import { operationStore, useOperationEntry } from "@/lib/use-operation-store";
import { useInvalidateResourceList } from "@/lib/use-operation";

export function OperationBanner() {
  const entry = useOperationEntry();
  const { token } = theme.useToken();
  const invalidate = useInvalidateResourceList();

  // Поллим Operation пока pending. При done — обновляем стор.
  const opId = entry?.status === "pending" ? entry.id : null;
  const { data: op } = useOperation(opId);

  useEffect(() => {
    if (!entry || entry.status !== "pending" || !op) return;
    if (!op.done) return;
    // done=true: либо success, либо error.
    if (op.error) {
      operationStore.markError(op.error.message ?? "Operation failed");
    } else {
      if (entry.resourceId) {
        invalidate(entry.resourceId, entry.folderUid ?? null);
      }
      operationStore.markDone();
    }
  }, [op, entry, invalidate]);

  if (!entry) return null;

  const palette = (() => {
    if (entry.status === "success") {
      return {
        bg: "rgba(16, 185, 129, 0.08)",
        border: "rgba(16, 185, 129, 0.4)",
        text: token.colorText,
        icon: <CheckCircle2 size={16} color="#34d399" />,
      };
    }
    if (entry.status === "error") {
      return {
        bg: "rgba(244, 63, 94, 0.08)",
        border: "rgba(244, 63, 94, 0.4)",
        text: token.colorText,
        icon: <XCircle size={16} color="#f87171" />,
      };
    }
    return {
      bg: token.colorBgElevated,
      border: token.colorBorderSecondary,
      text: token.colorText,
      icon: <Loader2 size={16} className="animate-spin" color={token.colorPrimary} />,
    };
  })();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "sticky",
        top: 48,
        zIndex: 19,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: palette.bg,
        borderBottom: `1px solid ${palette.border}`,
        color: palette.text,
        fontSize: 13,
      }}
    >
      {palette.icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 500 }}>{entry.title}</span>
        {entry.status === "pending" && (
          <span style={{ marginLeft: 8, color: token.colorTextSecondary, fontSize: 12 }}>
            операция выполняется…
          </span>
        )}
        {entry.status === "error" && entry.errorMessage && (
          <span style={{ marginLeft: 8, color: "#fca5a5", fontSize: 12 }}>
            {entry.errorMessage}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => operationStore.dismiss()}
        aria-label="Скрыть"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: 4,
          border: "none",
          background: "transparent",
          color: token.colorTextSecondary,
          cursor: "pointer",
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
