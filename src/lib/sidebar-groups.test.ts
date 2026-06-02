// KAC-246: построение групп расширенного сайдбара.

import { describe, it, expect } from "vitest";
import { buildSidebarGroups, activeLeafKey, flattenGroups } from "./sidebar-groups";

describe("buildSidebarGroups", () => {
  it("дашборд (вне модуля) → Обзор + Сервисы(лаунчеры) + Система", () => {
    const groups = buildSidebarGroups("/dashboard", "p1", "a1");
    const keys = groups.map((g) => g.key);
    expect(keys).toContain("overview");
    expect(keys).toContain("services");
    expect(keys).toContain("system");

    const services = groups.find((g) => g.key === "services")!;
    // лаунчеры на каждый модуль (vpc/compute/nlb/iam)
    expect(services.leaves.length).toBeGreaterThanOrEqual(4);
    expect(services.leaves.every((l) => l.key.startsWith("mod-"))).toBe(true);
  });

  it("внутри VPC-модуля → группа VPC с его items (не лаунчеры)", () => {
    const groups = buildSidebarGroups("/projects/p1/vpc/networks", "p1", "a1");
    const vpc = groups.find((g) => g.key === "vpc");
    expect(vpc).toBeTruthy();
    expect(vpc!.title).toBe("VPC");
    expect(vpc!.leaves.some((l) => l.key === "networks")).toBe(true);
    // не должно быть группы лаунчеров
    expect(groups.find((g) => g.key === "services")).toBeUndefined();
  });

  it("внутри IAM → группа IAM (iam не требует project)", () => {
    const groups = buildSidebarGroups("/iam/accounts", null, null);
    const iam = groups.find((g) => g.key === "iam");
    expect(iam).toBeTruthy();
    expect(iam!.leaves.some((l) => l.key === "iam-accounts")).toBe(true);
  });

  it("пустой bottomItems → нет группы Система", () => {
    const groups = buildSidebarGroups("/dashboard", "p1", "a1", []);
    expect(groups.find((g) => g.key === "system")).toBeUndefined();
  });

  it("каждая группа имеет заголовок-title", () => {
    const groups = buildSidebarGroups("/projects/p1/compute/instances", "p1", "a1");
    expect(groups.every((g) => g.title.length > 0)).toBe(true);
  });
});

describe("activeLeafKey / flattenGroups", () => {
  it("резолвит active по pathname", () => {
    const groups = buildSidebarGroups("/projects/p1/vpc/subnets", "p1", "a1");
    expect(activeLeafKey(groups, "/projects/p1/vpc/subnets")).toBe("subnets");
  });

  it("flattenGroups собирает все leaves", () => {
    const groups = buildSidebarGroups("/dashboard", "p1", "a1");
    const flat = flattenGroups(groups);
    expect(flat.length).toBe(groups.reduce((n, g) => n + g.leaves.length, 0));
  });

  it("нет матча → null", () => {
    const groups = buildSidebarGroups("/dashboard", "p1", "a1");
    expect(activeLeafKey(groups, "/totally/unknown")).toBeNull();
  });
});
