// src/components/form/FormSection.tsx
// FormSection — группа полей с заголовком + тонким divider. Best-practice:
// разбивать инфра-форму на секции (Идентичность → Конфигурация → Сеть →
// Расширенное). collapsible+defaultOpen=false — для optional/advanced-блоков.
import { useState } from "react";
import { Typography } from "antd";
import { DownOutlined, RightOutlined } from "@ant-design/icons";

interface Props {
  title: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function FormSection({ title, collapsible, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => collapsible && setOpen((v) => !v);
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? open : undefined}
        onClick={toggle}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle();
                }
              }
            : undefined
        }
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: collapsible ? "pointer" : "default",
          margin: "4px 0 12px",
          borderBottom: "1px solid var(--border, #383941)",
          paddingBottom: 6,
        }}
      >
        {collapsible && (open ? <DownOutlined /> : <RightOutlined />)}
        <Typography.Text strong type="secondary" style={{ textTransform: "uppercase", fontSize: 12, letterSpacing: 0.4 }}>
          {title}
        </Typography.Text>
      </div>
      {open && children}
    </div>
  );
}
