import { describe, it, expect } from "vitest";
import {
  parseCidr4,
  ip4ToInt,
  int4ToIp,
  overlaps,
  contains,
  relativePos,
} from "./cidr";

// KAC-246: чистая CIDR-математика (IPv4) для «живого» холста формы создания.
// Только логика — визуальную панель тестами не покрываем.

describe("ip4ToInt", () => {
  it("парсит валидный IPv4 в uint32", () => {
    expect(ip4ToInt("0.0.0.0")).toBe(0);
    expect(ip4ToInt("0.0.0.1")).toBe(1);
    expect(ip4ToInt("10.0.1.0")).toBe(10 * 2 ** 24 + 0 + 1 * 256 + 0);
    expect(ip4ToInt("255.255.255.255")).toBe(0xffffffff);
  });

  it("возвращает null для невалидного", () => {
    expect(ip4ToInt("")).toBeNull();
    expect(ip4ToInt("10.0.1")).toBeNull();
    expect(ip4ToInt("10.0.1.0.0")).toBeNull();
    expect(ip4ToInt("256.0.0.1")).toBeNull();
    expect(ip4ToInt("10.0.-1.0")).toBeNull();
    expect(ip4ToInt("a.b.c.d")).toBeNull();
    expect(ip4ToInt("10.0.1.0/24")).toBeNull();
  });
});

describe("int4ToIp", () => {
  it("обратная к ip4ToInt", () => {
    expect(int4ToIp(0)).toBe("0.0.0.0");
    expect(int4ToIp(1)).toBe("0.0.0.1");
    expect(int4ToIp(0xffffffff)).toBe("255.255.255.255");
    expect(int4ToIp(ip4ToInt("10.0.1.5")!)).toBe("10.0.1.5");
  });
});

describe("parseCidr4", () => {
  it("парсит валидный CIDR с выровненной базой", () => {
    expect(parseCidr4("10.0.1.0/24")).toEqual({
      base: ip4ToInt("10.0.1.0"),
      prefix: 24,
      size: 256,
    });
    expect(parseCidr4("0.0.0.0/0")).toEqual({
      base: 0,
      prefix: 0,
      size: 2 ** 32,
    });
    expect(parseCidr4("10.0.0.0/16")).toEqual({
      base: ip4ToInt("10.0.0.0"),
      prefix: 16,
      size: 65536,
    });
    expect(parseCidr4("192.168.1.42/32")).toEqual({
      base: ip4ToInt("192.168.1.42"),
      prefix: 32,
      size: 1,
    });
  });

  it("возвращает null для невалидного формата", () => {
    expect(parseCidr4("")).toBeNull();
    expect(parseCidr4("10.0.1.0")).toBeNull(); // нет префикса
    expect(parseCidr4("10.0.1.0/")).toBeNull();
    expect(parseCidr4("10.0.1.0/33")).toBeNull(); // префикс вне диапазона
    expect(parseCidr4("10.0.1.0/-1")).toBeNull();
    expect(parseCidr4("256.0.0.0/24")).toBeNull();
    expect(parseCidr4("10.0.1.0/aa")).toBeNull();
  });

  it("возвращает null при выставленных host-битах (невыровненная база)", () => {
    expect(parseCidr4("10.0.1.1/24")).toBeNull();
    expect(parseCidr4("10.0.0.0/15")).not.toBeNull();
    expect(parseCidr4("10.0.1.0/15")).toBeNull();
  });
});

describe("overlaps", () => {
  it("пересекающиеся диапазоны → true", () => {
    const a = parseCidr4("10.0.0.0/16")!;
    const b = parseCidr4("10.0.1.0/24")!; // внутри a
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(b, a)).toBe(true);
  });

  it("идентичные → true", () => {
    const a = parseCidr4("10.0.1.0/24")!;
    expect(overlaps(a, a)).toBe(true);
  });

  it("непересекающиеся → false", () => {
    const a = parseCidr4("10.0.1.0/24")!;
    const b = parseCidr4("10.0.2.0/24")!;
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(b, a)).toBe(false);
  });

  it("касание границами (смежные) → false", () => {
    const a = parseCidr4("10.0.1.0/24")!; // .0 .. .255
    const b = parseCidr4("10.0.2.0/24")!; // .0(256) .. — смежно, без пересечения
    expect(overlaps(a, b)).toBe(false);
  });
});

describe("contains", () => {
  it("child полностью внутри parent → true", () => {
    const parent = parseCidr4("10.0.0.0/16")!;
    const child = parseCidr4("10.0.1.0/24")!;
    expect(contains(parent, child)).toBe(true);
  });

  it("равный диапазон → true", () => {
    const p = parseCidr4("10.0.1.0/24")!;
    expect(contains(p, p)).toBe(true);
  });

  it("child вне parent → false", () => {
    const parent = parseCidr4("10.0.0.0/16")!;
    const child = parseCidr4("10.1.0.0/24")!;
    expect(contains(parent, child)).toBe(false);
  });

  it("частичное пересечение (не contains) → false", () => {
    const parent = parseCidr4("10.0.0.0/24")!; // .0 .. .255
    const child = parseCidr4("10.0.0.128/25")!; // внутри — true
    expect(contains(parent, child)).toBe(true);
    // child шире parent
    const wider = parseCidr4("10.0.0.0/23")!;
    expect(contains(parent, wider)).toBe(false);
  });
});

describe("relativePos", () => {
  it("child в начале parent", () => {
    const parent = parseCidr4("10.0.0.0/16")!;
    const child = parseCidr4("10.0.0.0/24")!;
    const pos = relativePos(parent, child);
    expect(pos.left).toBeCloseTo(0, 6);
    expect(pos.width).toBeCloseTo(256 / 65536, 6);
  });

  it("child в середине parent", () => {
    const parent = parseCidr4("10.0.0.0/16")!; // 65536 адресов
    const child = parseCidr4("10.0.128.0/24")!; // base offset = 128*256 = 32768
    const pos = relativePos(parent, child);
    expect(pos.left).toBeCloseTo(32768 / 65536, 6);
    expect(pos.width).toBeCloseTo(256 / 65536, 6);
  });

  it("child = весь parent → left 0, width 1", () => {
    const parent = parseCidr4("10.0.0.0/16")!;
    const pos = relativePos(parent, parent);
    expect(pos.left).toBeCloseTo(0, 6);
    expect(pos.width).toBeCloseTo(1, 6);
  });

  it("child в самом конце parent", () => {
    const parent = parseCidr4("10.0.0.0/16")!;
    const child = parseCidr4("10.0.255.0/24")!; // последний /24
    const pos = relativePos(parent, child);
    expect(pos.left).toBeCloseTo((65536 - 256) / 65536, 6);
    expect(pos.left + pos.width).toBeCloseTo(1, 6);
  });
});
