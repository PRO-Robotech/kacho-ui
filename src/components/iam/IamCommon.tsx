// Общие хелперы для IAM-страниц: формат timestamp + copyable id + Operation
// poll-обёртка для мутаций.

import { useState, useCallback, useEffect, useRef } from "react";
import { Button, Typography, Tag, message } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { CopyOutlined } from "@ant-design/icons";
import { api, ApiError } from "@/api/client";
import { useOperation } from "@/lib/use-operation";
import { toast } from "@/lib/toast";
import type { Operation } from "@/api/types";

export function fmtTs(ts?: string): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export function CopyableMonoId({ id }: { id: string | undefined }) {
  if (!id) return <Typography.Text type="secondary">—</Typography.Text>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <code style={{ fontSize: 12, fontFamily: "monospace" }}>{id}</code>
      <Button
        size="small"
        type="text"
        icon={<CopyOutlined style={{ fontSize: 11 }} />}
        onClick={(e) => {
          e.stopPropagation();
          if (id) {
            void navigator.clipboard.writeText(id);
            void message.success("Скопировано", 1);
          }
        }}
      />
    </span>
  );
}

export function SystemTag({ isSystem }: { isSystem?: boolean }) {
  return isSystem ? (
    <Tag color="purple">system</Tag>
  ) : (
    <Tag color="default">custom</Tag>
  );
}

/**
 * useIamMutation — обёртка над POST/PATCH/DELETE мутирующего RPC + Operation polling.
 * Возвращает { run, pending, op } — run(body|path) запускает мутацию, после
 * получения operationId — peek-poll до done; на done success — invalidate
 * указанные query-keys; на done error — toast.
 *
 * opts.onSuccess — вызывается после успешной операции (после done=true && !error).
 */
export function useIamMutation(opts: {
  method: "POST" | "PATCH" | "DELETE" | "ACTION";
  path: string | ((body: unknown) => string);
  invalidateKeys: string[][];
  successText?: string;
  onSuccess?: (op: Operation) => void;
}) {
  const qc = useQueryClient();
  const [opId, setOpId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { data: op } = useOperation(opId);
  const onSuccessRef = useRef(opts.onSuccess);
  const invalidateRef = useRef(opts.invalidateKeys);
  const successTextRef = useRef(opts.successText);
  useEffect(() => {
    onSuccessRef.current = opts.onSuccess;
    invalidateRef.current = opts.invalidateKeys;
    successTextRef.current = opts.successText;
  });

  useEffect(() => {
    if (op?.done && opId) {
      if (op.error) {
        toast.error(op.error.message ?? "Operation failed");
      } else {
        if (successTextRef.current) toast.success(successTextRef.current);
        invalidateRef.current.forEach((k) => qc.invalidateQueries({ queryKey: k }));
        if (onSuccessRef.current) onSuccessRef.current(op);
      }
      setOpId(null);
      setSubmitting(false);
    }
  }, [op?.done, op?.error, opId, qc, op]);

  const run = useCallback(
    async (body?: unknown) => {
      setSubmitting(true);
      try {
        const path = typeof opts.path === "function" ? opts.path(body) : opts.path;
        let resp: { operation: Operation };
        switch (opts.method) {
          case "POST":
            resp = await api.create(path, body ?? {});
            break;
          case "PATCH":
            resp = await api.update(path, body ?? {});
            break;
          case "DELETE":
            resp = await api.delete(path);
            break;
          case "ACTION":
            resp = await api.action(path, body ?? {});
            break;
        }
        const id = resp?.operation?.id ?? null;
        if (id) {
          setOpId(id);
        } else {
          // sync — нет operation; считаем успех
          invalidateRef.current.forEach((k) => qc.invalidateQueries({ queryKey: k }));
          if (successTextRef.current) toast.success(successTextRef.current);
          setSubmitting(false);
        }
        return resp.operation;
      } catch (e) {
        const msg =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Ошибка";
        toast.error(msg);
        setSubmitting(false);
        throw e;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts.method, opts.path, qc],
  );

  return { run, op, submitting, opId };
}
