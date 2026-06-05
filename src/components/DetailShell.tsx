// DetailShell — обёртка detail-страницы под YC look-and-feel.
//
// Layout (внутри Content; глобальный ServiceSidebar w=56 рисует Layout.tsx):
//   ┌─ Sub-pane w=240 ────────┬─ Main pane ────────────────────────────────┐
//   │  RESOURCE LABEL (caps)  │  [secondary action row]                    │
//   │  Name + status badges   │                                            │
//   │  ──────                 │  Active tab content (Обзор / IP-адреса …)  │
//   │  Tabs (vertical menu)   │                                            │
//   │                         │                                            │
//   │  ──────                 │                                            │
//   │  ДОКУМЕНТАЦИЯ           │                                            │
//   │  · ссылки               │                                            │
//   └─────────────────────────┴────────────────────────────────────────────┘
//
// Tab выбирается через ?tab=<id>. Дефолт — первый tab.

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { Menu, Typography, Badge } from "antd";
import { PanelHeader, useDetailHeaderIcon } from "@/components/PanelHeader";

// Слот в правой части строки-имени (зона 3): активный таб может «поднять» свой
// тулбар (поиск/колонки/фильтры) на уровень имени ресурса через HeaderSlotPortal.
const HeaderSlotContext = createContext<HTMLElement | null>(null);

/** Рендерит children в правый слот строки-имени (зона 3) detail-страницы.
 *  Вне DetailShell (нет слота) — graceful: ничего не рендерит. Используется
 *  related-таблицами / OperationsTab, чтобы их фильтры были на уровне имени. */
export function HeaderSlotPortal({ children }: { children: ReactNode }) {
  const el = useContext(HeaderSlotContext);
  return el ? createPortal(children, el) : null;
}

export interface DetailTab {
  id: string;
  label: string;
  count?: number;
  render: () => ReactNode;
  /** Зона-2 «действие» (eyebrow) для этого таба — НЕ обязано совпадать с label
   *  меню. Default: label. Напр. json → «Информация», связанный таб → «Список». */
  eyebrow?: string;
  /** Зона-2 заголовок (тип/название предмета таба). Default: resourceLabel
   *  (тип мастер-ресурса). Напр. связанный таб «Подсети» → plural ребёнка. */
  headerTitle?: string;
  /** Зона-2 иконка предмета таба. Default: иконка мастер-ресурса (ctxIcon).
   *  Напр. связанный таб → иконка дочернего ресурса. */
  headerIcon?: ReactNode;
}

export interface DocLink {
  label: string;
  href: string;
}

interface Props {
  resourceLabel: string;
  resourceName: string;
  badges?: ReactNode;
  tabs: DetailTab[];
  /** Опциональный ряд кнопок-secondary actions над content в main pane.
   *  Используется для domain-specific действий (Subnet «Перенести в зону» и т.п.). */
  secondaryActions?: ReactNode;
  docLinks?: DocLink[];
  defaultTab?: string;
  /** KAC-232: если задан — main pane (zone 3) рендерит это вместо контента
   *  активного таба. Используется для form-panel (edit / create связного
   *  ресурса разворачивается в правой зоне, табы остаются для контекста). */
  mainOverride?: ReactNode;
  /** KAC-233: controlled-режим табов (path-based вместо ?tab=). Когда задан
   *  `onTabSelect` — активный таб = `activeTabId`, клик по табу зовёт
   *  `onTabSelect(id)` (caller навигирует по path → уникальный URI на таб,
   *  и переключение таба выходит из form-panel). Иначе — legacy ?tab=. */
  activeTabId?: string;
  onTabSelect?: (id: string) => void;
  /** Действия рядом с именем ресурса в зоне 3 (Редактировать/Удалить/Создать). */
  nameActions?: ReactNode;
  /** Caps-eyebrow над именем (тип ресурса) — зеркалит eyebrow зоны-2 → симметрия. */
  nameEyebrow?: string;
  /** Override зоны-2 шапки (для форм edit/create: «Редактирование»/«Создание» +
   *  тип + иконка ресурса формы). Иначе eyebrow = label активного таба. */
  headerEyebrow?: string;
  headerTitle?: string;
  headerIcon?: ReactNode;
}

// Рейл табов: фиксированная ширина под самый длинный label/zone-2-заголовок
// (после сокращения route-table longest = «Сетевые интерфейсы»/«Группы
// безопасности» ≈175px@16 + иконка 42 + отступы). Жёстко пинуется (min=max),
// иначе в `min-width:max-content` обёртке длинный заголовок распирал бы aside →
// ширина рейла «прыгала» при смене таба (KAC-246).
const SUB_PANE_WIDTH = 288;

// NameDotGrid — бесток-identicon под Kachō: сетка 5×5 точек, размер/прозрачность
// каждой из hash(имя) (Linear-стиль dot-pattern). Brand cool-палитра, тон-плитка/
// радиус 1-в-1 с ContextBadge зоны-2 → вписано в стилистику.
const DOTGRID_PALETTE = [
  "#2BB5C0", // teal
  "#2D9CDB", // sky
  "#2F80ED", // blue
  "#3D8DF5", // primary
  "#4F6BF0", // royal
  "#5B7CFA", // indigo
  "#6C5CE7", // violet
  "#7B6CF6", // periwinkle
];
function dotgridHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  // avalanche — мелкое изменение имени даёт сильно иной паттерн.
  h ^= h >>> 13;
  h = (h * 0x5bd1e995) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}
const DOT_R = [1.6, 2.6, 3.8, 5.2];
function NameDotGrid({ name, size = 42 }: { name: string; size?: number }) {
  const n = dotgridHash((name || "?").trim() || "?");
  const col = DOTGRID_PALETTE[n % DOTGRID_PALETTE.length];
  const G = 5;
  const pad = 14;
  const step = (100 - 2 * pad) / (G - 1);
  const dots: Array<[number, number, number, number]> = [];
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      const v = (n >> ((y * G + x) % 30)) & 3; // 0..3 — размер/яркость точки
      const r = DOT_R[v];
      const op = v === 0 ? 0.3 : Math.min(1, 0.55 + v * 0.13);
      dots.push([pad + x * step, pad + y * step, r, op]);
    }
  }
  return (
    <div
      aria-hidden
      style={{
        // Размер/радиус/тон-плитка 1-в-1 с ContextBadge (TILE=42) зоны-2.
        width: size,
        height: size,
        borderRadius: 12,
        flexShrink: 0,
        overflow: "hidden",
        background: "rgba(61,141,245,0.08)",
        border: "1px solid rgba(61,141,245,0.20)",
        boxShadow: "var(--kc-shadow-sm)",
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block" }}>
        {dots.map(([cx, cy, r, op], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={col} fillOpacity={Number(op.toFixed(2))} />
        ))}
      </svg>
    </div>
  );
}

export function DetailShell({
  resourceLabel,
  resourceName,
  badges,
  tabs,
  secondaryActions,
  docLinks,
  defaultTab,
  mainOverride,
  activeTabId,
  onTabSelect,
  nameActions,
  nameEyebrow,
  headerEyebrow,
  headerTitle,
  headerIcon: headerIconOverride,
}: Props) {
  const ctxIcon = useDetailHeaderIcon();
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null);
  const [params, setParams] = useSearchParams();
  const fallback = defaultTab ?? tabs[0]?.id ?? "overview";
  const controlled = onTabSelect !== undefined;
  const activeId = controlled ? (activeTabId ?? fallback) : (params.get("tab") ?? fallback);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const setTab = (id: string) => {
    if (controlled) {
      onTabSelect!(id);
      return;
    }
    const next = new URLSearchParams(params);
    if (id === fallback) next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  };

  const docs = docLinks ?? DEFAULT_VPC_DOCS;

  return (
    <div
      className="kc-surface"
      style={{
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
        // Высота под viewport: header h=48 + Content padding 20+20 + small.
        // (marginTop:-8 убран — list-страница его не имеет, иначе фон прыгал
        // вверх на 8px при переходе list↔detail.)
        minHeight: "100%",
      }}
    >
      {/* KAC-246: рейл табов — часть единой detail-поверхности. Без своего
          фона/рамки/радиуса/тени; от main отделён ТОЛЬКО вертикальным
          border-secondary. «Встроен», а не «плавает». */}
      <aside
        style={{
          width: SUB_PANE_WIDTH,
          minWidth: SUB_PANE_WIDTH,
          maxWidth: SUB_PANE_WIDTH,
          flexGrow: 0,
          flexShrink: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--kc-border-secondary)",
          // padding 20 — как у list kc-surface, чтобы блок [иконка+действие+тип]
          // был на той же позиции (20,20) от kc-surface и НЕ прыгал list↔detail.
          padding: 20,
        }}
      >
        {/* Зона 2 (рейл) — ИДЕНТИЧНОСТЬ ресурса: [аватар] + ТИП(eyebrow) + имя.
            (Поменяно местами с контекстом таба, который теперь в зоне 3.) */}
        <div
          style={{
            paddingBottom: 14,
            marginBottom: 18,
            borderBottom: "1px solid var(--kc-border-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <NameDotGrid name={resourceName} />
            <div style={{ minWidth: 0 }}>
              {nameEyebrow && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--kc-primary)",
                    marginBottom: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {nameEyebrow}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {/* Размер/вес синхронизированы с ContextBadge-title зоны-3
                    (16/600/lh1.25) → типографика рейла и main идентична. */}
                <Typography.Title
                  level={3}
                  ellipsis={{ tooltip: resourceName || undefined }}
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 600,
                    lineHeight: 1.25,
                    color: "var(--kc-text)",
                  }}
                >
                  {resourceName || "(без имени)"}
                </Typography.Title>
                {badges}
              </div>
            </div>
          </div>
        </div>

        <Menu
          mode="inline"
          selectedKeys={active ? [active.id] : []}
          onClick={({ key }) => setTab(key)}
          className="kc-detail-rail-menu"
          style={{ borderRight: "none", background: "transparent" }}
          items={tabs.map((t) => ({
            key: t.id,
            label: (
              <span
                style={{
                  display: "inline-flex",
                  justifyContent: "space-between",
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <span>{t.label}</span>
                {typeof t.count === "number" && t.count > 0 && (
                  <Badge
                    count={t.count}
                    color="rgba(255,255,255,0.12)"
                    overflowCount={9999}
                  />
                )}
              </span>
            ),
          }))}
        />

        {docs.length > 0 && (
          <div
            style={{
              marginTop: "auto",
              padding: "16px 8px 8px 8px",
              borderTop: "1px solid var(--kc-border-secondary)",
            }}
          >
            <Typography.Text
              type="secondary"
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontWeight: 500,
              }}
            >
              Документация
            </Typography.Text>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "8px 0 0 0",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {docs.map((d) => (
                <li key={d.href}>
                  <Typography.Link
                    href={d.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, lineHeight: 1.4 }}
                  >
                    {d.label}
                  </Typography.Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: "20px 24px" }}>
        {/* Зона 3 (main) верх — КОНТЕКСТ активного таба: [иконка] + действие +
            тип (тот же PanelHeader, что список). Справа — слот: активный таб
            «поднимает» сюда фильтры (related-таблица / операции). Приоритеты:
            форма (Создание/Редактирование) > per-tab > дефолт. (Поменяно местами
            с блоком имени, который теперь в зоне 2 / рейле.) */}
        <PanelHeader
          icon={headerIconOverride ?? active?.headerIcon ?? ctxIcon}
          eyebrow={headerEyebrow ?? active?.eyebrow ?? active?.label}
          title={headerTitle ?? active?.headerTitle ?? resourceLabel}
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {nameActions}
              {/* Слот для фильтров активного таба. */}
              <div ref={setSlotEl} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} />
            </div>
          }
        />

        {mainOverride ? (
          mainOverride
        ) : (
          <>
            {secondaryActions && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: "1px solid var(--kc-border-secondary)",
                }}
              >
                {secondaryActions}
              </div>
            )}
            <HeaderSlotContext.Provider value={slotEl}>
              {active?.render()}
            </HeaderSlotContext.Provider>
          </>
        )}
      </main>
    </div>
  );
}

// Дефолтные ссылки для VPC ресурсов (Kachō docs; конкретные ссылки на тип
// мастер-ресурса передаёт ResourceShell через docLinks).
const DEFAULT_VPC_DOCS: DocLink[] = [
  { label: "Начать работу с сетями и подсетями", href: "#" },
  { label: "Облачные сети и подсети", href: "#" },
  { label: "Группы безопасности", href: "#" },
  { label: "Адреса облачных ресурсов", href: "#" },
  { label: "Получить статический публичный IP-адрес", href: "#" },
];
