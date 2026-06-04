// SectionHeader — «шапка» секции/таба detail-страницы: title слева + действия
// справа + нижняя линия. Унифицирована с шапкой форм через общий PanelHeader:
// иконка ресурса берётся из DetailHeaderContext (ResourceShell прокидывает её
// вниз), поэтому ВСЕ табы (Обзор / Связанные / JSON / Маршруты / SG-rules)
// получают тот же вид [иконка] + title + actions + линия, что и форма.
import { type ReactNode } from "react";
import { PanelHeader, useDetailHeaderIcon } from "@/components/PanelHeader";

interface Props {
  title: ReactNode;
  /** Блок действий справа (кнопки, поиск, шестерёнка). */
  right?: ReactNode;
}

export function SectionHeader({ title, right }: Props) {
  const icon = useDetailHeaderIcon();
  return <PanelHeader icon={icon} title={title} right={right} />;
}
