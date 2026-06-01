// src/components/form/FormFooter.tsx
// FormFooter — единый футер Create/Edit форм: primary DopplerButton + Cancel.
// pending → pulsing + защита от double-submit. sticky=true делает футер липким
// (для длинных форм — действия всегда видны).
import { Button, Space } from "antd";
import { DopplerButton } from "@/components/DopplerButton";

interface Props {
  submitLabel: string;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  sticky?: boolean;
}

export function FormFooter({ submitLabel, submitting, onSubmit, onCancel, sticky }: Props) {
  return (
    <div
      style={
        sticky
          ? {
              position: "sticky",
              bottom: 0,
              background: "var(--card, #26272d)",
              paddingTop: 12,
              marginTop: 4,
              borderTop: "1px solid var(--border, #383941)",
              zIndex: 1,
            }
          : undefined
      }
    >
      <Space>
        <DopplerButton type="primary" onClick={onSubmit} pulsing={submitting}>
          {submitLabel}
        </DopplerButton>
        <Button onClick={onCancel} disabled={submitting}>
          Отменить
        </Button>
      </Space>
    </div>
  );
}
