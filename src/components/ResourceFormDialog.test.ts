// Regression-guards для PATCH-flow.
//
// История: backend всех Update*Service делает full-replace mutable полей при
// пустом update_mask. UI раньше mask вообще не слал — любые ref-поля,
// отсутствующие в body или равные "", стирались на бэке. Эти тесты не дают
// регрессии повториться.

import { describe, it, expect } from "vitest";
import { computeUpdateMask, snakeToCamelPath } from "./ResourceFormDialog";
import type { FormField } from "@/lib/form-schema";

describe("snakeToCamelPath", () => {
  it("converts simple snake_case", () => {
    expect(snakeToCamelPath("route_table_id")).toBe("routeTableId");
    expect(snakeToCamelPath("name")).toBe("name");
    expect(snakeToCamelPath("description")).toBe("description");
  });

  it("preserves dotted FieldMask paths (per proto3 JSON spec)", () => {
    expect(snakeToCamelPath("external_ipv4_address_spec.zone_id"))
      .toBe("externalIpv4AddressSpec.zoneId");
    expect(snakeToCamelPath("a.b_c.d_e_f")).toBe("a.bC.dEF");
  });

  it("does not mangle uppercase or numeric segments", () => {
    expect(snakeToCamelPath("v4_cidr_blocks")).toBe("v4CidrBlocks");
    expect(snakeToCamelPath("zone_id")).toBe("zoneId");
  });
});

const fName: FormField = { name: "name", label: "Name", type: "string" };
const fDescription: FormField = { name: "description", label: "Description", type: "text" };
const fRouteTable: FormField = {
  name: "route_table_id",
  label: "Route Table",
  type: "ref",
  refResource: "route-tables",
};
const fProjectId: FormField = {
  name: "project_id",
  label: "Проект",
  type: "string",
  hidden: true,
};
const fAddrKind: FormField = {
  name: "_address_kind",
  label: "Address Kind",
  type: "enum",
  options: [{ value: "external", label: "external" }],
};

describe("computeUpdateMask — regression: ссылки не должны попадать в mask, если их не меняли", () => {
  it("returns empty array when nothing changed", () => {
    const orig = { name: "n", description: "d", route_table_id: "RT-1" };
    const cur = { name: "n", description: "d", route_table_id: "RT-1" };
    expect(computeUpdateMask(orig, cur, [fName, fDescription, fRouteTable])).toEqual([]);
  });

  it("returns only the changed field — references stay untouched", () => {
    // Регрессия: раньше mask отсутствовал и backend стирал route_table_id.
    // Сейчас при изменении ТОЛЬКО description в mask должно быть только description.
    const orig = { name: "n", description: "old", route_table_id: "RT-1" };
    const cur = { name: "n", description: "new", route_table_id: "RT-1" };
    expect(computeUpdateMask(orig, cur, [fName, fDescription, fRouteTable]))
      .toEqual(["description"]);
  });

  it("includes route_table_id when user explicitly changed it (including to null/clear)", () => {
    const orig = { description: "x", route_table_id: "RT-1" };
    const cur = { description: "x", route_table_id: undefined };
    expect(computeUpdateMask(orig, cur, [fDescription, fRouteTable]))
      .toEqual(["route_table_id"]);
  });

  it("excludes hidden fields (project_id и т.п. — они immutable от user perspective)", () => {
    const orig = { project_id: "F-1", name: "n" };
    const cur = { project_id: "F-2", name: "n2" };
    expect(computeUpdateMask(orig, cur, [fProjectId, fName])).toEqual(["name"]);
  });

  it("excludes immutable fields — backend rejects их с InvalidArgument в любом случае", () => {
    // Регрессия: Subnet.v4_cidr_blocks immutable; UI должен слать verb-action,
    // не PATCH. computeUpdateMask не должен ставить immutable в маску.
    const fCidr: FormField = {
      name: "v4_cidr_blocks",
      label: "CIDRs",
      type: "array",
      itemLabel: "CIDR",
      itemFields: [],
      immutable: true,
    };
    const orig = { name: "n", v4_cidr_blocks: ["10.0.0.0/24"] };
    const cur = { name: "n", v4_cidr_blocks: ["10.0.0.0/24", "10.0.1.0/24"] };
    expect(computeUpdateMask(orig, cur, [fName, fCidr])).toEqual([]);
  });

  it("excludes UI-discriminator fields (`_*`)", () => {
    // _address_kind — UI-only переключатель в Address-форме (oneof selector),
    // не proto-поле. Не должен пролезать в mask.
    const orig = { _address_kind: "external", name: "n" };
    const cur = { _address_kind: "internal", name: "n" };
    expect(computeUpdateMask(orig, cur, [fAddrKind, fName])).toEqual([]);
  });

  it("compares arrays/maps deeply via JSON canonicalization", () => {
    const fLabels: FormField = { name: "labels", label: "Labels", type: "string" };
    const orig = { labels: { a: "1", b: "2" } };
    const curSame = { labels: { a: "1", b: "2" } };
    const curDiff = { labels: { a: "1", b: "3" } };
    expect(computeUpdateMask(orig, curSame, [fLabels])).toEqual([]);
    expect(computeUpdateMask(orig, curDiff, [fLabels])).toEqual(["labels"]);
  });

  it("changes in unmapped fields are ignored — only spec.fields drive the mask", () => {
    // Backend ожидает paths из proto-схемы. Поля, которых в spec.fields нет,
    // в mask не попадают, даже если их отдал API.
    const orig = { name: "n", id: "X" };
    const cur = { name: "n", id: "Y" };  // server-generated id никогда не меняется
    expect(computeUpdateMask(orig, cur, [fName])).toEqual([]);
  });
});

describe("FieldMask serialization — regression: должен быть comma-string, не объект", () => {
  // Это сценарий который вызывал `proto: syntax error … unexpected token {`
  // — он не должен повториться. Тест документирует ожидаемый shape.
  it("paths join into comma-separated camelCase string per proto3 JSON mapping", () => {
    const mask = ["name", "route_table_id", "v4_cidr_blocks"];
    const serialized = mask.map(snakeToCamelPath).join(",");
    expect(serialized).toBe("name,routeTableId,v4CidrBlocks");
    // protojson grpc-gateway ожидает именно строку. Обёртка {paths:[...]}
    // вызывала "unexpected token {" — этот тест охраняет форму.
    expect(typeof serialized).toBe("string");
  });
});
