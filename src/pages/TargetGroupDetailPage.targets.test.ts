// TargetGroupDetailPage target wire-shape helpers (KAC-230).
//
// Покрывает самую баг-опасную часть — маппинг формы → proto Target.oneof
// identity (instance_id / nic_id / ip_ref / external_ip) и обратное
// представление + identity-only payload для :removeTargets.

import { describe, it, expect } from "vitest";
import {
  buildTargetPayload,
  targetIdentity,
  targetIdentityOnly,
  type Target,
} from "./TargetGroupDetailPage";

describe("buildTargetPayload — oneof identity wire-shape (KAC-230)", () => {
  it("instance → {instance_id, weight}", () => {
    expect(buildTargetPayload("instance", { instanceId: "epd-1", weight: 5 })).toEqual({
      instance_id: "epd-1",
      weight: 5,
    });
  });

  it("nic → {nic_id, weight}", () => {
    expect(buildTargetPayload("nic", { nicId: "kni-1", weight: 1 })).toEqual({
      nic_id: "kni-1",
      weight: 1,
    });
  });

  it("ip_ref → {ip_ref:{subnet_id,address}, weight}", () => {
    expect(buildTargetPayload("ip_ref", { subnetId: "ens-1", ipAddr: "10.0.0.5", weight: 1 })).toEqual({
      ip_ref: { subnet_id: "ens-1", address: "10.0.0.5" },
      weight: 1,
    });
  });

  it("external_ip → {external_ip:{address,zone_id}, weight}", () => {
    expect(buildTargetPayload("external_ip", { extAddr: "203.0.113.10", zoneId: "ru-central1-a", weight: 1 })).toEqual({
      external_ip: { address: "203.0.113.10", zone_id: "ru-central1-a" },
      weight: 1,
    });
  });

  it("external_ip без zone → zone_id пустой", () => {
    expect(buildTargetPayload("external_ip", { extAddr: "203.0.113.10", weight: 1 })).toEqual({
      external_ip: { address: "203.0.113.10", zone_id: "" },
      weight: 1,
    });
  });

  it("weight по умолчанию = 1", () => {
    expect(buildTargetPayload("instance", { instanceId: "epd-1" })).toEqual({
      instance_id: "epd-1",
      weight: 1,
    });
  });

  it("неполные поля → null (submit заблокирован)", () => {
    expect(buildTargetPayload("instance", {})).toBeNull();
    expect(buildTargetPayload("nic", {})).toBeNull();
    expect(buildTargetPayload("ip_ref", { subnetId: "ens-1" })).toBeNull(); // нет address
    expect(buildTargetPayload("ip_ref", { ipAddr: "10.0.0.5" })).toBeNull(); // нет subnet
    expect(buildTargetPayload("external_ip", {})).toBeNull();
  });
});

describe("targetIdentity — отображение", () => {
  it("различает все 4 типа", () => {
    expect(targetIdentity({ instance_id: "epd-1" }).label).toBe("Instance");
    expect(targetIdentity({ nic_id: "kni-1" }).label).toBe("NIC");
    expect(targetIdentity({ ip_ref: { subnet_id: "ens-1", address: "10.0.0.5" } }).label).toBe("In-cloud IP");
    expect(targetIdentity({ external_ip: { address: "203.0.113.10" } }).label).toBe("External IP");
  });
});

describe("targetIdentityOnly — payload для removeTargets (без weight)", () => {
  it("оставляет только identity-форму", () => {
    const t: Target = { instance_id: "epd-1", weight: 7 };
    expect(targetIdentityOnly(t)).toEqual({ instance_id: "epd-1" });
    expect(targetIdentityOnly({ ip_ref: { subnet_id: "ens-1", address: "10.0.0.5" }, weight: 3 })).toEqual({
      ip_ref: { subnet_id: "ens-1", address: "10.0.0.5" },
    });
  });
});
