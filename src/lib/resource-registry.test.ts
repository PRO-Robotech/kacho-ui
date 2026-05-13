// Тесты для sanitize VPC SecurityGroupRule.
// Регрессия: SgRulesEditor хранит UI-only дискриминаторы (_protocol_mode,
// _ports_any, _target_kind), и неактивные ветки oneof-target. Они НЕ должны
// уходить на backend — proto-shape ожидает чистый Rule.

import { describe, it, expect } from "vitest";
import { sanitizeSgRule } from "./resource-registry";

describe("sanitizeSgRule", () => {
  it("strips _-prefixed UI discriminators", () => {
    const out = sanitizeSgRule({
      _protocol_mode: "name",
      _ports_any: false,
      _target_kind: "cidr",
      direction: "INGRESS",
      protocol_name: "tcp",
      ports: { from_port: 80, to_port: 80 },
      cidr_blocks: { v4_cidr_blocks: ["10.0.0.0/8"] },
    });
    expect(out).not.toHaveProperty("_protocol_mode");
    expect(out).not.toHaveProperty("_ports_any");
    expect(out).not.toHaveProperty("_target_kind");
  });

  it("protocol=any → drops both protocol_name and protocol_number", () => {
    const out = sanitizeSgRule({
      _protocol_mode: "any",
      protocol_name: "tcp",     // stale value — should be cleared
      protocol_number: 6,        // stale value — should be cleared
      direction: "EGRESS",
    });
    expect(out).not.toHaveProperty("protocol_name");
    expect(out).not.toHaveProperty("protocol_number");
    expect(out.direction).toBe("EGRESS");
  });

  it("protocol=name → keeps name, drops number", () => {
    const out = sanitizeSgRule({
      _protocol_mode: "name",
      protocol_name: "tcp",
      protocol_number: 99,  // stale
    });
    expect(out.protocol_name).toBe("tcp");
    expect(out).not.toHaveProperty("protocol_number");
  });

  it("protocol=number → keeps number, drops name", () => {
    const out = sanitizeSgRule({
      _protocol_mode: "number",
      protocol_name: "tcp",  // stale
      protocol_number: 17,
    });
    expect(out.protocol_number).toBe(17);
    expect(out).not.toHaveProperty("protocol_name");
  });

  it("ports any → drops ports field even if it has stale data", () => {
    const out = sanitizeSgRule({
      _ports_any: true,
      ports: { from_port: 22, to_port: 22 },  // stale
    });
    expect(out).not.toHaveProperty("ports");
  });

  it("ports !any → keeps ports", () => {
    const out = sanitizeSgRule({
      _ports_any: false,
      ports: { from_port: 22, to_port: 22 },
    });
    expect(out.ports).toEqual({ from_port: 22, to_port: 22 });
  });

  it("target=cidr → keeps cidr_blocks, drops sg/predefined", () => {
    const out = sanitizeSgRule({
      _target_kind: "cidr",
      cidr_blocks: { v4_cidr_blocks: ["0.0.0.0/0"] },
      security_group_id: "stale-sg",
      predefined_target: "stale_pred",
    });
    expect(out.cidr_blocks).toEqual({ v4_cidr_blocks: ["0.0.0.0/0"] });
    expect(out).not.toHaveProperty("security_group_id");
    expect(out).not.toHaveProperty("predefined_target");
  });

  it("target=sg → keeps security_group_id, drops cidr/predefined", () => {
    const out = sanitizeSgRule({
      _target_kind: "sg",
      cidr_blocks: { v4_cidr_blocks: ["10.0.0.0/8"] },
      security_group_id: "SG-2",
      predefined_target: "stale",
    });
    expect(out.security_group_id).toBe("SG-2");
    expect(out).not.toHaveProperty("cidr_blocks");
    expect(out).not.toHaveProperty("predefined_target");
  });

  it("target=predefined → keeps predefined_target, drops others", () => {
    const out = sanitizeSgRule({
      _target_kind: "predefined",
      cidr_blocks: { v4_cidr_blocks: ["x"] },
      security_group_id: "SG-x",
      predefined_target: "self_security_group",
    });
    expect(out.predefined_target).toBe("self_security_group");
    expect(out).not.toHaveProperty("cidr_blocks");
    expect(out).not.toHaveProperty("security_group_id");
  });

  it("infers discriminators when missing (backend payload без _flags)", () => {
    // Сценарий: open Edit SG → editor получил rule из API без UI-метаданных.
    // Sanitize должен корректно вывести oneof по присутствующему полю.
    const out = sanitizeSgRule({
      direction: "INGRESS",
      protocol_name: "tcp",       // → mode=name
      ports: { from_port: 0, to_port: 65535 },  // → ports !any
      security_group_id: "SG-other",  // → target=sg
    });
    expect(out.direction).toBe("INGRESS");
    expect(out.protocol_name).toBe("tcp");
    expect(out).not.toHaveProperty("protocol_number");
    expect(out.ports).toEqual({ from_port: 0, to_port: 65535 });
    expect(out.security_group_id).toBe("SG-other");
    expect(out).not.toHaveProperty("cidr_blocks");
    expect(out).not.toHaveProperty("predefined_target");
  });

  it("preserves unrelated fields (id, description, labels)", () => {
    const out = sanitizeSgRule({
      id: "rule-1",
      description: "Allow HTTPS from anywhere",
      labels: { tier: "edge" },
      direction: "INGRESS",
      _target_kind: "cidr",
      cidr_blocks: { v4_cidr_blocks: ["0.0.0.0/0"] },
    });
    expect(out.id).toBe("rule-1");
    expect(out.description).toBe("Allow HTTPS from anywhere");
    expect(out.labels).toEqual({ tier: "edge" });
  });
});

import { sanitizeInstanceCreate } from "./resource-registry";

describe("sanitizeInstanceCreate — network_interface_specs", () => {
  const base = {
    folder_id: "f1",
    name: "vm-1",
    zone_id: "ru-1-a",
    platform_id: "standard-v3",
    resources_spec: { cores: 2, memory_gib: 2, core_fraction: "100" },
    _boot_source: "image" as const,
    boot_disk_spec: { auto_delete: true, disk_spec: { image_id: "img-1", size_gib: 10, type_id: "" } },
  };

  it("with-address: emits {subnet_id, primary_v4_address_spec.address}", () => {
    const out = sanitizeInstanceCreate({
      ...base,
      network_interface_specs: [{
        _addr_cascader: ["net-1", "sub-1", "addr-1"],
        subnet_id: "sub-1",
        primary_v4_address_spec: { address: "10.0.0.5" },
        _ext_mode: "none",
        _use_existing_nic: false,
        nic_id: "",
        security_group_ids: [{ value: "sg-1" }],
      }],
    });
    expect(out.network_interface_specs).toEqual([
      { subnet_id: "sub-1", security_group_ids: ["sg-1"], primary_v4_address_spec: { address: "10.0.0.5" } },
    ]);
  });

  it("no-address: emits just {subnet_id}", () => {
    const out = sanitizeInstanceCreate({
      ...base,
      network_interface_specs: [{
        _addr_cascader: ["net-1", "sub-1", "__noaddr__:sub-1"],
        subnet_id: "sub-1",
        primary_v4_address_spec: { address: "" },
        _ext_mode: "none",
        _use_existing_nic: false,
        nic_id: "",
        security_group_ids: [],
      }],
    });
    expect(out.network_interface_specs).toEqual([{ subnet_id: "sub-1" }]);
  });

  it("external auto: adds one_to_one_nat_spec {ip_version:'IPV4'}", () => {
    const out = sanitizeInstanceCreate({
      ...base,
      network_interface_specs: [{
        subnet_id: "sub-1",
        primary_v4_address_spec: { address: "10.0.0.5" },
        _ext_mode: "auto",
        _use_existing_nic: false,
        nic_id: "",
        security_group_ids: [],
      }],
    });
    expect(out.network_interface_specs).toEqual([
      { subnet_id: "sub-1", primary_v4_address_spec: { address: "10.0.0.5", one_to_one_nat_spec: { ip_version: "IPV4" } } },
    ]);
  });

  it("external list: passes the external IP value into one_to_one_nat_spec.address", () => {
    const out = sanitizeInstanceCreate({
      ...base,
      network_interface_specs: [{
        subnet_id: "sub-1",
        primary_v4_address_spec: { address: "" },
        _ext_mode: "list",
        _ext_addr_id: "addr-ext-1",
        _ext_addr_value: "203.0.113.10",
        _use_existing_nic: false,
        nic_id: "",
        security_group_ids: [],
      }],
    });
    expect(out.network_interface_specs).toEqual([
      { subnet_id: "sub-1", primary_v4_address_spec: { one_to_one_nat_spec: { address: "203.0.113.10" } } },
    ]);
  });

  it("existing nic_id: emits only {nic_id} (+ sg if any), ignores subnet/address", () => {
    const out = sanitizeInstanceCreate({
      ...base,
      network_interface_specs: [{
        _addr_cascader: ["net-1", "sub-1", "addr-1"],
        subnet_id: "sub-1",
        primary_v4_address_spec: { address: "10.0.0.5" },
        _ext_mode: "auto",
        _use_existing_nic: true,
        nic_id: "nic-1",
        security_group_ids: [{ value: "sg-1" }],
      }],
    });
    expect(out.network_interface_specs).toEqual([{ nic_id: "nic-1", security_group_ids: ["sg-1"] }]);
  });

  it("strips all _-prefixed UI keys from the emitted spec", () => {
    const out = sanitizeInstanceCreate({
      ...base,
      network_interface_specs: [{
        _addr_cascader: ["net-1", "sub-1", "addr-1"],
        subnet_id: "sub-1",
        primary_v4_address_spec: { address: "10.0.0.5" },
        _ext_mode: "auto",
        _use_existing_nic: false,
        nic_id: "",
        security_group_ids: [],
      }],
    });
    const spec = (out.network_interface_specs as Record<string, unknown>[])[0];
    for (const k of Object.keys(spec)) expect(k.startsWith("_")).toBe(false);
  });
});
