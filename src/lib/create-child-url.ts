// KAC-102 / KAC-103: utilities для URL patterns:
//   - parent→child:  /folders/<f>/vpc/<parent>/<id>/create-<slug>  (KAC-102)
//   - top-level:     /folders/<f>/vpc/create-<slug>                (KAC-103)
//
// Slug в URL — kebab-case singular (`network`, `subnet`, `route-table`,
// `security-group`, `address`, `network-interface`). REGISTRY spec.id —
// kebab-case plural (`networks`, `subnets`, `route-tables`, ...). Маппинг —
// explicit таблица (без runtime инфлекции, чтобы избежать сюрпризов вроде
// `addresses`→`addres`).

/** Соответствие URL-slug → spec.id в REGISTRY. */
export const CREATE_CHILD_SLUGS: Record<string, string> = {
  network: "networks",
  subnet: "subnets",
  "route-table": "route-tables",
  "security-group": "security-groups",
  address: "addresses",
  "network-interface": "network-interfaces",
  gateway: "gateways",
  "private-endpoint": "private-endpoints",
};

/** Обратное соответствие spec.id → URL-slug (для построения ссылок). */
export const CREATE_CHILD_SPEC_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(CREATE_CHILD_SLUGS).map(([slug, specId]) => [specId, slug]),
);

/** Извлекает `<child-slug>` из URL pathname, если suffix `/create-<slug>` есть.
 *  Возвращает spec.id из REGISTRY или null. */
export function detectCreateChildSpecId(pathname: string): string | null {
  const m = pathname.match(/\/create-([a-z][a-z0-9-]*)$/);
  if (!m) return null;
  return CREATE_CHILD_SLUGS[m[1]] ?? null;
}

/** Строит URL для create-child от parent detail-страницы.
 *  @param parentDetailPath — `/folders/X/vpc/networks/<id>` (без `/edit`, без `/create-…`)
 *  @param childSpecId — `subnets`, `route-tables` etc. */
export function buildCreateChildUrl(
  parentDetailPath: string,
  childSpecId: string,
): string | null {
  const slug = CREATE_CHILD_SPEC_TO_SLUG[childSpecId];
  if (!slug) return null;
  return `${parentDetailPath}/create-${slug}`;
}

/** KAC-103: строит URL для top-level create в folder-scope VPC.
 *  Префикс `vpc` хардкодим, т.к. эта утилита — только для VPC ресурсов.
 *  @param folderId — id folder'а
 *  @param specId — `networks`, `subnets`, `addresses`, etc. */
export function buildTopLevelCreateUrl(
  folderId: string,
  specId: string,
): string | null {
  const slug = CREATE_CHILD_SPEC_TO_SLUG[specId];
  if (!slug) return null;
  return `/folders/${folderId}/vpc/create-${slug}`;
}
