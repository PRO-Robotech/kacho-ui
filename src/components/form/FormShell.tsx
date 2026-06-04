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
import { ResourceIcon } from "@/components/form/ResourceIcon";
import { PanelHeader, useDetailHeaderIcon } from "@/components/PanelHeader";

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
  // Подзаголовок-подсказка убран (лишний) — шапка формы = иконка + действие +
  // название, идентична шапке таба. subtitle оставлен как опц. override.

  // Внутри detail-страницы (есть DetailHeaderContext) форма рендерится edit-/
  // child-create-панелью в main-pane, который УЖЕ является поверхностью. Своя
  // kc-surface-карточка тут не нужна — она сдвигала бы шапку формы относительно
  // шапки таба (padding карточки) → «прыжок» иконки/названия/действия при
  // переключении таб↔форма. Embedded → без карточки, шапка ровно как у таба.
  const embedded = useDetailHeaderIcon() !== undefined;

  const header = (
    <PanelHeader
      icon={<ResourceIcon specId={specId} />}
      eyebrow={verb}
      title={heading}
      subtitle={subtitle}
    />
  );

  if (embedded) {
    return (
      <div style={{ maxWidth: FORM_WIDTH, width: "100%", margin: 0 }}>
        {header}
        {children}
      </div>
    );
  }

  return (
    // Standalone (create/edit-страница, модалка) — прижато влево, kc-surface
    // (как секции detail/list), не модалка.
    <div style={{ maxWidth: FORM_WIDTH, width: "100%", margin: 0 }}>
      <div className="kc-surface" style={{ padding: "20px 22px" }}>
        {header}
        {children}
      </div>
    </div>
  );
}
