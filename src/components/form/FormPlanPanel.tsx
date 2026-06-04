// FormPlanPanel — правая «живая» панель формы создания (KAC-246). Показывает,
// ЧТО именно будет создано (сам ресурс + известные побочные эффекты) и набор
// live-проверок по введённым полям, обновляясь по мере ввода. Эталон 2026-infra:
// Terraform-plan + live preview — «что произойдёт» до нажатия «Создать».
// Theme-aware (--kc-* + antd-token), стиль — как DependencyTreePanel (left-border,
// sticky top). Визуально не покрывается тестами; логика плана — create-plan.ts.
import { theme, Typography } from "antd";
import { CheckCircleFilled } from "@ant-design/icons";
import { ResourceIcon } from "@/components/form/ResourceIcon";
import { createPlan } from "@/lib/create-plan";
import { getByPath } from "@/lib/path";
import type { ResourceSpec } from "@/lib/resource-registry";

interface Props {
  spec: ResourceSpec;
  obj: Record<string, unknown>;
}

// Русское склонение «ресурс»: 1 → ресурс, 2-4 → ресурса, иначе → ресурсов
// (с учётом 11-14 → ресурсов).
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

/** Generic live-проверки: имя + (если у spec есть) выбранный network_id / subnet_id. */
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

export function FormPlanPanel({ spec, obj }: Props) {
  const { token } = theme.useToken();
  const plan = createPlan(spec, obj);
  const liveChecks = checks(spec, obj);

  return (
    <div
      style={{
        flexShrink: 0,
        width: 280,
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        borderLeft: "1px solid var(--kc-border-secondary)",
        paddingLeft: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <Typography.Text strong style={{ fontSize: 12, color: "var(--kc-text)" }}>
        План
      </Typography.Text>

      {/* Будет создано */}
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

      {/* Live-проверки */}
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

      {/* Счётчик */}
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
    </div>
  );
}
