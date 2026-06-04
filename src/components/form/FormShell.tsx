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
import { PanelHeader } from "@/components/PanelHeader";

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
      {/* kc-surface — тот же стиль, что у секций detail/list-страниц (container-фон,
          secondary-border, r12, лёгкая shadow-sm). Форма читается как часть страницы,
          а не как всплывающая модалка (раньше был elevated + shadow-md + r16). */}
      <div className="kc-surface" style={{ padding: "22px 24px 20px" }}>
        {/* Единая шапка (PanelHeader) — общая с табами detail-страниц. */}
        <PanelHeader
          icon={<ResourceIcon specId={specId} />}
          eyebrow={verb}
          title={heading}
          subtitle={sub}
        />
        {children}
      </div>
    </div>
  );
}
