// src/components/form/ImmutableField.tsx
// ImmutableField — read-only отображение неизменяемого/preset-поля с affordance:
// 🔒 + tooltip-причина. Инфра-UX best-practice: пользователь видит ПОЧЕМУ поле
// нельзя править (вместо молчаливого disabled-инпута). Для scalar/ref-полей.
import { Space, Tooltip, Typography } from "antd";
import { LockOutlined } from "@ant-design/icons";

interface Props {
  value: React.ReactNode;
  /** Причина: "Неизменяемо после создания" (edit) / "Задано из контекста" (create). */
  reason: string;
}

export function ImmutableField({ value, reason }: Props) {
  const empty = value === "" || value === null || value === undefined;
  return (
    <Space size={6} align="center">
      <Typography.Text style={{ fontFamily: "monospace" }} type={empty ? "secondary" : undefined}>
        {empty ? "—" : value}
      </Typography.Text>
      <Tooltip title={reason}>
        <LockOutlined aria-label="immutable-lock" style={{ color: "var(--kc-text-tertiary)" }} />
      </Tooltip>
    </Space>
  );
}
