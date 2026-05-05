// Regression-guard: case.ts должен трансформировать только КЛЮЧИ объектов.
// Значения-строки нетронутыми. Эта инвариантность — основа FieldMask-fix:
// мы посылаем `update_mask: "name,routeTableId"` (строка-значение), и она
// должна дойти до backend как есть, иначе protojson не распарсит FieldMask.

import { describe, it, expect } from "vitest";
import { snakeToCamel, camelToSnake } from "./case";

describe("snakeToCamel — keys only, not values", () => {
  it("renames keys snake → camel", () => {
    expect(snakeToCamel({ route_table_id: "X" })).toEqual({ routeTableId: "X" });
  });

  it("never mangles string values", () => {
    // Регрессия: если б snakeToCamel трогал значения, FieldMask-string поломался.
    expect(snakeToCamel({ update_mask: "name,route_table_id" }))
      .toEqual({ updateMask: "name,route_table_id" });
    expect(snakeToCamel({ k: "snake_case_inside_string" }))
      .toEqual({ k: "snake_case_inside_string" });
  });

  it("recurses through nested objects and arrays", () => {
    expect(
      snakeToCamel({ outer_field: { inner_field: 1, list: [{ nested_key: 2 }] } }),
    ).toEqual({ outerField: { innerField: 1, list: [{ nestedKey: 2 }] } });
  });

  it("does not transform array element strings", () => {
    expect(snakeToCamel({ paths: ["route_table_id", "v4_cidr_blocks"] }))
      .toEqual({ paths: ["route_table_id", "v4_cidr_blocks"] });
  });

  it("preserves opaque fields (labels) — keys внутри labels = user-defined", () => {
    expect(
      snakeToCamel({ labels: { team_lead: "alice", env_prod: "true" } }),
    ).toEqual({ labels: { team_lead: "alice", env_prod: "true" } });
  });

  it("preserves @-tagged keys (Any-tag)", () => {
    expect(snakeToCamel({ "@type": "x", some_field: 1 }))
      .toEqual({ "@type": "x", someField: 1 });
  });
});

describe("camelToSnake — symmetric, keys only", () => {
  it("renames keys camel → snake", () => {
    expect(camelToSnake({ routeTableId: "X" })).toEqual({ route_table_id: "X" });
  });

  it("does not touch string values", () => {
    expect(camelToSnake({ updateMask: "name,routeTableId" }))
      .toEqual({ update_mask: "name,routeTableId" });
  });

  it("preserves @-tagged keys", () => {
    expect(camelToSnake({ "@type": "x", someField: 1 }))
      .toEqual({ "@type": "x", some_field: 1 });
  });
});
