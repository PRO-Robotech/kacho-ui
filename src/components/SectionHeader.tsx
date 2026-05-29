// SectionHeader — единая «шапка» зоны 3 detail-страницы: заголовок секции
// слева + блок действий справа, с нижней границей. Используется во всех табах
// ResourceShell (Обзор → «Редактировать», связанные → «Создать», JSON и т.п.),
// чтобы action-кнопки жили в шапке, а не плавали в области контента, и имели
// единый стиль/размер.

import { type ReactNode } from "react";
import { Space, Typography } from "antd";

interface Props {
  title: ReactNode;
  /** Блок действий справа (кнопки, поиск, шестерёнка). */
  right?: ReactNode;
}

export function SectionHeader({ title, right }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        paddingBottom: 14,
        marginBottom: 18,
        borderBottom: "1px solid var(--ant-color-border-secondary)",
      }}
    >
      <Typography.Title level={4} style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>
        {title}
      </Typography.Title>
      {right && (
        <Space size={8} wrap>
          {right}
        </Space>
      )}
    </div>
  );
}
