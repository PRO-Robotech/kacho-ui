import { describe, it, expect } from "vitest";
import { createPlan, createSubmitLabel } from "./create-plan";
import type { ResourceSpec } from "./resource-registry";

// KAC-246: модель «Create with Live Plan» — что именно будет создано + побочные
// эффекты. Тестируем только чистую логику плана (визуальную панель не покрываем).

function spec(id: string, singular = id): ResourceSpec {
  return {
    id,
    route: id,
    apiPath: `/x/v1/${id}`,
    payloadKey: id,
    singular,
    plural: id,
    scope: "project",
    ops: { create: true, update: true, delete: true },
    columns: [],
    template: () => ({}),
  } as ResourceSpec;
}

describe("createPlan (KAC-246)", () => {
  it("networks → 2 items: primary + default SG", () => {
    const plan = createPlan(spec("networks", "Сеть"), { name: "prod-net" });
    expect(plan.count).toBe(2);
    expect(plan.items).toHaveLength(2);

    const [primary, side] = plan.items;
    expect(primary.kind).toBe("primary");
    expect(primary.specId).toBe("networks");
    expect(primary.label).toBe("prod-net");

    expect(side.kind).toBe("side-effect");
    expect(side.specId).toBe("security-groups");
    expect(side.label).toBe("Группа безопасности по умолчанию");
  });

  it("subnets → 1 item (только primary, без side-effects)", () => {
    const plan = createPlan(spec("subnets", "Подсеть"), { name: "sub-a" });
    expect(plan.count).toBe(1);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({ kind: "primary", specId: "subnets", label: "sub-a" });
  });

  it("addresses → 1 item (только primary)", () => {
    const plan = createPlan(spec("addresses", "Адрес"), { name: "ip-1" });
    expect(plan.count).toBe(1);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].kind).toBe("primary");
    expect(plan.items[0].specId).toBe("addresses");
  });

  it("пустое имя → label '(без имени)'", () => {
    const plan = createPlan(spec("subnets"), {});
    expect(plan.items[0].label).toBe("(без имени)");
  });

  it("name не строка / пробелы → '(без имени)'", () => {
    expect(createPlan(spec("subnets"), { name: "   " }).items[0].label).toBe("(без имени)");
    expect(createPlan(spec("subnets"), { name: 123 }).items[0].label).toBe("(без имени)");
  });
});

describe("createSubmitLabel (KAC-246)", () => {
  it("count=1 → обычный «Создать <singular>»", () => {
    expect(createSubmitLabel(spec("subnets", "Подсеть"), { name: "s" })).toBe("Создать подсеть");
  });

  it("count>1 (networks → +default SG) → «Создать <singular> · N»", () => {
    expect(createSubmitLabel(spec("networks", "Сеть"), { name: "n" })).toBe("Создать сеть · 2");
  });
});
