// FormArchitecturePanel — «Live Architecture» (KAC-246). Эксклюзивная правая
// панель формы создания: вместо статичного списка плана — ЖИВОЙ визуальный
// холст того, что создаётся, обновляющийся по мере ввода полей.
//
// Ветвится по spec.id:
//   • "subnets"  → CIDR-линейка: диапазон родительской сети + существующие
//                  подсети (серые сегменты) + новая подсеть (accent / красный
//                  при overlap / вне диапазона). Killer-фича.
//   • "networks" → узел-карточка сети + chips CIDR + приглушённый узел
//                  «+ Группа безопасности по умолчанию».
//   • иначе      → generic «План» (PlanList) — что будет создано + live-checks
//                  + счётчик (поведение прежнего FormPlanPanel сохранено).
//
// Панель — read-only визуализация по `obj`. НЕ влияет на форму/валидацию/submit.
// Theme-aware (--kc-* + antd-token). Визуал тестами не покрывается; CIDR-
// математика — cidr.ts/cidr.test.ts.
import { theme, Tag, Typography } from "antd";
import { CheckCircleFilled } from "@ant-design/icons";
import { ResourceIcon } from "@/components/form/ResourceIcon";
import { createPlan } from "@/lib/create-plan";
import { getByPath } from "@/lib/path";
import { useResourceList } from "@/lib/use-resource-list";
import { useProjectStore } from "@/lib/context-store";
import { REGISTRY, type ResourceSpec } from "@/lib/resource-registry";
import { parseCidr4, overlaps, contains, relativePos, type Cidr4 } from "@/lib/cidr";

interface Props {
  spec: ResourceSpec;
  obj: Record<string, unknown>;
}

const PANEL_WIDTH = 300;

// ── Shell (общая карточка-поверхность) ────────────────────────────────────────

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        flexShrink: 0,
        width: PANEL_WIDTH,
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        background: "var(--kc-container)",
        border: "1px solid var(--kc-border-secondary)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <span
        style={{
          textTransform: "uppercase",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: "var(--kc-text-tertiary)",
        }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

// ── Generic «План» (поведение прежнего FormPlanPanel) ─────────────────────────

function plural(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "ресурсов";
  const mod10 = n % 10;
  if (mod10 === 1) return "ресурс";
  if (mod10 >= 2 && mod10 <= 4) return "ресурса";
  return "ресурсов";
}

function nonEmpty(obj: Record<string, unknown>, path: string): boolean {
  const v = getByPath(obj, path);
  return typeof v === "string" ? v.trim() !== "" : v != null && v !== "";
}

function checks(spec: ResourceSpec, obj: Record<string, unknown>) {
  const out: { ok: boolean; doneText: string; todoText: string }[] = [];
  out.push({ ok: nonEmpty(obj, "name"), doneText: "Имя задано", todoText: "Укажите имя" });
  const fieldNames = new Set((spec.fields ?? []).map((f) => f.name));
  if (fieldNames.has("network_id")) {
    out.push({ ok: nonEmpty(obj, "network_id"), doneText: "Сеть выбрана", todoText: "Выберите сеть" });
  }
  if (fieldNames.has("subnet_id")) {
    out.push({ ok: nonEmpty(obj, "subnet_id"), doneText: "Подсеть выбрана", todoText: "Выберите подсеть" });
  }
  return out;
}

function PlanList({ spec, obj }: Props) {
  const { token } = theme.useToken();
  const plan = createPlan(spec, obj);
  const liveChecks = checks(spec, obj);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Typography.Text style={{ fontSize: 12, color: "var(--kc-text-secondary)" }}>
          Будет создано:
        </Typography.Text>
        {plan.items.map((item, i) => {
          const sideEffect = item.kind === "side-effect";
          return (
            <div
              key={`${item.specId}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                lineHeight: 1.35,
                color: sideEffect ? "var(--kc-text-secondary)" : "var(--kc-text)",
              }}
            >
              <span style={{ display: "inline-flex", fontSize: 14, lineHeight: 0, color: "var(--kc-primary)" }}>
                <ResourceIcon specId={item.specId} />
              </span>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {sideEffect ? "+ " : ""}
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {liveChecks.map((c, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              color: c.ok ? token.colorSuccess : "var(--kc-text-tertiary)",
            }}
          >
            {c.ok ? (
              <CheckCircleFilled style={{ fontSize: 12, color: token.colorSuccess }} />
            ) : (
              <span
                aria-hidden
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  border: "1.5px solid var(--kc-text-tertiary)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
            )}
            <span>{c.ok ? c.doneText : c.todoText}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 2,
          paddingTop: 12,
          borderTop: "1px solid var(--kc-border-secondary)",
          fontSize: 12.5,
          color: "var(--kc-text-secondary)",
        }}
      >
        Создаётся{" "}
        <Typography.Text strong style={{ color: "var(--kc-text)", fontSize: 12.5 }}>
          {plan.count}
        </Typography.Text>{" "}
        {plural(plan.count)}
      </div>
    </>
  );
}

// ── Network: узел-карточка ────────────────────────────────────────────────────

function NetworkNode({ obj }: { obj: Record<string, unknown> }) {
  const rawName = typeof obj.name === "string" ? obj.name.trim() : "";
  const name = rawName === "" ? "(без имени)" : rawName;
  const cidrs = Array.isArray(obj.ipv4_cidr_blocks)
    ? (obj.ipv4_cidr_blocks as unknown[]).filter((c): c is string => typeof c === "string" && c !== "")
    : [];
  // Network.Create всегда создаёт default-SG (см. create-plan SIDE_EFFECTS).
  const sgSpec = REGISTRY["security-groups"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Узел сети */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "var(--kc-hover-fill)",
          border: "1px solid var(--kc-border-secondary)",
          borderRadius: 8,
          padding: "10px 12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", fontSize: 15, lineHeight: 0, color: "var(--kc-primary)" }}>
            <ResourceIcon specId="networks" />
          </span>
          <Typography.Text
            strong
            style={{ color: "var(--kc-text)", fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            Сеть «{name}»
          </Typography.Text>
        </div>
        {cidrs.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {cidrs.map((c) => (
              <Tag key={c} color="blue" style={{ fontFamily: "monospace", fontSize: 11, margin: 0 }}>
                {c}
              </Tag>
            ))}
          </div>
        )}
      </div>

      {/* Соединение «└» + узел default-SG (приглушённый) */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 0, paddingLeft: 14 }}>
        <span
          aria-hidden
          style={{
            color: "var(--kc-text-tertiary)",
            fontSize: 13,
            lineHeight: "20px",
            fontFamily: "monospace",
            paddingTop: 6,
          }}
        >
          └
        </span>
        <div
          style={{
            marginTop: 6,
            marginLeft: 6,
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: "1px dashed var(--kc-border-secondary)",
            borderRadius: 8,
            padding: "8px 10px",
          }}
        >
          <span style={{ display: "inline-flex", fontSize: 14, lineHeight: 0, color: "var(--kc-text-tertiary)" }}>
            {sgSpec ? <ResourceIcon specId="security-groups" /> : null}
          </span>
          <Typography.Text style={{ color: "var(--kc-text-secondary)", fontSize: 12.5 }}>
            + Группа безопасности по умолчанию
          </Typography.Text>
        </div>
      </div>
    </div>
  );
}

// ── Subnet: CIDR-линейка (killer-фича) ────────────────────────────────────────

function firstCidrString(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (typeof item === "string" && item !== "") return item;
    if (item && typeof item === "object" && "value" in (item as object)) {
      const v = (item as Record<string, unknown>).value;
      if (typeof v === "string" && v !== "") return v;
    }
  }
  return null;
}

function SubnetRuler({ obj }: { obj: Record<string, unknown> }) {
  const { token } = theme.useToken();
  const projectId = useProjectStore((s) => s.project?.id ?? null);
  const networkId = typeof obj.network_id === "string" ? obj.network_id : "";

  const networksSpec = REGISTRY["networks"];
  const subnetsSpec = REGISTRY["subnets"];

  // Родительская сеть — список сетей проекта (находим по id).
  const networksQ = useResourceList(networksSpec, "project_id", projectId);
  // Существующие подсети этой сети.
  const subnetsQ = useResourceList(subnetsSpec, "network_id", networkId || null);

  const networks =
    (networksQ.data?.[networksSpec.payloadKey] as Record<string, unknown>[] | undefined) ?? [];
  const parentNet = networks.find((n) => n.id === networkId);
  const parentCidrStr = parentNet ? firstCidrString(parentNet.ipv4_cidr_blocks) : null;
  const parentCidr = parentCidrStr ? parseCidr4(parentCidrStr) : null;

  const existingSubnets =
    (subnetsQ.data?.[subnetsSpec.payloadKey] as Record<string, unknown>[] | undefined) ?? [];
  const existing: { cidr: Cidr4; str: string }[] = [];
  for (const s of existingSubnets) {
    const str = firstCidrString(s.v4_cidr_blocks);
    const c = str ? parseCidr4(str) : null;
    if (c && str) existing.push({ cidr: c, str });
  }

  const newCidrStr = firstCidrString(obj.v4_cidr_blocks);
  const newCidr = newCidrStr ? parseCidr4(newCidrStr) : null;

  // Валидация новой подсети относительно сети + соседей.
  let overlapWith: string | null = null;
  let outOfRange = false;
  if (newCidr && parentCidr) {
    if (!contains(parentCidr, newCidr)) outOfRange = true;
    for (const e of existing) {
      if (overlaps(newCidr, e.cidr)) {
        overlapWith = e.str;
        break;
      }
    }
  }
  const newIsBad = !!newCidr && (outOfRange || overlapWith !== null);

  // Статус-строка.
  let status: { text: string; color: string };
  if (!parentCidr || !newCidr) {
    status = { text: "○ Укажите сеть и CIDR", color: "var(--kc-text-tertiary)" };
  } else if (overlapWith) {
    status = { text: `⚠ Пересекается с ${overlapWith}`, color: token.colorError };
  } else if (outOfRange) {
    status = { text: `⚠ Вне диапазона сети ${parentCidrStr}`, color: token.colorError };
  } else {
    status = { text: "✓ Без пересечений, в диапазоне сети", color: token.colorSuccess };
  }

  // Геометрия сегментов на линейке (доли 0..1, кламп в [0,1]).
  const seg = (c: Cidr4) => {
    if (!parentCidr) return null;
    const { left, width } = relativePos(parentCidr, c);
    const l = Math.max(0, Math.min(1, left));
    const r = Math.max(0, Math.min(1, left + width));
    return { leftPct: l * 100, widthPct: Math.max(0, r - l) * 100 };
  };

  const newSeg = newCidr ? seg(newCidr) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Линейка */}
      <div
        style={{
          position: "relative",
          height: 30,
          width: "100%",
          background: "var(--kc-hover-fill)",
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid var(--kc-border-secondary)",
        }}
      >
        {parentCidr &&
          existing.map((e, i) => {
            const s = seg(e.cidr);
            if (!s || s.widthPct <= 0) return null;
            return (
              <div
                key={`${e.str}-${i}`}
                title={e.str}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${s.leftPct}%`,
                  width: `${s.widthPct}%`,
                  background: "var(--kc-text-tertiary)",
                  opacity: 0.5,
                  borderRight: "1px solid var(--kc-container)",
                  borderLeft: "1px solid var(--kc-container)",
                }}
              />
            );
          })}
        {parentCidr && newSeg && newSeg.widthPct > 0 && (
          <div
            title={newCidrStr ?? undefined}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${newSeg.leftPct}%`,
              width: `${newSeg.widthPct}%`,
              background: newIsBad ? token.colorError : "var(--kc-primary)",
              transition: "left .25s ease, width .25s ease, background .2s ease",
              boxShadow: "0 0 0 1px var(--kc-container)",
            }}
          />
        )}
        {/* Новая подсеть вне диапазона — линейка пуста по позиции; индикатор-кромка */}
        {parentCidr && newCidr && outOfRange && (!newSeg || newSeg.widthPct <= 0) && (
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              width: 4,
              background: token.colorError,
            }}
          />
        )}
      </div>

      {/* Подписи: сеть слева, новая подсеть со стрелкой под позицией */}
      <div style={{ position: "relative", height: 16 }}>
        <Typography.Text
          style={{ position: "absolute", left: 0, top: 0, fontFamily: "monospace", fontSize: 11, color: "var(--kc-text-tertiary)" }}
        >
          {parentCidrStr ?? "сеть не выбрана"}
        </Typography.Text>
        {newSeg && newSeg.widthPct > 0 && newCidrStr && (
          <Typography.Text
            style={{
              position: "absolute",
              top: 0,
              left: `${Math.min(70, newSeg.leftPct)}%`,
              fontFamily: "monospace",
              fontSize: 11,
              color: newIsBad ? token.colorError : "var(--kc-primary)",
              whiteSpace: "nowrap",
              transition: "left .25s ease",
            }}
          >
            ↑ {newCidrStr}
          </Typography.Text>
        )}
      </div>

      {/* Новая подсеть-строка fallback (если по позиции не влезла) */}
      {newCidrStr && (!newSeg || newSeg.widthPct <= 0) && (
        <Typography.Text style={{ fontFamily: "monospace", fontSize: 11, color: newIsBad ? token.colorError : "var(--kc-primary)" }}>
          новая: {newCidrStr}
        </Typography.Text>
      )}

      {/* Статус-валидация */}
      <Typography.Text style={{ fontSize: 12.5, color: status.color }}>{status.text}</Typography.Text>
    </div>
  );
}

// ── Точка входа ───────────────────────────────────────────────────────────────

export function FormArchitecturePanel({ spec, obj }: Props) {
  if (spec.id === "subnets") {
    return (
      <PanelShell title="Архитектура">
        <SubnetRuler obj={obj} />
      </PanelShell>
    );
  }
  if (spec.id === "networks") {
    return (
      <PanelShell title="Архитектура">
        <NetworkNode obj={obj} />
      </PanelShell>
    );
  }
  return (
    <PanelShell title="План">
      <PlanList spec={spec} obj={obj} />
    </PanelShell>
  );
}
