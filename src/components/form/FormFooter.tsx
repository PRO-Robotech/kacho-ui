// src/components/form/FormFooter.tsx
// FormFooter — единый футер Create/Edit форм: primary DopplerButton + Cancel.
// pending → pulsing + защита от double-submit. sticky=true делает футер липким
// (для длинных форм — действия всегда видны). Фон elevated (> container тела),
// верхняя граница border-secondary — футер визуально отделяется от тела.
// Theme-aware (--kc-*): чисто и в DARK, и в LIGHT.
import { Button } from "antd";
import { DopplerButton } from "@/components/DopplerButton";

interface Props {
  submitLabel: string;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  sticky?: boolean;
  /** Danger-вариант submit-кнопки (для delete-flow). По умолчанию primary. */
  danger?: boolean;
  /** Блокировка submit (например requireNameConfirm не пройден). */
  submitDisabled?: boolean;
}

export function FormFooter({
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
  sticky,
  danger,
  submitDisabled,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--kc-elevated)",
        borderTop: "1px solid var(--kc-border-secondary)",
        padding: "14px 0 2px",
        marginTop: 12,
        ...(sticky
          ? { position: "sticky", bottom: 0, zIndex: 1 }
          : null),
      }}
    >
      <DopplerButton
        type="primary"
        danger={danger}
        onClick={onSubmit}
        pulsing={submitting}
        disabled={submitDisabled}
      >
        {submitLabel}
      </DopplerButton>
      <Button onClick={onCancel} disabled={submitting}>
        Отменить
      </Button>
    </div>
  );
}
