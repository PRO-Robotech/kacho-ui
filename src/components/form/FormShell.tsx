// src/components/form/FormShell.tsx
// FormShell — премиум-шапка (иконка ресурса в accent-квадрате + verb-заголовок +
// опц. описание ресурса) + тонкий divider + контейнер тела Create/Edit форм.
// Унифицирует header между modal и page. Theme-aware (--kc-*). KAC-246.
import { Typography } from "antd";
import { ResourceIcon } from "@/components/form/ResourceIcon";

interface Props {
  specId: string;
  mode: "create" | "edit";
  singular: string;
  /** Опц. короткое описание ресурса (контекст под заголовком). */
  description?: string;
  title?: string;
  children: React.ReactNode;
}

export function FormShell({ specId, mode, singular, description, title, children }: Props) {
  const heading = title ?? `${mode === "create" ? "Создание" : "Редактирование"}: ${singular}`;
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: "1px solid var(--kc-border-secondary)",
        }}
      >
        {/* Accent-квадрат с иконкой ресурса. */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: "var(--kc-primary)",
            background: "linear-gradient(135deg, rgba(61,141,245,0.18), rgba(61,141,245,0.05))",
            border: "1px solid rgba(61,141,245,0.24)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
          }}
        >
          <ResourceIcon specId={specId} />
        </div>
        <div style={{ minWidth: 0, paddingTop: 1 }}>
          <Typography.Title
            level={4}
            style={{ margin: 0, fontWeight: 600, color: "var(--kc-text)", lineHeight: 1.3 }}
          >
            {heading}
          </Typography.Title>
          {description && (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 13, lineHeight: 1.5, display: "block", marginTop: 4 }}
            >
              {description}
            </Typography.Text>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
