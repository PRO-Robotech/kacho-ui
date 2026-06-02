import { describe, it, expect } from "vitest";
import { reorderNameIdFirst } from "./spec-columns";
import type { ResourceColumn } from "./resource-registry";

// KAC-245: во всех таблицах первые две колонки по умолчанию — Name, затем ID.
const col = (header: string, path: string): ResourceColumn => ({ header, path, format: "text" });

describe("reorderNameIdFirst (KAC-245)", () => {
  it("ставит name первой, id второй когда id был в конце (IAM/security-groups)", () => {
    const input = [col("Name", "name"), col("Owner", "owner"), col("Created", "created_at"), col("ID", "id")];
    expect(reorderNameIdFirst(input).map((c) => c.path)).toEqual(["name", "id", "owner", "created_at"]);
  });

  it("идемпотентно когда name+id уже первые две (VPC/compute)", () => {
    const input = [col("Имя", "name"), col("Идентификатор", "id"), col("Описание", "description")];
    expect(reorderNameIdFirst(input).map((c) => c.path)).toEqual(["name", "id", "description"]);
  });

  it("ставит name перед id когда id шёл первым (regions/zones)", () => {
    const input = [col("ID", "id"), col("Region", "region_id"), col("Name", "name")];
    expect(reorderNameIdFirst(input).map((c) => c.path)).toEqual(["name", "id", "region_id"]);
  });

  it("оставляет id первым если name-колонки нет (disk-types/compute-zones)", () => {
    const input = [col("ID", "id"), col("Description", "description")];
    expect(reorderNameIdFirst(input).map((c) => c.path)).toEqual(["id", "description"]);
  });

  it("сохраняет тот же объект колонки (кастомный render не теряется)", () => {
    const nameC: ResourceColumn = { header: "Имя", path: "name", render: () => null };
    const out = reorderNameIdFirst([col("X", "x"), nameC]);
    expect(out[0]).toBe(nameC);
  });

  it("без name/id возвращает массив как есть", () => {
    const input = [col("A", "a"), col("B", "b")];
    expect(reorderNameIdFirst(input)).toEqual(input);
  });
});
