// PanelHeader — ЕДИНАЯ «шапка» секции для форм и табов detail-страниц:
//   [иконка-плитка] [eyebrow-caps?] [title] [subtitle?]            [actions?]
//   ───────────────────────────────────────────────────────────────────────
// Унифицирует вид FormShell (форма: eyebrow=Создание/Редактирование + subtitle)
// и SectionHeader (табы Обзор/JSON/Связанные/…: icon из контекста + title +
// actions). Линия снизу + фикс-высота → заголовки/линии на одном уровне.
//
// DetailHeaderContext: ResourceShell прокидывает иконку ресурса вниз, и все
// SectionHeader внутри detail-страницы получают её автоматически (без правки
// каждого call-site). Вне detail (нет провайдера) — иконки нет, graceful.
import { createContext, useContext, type ReactNode } from "react";
import { Space, Typography } from "antd";

interface DetailHeaderCtx {
  icon?: ReactNode;
}

const DetailHeaderContext = createContext<DetailHeaderCtx | null>(null);
export const DetailHeaderProvider = DetailHeaderContext.Provider;
export function useDetailHeaderIcon(): ReactNode | undefined {
  return useContext(DetailHeaderContext)?.icon;
}

const tileStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 19,
  color: "var(--kc-primary)",
  background: "linear-gradient(135deg, rgba(61,141,245,0.16), rgba(61,141,245,0.05))",
  border: "1px solid rgba(61,141,245,0.22)",
};

interface Props {
  /** Иконка ресурса (оборачивается в плитку). */
  icon?: ReactNode;
  /** Мелкая caps-надпись над заголовком (форма: «Создание»/«Редактирование»). */
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  /** Блок действий справа (кнопки, поиск, счётчик). */
  right?: ReactNode;
}

export function PanelHeader({ icon, eyebrow, title, subtitle, right }: Props) {
  const stacked = !!(eyebrow || subtitle);
  // С subtitle (3 строки) — плитку выравниваем по верху (flex-start). Без
  // subtitle (eyebrow+title) — ЦЕНТРИРУЕМ плитку и текст: текст не вылазит за
  // верх/низ плитки (плитка крупнее текстового блока). KAC-246.
  const align = subtitle ? "flex-start" : "center";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        alignItems: align,
        minHeight: 42,
        paddingBottom: 14,
        marginBottom: 18,
        borderBottom: "1px solid var(--kc-border-secondary)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          minWidth: 0,
          flex: 1,
          alignItems: align,
        }}
      >
        {icon && <div style={tileStyle}>{icon}</div>}
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--kc-primary)",
                marginBottom: 2,
              }}
            >
              {eyebrow}
            </div>
          )}
          <Typography.Title
            level={4}
            ellipsis={{ tooltip: typeof title === "string" ? title : undefined }}
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: "var(--kc-text)",
              lineHeight: stacked ? 1.3 : "42px",
            }}
          >
            {title}
          </Typography.Title>
          {subtitle && (
            <Typography.Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5, display: "block", marginTop: 4 }}>
              {subtitle}
            </Typography.Text>
          )}
        </div>
      </div>
      {right && (
        <Space size={8} wrap style={{ alignItems: "center" }}>
          {right}
        </Space>
      )}
    </div>
  );
}
