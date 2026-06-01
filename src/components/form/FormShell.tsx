// src/components/form/FormShell.tsx
// FormShell — единый заголовок (level=4 + ResourceIcon + verb) + контейнер тела
// Create/Edit форм. Унифицирует title между modal и page (раньше page был
// level=3 без иконки и с другим текстом). title-override опционален.
import { Typography } from "antd";
import { ResourceIcon } from "@/components/form/ResourceIcon";

interface Props {
  specId: string;
  mode: "create" | "edit";
  singular: string;
  title?: string;
  children: React.ReactNode;
}

export function FormShell({ specId, mode, singular, title, children }: Props) {
  const heading = title ?? `${mode === "create" ? "Создание" : "Редактирование"}: ${singular}`;
  return (
    <div>
      <Typography.Title
        level={4}
        style={{ margin: "0 0 16px", display: "flex", alignItems: "center", gap: 10 }}
      >
        <ResourceIcon specId={specId} />
        {heading}
      </Typography.Title>
      {children}
    </div>
  );
}
