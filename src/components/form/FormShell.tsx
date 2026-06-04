// src/components/form/FormShell.tsx
// FormShell — единый презентабельный «панель»-контейнер Create/Edit форм:
//   • шапка-band: градиентная иконка-плитка ресурса + caps-verb (Создание/
//     Редактирование) + заголовок (singular) + подзаголовок — по образцу
//     DeleteDialog и welcome-страницы «первый ресурс»;
//   • подложка-карточка (elevated + border + radius + shadow) поверх тёмного
//     фона (modal body / page = --kc-page), на которой лежит тело формы;
//   • единая ширина FORM_WIDTH для ВСЕХ ресурсов (modal == page == custom).
// Рендерится и generic-телом (ResourceFormBody), и кастом-формами
// (InlineSubnet/SG/NIC/AddressPool) → визуальный паритет всех форм.
// Theme-aware (--kc-*): чисто в DARK и LIGHT.
import { Typography } from "antd";
import { ResourceIcon } from "@/components/form/ResourceIcon";

/** Единый стандарт ширины формы (modal width / page maxWidth / card maxWidth). */
export const FORM_WIDTH = 820;

interface Props {
  specId: string;
  mode: "create" | "edit";
  singular: string;
  /** Override заголовка (по умолчанию — singular ресурса). */
  title?: string;
  /** Override подзаголовка (по умолчанию — generic-подсказка по mode). */
  subtitle?: string;
  children: React.ReactNode;
}

export function FormShell({ specId, mode, singular, title, subtitle, children }: Props) {
  const verb = mode === "create" ? "Создание" : "Редактирование";
  const heading = title ?? singular;
  const sub =
    subtitle ??
    (mode === "create"
      ? "Заполните параметры — ресурс будет создан после подтверждения."
      : "Измените параметры — изменения вступят в силу после сохранения.");

  return (
    // Прижато влево (margin 0, не auto) — единый отступ слева от сайдбара во
    // ВСЕХ формах: create-page, edit-page и edit-панель в зоне 3 detail.
    // Раньше margin:auto центрировал карточку → edit «уезжал» в середину зоны 3.
    <div style={{ maxWidth: FORM_WIDTH, width: "100%", margin: 0 }}>
      <div
        style={{
          background: "var(--kc-elevated)",
          border: "1px solid var(--kc-border)",
          borderRadius: 16,
          boxShadow: "var(--kc-shadow-md)",
          padding: "22px 24px 20px",
        }}
      >
        {/* ── Шапка-band: иконка-плитка + caps-verb + заголовок + подзаголовок ── */}
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            marginBottom: 20,
            paddingBottom: 18,
            borderBottom: "1px solid var(--kc-border-secondary)",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 21,
              color: "var(--kc-primary)",
              background:
                "linear-gradient(135deg, rgba(61,141,245,0.20), rgba(61,141,245,0.05))",
              border: "1px solid rgba(61,141,245,0.26)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
            }}
          >
            <ResourceIcon specId={specId} />
          </div>
          <div style={{ minWidth: 0, flex: 1, paddingTop: 1 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--kc-primary)",
              }}
            >
              {verb}
            </div>
            <Typography.Title
              level={4}
              ellipsis={{ tooltip: heading }}
              style={{ margin: "3px 0 6px", fontSize: 18, fontWeight: 600, color: "var(--kc-text)" }}
            >
              {heading}
            </Typography.Title>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 13, lineHeight: 1.5, display: "block" }}
            >
              {sub}
            </Typography.Text>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
