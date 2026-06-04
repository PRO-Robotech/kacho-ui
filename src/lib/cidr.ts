// cidr — чистая CIDR-математика (IPv4) для «живого» холста формы создания
// (KAC-246, FormArchitecturePanel). Без React. Домен — uint32 (base/size).
//
// Все функции тотальны и безопасны: невалидный ввод → null (не бросают).
// Логику покрывает cidr.test.ts; визуальную панель — не покрываем.

export interface Cidr4 {
  /** Стартовый адрес диапазона в uint32-домене (выровнен по prefix). */
  base: number;
  /** Длина маски 0..32. */
  prefix: number;
  /** Размер диапазона = 2^(32-prefix). */
  size: number;
}

/** "10.0.1.0" → 167772416; невалид → null. */
export function ip4ToInt(ip: string): number | null {
  if (typeof ip !== "string") return null;
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let acc = 0;
  for (const p of parts) {
    // Строго цифры (без знака, без пробелов, без пустоты).
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    acc = acc * 256 + n;
  }
  // >>> 0 → беззнаковый uint32.
  return acc >>> 0;
}

/** 167772416 → "10.0.1.0". */
export function int4ToIp(n: number): string {
  const u = n >>> 0;
  return [(u >>> 24) & 0xff, (u >>> 16) & 0xff, (u >>> 8) & 0xff, u & 0xff].join(
    ".",
  );
}

/**
 * "10.0.1.0/24" → {base, prefix:24, size:256}; невалид → null.
 * Отклоняет выставленные host-биты (база должна быть выровнена по prefix).
 */
export function parseCidr4(s: string): Cidr4 | null {
  if (typeof s !== "string") return null;
  const slash = s.indexOf("/");
  if (slash < 0) return null;
  const ipPart = s.slice(0, slash);
  const prefixPart = s.slice(slash + 1);
  if (!/^\d{1,2}$/.test(prefixPart)) return null;
  const prefix = Number(prefixPart);
  if (prefix < 0 || prefix > 32) return null;
  const base = ip4ToInt(ipPart);
  if (base === null) return null;
  const size = 2 ** (32 - prefix);
  // host-bits: маска младших (32-prefix) бит должна быть нулевой.
  // mask = size-1 (для prefix=0 → size=2^32, маска = всё → base обязан быть 0).
  if (prefix === 0) {
    if (base !== 0) return null;
  } else {
    const hostMask = size - 1;
    if ((base & hostMask) !== 0) return null;
  }
  return { base, prefix, size };
}

/** Полуинтервалы [a.base, a.base+a.size) ∩ [b…) ≠ ∅. Касание границами → false. */
export function overlaps(a: Cidr4, b: Cidr4): boolean {
  const aEnd = a.base + a.size;
  const bEnd = b.base + b.size;
  return a.base < bEnd && b.base < aEnd;
}

/** child полностью внутри parent (включая равенство). */
export function contains(parent: Cidr4, child: Cidr4): boolean {
  return (
    child.base >= parent.base &&
    child.base + child.size <= parent.base + parent.size
  );
}

/**
 * Позиция child внутри parent как доли 0..1 (для рендера сегмента на линейке).
 * Не предполагает contains — вызывающий код сам клампит/решает, что делать,
 * если сегмент вылез за пределы (overlap/вне диапазона подсвечивается красным).
 */
export function relativePos(
  parent: Cidr4,
  child: Cidr4,
): { left: number; width: number } {
  if (parent.size <= 0) return { left: 0, width: 0 };
  const left = (child.base - parent.base) / parent.size;
  const width = child.size / parent.size;
  return { left, width };
}
