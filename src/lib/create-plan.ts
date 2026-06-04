// create-plan — модель «Create with Live Plan» (KAC-246). Прежде чем создать
// ресурс, форма показывает, ЧТО именно будет создано (сам ресурс + известные
// побочные эффекты), обновляя план по мере ввода. Чистая логика — без React.
import type { ResourceSpec } from "@/lib/resource-registry";

export interface PlanItem {
  /** primary — сам ресурс; side-effect — что создаст backend вместе с ним. */
  kind: "primary" | "side-effect";
  /** specId для иконки (ключ REGISTRY). */
  specId: string;
  label: string;
}

export interface CreatePlan {
  items: PlanItem[];
  count: number;
}

const NO_NAME = "(без имени)";

// Известные побочные эффекты создания, по spec.id. Расширяемо: добавляем запись,
// когда backend создаёт что-то вместе с primary-ресурсом.
const SIDE_EFFECTS: Record<string, PlanItem[]> = {
  // KAC-246: Network.Create всегда создаёт default-SG (inline в kacho-vpc
  // network.go::doCreate при KACHO_VPC_DEFAULT_SG_INLINE=true, default).
  networks: [
    { kind: "side-effect", specId: "security-groups", label: "Группа безопасности по умолчанию" },
  ],
};

function nameLabel(obj: Record<string, unknown>): string {
  const raw = obj.name;
  if (typeof raw !== "string") return NO_NAME;
  const trimmed = raw.trim();
  return trimmed === "" ? NO_NAME : trimmed;
}

export function createPlan(spec: ResourceSpec, obj: Record<string, unknown>): CreatePlan {
  const primary: PlanItem = { kind: "primary", specId: spec.id, label: nameLabel(obj) };
  const items = [primary, ...(SIDE_EFFECTS[spec.id] ?? [])];
  return { items, count: items.length };
}

/** Submit-label для create-формы: «Создать <singular>», + « · N» когда план
 *  создаёт более одного ресурса (primary + побочные эффекты). */
export function createSubmitLabel(spec: ResourceSpec, obj: Record<string, unknown>): string {
  const base = `Создать ${spec.singular.toLowerCase()}`;
  const { count } = createPlan(spec, obj);
  return count > 1 ? `${base} · ${count}` : base;
}
